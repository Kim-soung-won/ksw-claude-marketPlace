# integration-test-writer 렌더 경계 점검 (jsdom 렌더 한계 대응)

통합 테스트는 jsdom 위에서 돈다. jsdom은 실제 브라우저의 레이아웃·페인팅·일부
DOM API를 구현하지 않으므로, 화면을 실제로 "그리는" 지점(canvas 차트, 가상
스크롤, 파일 DnD 등)에서 테스트가 조용히 무너지거나 빈 화면을 단언하게 된다.
이 리소스는 그 한계를 **조용히 축소하지 않고** 대응하기 위한 사다리·카탈로그·
점검 절차를 담는다.

---

## 0. 개념 — 네트워크 경계 vs 렌더 경계

통합 테스트의 최우선 원칙("내부는 실제로, 경계만 대체한다")에서 말하는 **경계는
두 종류**다. 이 개념의 정본은 `integration-test-authoring` 스킬 **원칙 1**이며,
이 리소스는 그 원칙 위에서 렌더 경계 대응의 **절차·카탈로그**를 담는다.

- **네트워크 경계(HTTP)** — 통제 불가능한 외부 통신. **MSW로만** HTTP 레벨에서
  가로챈다. `global.fetch`/axios 스터빙이나 API 클라이언트 함수 목킹은 요청↔응답
  처리 연결을 끊으므로 **금지**한다.
- **렌더 경계** — jsdom이 실제로 그려낼 수 없는 leaf(canvas 기반 차트, 가상
  스크롤, 파일 DnD, floating 포지셔닝 등). 여기서는 **시각화 leaf만 stub하는
  것은 허용**하되, 그 leaf로 **들어가는 데이터 흐름은 실제로 유지**한다. 즉
  데이터·aria 같은 관찰 가능한 것은 실제 흐름 위에서 단언하고, 픽셀·좌표·시리즈
  렌더링처럼 jsdom이 못 그리는 것은 E2E로 넘긴다.

핵심 구분: 네트워크 경계는 **대체하되 연결은 유지**(MSW), 렌더 경계는 **못 그리는
leaf만 국소 stub하되 데이터는 관통**시킨다. 둘 다 "연결을 끊지 않는다"는 같은
원칙의 두 얼굴이다.

---

## 1. 대응 전략 사다리 (위에서부터 시도)

렌더 경계 한계를 만나면 아래 순서로 위에서부터 시도한다. 아래로 내려갈수록 커버
범위가 좁아지므로, **가능한 한 위 전략으로 해결**한다. 마지막 칸의 "조용한 축소"는
어떤 경우에도 하지 않는다.

| # | 전략 | 무엇을 | 어디에 |
|---|---|---|---|
| 1 | **폴리필** | jsdom에 없는 전역 브라우저 API를 no-op/stub으로 채운다 | 프로젝트 `test/setup.ts` (전역) |
| 2 | **하니스 목 컨텍스트** | 라이브러리의 가상화/포털을 테스트용 컨텍스트로 강제 | 공용 하니스 `test/test-utils/render.tsx` 옵션 |
| 3 | **렌더 leaf stub** | 시각화 leaf 모듈만 국소 `vi.mock` (데이터 흐름은 유지) | 테스트 파일 국소 |
| 4 | **축소하되 정직한 단언** | 관찰 가능한 것만 단언 (role·전달 데이터·aria) | 테스트 파일 |
| 5 | **E2E 이관 + 요약에 사유 명시** | 픽셀·좌표·실제 DnD UX는 E2E로 넘기고 요약에 명시 | 요약 리포트 |
| ✗ | ~~조용한 축소~~ | 사유 없이 단언을 지우거나 흐름을 건너뛰기 | **금지** |

전략 4·5로 내려갔다면 **왜 위 전략으로 못 올렸는지**를 반드시 요약에 남긴다.
silent하게 커버리지를 줄이지 않는다.

---

## 2. 카탈로그 — 전략별 대응

### 전략 1 — 폴리필 (프로젝트 `test/setup.ts`, 전역)

jsdom에 아예 없는 전역 API. `setup.ts`에서 한 번 채우면 모든 테스트가 커버된다.
아래는 표준 레시피이며, 프로젝트 setup에 이미 있으면 그대로 쓰고 없으면 보강을
보고한다.

| API | 왜 필요한가 | 표준 레시피 |
|---|---|---|
| `ResizeObserver` | 가상 스크롤·반응형 측정 컴포넌트가 생성자를 호출. jsdom엔 없음 | `global.ResizeObserver = class { observe(){} unobserve(){} disconnect(){} }` |
| `IntersectionObserver` | lazy load·무한 스크롤 트리거 관찰 | 동일한 no-op stub (콜백을 뒤에서 불러야 하면 인스턴스를 배열에 보관해두는 형태) |
| `window.matchMedia` | 테마/반응형 분기 | `window.matchMedia = vi.fn(q => ({ matches:false, media:q, onchange:null, addEventListener:vi.fn(), removeEventListener:vi.fn(), addListener:vi.fn(), removeListener:vi.fn(), dispatchEvent:vi.fn() }))` |
| `Element.prototype.scrollIntoView` | 포커스 이동·목록 스크롤 | `Element.prototype.scrollIntoView = vi.fn()` |
| `URL.createObjectURL` / `revokeObjectURL` | blob 다운로드/미리보기 | `URL.createObjectURL = vi.fn(() => 'blob:mock')` / `URL.revokeObjectURL = vi.fn()` |
| `structuredClone` · `crypto.randomUUID` | (버전 주의) 최신 node엔 있으나 없으면 필요 | 부재 시에만 폴리필. 있으면 건드리지 않는다 |

**커버 범위**: 폴리필은 "API가 없어서 생성자/호출 단계에서 터지는" 문제를 막는다.
관찰(observe)의 실제 콜백 동작(뷰포트 교차 여부 등)까지 재현하지는 않는다 — 그건
로직상 필요하면 전략 2/4로 다룬다.

### 전략 2 — 하니스 목 컨텍스트 (공용 `render.tsx` 옵션, 프로젝트측)

라이브러리가 레이아웃 측정에 의존해 jsdom에서 0개 행으로 렌더되는 경우, 그
라이브러리가 제공하는 테스트용 컨텍스트로 뷰포트를 강제한다.

- **`react-virtuoso` 가상 스크롤** — jsdom엔 실제 높이가 없어 행이 **0개로 렌더**되는
  문제. `import { VirtuosoMockContext } from 'react-virtuoso'`로 감싸고
  `value={{ viewportHeight: 300, itemHeight: 40 }}`를 강제한다. 공용 하니스에
  **opt-in 옵션**으로 노출하기를 권장한다(모든 테스트가 가상화 컨텍스트를 이고
  가지 않도록). → 목록 행·행 액션·버전 롤백/삭제 흐름을 커버 가능.

**커버 범위**: 가상화된 목록의 행·행 내부 인터랙션까지 실제 데이터로 관찰 가능.
스크롤 위치에 따른 실제 윈도잉 동작(어떤 행이 언마운트되는지)은 재현 대상이 아니다.

### 전략 3 — 렌더 leaf stub (테스트 파일 국소 `vi.mock`)

jsdom이 canvas·미디어를 못 그리는 leaf. **그 leaf 모듈만** 국소로 stub하고,
**데이터는 stub까지 실제로 흐르게 둔 뒤 그 데이터를 단언**한다(연결 유지).

- **ECharts (`echarts-for-react`, `@we/ai-template`의 `Chart_*`가 이를 감쌈)** —
  canvas 2D 컨텍스트가 없어 렌더 불가. `echarts-for-react` 모듈을 **데이터/option
  prop만 노출하는 stub**로 `vi.mock`한다(예: 받은 `option`을 `data-testid` 컨테이너에
  직렬화해 노출). 전달 데이터·컨테이너 렌더는 **관찰 O**, 픽셀·시리즈 그리기는
  E2E. **데이터가 stub까지 실제로 흐르게 두고 그 데이터를 단언**해 연결을 유지한다.
- **`HTMLMediaElement` `play()` / `pause()`** — jsdom 미구현. 미디어를 쓰면
  `HTMLMediaElement.prototype.play = vi.fn()` / `pause = vi.fn()`로 stub한다.

**커버 범위**: 상위 로직이 leaf에 **무슨 데이터를 넘기는가**까지 실제로 검증.
leaf 내부의 실제 시각적 산출물(차트 픽셀, 재생 프레임)은 검증 대상에서 제외(E2E).

### 전략 4/5 — 포지셔닝·포털 함정 (축소·관찰 또는 E2E)

jsdom이 레이아웃을 계산하지 않아 좌표 기반 동작이 무의미해지는 영역. 위치가 아니라
**콘텐츠 존재**를 단언하거나, UX 자체는 E2E로 넘긴다.

- **`getBoundingClientRect`가 0을 반환** → floating-ui 기반 툴팁·팝오버
  (`@we/ai-template`의 `Popover`/`TooltipBox`)의 위치 계산이 무의미. **위치가 아니라
  콘텐츠**(role·텍스트)의 존재를 단언한다. 위치·overflow 말줄임 표시는 E2E.
- **portal 렌더 (`Dialog`/`Popover`/`Toast`가 `document.body`로 포털)** → 렌더러의
  `container`가 아니라 `screen.*` 또는 `within(document.body)`로 조회한다. RTL은
  `screen`이 기본이라 대개 문제없지만, **`container` 직접 접근을 피한다**는 점을
  명시한다.
- **애니메이션 (framer-motion: `@we/ai-template`의 `StatusBadge`/`Slide`)** → 진입/퇴장
  애니메이션 **완료 후 상태**를 `findBy*`/`waitFor`로 기다려 단언하고, 진행 중
  애니메이션 프레임 자체는 단언하지 않는다.
- **파일 업로드 (react-dropzone: `@we/ai-template`의 `FileUploader`)** → jsdom은
  `DataTransfer`/drop 이벤트가 제한적. 컴포넌트 내부의 hidden `input[type=file]`을
  찾아 `await userEvent.upload(input, file)`로 **파일 선택 경로**를 검증한다. 실제
  드래그&드롭 UX는 E2E.
- **SSE/스트리밍 · WebSocket** → jsdom·MSW의 지원에 한계가 있다. 대상 흐름이 이를
  쓰면 **별도 확인/이관 대상**으로 요약에 표기한다.

---

## 3. 점검 절차 요지

1. **식별** — 대상 흐름이 위 카탈로그 대상(차트·가상 스크롤·업로더·다운로드·
   포털·툴팁·애니메이션·스트리밍)을 쓰는지 확인한다. 대상 컴포넌트 트리와 import를
   훑어 렌더 경계 leaf를 찾는다.
2. **제공 여부 확인** — 프로젝트 `test/setup.ts`와 공용 하니스(`render.tsx`)가 해당
   폴리필·목 컨텍스트를 **이미 제공하는지** 본다. 있으면 그대로 사용한다.
3. **보강 또는 보고** — 없으면 표준 레시피로 보강하거나(전략 1~3), 흐름·시점상
   애매하면 **축소 사유 + 권장 보강을 요약에 명시 보고**한다.

이 보고는 `dependency-preflight.md`의 **하드 "차단 보고"와 다른 소프트 보고**다.
의존성 부재는 import 에러로 테스트가 아예 실행조차 안 되므로 차단하지만, 렌더 경계
폴리필·목 컨텍스트는 **프로젝트 인프라라 워커가 setup/하니스에 추가할 수 있고**,
못 커버한 부분은 단언을 정직하게 축소해 실행 가능한 테스트를 남길 수 있다. 그래서
여기서는 "진행 불가"가 아니라 "이렇게 축소했다 / 이걸 보강하면 커버가 넓어진다"를
요약에 남기는 소프트 보고로 처리한다.

---

## 범위 경계 (중요)

- 폴리필과 `VirtuosoMockContext` 하니스는 **프로젝트 인프라**(각 프로젝트의
  `test/setup.ts` / `test/test-utils/render.tsx`)에 속한다.
- 이 리소스는 **레시피(지식)를 실어 나르고**, 워커가 대상 프로젝트에 그것을
  적용·보고할 뿐이다. **플러그인이 프로젝트 코드를 소유하지 않는다.** 인프라를
  신설·수정할 때는 범위를 넘어 대형 테스트 인프라를 임의로 만들지 말고, 최소한의
  보강과 함께 그 사실을 요약에 명시한다.
- 네트워크 경계 목킹 금지 원칙(MSW만, API 클라이언트 목 금지)은 이 리소스의 어떤
  전략으로도 **약화되지 않는다.** leaf stub은 렌더 경계에만 적용된다.
