---
name: mfe-runtime-troubleshooting
description: >-
  마이크로 프론트엔드(Module Federation) 환경에서 화면이 안 뜨거나 원격 모듈이 깨질 때의
  진단 절차. "리모트가 안 불러와져", "loadRemote 실패", "Failed to fetch dynamically
  imported module", "mf-manifest 404", "remoteEntry 404", "원격 모듈 로딩 에러",
  "Invalid hook call", "Cannot read properties of null (reading useState/useContext)",
  "hook 두 번 호출되는 것 같아", "React 인스턴스가 두 개", "Provider 없다고 나와",
  "리모트에서 토스트/모달이 안 떠", "쿼리 캐시가 host랑 remote랑 따로 놀아",
  "리모트 화면만 스타일이 깨져", "tailwind가 다른 모듈까지 먹어", "MFE에서 라우팅이 안 먹혀",
  "리모트 배포했는데 화면이 옛날 거야", "singleton 경고 떠", "shared 버전 경고",
  "MFE HMR이 안 돼" 같은 증상·에러 문구에 트리거한다. 핵심은 증상을 6개 계열
  (모듈 해석·인스턴스 중복·Provider 전제·상태 공유·스타일 격리·캐시 신선도)로 먼저 분류한 뒤
  해당 계열의 확인 순서를 따라가는 것이며, 눈에 보이는 에러 문구가 실제 원인과 다른
  위장 케이스를 다룬다.
---

# MFE 런타임 통합 트러블슈팅

Module Federation 환경의 버그는 **에러 문구와 실제 원인이 자주 어긋난다.** "Provider 가
없다"는 에러가 실제로는 React 이중 로드이고, "모듈을 못 찾는다"가 실제로는 배포 후
manifest 캐시 문제인 식이다. 그래서 이 문서는 **증상 → 계열 분류 → 확인 순서**로 간다.

> 📎 실제 사례별 재현·확인 명령은 같은 폴더의 [`examples.md`](./examples.md)에 있다.
> 계열을 특정한 뒤 판단이 애매할 때 읽는다.

> 설정 규약의 원본(어떤 shared 를 singleton 으로 둘지, `init()` 을 어떻게 구성할지)은
> 이 플러그인의 `resources/mfe-config-architect/mf-config-reference.md` 에 있다.

---

## 0. 먼저 확인 — 3분 체크

원인 추적에 들어가기 전에 이 셋을 먼저 확인한다. 절반 이상이 여기서 끝난다.

```
- [ ] 해당 Remote 의 dev 서버가 떠 있는가 (Host 만 띄우고 Remote 를 안 띄운 경우가 가장 흔하다)
- [ ] 브라우저에서 <Remote URL>/mf-manifest.json 이 200 으로 열리는가
- [ ] 콘솔의 첫 번째 에러가 무엇인가 (뒤따르는 에러는 대개 파생물이다 — 첫 줄만 본다)
```

---

## 1. 증상 → 계열 분류

| 증상 | 계열 | 절 |
|---|---|---|
| 모듈을 못 찾음, 404, `Failed to fetch dynamically imported module`, 폴백 화면만 뜸 | **A. 모듈 해석** | §2 |
| `Invalid hook call`, `Cannot read properties of null (reading 'useX')`, 마운트하자마자 크래시 | **B. 인스턴스 중복** | §3 |
| 토스트·모달·툴팁이 안 뜸, "Provider 없음" 류 에러, 포털이 비어 있음 | **C. Provider 전제** | §4 |
| 로그인 상태·권한·테마·언어·쿼리 캐시가 모듈 간에 안 맞음 | **D. 상태 공유** | §5 |
| 특정 모듈만 스타일이 깨짐, 반대로 한 모듈 CSS 가 다른 화면까지 오염 | **E. 스타일 격리** | §6 |
| 배포·재빌드 후에도 옛 화면, 청크 404, 타입이 옛날 것 | **F. 캐시 신선도** | §7 |

두 계열의 증상이 섞여 보이면 **B → A → C → D 순**으로 배제한다(B 가 다른 계열의 증상을
가장 잘 위장한다).

---

## 2. A. 모듈 해석 실패

`loadRemote("Agent/XComp")` 가 실패하는 경우다. 아래 순서로 **이름 사슬**을 대조한다.

```bash
# 1) Remote 의 모듈 이름
grep -rn "VITE_MODULE_NAME" <remote>/.env*
# 2) Remote 가 노출한 키
grep -n "exposes" -A 30 <remote>/rsbuild.config.ts
# 3) Host 의 등록 이름·entry
grep -rn "name:\|alias:\|entry:" <host>/src/app/bootstrap.tsx
# 4) Host 의 호출부
grep -rn "loadRemote(" <host>/src | head -20
```

네 값이 **정확히** 같아야 한다: `VITE_MODULE_NAME` = `init` 의 `name`/`alias` =
`loadRemote("<이 부분>/…")`. 대소문자도 구분한다.

그다음 순서:

1. **entry 형식** — `.../mf-manifest.json` 인가. `remoteEntry.js` 를 직접 가리키면
   shared 협상 정보가 빠져 간헐적으로 깨진다.
2. **URL** — `import.meta.env.VITE_*_MFE_BASE_URL` 값이 빌드에 실제로 들어갔는지
   콘솔에서 확인한다(env 파일만 고치고 dev 서버를 재시작하지 않은 경우가 흔하다).
3. **CORS / 네트워크** — 네트워크 탭에서 `mf-manifest.json` 요청의 상태를 본다.
   다른 PC·컨테이너에서 접근한다면 Remote 의 `server.host` 가 `0.0.0.0` 인지 확인한다.
4. **노출 키 오타** — `exposes` 키는 `./XxxComp`, 호출은 `"<Module>/XxxComp"` 다.
   `./` 유무를 헷갈리는 실수가 잦다.
5. 그래도 실패하면 §7(캐시 신선도)로 간다.

> 폴백 화면이 떠서 원인 에러가 가려지는 경우, Host 의 `errorLoadRemote` 폴백 플러그인에
> `console.error(id, error)` 가 있는지 확인한다. 없으면 원인 로그 자체가 삼켜진다.

---

## 3. B. 인스턴스 중복 (가장 잘 위장하는 계열)

`react` 나 Context 를 제공하는 패키지가 **두 벌 로드**되면, 증상은 hook 오류부터
"Provider 가 없다"까지 무엇이든 될 수 있다.

확인 순서:

1. **shared 교차 대조** — Host 와 문제의 Remote 양쪽 `shared` 를 나란히 놓고 본다.
   ```bash
   grep -n "shared" -A 40 <host>/rsbuild.config.ts
   grep -n "shared" -A 40 <remote>/rsbuild.config.ts
   ```
   - 한쪽에만 있는 키 → 그 패키지는 두 벌 로드된다.
   - 한쪽만 `singleton: true` → 마찬가지다. **`singleton` 은 양쪽 모두에 있어야 의미가 있다.**
   - `requiredVersion` 이 문자열 리터럴로 박혀 있고 실제 `package.json` 과 다르면 협상 실패.
2. **버전 major 불일치** — 콘솔의 shared 경고(`Unsatisfied version …`)를 읽는다.
   major 가 다르면 singleton 이라도 한쪽이 자기 사본을 쓴다. 해결은 전 모듈 동시 업그레이드다.
3. **브라우저에서 직접 확인** — `examples.md` 의 "React 인스턴스 개수 세기" 절차를 쓴다.
4. **`@module-federation/*` 버전 혼재** — `enhanced`·`runtime`·`sdk`·`retry-plugin` 이 서로
   다른 minor 면 런타임이 둘로 갈린다. 하나로 맞춘다.

---

## 4. C. Provider 전제 누락

원격 모듈은 **Host 의 Provider 안에 마운트되지만 Host 의 Provider 를 신뢰하지 않는다.**
노출 컴포넌트는 자체 Provider 래퍼로 감싸는 것이 규약이다.

확인 순서:

1. 문제의 노출 파일(`src/export/<x>-comp.tsx`)이 Provider 래퍼를 거치는가.
   ```bash
   cat <remote>/src/export/<x>-comp.tsx
   ```
   페이지 컴포넌트를 **직접** default export 하고 있으면 그것이 원인이다.
2. 래퍼가 마운트해야 할 것이 다 있는가 — 공용 템플릿 Provider(포털·토스트·알림 의존),
   i18n Provider, ErrorBoundary, 쿼리 클라이언트 브리지, CSS 엔트리.
3. 포털 기반 UI(툴팁·팝오버·알림)가 안 뜬다면 포털 아웃렛을 만드는 Provider 가
   그 모듈 트리 안에 있는지 본다. Host 에만 있으면 Remote 쪽 포털 훅은 `null` 을 받는다.
4. 그래도 안 되면 §3 을 의심한다 — Provider 는 있는데 `react` 가 두 벌이면 Context 가 끊긴다.

---

## 5. D. 상태 공유가 안 됨

무엇이 어떤 경로로 건너가는지부터 확정한다. 경로마다 실패 지점이 다르다.

| 공유 대상 | 경로 | 안 될 때 볼 곳 |
|---|---|---|
| 인증·메뉴 권한 | Host 가 채우는 전역 스토어(`window.__…__`) | Host 가 채우기 **전에** Remote 가 읽지 않는지(마운트 타이밍), 키 이름 오타 |
| 테마·언어 | `window` CustomEvent + localStorage 폴백 | Remote 가 마운트 시 구독하는지, 언마운트 시 해제하는지, 이벤트 이름 일치 |
| 서버 캐시(react-query) | Provider Context + 모듈 전역 브리지 | `@tanstack/react-query` 가 양쪽 `shared.singleton` 인지, 브리지 컴포넌트가 Provider **안**에 렌더되는지 |
| 클라이언트 스토어(zustand) | `shared.singleton` + 같은 store 모듈 | store 파일이 모듈별로 각자 번들되면 별개 store 다. 공유하려면 공용 패키지로 빼야 한다 |
| 도메인 데이터 | 서버 API | — |

> **함정**: `zustand` 를 singleton 으로 공유해도 **store 인스턴스**가 공유되는 것은 아니다.
> 공유되는 것은 라이브러리 코드뿐이다. 각 모듈이 자기 `create()` 를 호출하면 별개 store 다.

---

## 6. E. 스타일 격리

Remote 는 자체 CSS 를 들고 온다. 그래서 두 방향의 사고가 난다.

- **모듈 스타일이 안 먹음** — 노출 래퍼가 CSS 엔트리를 import 하지 않았다. Remote 단독
  실행 시엔 `main.tsx` 가 import 해서 멀쩡해 보이지만, Host 를 통하면 그 경로를 안 탄다.
  **CSS import 는 노출 래퍼에도 있어야 한다.**
- **모듈 스타일이 다른 화면을 오염** — 전역 셀렉터(`body`, `*`, 태그 셀렉터)나
  Tailwind preflight 가 원인이다. 노출 래퍼가 씌우는 **모듈 루트 `div` 의 className
  (= 모듈 이름)** 을 스코프 앵커로 쓴다. Tailwind 를 쓰는 모듈이 여럿이면 preflight 를
  한 곳(Host)에서만 켜거나 prefix 를 분리한다.

---

## 7. F. 캐시 신선도

Remote 는 독립 배포되므로 "Host 가 들고 있는 manifest 가 낡은" 상태가 정상적으로 발생한다.

증상: 재배포 직후 청크 404, 옛 화면, 강력 새로고침하면 고쳐짐.

1. Host 의 `init({ plugins })` 에 **manifest 재조회 플러그인**이 있는지 확인한다
   (`errorLoadRemote` → `registerRemotes([...], { force: true })` → `loadRemote` 재시도).
   없으면 이 사고는 계속 재발한다.
2. 재조회 플러그인이 있는데도 무한 로딩/무한 새로고침이면 **재시도 횟수 가드**(모듈 id 별
   `Map`)가 빠졌는지 본다.
3. 서버(nginx 등)가 `mf-manifest.json` 에 장기 캐시 헤더를 주고 있지 않은지 확인한다.
   manifest 는 `no-cache`, 해시 붙은 청크는 장기 캐시가 맞는 조합이다.
4. **타입이 옛날 것** — Host 의 `@mf-types/` 는 Remote 가 떠 있을 때 생성된다.
   Remote 를 띄운 채 Host 를 재시작해 재생성한다. 프로덕션 빌드는 이 폴더에 의존하지
   않도록 타입체크 예외가 설정돼 있어야 한다.

---

## 8. 보고 형식

원인을 특정했으면 아래 형태로 요약한다.

```markdown
**증상**: {관찰된 것 — 에러 문구 원문 포함}
**계열**: {A~F}
**원인**: {확인된 사실. 어느 파일의 무엇이 어긋났는지}
**근거**: {확인 명령과 그 출력 / 네트워크·콘솔 관찰}
**수정**: {변경할 파일과 내용}
**재발 방지**: {설정·규약 차원에서 막을 방법. 없으면 생략}
```

**추측을 원인으로 보고하지 않는다.** 확인하지 못한 가설은 "확인 필요" 목록으로 따로 적는다.
