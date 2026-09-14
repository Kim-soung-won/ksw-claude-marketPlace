# 통합 테스트 작성 규약 — 골드 예시

`SKILL.md`의 세 원칙(내부는 실제로·경계만 MSW / 단언은 관찰 동작에서 / 단위는
페이지·흐름)을 실제 프로젝트에 적용해 커밋한 사례. 무엇을 실제로 연결하고 무엇을
MSW로 가로챌지, 실패 경로를 어떻게 만들지 판단이 서지 않을 때 읽는다.

## 목차

- 예시 A — 로그인 흐름: 성공 리다이렉트 + 실패 에러 표시 (`LoginPage.integration.test.tsx`)
- 예시 B — 주문 목록 흐름: 조회 → 필터 → 상세 (`OrderListPage.integration.test.tsx`)
- 두 예시의 공통 골격
- 실패·방어 경로 예시 — 계약 위반 응답 → ErrorPage
- 통합 테스트 실전 함정 — MSW·흐름에서 반복해 부딪힌 것들

---

## 예시 A — 로그인 흐름 (성공/실패 한 파일)

- **흐름**: 로그인 화면에서 이메일·비밀번호 입력 → 제출 → (성공) 대시보드
  리다이렉트 + 토스트 / (실패) 401 에러 메시지 노출.
- **진입점**: `src/pages/login/LoginPage.tsx`
- **테스트**: `test/pages/login/LoginPage.integration.test.tsx`
- **실제로 연결된 것**: 로그인 폼 컴포넌트, 폼 검증 로직, `useLoginMutation`
  (react-query), 인증 상태 스토어(zustand), `postLogin` API 요청 코드.
- **가로챈 경계**: `POST /api/auth/login` 한 곳만 MSW로.
- **근거 도메인 스킬**: `./.claude/skills/auth_api.md`(요청 바디·200/401 응답 형태),
  `auth_scenario.md`("로그인 흐름"의 성공 리다이렉트·401 실패 배너·검증 게이트).
  작성 전 `domain-skill-reviewer`로 두 스킬의 신뢰도를 확인했다.

### 무엇을 실제로 돌렸나

`postLogin`이 실제로 실행되므로 요청 바디 직렬화, 응답 파싱, `401 → "이메일 또는
비밀번호를 확인하세요"` 에러 매핑까지 전부 실제 코드가 돈다. 이때 MSW가 돌려주는
200/401 응답의 JSON 모양·에러 코드 필드는 **상상으로 지어낸 게 아니라
`auth_api.md`의 계약 그대로**다 — 그래야 실서버 계약과 어긋난 모킹으로 거짓
통과하지 않는다. 성공 시 응답 토큰이
실제 스토어에 반영되고, 그 상태 변화가 라우팅 가드를 통과시켜 리다이렉트가 일어난다.
어느 것도 목으로 대체하지 않았다 — 목이 필요했던 유일한 지점은 HTTP 응답이다.

### 단언은 화면에서

| 흐름 단계 | 사용자 조작 | 관찰 단언 (접근성 쿼리) |
| --- | --- | --- |
| 성공 제출 | 유효 입력 → "로그인" 클릭 | `findByRole` 로 대시보드 헤딩 노출, 성공 토스트 텍스트 |
| 실패 제출(401) | 틀린 비밀번호 → 클릭 | `findByText` 로 에러 메시지, URL은 `/login` 유지 |
| 검증 실패 | 빈 이메일 → 클릭 | 인라인 검증 메시지, 요청이 **나가지 않음**(MSW 미호출) |
| 로딩 | 제출 직후 | 지연 응답 중 스피너 등장 → 응답 후 소멸 |

내부 상태(`isAuthenticated === true`)나 `postLogin` 호출 횟수를 박제하지 않았다.
"대시보드가 보인다 / 에러 메시지가 보인다"가 사용자 가치이자 단언 대상이다.

### 실패 경로는 server.use 오버라이드로

```ts
it("잘못된 자격증명이면 에러 메시지를 보여준다", async () => {
  // scenario: "로그인 흐름" — 자격증명 오류 시 에러 배너 노출
  // api: POST /auth/login 401 → { code: "INVALID_CREDENTIALS" } (auth_api.md 계약)
  server.use(
    http.post("/api/auth/login", () =>
      HttpResponse.json({ code: "INVALID_CREDENTIALS" }, { status: 401 }),
    ),
  );
  // 응답 형태(401·code 필드)는 auth_api.md에서 그대로 옮겼다. 임의로 지어내면
  // 에러 매핑이 실서버와 다르게 검증돼 거짓 통과한다.
  // 전역 happy-path 핸들러는 그대로 두고, 이 케이스에서만 401로 덮는다.
  // afterEach의 resetHandlers()가 되돌리므로 다음 케이스로 새지 않는다.
});
```

### 검증 실패는 요청이 나가지 않는 것까지 관찰

`onUnhandledRequest: "error"` 덕에, 검증 실패 케이스에서 폼이 실수로 요청을
보내면 테스트가 깨진다 — "검증이 막았어야 할 요청이 나갔다"는 회귀를 통합 레벨에서
잡는다.

---

## 예시 B — 주문 목록 흐름 (조회 → 필터 → 상세)

- **흐름**: 목록 페이지 진입 시 주문 조회 → 상태 필터 적용 → 항목 클릭 → 상세 진입.
- **진입점**: `src/pages/orders/OrderListPage.tsx`
- **테스트**: `test/pages/orders/OrderListPage.integration.test.tsx`
- **실제로 연결된 것**: 목록·필터·상세 컴포넌트, 필터 상태 스토어(zustand),
  `useOrdersQuery`/`useOrderDetailQuery`(react-query), 주문 API 요청 코드, 라우팅.
- **가로챈 경계**: `GET /api/orders`, `GET /api/orders/:id` 두 엔드포인트만 MSW로.
- **근거 도메인 스킬**: `orders_api.md`(목록·상세 응답 스키마, 쿼리 파라미터 계약),
  `orders_scenario.md`(조회→필터→상세 상태 전이·빈 결과 처리), `orders_domain.md`
  (필터 가능한 상태 값·엣지 케이스 근거). 빈 결과·상세 응답 모양을 여기서 유도했다.

### 여러 요청이 흐름 안에서 이어진다

필터를 바꾸면 `GET /api/orders?status=...`가 새 쿼리 키로 다시 나가고, 항목을
클릭하면 `GET /api/orders/:id`가 나간다. MSW 핸들러가 쿼리 파라미터·경로 파라미터를
읽어 응답을 달리 주므로, **react-query의 키 무효화·리패치·상세 캐싱이 실제로 도는지**를
그대로 검증할 수 있다.

### 단언은 목록의 변화에서

- 초기: 로딩 스피너 → `findAllByRole("row")`로 N행 등장.
- 필터 "배송중" 선택: `findByText`로 필터된 결과만 남고 다른 상태 행이 사라짐.
- 빈 결과 필터: `server.use`로 빈 배열 응답 → "주문이 없습니다" 빈 상태 UI 관찰.
- 항목 클릭: 상세 헤딩(`findByRole("heading", { name: /주문 #/ })`) 등장.

### 배울 점

- 필터 상태를 스토어 값으로 단언하지 않고 "화면에 남은 행"으로 단언했다 —
  필터 구현을 파생 셀렉터로 리팩터링해도 깨지지 않는다.
- 빈 상태·에러 상태를 각각 `server.use` 오버라이드로 만들어, 한 흐름의 분기들을
  같은 파일에 모았다.

---

## 두 예시의 공통 골격

```ts
// @vitest-environment jsdom
import { beforeAll, afterEach, afterAll, beforeEach } from "vitest";
import { http, HttpResponse } from "msw";
import { server } from "@test/msw/server";
import { renderWithHarness } from "@test/utils"; // 공용 test-utils 하니스

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  server.resetHandlers();   // 케이스별 server.use 오버라이드 해제
  resetAuthStore();         // zustand 잔류 제거
  // 하니스가 케이스마다 새 QueryClient(retry:false)를 제공
});
afterAll(() => server.close());
```

공통점: 둘 다 흐름을 구성하는 내부 모듈을 **하나도 목하지 않고** HTTP 경계만 MSW로
가로챘고, MSW 응답 형태는 `*_api.md` 계약에서·케이스와 단언은 `*_scenario.md`에서
유도했으며(작성 전 `domain-skill-reviewer`로 신뢰도 확인), 단언을 전부 **화면
관찰**에서 뽑고, 성공·실패·빈·지연 분기를 한 파일에 모으고 케이스마다 핸들러·
스토어·캐시를 리셋했다.

---

## 실패·방어 경로 예시 — 계약 위반 응답 → ErrorPage

성공 응답만 세운 통합 테스트는 절반짜리다(SKILL 최우선 원칙 4). 아래는 성공
스키마를 **일부러 어긴** 응답으로 zod 검증이 throw하고 화면이 ErrorPage(에러
폴백)로 전환되는지 관찰하는 케이스다. 같은 흐름 파일에 성공 케이스와 나란히 둔다.

```ts
it("응답이 계약을 위반하면 검증이 throw하고 ErrorPage로 전환된다", async () => {
  // scenario: "주문 목록 흐름" — 응답 계약 위반은 화면을 에러 폴백으로 전환 (orders_scenario.md 핵심 제약)
  // api: GET /api/orders 성공 계약은 { items: [{ id, status: "shipped"|"pending"|… }], total: number } (orders_api.md).
  //      아래는 필수 status 필드를 빼고 total을 string으로 준, 계약을 일부러 어긴 바디다.
  server.use(
    http.get("/api/orders", () =>
      HttpResponse.json({
        items: [{ id: "o-1" /* status 누락 → zod throw */ }],
        total: "3", // number 계약을 string으로 위반
      }),
    ),
  );

  renderWithHarness(<OrderListPage />);

  // zod 검증이 throw → 상위 ErrorBoundary가 잡아 ErrorPage로 전환된다.
  // 관찰 단언: 목록 행이 아니라 에러 폴백이 뜬다.
  expect(await screen.findByRole("heading", { name: /문제가 발생했습니다/ })).toBeVisible();
  expect(screen.queryByRole("row")).not.toBeInTheDocument();
});
```

null·빈 경계도 같은 방식으로 만든다 — nullable 아닌 필드를 `null`로 주거나 배열을
비워, 설계상 ErrorPage로 튕겨야 하면 위와 같이 에러 폴백을, graceful 처리(빈 상태)가
계약이면 "주문이 없습니다" 빈 상태 UI를 단언한다. 어느 쪽이 맞는지는
`orders_scenario.md`의 핵심 제약·`orders_domain.md`에서 유도하고, 위반 바디의 근거는
항상 `// api:` 주석으로 남긴다. 정확한 MSW v2 문법은
[`msw-mocking`](../msw-mocking/SKILL.md)을 본다.

---

## 통합 테스트 실전 함정 — MSW·흐름에서 반복해 부딪힌 것들

RTL 자체의 함정(자동 cleanup 미등록, `userEvent.setup()`의 클립보드 교체, 접근명이
겹치는 버튼, `throwOnError` 훅)은 단위 규약과 동일하니 그쪽 `examples.md`를 함께
본다. 아래는 **통합·MSW 고유**의 함정이다.

| 증상 | 진짜 원인 | 대응 |
| --- | --- | --- |
| 앞 케이스의 401이 뒤 케이스에도 나옴 | `afterEach`에서 `resetHandlers()` 누락 | 라이프사이클 훅 3종 세트 고정 |
| 첫 케이스는 통과, 두 번째부터 옛 데이터가 보임 | QueryClient를 재사용해 캐시가 잔류 | 케이스마다 새 QueryClient(하니스가 제공) |
| 실패 응답인데 테스트가 계속 로딩에 멈춤 | `retry`가 켜져 있어 에러 UI까지 지연 | `retry: false` |
| "Unhandled request" 로 스위트가 죽음 | 흐름이 예상 못 한 요청을 보냄 | 핸들러 누락인지 흐름 버그인지 판정(신호로 취급) |
| 지연 응답 스피너 단언이 불안정 | 응답 반영 전/후 타이밍을 `getBy`로 즉시 단언 | `findBy*`/`waitFor`로 등장·소멸을 각각 대기 |

### 1. `resetHandlers()`를 빠뜨리면 실패 응답이 샌다

`server.use(...)`로 특정 케이스에서만 401을 줬는데 `afterEach`에서
`resetHandlers()`를 하지 않으면, 그 오버라이드가 뒤 케이스로 그대로 넘어간다.
증상은 "관계없는 성공 케이스가 갑자기 에러 UI를 띄운다"로 엉뚱하게 나타난다.
여기서 단언을 눅이지 말고 라이프사이클 훅부터 확인한다.

### 2. QueryClient·스토어 잔류가 흐름 오염으로 위장한다

통합 테스트는 실제 상태를 쓰므로, 캐시와 스토어도 실제로 잔류한다. 케이스마다
새 QueryClient를 만들지 않으면 앞 흐름의 목록 데이터가 뒤 흐름에 보인다. 스토어도
`afterEach`에서 초기화한다. 이건 목킹 문제가 아니라 **실제 연결의 대가**이며, 정리로
해결하지 단언 약화로 덮지 않는다.

### 3. `onUnhandledRequest: "error"`는 버그 탐지기다

"Unhandled request" 실패를 귀찮다고 `"bypass"`로 끄면, 흐름이 몰래 보내는 잘못된
요청을 놓친다. 이 에러는 통합 테스트가 잡아낸 **실제 신호**일 때가 많다 — 핸들러를
추가할지, 흐름의 요청 로직을 고칠지 먼저 판정한다.

### 공통 교훈

통합 테스트의 함정은 대부분 **케이스 간 상태 누수**가 단언 실패로 위장하는 형태다.
단언을 약화시키기 전에 "이게 흐름의 동작 문제인가, 케이스 격리(핸들러·캐시·스토어)
문제인가"를 먼저 묻는다. 한 번 밝혀진 함정은 개별 테스트가 아니라 **공용 하니스·MSW
서버 설정·이 문서**가 흡수해서, 다음 사람이 같은 자리에서 넘어지지 않게 한다.
