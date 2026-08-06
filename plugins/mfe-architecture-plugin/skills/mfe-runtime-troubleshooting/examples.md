# MFE 런타임 트러블슈팅 — 사례집

`SKILL.md` 로 계열을 특정한 뒤, 판단이 애매하거나 확인 절차가 필요할 때 읽는다.
모두 rsbuild + `@module-federation/enhanced` 기반 Host 1 + Remote N 구성에서 나온 사례다.

---

## 사례 1 — "Provider 가 없다"는데 Provider 는 있다 (계열 B 가 C 로 위장)

**증상**: Remote 화면 진입 시 툴팁·토스트가 안 뜨고 콘솔에
`Cannot read properties of null (reading 'useContext')`.

**오진**: 노출 래퍼에 공용 템플릿 Provider 를 추가 → 변화 없음.

**실제 원인**: 해당 Remote 의 `shared` 에 `react-dom` 이 빠져 있었다. `react` 만 singleton
이라 `react-dom` 이 두 벌 로드됐고, 포털이 다른 React 트리에 붙어 Context 를 못 찾았다.

**확인 방법** — 브라우저 콘솔에서 React 인스턴스 개수 세기:

```js
// 페이지에 로드된 React 사본 수 (MF 런타임의 shared 스코프 확인)
Object.keys(__FEDERATION__?.__SHARE__ ?? {}).forEach((scope) => {
  const share = __FEDERATION__.__SHARE__[scope];
  for (const pkg of ["react", "react-dom"]) {
    const versions = Object.keys(share?.[pkg] ?? {});
    console.log(scope, pkg, versions);   // 버전이 2개 이상이면 중복
  }
});
```

**교훈**: `react` 와 `react-dom` 은 **항상 짝으로** singleton 선언한다. 하나만 선언하면
증상이 Provider 문제로 위장한다.

---

## 사례 2 — 재배포 직후에만 청크 404 (계열 F)

**증상**: Remote 를 배포한 직후 몇 분간, 이미 Host 를 열어둔 사용자에게만
`Failed to fetch dynamically imported module … /static/js/async/xxx.<hash>.js 404`.

**원인**: Host 가 이전 `mf-manifest.json` 을 메모리에 들고 있어 옛 해시 청크를 요청했다.

**대응**: `init({ plugins })` 에 manifest 재조회 플러그인을 둔다.

```ts
{
  name: "manifest-refresh-plugin",
  async errorLoadRemote({ id }) {
    const tried = retryTracker.get(id) ?? 0;
    if (tried >= 1) { retryTracker.delete(id); return; }   // ← 무한 루프 가드 (필수)
    const remote = remotes.find((r) => r.name === id.split("/")[0]);
    if (!remote) return;
    retryTracker.set(id, tried + 1);
    try { registerRemotes([remote], { force: true }); } catch { /* 캐시로 재시도 */ }
    const result = await loadRemote(id);
    retryTracker.delete(id);
    return result;
  },
}
```

**함정**: 가드(`retryTracker`)를 빼면 실패가 계속 `errorLoadRemote` 를 재호출해
탭이 멈춘다. 실제로 겪기 전에는 코드 리뷰에서 잘 안 보이는 결함이다.

**추가 조치**: nginx 에서 `mf-manifest.json` 은 `no-cache`, 해시 청크는 장기 캐시.

---

## 사례 3 — 대시보드 카드 하나가 죽으면 화면 전체가 에러 (폴백 입도)

**증상**: 대시보드의 차트 위젯 Remote 하나가 실패했을 뿐인데 페이지 전체가 에러 화면.

**원인**: `errorLoadRemote` 폴백이 모든 모듈에 전체 화면 에러 컴포넌트를 반환했다.

**대응**: 노출 모듈을 **페이지/위젯**으로 나누고 폴백을 다르게 준다.

```ts
const COMPONENT_MODULES = new Set([
  "Agent/AgentStateChart",
  "Agent/McpStateChart",
  "Model/LLMStateChart",
]);

errorLoadRemote({ id, error }) {
  if (id === "DocumentAI/UploadNotificationModule") throw error;  // 호출부가 자체 처리
  if (COMPONENT_MODULES.has(id)) return { default: () => <카드크기_에러박스 /> };
  console.error(`Failed to load remote module '${id}':`, error);  // ← 원인 로그 보존
  return { default: () => <전체화면_에러 /> };
}
```

**교훈**: 폴백을 다는 순간 원인 에러가 삼켜진다. `console.error` 를 반드시 남긴다.

---

## 사례 4 — Host 와 Remote 의 react-query 캐시가 따로 논다 (계열 D)

**증상**: Host 에서 갱신한 목록이 Remote 화면에서 옛 데이터로 보임. `invalidateQueries`
가 상대편에 안 먹음.

**원인 두 가지가 겹칠 수 있다**:
1. `@tanstack/react-query` 가 한쪽 `shared` 에서 `singleton` 이 빠져 라이브러리가 두 벌.
2. 라이브러리는 공유됐지만 **`QueryClient` 인스턴스**가 모듈마다 따로 생성됨.

**대응**: 양쪽 `shared` 에 `singleton: true` 로 맞추고, 노출 래퍼 안에 브리지를 렌더해
Context 의 클라이언트를 모듈 전역에 캡처한다.

```tsx
let _client: QueryClient | null = null;
export function getQueryClient() {
  if (!_client) throw new Error("QueryClient not initialized");
  return _client;
}
export function QueryClientBridge() {
  const client = useQueryClient();          // Provider 안에서만 유효
  useEffect(() => { _client = client; }, [client]);
  return null;
}
```

훅 밖(서비스·이벤트 핸들러)에서는 `getQueryClient()` 로 이 인스턴스를 쓴다.
`new QueryClient()` 를 그 자리에서 만들면 캐시가 또 갈린다.

**같은 함정, 다른 대상**: `zustand` 를 singleton 으로 공유해도 각 모듈이 자기 `create()`
를 호출하면 store 는 별개다. 진짜로 공유하려면 store 를 공용 패키지로 빼거나 전역
(`window`) 브리지를 쓴다.

---

## 사례 5 — Remote 단독 실행은 멀쩡한데 Host 를 통하면 스타일이 없다 (계열 E)

**증상**: `npm run dev` 로 Remote 를 직접 열면 정상, Host 메뉴로 들어가면 Tailwind 클래스가
전부 무시됨.

**원인**: CSS 엔트리를 `main.tsx`(단독 실행 진입점)에서만 import 했다. Host 경유 시에는
`src/export/<x>-comp.tsx` 만 로드되므로 그 경로를 안 탄다.

**대응**: 노출 파일(또는 그 Provider 래퍼)에서도 CSS 를 import 한다.

```tsx
import "@/assets/scss/tailwind.scss";   // 노출 래퍼에도 필요
```

**역방향 사고**: 여러 Remote 가 각자 Tailwind preflight 를 들고 오면 서로의 화면을 덮어쓴다.
노출 래퍼가 씌우는 모듈 루트 `div className={VITE_MODULE_NAME}` 을 스코프 앵커로 삼아
전역 셀렉터를 그 아래로 한정한다.

---

## 사례 6 — 이름 사슬 한 곳만 틀림 (계열 A)

**증상**: `loadRemote("Agent/McpManageComp")` 만 실패. 같은 Remote 의 다른 모듈은 정상.

**확인**: `exposes` 키가 `"./MCPManageComp"`(대문자 MCP)인데 호출은 `"Agent/McpManageComp"`
였다. 대소문자까지 정확히 같아야 한다.

**예방**: 노출 키는 Remote 계약 문서(`MFE_{RemoteName}` 스킬)에서 복사해 쓴다.
사람이 기억으로 타이핑하는 순간 이 사고가 난다.

---

## 사례 7 — `@module-federation/*` 버전 혼재

**증상**: 원인이 불분명한 shared 협상 실패, 간헐적 로드 실패, 타입 생성 실패.

**확인**:
```bash
grep -n "@module-federation" <각 모듈>/package.json
cat node_modules/@module-federation/rsbuild-plugin/package.json | grep -A5 '"dependencies"'
```

`enhanced`·`runtime`·`sdk` 를 `0.8.x` 로 직접 선언해 뒀는데 번들러 플러그인이 `0.11.x` 를
전이 의존으로 끌고 오는 상태였다. **직접 선언은 대개 옛 설정의 잔재다** — 플러그인의
전이 의존에 맡길 수 있으면 직접 선언을 지우고, 남긴다면 버전을 플러그인 요구에 맞춘다.
