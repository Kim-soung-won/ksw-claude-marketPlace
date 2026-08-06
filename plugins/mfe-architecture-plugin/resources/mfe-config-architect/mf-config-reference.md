# Module Federation 설정 참조 — 우리 팀 하우스 스타일

이 문서는 `mfe-config-architect` 에이전트가 Host/Remote 설정을 **생성**하거나 **검토**할 때
기준으로 삼는 규칙 원본이다. 추측하지 말고 항상 이 규칙과 대상 저장소의 실제 파일에
근거해 판단한다.

기준 스택은 **React 18 + rsbuild + `@module-federation/rsbuild-plugin`(빌드) +
`@module-federation/enhanced/runtime`(런타임)** 이며, 참조 구현은 Host 1개(레이아웃·라우팅 셸)와
도메인별 Remote 여러 개로 구성된 멀티 레포다.

---

## 1. 역할 구분 — Host 하나, Remote 여러 개

| 역할 | 책임 | 설정 특징 |
|---|---|---|
| **Host(레이아웃 셸)** | 전역 레이아웃·사이드바·라우팅 트리·인증/메뉴·테마·i18n 루트 | `exposes` 없음. `remotes` 를 **빌드 설정이 아니라 런타임 `init()`** 에 선언 |
| **Remote(도메인 모듈)** | 한 메뉴그룹/도메인의 페이지·위젯 | `exposes` 만 선언. 자체 dev 서버로 단독 실행도 가능해야 한다 |

**핵심 규약: Host 의 `pluginModuleFederation({...})` 에는 `remotes` 를 적지 않는다.**
Remote 목록은 `src/app/bootstrap.tsx` 의 `init()` 에서 런타임 등록한다(§4). 빌드 시점에
Remote URL 을 고정하지 않아야 환경(dev/stage/prod)별 URL 을 env 로만 바꿔 배포할 수 있고,
Remote 재배포 시 Host 재빌드 없이 manifest 를 다시 읽을 수 있다.

---

## 2. 빌드 설정 (`rsbuild.config.ts`)

Host·Remote 공통 골격이다. 빈칸(⟨…⟩)만 모듈마다 다르다.

```ts
import { defineConfig, loadEnv } from "@rsbuild/core";
import { pluginModuleFederation } from "@module-federation/rsbuild-plugin";
import deps from "./package.json" with { type: "json" };

const dependencies = deps.dependencies;
const { publicVars } = loadEnv({ prefixes: ["VITE_"] });

export default defineConfig({
  source: { tsconfigPath: ..., define: publicVars },
  plugins: [
    pluginReact(),
    pluginModuleFederation({
      name: process.env.VITE_MODULE_NAME,   // ← 하드코딩하지 않는다
      exposes: { /* Remote 만 */ },
      shared: { /* §3 */ },
    }),
    // pluginTypeCheck / pluginEslint / pluginSass / pluginStyledComponents
  ],
  server: { port: ⟨모듈 고유 포트⟩, proxy: [ /* 백엔드 프록시 */ ] },
});
```

규칙:

1. **`name` 은 `process.env.VITE_MODULE_NAME`** 으로 받는다. 이 값이 `init()` 의 remote `name`·
   `alias`, `loadRemote("<name>/<모듈>")` 의 접두사, Remote 루트 `div` 의 className 과 **모두 동일해야**
   한다. 한 군데라도 어긋나면 모듈을 찾지 못한다.
2. **`requiredVersion` 은 반드시 `dependencies[...]` 에서 읽는다.** 문자열 리터럴로 박으면
   `package.json` 업그레이드와 어긋나 singleton 경고·이중 인스턴스를 만든다.
3. **포트는 모듈마다 고정·유일**해야 한다(Host 와 모든 Remote 가 동시에 뜬다).
   Host 는 컨테이너·타 PC 접근을 위해 `server.host: "0.0.0.0"` 을 둔다.
4. `pluginTypeCheck` 의 `issue.exclude` 로 프로덕션 빌드에서 Host 의 원격 소비 페이지 폴더
   (`src/pages/mfe/**`)를 제외한다 — Remote 타입(`@mf-types`)은 Remote 가 떠 있을 때만 최신이라
   CI 빌드에서 실패 원인이 된다.
5. `.md` 를 `asset/source` 로 읽거나 Tailwind/PostCSS 를 쓰는 모듈은 `tools.rspack`·`tools.postcss`
   설정을 Host·Remote **양쪽에** 동일하게 둔다(Remote 는 단독 실행도 해야 한다).

---

## 3. `shared` 정책 — 이 설정의 핵심

`shared` 는 "Host 와 Remote 가 같은 인스턴스를 쓸 것인가"를 정하는 자리다. 잘못 정하면
런타임에 hook 오류·상태 미공유·스타일 붕괴로 나타난다.

| 패키지 | singleton | 이유 |
|---|---|---|
| `react`, `react-dom` | **true** | 인스턴스가 둘이면 "Invalid hook call"·Context 단절. 타협 불가 |
| `react-router`, `react-router-dom` | **true** | Host 라우터가 만든 history/Context 를 Remote 가 그대로 써야 한다 |
| `zustand` | **true** | 스토어 구현체가 갈리면 Host·Remote 가 같은 store 를 참조해도 구독이 끊긴다 |
| `react-hook-form` | **true** | FormProvider Context 가 모듈 경계를 넘는 폼에서 필요 |
| `@tanstack/react-query` | **true** | Provider Context 를 넘겨받아야 캐시가 공유된다(§6 함정 참고) |
| 공용 **타입 전용** 패키지(`@we/ai-types` 등) | **true** | 계약 단일 출처 |
| 공용 **컴포넌트 라이브러리**(`@we/ai-template` 등) | **false** | 모듈마다 자체 Provider·CSS 를 마운트하는 설계라 각자 사본을 갖는 편이 안전하다. 버전 정렬은 업데이트 스크립트로 맞춘다 |

규칙:

- **`singleton: true` 인 패키지는 Host 와 모든 Remote 의 `shared` 에 빠짐없이 같은 정책으로
  선언한다.** 한쪽에만 있거나 한쪽만 `singleton` 이 빠지면 그 패키지는 조용히 두 벌 로드된다.
  검토 시 모듈 간 `shared` 키 집합을 **교차 비교**하는 것이 가장 값어치 있는 검사다.
- 버전 범위는 `package.json` 의 선언을 그대로 쓰되, 모듈 간 major 가 다르면 singleton 이
  경고와 함께 한쪽을 버린다 — 업그레이드는 전 모듈 동시에 한다.
- `@module-federation/*` 패키지(`enhanced`·`runtime`·`sdk`·`retry-plugin`)는 **서로 버전을 맞춘다.**
  선언 버전과 번들러 플러그인이 요구하는 버전이 어긋나면(예: `0.8.x` 선언 + 플러그인은 `0.11.x` 요구)
  옛 설정 잔재이므로 정리한다.

---

## 4. Host 의 런타임 등록 (`src/app/bootstrap.tsx`)

```ts
import { init, loadRemote, registerRemotes } from "@module-federation/enhanced/runtime";
import { RetryPlugin } from "@module-federation/retry-plugin";

const remotes = [
  { name: "Agent", alias: "Agent", entry: `${import.meta.env.VITE_AGENT_MFE_BASE_URL}/mf-manifest.json` },
  // 기능 플래그로 조건부 포함 가능: ...(featureFlags.ragUi ? [{...}] : [])
];

init({ name: "AdminLayout", remotes, plugins: [ RetryPlugin({...}), /* §5 */ ] });
```

규칙:

1. **entry 는 `mf-manifest.json`** 을 가리킨다(`remoteEntry.js` 직접 지정이 아니라). manifest 를
   경유해야 런타임이 shared·expose 메타를 읽고 재조회할 수 있다.
   Remote 의 `VITE_REMOTE_FILENAME` 은 기본값 `remoteEntry.js` 를 유지한다 — 커스텀 파일명은
   인식 이슈가 보고돼 있다.
2. Remote URL 은 **모듈별 env 변수**(`VITE_<MODULE>_MFE_BASE_URL`)로만 받는다. 하드코딩 금지.
3. `name`·`alias` 는 해당 Remote 의 `VITE_MODULE_NAME` 과 정확히 같게 쓴다.
4. 미완성·플래그 대상 모듈은 배열에서 조건부로 뺀다(등록만 하고 안 쓰면 초기 manifest 조회가
   낭비되고, 죽은 URL 이면 에러 로그가 쌓인다).

---

## 5. 장애 내성 — `init` 의 플러그인 3종

Remote 는 **독립 배포**되므로 "Host 는 살아 있는데 Remote 만 죽거나 갱신된" 상태가 정상 시나리오다.
그래서 `init({ plugins })` 에 아래 셋을 둔다.

1. **`RetryPlugin`** — `fetch`·`script` 각각 `retryTimes: 1`, `retryDelay: 1000` 수준. 네트워크
   순간 실패 복구용이다. 재시도 횟수를 크게 잡으면 실패가 사용자에게 보이기까지만 늦어진다.
2. **manifest 재조회 플러그인** — `errorLoadRemote({ id })` 에서 `registerRemotes([remote], { force: true })`
   로 manifest 를 새로 읽고 `loadRemote(id)` 를 한 번 더 시도한다. Remote 재배포로 청크 해시가
   바뀌었을 때(캐시된 옛 manifest 참조) 생기는 404 를 자가 치유한다.
   **모듈 id 별 재시도 횟수를 `Map` 으로 추적해 1회로 제한한다** — 이 가드가 없으면 무한 루프다.
3. **에러 폴백 플러그인** — 끝내 실패한 모듈에 대해 `{ default: () => <FallbackUI /> }` 를 반환한다.
   폴백은 **노출 단위에 따라 다르게** 준다:
   - **페이지 모듈** → 화면 전체 높이의 에러 화면 + 새로고침 액션
   - **위젯/차트 모듈**(대시보드 카드 등) → 카드 크기의 작은 에러 박스.
     대상 id 를 `COMPONENT_MODULES` 같은 `Set` 에 열거해 구분한다.
   - **예외적으로 실패를 그대로 던져야 하는 모듈**(호출부가 자체 처리) 은 `throw error` 로 통과시킨다.

---

## 6. Remote 의 노출 규약 (`exposes`)

```ts
exposes: {
  "./AgentDashboardComp": `${process.env.VITE_REMOTE_COMP_DEFAULT_PATH}agent-dashboard-comp.tsx`,
}
```

- 노출 대상 파일은 **한 폴더에 모은다**: `VITE_REMOTE_COMP_DEFAULT_PATH=./src/export/`.
  이 폴더가 Remote 의 공개 API 면(面)이다. 여기 없는 파일은 외부 계약이 아니다.
- 파일명은 kebab-case + `-comp.tsx`, 키는 `./` + PascalCase + `Comp`.
- **노출 파일은 얇은 래퍼다.** 실제 화면은 `@/pages/...` 에 두고, 노출 파일은 의존성 Provider 로
  감싸기만 한다:

```tsx
const AgentDashboardComp = () => (
  <ExportDependencyProvider children={<AgentDashboardPage />} />
);
export default AgentDashboardComp;
```

- **`ExportDependencyProvider`(모듈 부트스트랩 래퍼)가 반드시 감싸야 하는 것들**:
  - 모듈 루트 `div` 에 `className = VITE_MODULE_NAME` — CSS 스코프 앵커
  - 자체 CSS/Tailwind 엔트리 import (Host 가 CSS 를 대신 넣어주지 않는다)
  - `I18nextProvider`(모듈 자체 i18n 인스턴스)
  - 공용 템플릿 Provider(`WeAiTemplateProvider` 등) — 포털·토스트·알림이 여기에 의존한다
  - `ErrorBoundary`(공용 `PageErrorFallback`)
  - react-query 클라이언트 브리지(§7)
  - 전역 이벤트 구독 등록/해제(`theme`·`language`)를 `useEffect` 로

---

## 7. 모듈 간 통신 규약

| 대상 | 방식 |
|---|---|
| **테마·언어** | `window` CustomEvent(`"theme"`, `"language"`) 브로드캐스트 + `localStorage` 폴백. Remote 는 마운트 시 구독, 언마운트 시 해제 |
| **인증·메뉴 권한** | Host 가 채우는 전역 스토어(`window.__WE_AUTH_MENU_STORE__`)를 Remote 가 읽는다 |
| **서버 캐시(react-query)** | Provider Context 로 내려온 `QueryClient` 를 모듈 전역에 캡처하는 **브리지 컴포넌트**를 Provider 안에 렌더한다(`useQueryClient()` → 모듈 스코프 변수에 저장). 훅 밖(서비스 코드)에서 캐시를 만져야 할 때 이 인스턴스를 쓴다 |
| **도메인 데이터** | 서버 API 를 통해서만. Remote 끼리 직접 import 하지 않는다 |
| **타입** | 공용 타입 패키지(`@we/ai-types`)로 배포해 `shared.singleton` 으로 정렬 |

---

## 8. Host 의 소비 규약

Host 는 Remote 페이지를 `src/pages/mfe/<도메인>-ui/<화면>-page.ui.tsx` 로 감싸고, 라우트 객체를
`src/pages/mfe/index.ts` 배럴로 재수출한다.

```tsx
//@ts-ignore  ← 타입만 빌려오는 import (번들에는 들어가지 않는다)
import AgentDashboardRoute from "Agent/AgentDashboardComp";

const AgentDashboardApp = lazy(() =>
  loadRemote<{ default: typeof AgentDashboardRoute }>("Agent/AgentDashboardComp", { from: "runtime" })
    as Promise<{ default: typeof AgentDashboardRoute }>,
);

export const AgentDashboardRemoteRoute = {
  path: pathKeys.agent.agentDashboard(),
  element: <AgentDashboardPage />,   // 내부에서 <Suspense fallback={<MfeLoadingSuspense/>}> 로 감쌈
};
```

규칙:

- `loadRemote(..., { from: "runtime" })` 를 `lazy()` 안에서 호출하고 **항상 `Suspense` 로 감싼다**
  (공용 MFE 로딩 컴포넌트 사용).
- Host 가 소유하는 것은 **브레드크럼·페이지 타이틀·카드 컨테이너 등 셸**뿐이다. 화면 내용은
  Remote 가 소유한다.
- 라우트 경로는 Host 의 `pathKeys` 에서만 만든다(문자열 하드코딩 금지).
- 타입은 Host 에 생성되는 `@mf-types/` 를 쓰고, 아직 타입이 없는 Remote 는 `src/remote.d.ts` 에
  `declare module "<Name>/*";` 스텁으로 임시 통과시킨다(해소되면 스텁을 지운다).

---

## 9. 새 Remote 를 붙일 때 체크리스트

```
- [ ] Remote: VITE_MODULE_NAME 결정(고유), 포트 결정(중복 없음)
- [ ] Remote: pluginModuleFederation 의 name/exposes/shared 작성 (§2·§3·§6)
- [ ] Remote: src/export/<x>-comp.tsx + ExportDependencyProvider 래핑
- [ ] Remote: .env 에 VITE_REMOTE_COMP_DEFAULT_PATH·VITE_REMOTE_FILENAME 확인
- [ ] Host:   .env 에 VITE_<MODULE>_MFE_BASE_URL 추가 (dev/prod 각각)
- [ ] Host:   bootstrap.tsx remotes 배열에 { name, alias, entry } 추가
- [ ] Host:   shared 정책이 Remote 와 키·singleton 까지 일치하는지 대조
- [ ] Host:   pages/mfe/<도메인>-ui/ 소비 페이지 + index.ts 배럴 + pathKeys + 메뉴 등록
- [ ] 검증:   Remote 단독 실행 → Host 실행 → 해당 메뉴 진입 → 콘솔에 React/Provider 경고 없음
```

---

## 10. 위반 등급 기준

검토 결과는 아래 등급으로 분류한다.

- 🔴 **CRITICAL** — 런타임에서 실제로 깨진다. `react`/`react-dom` singleton 누락·불일치,
  모듈 이름(`VITE_MODULE_NAME` ↔ `init` remote name ↔ `loadRemote` 접두사) 불일치,
  Remote URL 하드코딩, 노출 컴포넌트의 Provider 래핑 누락, manifest 재조회 무한 루프 가드 부재.
- 🟡 **WARNING** — 지금은 동작하지만 곧 사고가 된다. 모듈 간 `shared` 키 집합 불일치,
  `requiredVersion` 리터럴 하드코딩, `@module-federation/*` 버전 혼재, `Suspense`/에러 폴백 없는
  `loadRemote`, 포트 충돌, 프로덕션 타입체크 예외 미설정.
- 🟢 **INFO** — 규약 정렬 제안. 노출 파일 네이밍, 배럴 누락, 죽은 remote 등록, 스텁 잔재.
