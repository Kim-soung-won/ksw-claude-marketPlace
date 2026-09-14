---
name: msw-mocking
description: >-
  Mock Service Worker(MSW) v2 문법으로 HTTP 요청을 모킹할 때 참조하는 API
  레퍼런스. "MSW 핸들러 작성", "Mock Service Worker", "MSW로 API 모킹",
  "setupServer 설정", "http.get 모킹", "http.post 모킹", "HttpResponse.json",
  "server.use로 오버라이드", "네트워크 에러 모킹", "지연 응답 모킹", "delay로 로딩 상태",
  "onUnhandledRequest error", "MSW v2 문법", "MSW 핸들러 라이프사이클",
  "path 파라미터 params 모킹", "요청 바디 검증 핸들러", "once true 일회성 응답"
  같은 요청·문구에 트리거한다. Node/vitest 통합 테스트에서 `msw/node`의
  setupServer로 HTTP 경계를 가로채는 상황에 맞춰, http 네임스페이스 핸들러 ·
  HttpResponse 응답 · 서버 라이프사이클 · server.use 오버라이드 · delay 지연 ·
  네트워크 에러 · path/query/body 파싱을 정확한 v2 시그니처로 정리한다. handlers.ts
  해피패스 묶음, 401/500/네트워크에러/지연 오버라이드, POST 바디 검증 핸들러의
  골드 스니펫은 examples.md에 있다.
---

# MSW 모킹 API 레퍼런스 (v2)

Node/vitest 통합 테스트에서 HTTP 경계를 MSW로 가로챌 때, **정확한 v2 문법**으로
핸들러·응답·서버 라이프사이클을 작성하기 위한 레퍼런스다. 같은 폴더의
`integration-test-authoring` 규약이 "내부는 실제로, HTTP 경계만 MSW로 가로챈다"는
방법론을 정하면, 이 스킬은 그 경계를 **어떤 v2 API로 정확히 구현하는가**를 담는다.

> 📎 통합 테스트 맥락에서 바로 복사해 쓰는 골드 스니펫(handlers 묶음 ·
> setupServer 라이프사이클 · 실패/지연 오버라이드 · POST 바디 검증)은 같은
> 폴더의 [`examples.md`](./examples.md)에 있다. 실제 파일에 배치할 형태가
> 필요하면 그쪽을 읽는다.

---

## 최우선 원칙: v2 문법만 쓴다 (v1은 구버전 함정)

> **이 문서에서 가장 중요한 규칙이다.** MSW는 v2에서 API가 breaking change로
> 바뀌었다. 아래 표의 **왼쪽(v1)은 절대 쓰지 않는다.** v1 코드가 눈에 들어와도
> 그대로 옮기지 말고 오른쪽(v2)으로 옮겨 쓴다.

| v1 (쓰지 않는다) | v2 (이대로 쓴다) |
| --- | --- |
| `import { rest } from 'msw'` | `import { http, HttpResponse } from 'msw'` |
| `rest.get('/user', (req, res, ctx) => …)` | `http.get('/user', (info) => …)` |
| `res(ctx.json(body))` | `return HttpResponse.json(body)` |
| `res(ctx.status(401), ctx.json(body))` | `return HttpResponse.json(body, { status: 401 })` |
| `res(ctx.status(500))` | `return new HttpResponse(null, { status: 500 })` |
| `req.body` (파싱된 바디) | `await request.json()` (Fetch Request 직접 읽기) |
| `req.url.searchParams` | `new URL(request.url).searchParams` |
| `res(ctx.delay(500), …)` | `await delay(500); return …` |
| resolver 인자 `(req, res, ctx)` | resolver 인자 하나: `{ request, params, cookies, requestId }` |

v2 resolver는 `res`/`ctx`를 받지 않는다. **응답을 `return`으로 돌려준다.**

---

## 임포트

```js
import { http, HttpResponse, delay, passthrough } from 'msw'
import { setupServer } from 'msw/node'   // Node/vitest 환경
```

> 이 스킬은 **Node/vitest 통합 테스트** 맥락이라 `msw/node`의 `setupServer`를
> 쓴다. 브라우저에서 서비스 워커로 가로채는 `setupWorker`(`msw/browser`)는 이
> 맥락 밖이다.

---

## 핸들러 — `http` 네임스페이스

메서드: `http.get / post / put / patch / delete / all / head / options`.

```js
http.get('/user', ({ request, params, cookies, requestId }) => {
  return HttpResponse.json({ id: 1, name: 'Ada' })
})
```

resolver는 인자를 **하나의 객체**로 받는다: `{ request, params, cookies, requestId }`.

### request — Fetch API Request

바디는 `request`에서 **직접 비동기로** 읽는다.

| 바디 형식 | 읽는 법 |
| --- | --- |
| JSON | `await request.json()` |
| 텍스트 | `await request.text()` |
| 폼 데이터 | `await request.formData()` |
| ArrayBuffer | `await request.arrayBuffer()` |

- 같은 request 바디를 **두 번 읽어야** 하면 먼저 `request.clone()` 한다(스트림은
  한 번만 소비된다).
- 쿼리 파라미터: `const url = new URL(request.url); url.searchParams.get('page')`.

### path 파라미터 — `params`

경로에 `:name`을 쓰고 resolver의 `params`로 접근한다.

```ts
http.get<{ id: string }>('/posts/:id', ({ params }) => {
  const { id } = params
  return HttpResponse.json({ id })
})
```

| 패턴 | 의미 |
| --- | --- |
| `:id` | 필수 세그먼트 |
| `:id?` | 옵셔널 세그먼트 |
| `:segments+` | 반복 세그먼트 → `params.segments`가 **배열** |
| `\\:` | 리터럴 콜론 이스케이프 |

> ⚠️ `params` 값은 **항상 `string | string[]`**이다. MSW는 숫자로 파싱하지
> 않는다 — 숫자가 필요하면 resolver에서 직접 `Number(id)` 한다. 타입 제네릭
> `http.get<{ id: string }>(...)`으로 `params` 타입을 잡는다.

---

## 응답 — `HttpResponse` (Fetch Response 대체)

```js
HttpResponse.json(body, init)   // JSON, Content-Type: application/json 자동
HttpResponse.text(body, init)
HttpResponse.html(body, init)
HttpResponse.xml(body, init)
HttpResponse.formData(body, init)
HttpResponse.arrayBuffer(body, init)
```

| 상황 | 코드 |
| --- | --- |
| 성공 JSON | `return HttpResponse.json({ id: 1 })` |
| 에러 상태 + 바디 | `return HttpResponse.json({ errorMessage: 'Missing session' }, { status: 401 })` |
| 바디 없는 상태 응답 | `return new HttpResponse(null, { status: 500 })` |
| 헤더 지정 | `return new HttpResponse('Not found', { status: 404, headers: { 'Content-Type': 'text/plain' } })` |

### 상태코드 에러 vs 네트워크 에러 — 구분해서 쓴다

| 종류 | 코드 | 의미 |
| --- | --- | --- |
| **상태코드 에러(4xx/5xx)** | `HttpResponse.json(body, { status: 401 })` / `new HttpResponse(null, { status: 500 })` | **서버가 에러 상태로 응답**했다. 응답은 도착하며, 클라이언트의 에러 매핑·에러 UI가 이 응답을 받아 돈다. |
| **네트워크 에러** | `return HttpResponse.error()` | **서버 응답 자체가 없다**(연결 실패). `fetch`가 reject되는 상황을 재현한다. 상태코드가 아니다. |

"401을 받았을 때 에러 배너"는 `status: 401`, "네트워크가 끊겼을 때 재시도 안내"는
`HttpResponse.error()`로 각각 만든다.

---

## setupServer — Node/vitest

```js
const server = setupServer(...handlers)
```

| 메서드 | 하는 일 |
| --- | --- |
| `server.listen(options)` | 요청 가로채기 시작 |
| `server.use(...handlers)` | 런타임/테스트별 오버라이드 추가 (**초기 핸들러보다 우선**) |
| `server.resetHandlers(...)` | `use`로 추가한 런타임 핸들러 제거 (인자 주면 그 핸들러로 리셋) |
| `server.restoreHandlers()` | 일회성(`{ once: true }`)으로 소진된 핸들러를 되살림 |
| `server.close()` | 가로채기 종료 |

### 권장 라이프사이클 (vitest/jest 동일)

```js
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

- `onUnhandledRequest: 'error'` — 매칭되는 핸들러가 없는 요청을 **에러로**
  드러낸다. 누락 핸들러·예상 밖 요청을 조기에 잡는다.
- `afterEach`의 `resetHandlers()` — 케이스에서 `server.use`로 건 오버라이드를
  되돌려 **테스트 간 격리**를 지킨다. 빠뜨리면 앞 케이스의 실패 응답이 뒤로 샌다.

> ⚠️ 공식 명시 주의:
> - `setupServer`를 **여러 번 호출하지 않는다**(파일당 서버 하나).
> - Node 환경에는 브라우저 API(`location` · `localStorage`)가 **없다**.

---

## 2계층 오버라이드 — 해피패스는 전역, 예외는 테스트별

통합 테스트의 실패/엣지 시나리오는 이 패턴으로 만든다.

1. **해피패스 핸들러는 `setupServer(...handlers)`에 전역으로** 둔다(모든 흐름의
   기본 정상 응답).
2. **실패/엣지 응답은 각 테스트에서 `server.use(...)`로 오버라이드**한다 —
   초기 핸들러보다 우선하므로 그 케이스에서만 401/500/지연을 준다.
3. `afterEach(() => server.resetHandlers())`로 오버라이드를 걷어 격리한다.

```js
// 이 케이스에서만 401
server.use(
  http.post('/api/login', () =>
    HttpResponse.json({ code: 'INVALID_CREDENTIALS' }, { status: 401 }),
  ),
)
```

### 일회성 응답 — `{ once: true }`

세 번째 인자로 `{ once: true }`를 주면 **첫 매칭에만** 응답하고, 이후 요청은 초기
핸들러로 폴백한다. "첫 요청은 실패, 재시도는 성공" 같은 재시도 흐름에 쓴다.

```js
server.use(
  http.get('/api/orders', () => new HttpResponse(null, { status: 500 }), { once: true }),
)
```

---

## 지연 / 로딩 상태 — `delay`

```js
import { delay } from 'msw'

http.get('/api/orders', async () => {
  await delay(500)                 // 고정 500ms
  return HttpResponse.json(orders)
})
```

| 호출 | 지연 |
| --- | --- |
| `await delay(500)` | 고정 밀리초 |
| `await delay()` | 랜덤한 현실적 지연 |
| `await delay('infinite')` | 응답하지 않음 → **타임아웃 시나리오** |

로딩 UI 검증에 쓴다: 지연 중 스피너가 보였다가 응답 후 사라지는지를 관찰한다.

---

## passthrough / 미매칭 폴백

| resolver 반환 | 동작 |
| --- | --- |
| `return passthrough()` | 가로채지 않고 **실제 요청을 통과**시킨다 |
| 아무것도 반환 안 함 (`undefined`) | 다음 핸들러를 계속 탐색한다 |

---

## 진행 톤

- **v2 문법만 쓴다.** `rest` · `res(ctx…)` · `ctx.status` · `req.body`는 v1의
  구버전 함정이다. resolver는 인자 하나(`{ request, params, cookies, requestId }`)를
  받고 응답을 `return`한다.
- 응답은 `HttpResponse`로 만든다. 상태코드 에러(4xx/5xx)와 네트워크 에러
  (`HttpResponse.error()`)를 **구분**한다.
- 바디는 `await request.json()` 등으로 직접 읽고, path 파라미터는 `params`
  (항상 `string | string[]`)로, 쿼리는 `new URL(request.url).searchParams`로 읽는다.
- 라이프사이클은 `listen({ onUnhandledRequest: 'error' })` / `afterEach
  resetHandlers` / `afterAll close`. 해피패스는 전역, 예외는 `server.use` 오버라이드.
- 응답 본문·상태코드·에러 형태는 상상으로 짓지 않는다 — 통합 테스트 맥락에서는
  프로젝트 도메인 스킬의 `*_api.md` 계약 그대로 만든다(`integration-test-authoring`
  최우선 원칙 0과 연결). 계약대로 만든 골드 스니펫은
  [`examples.md`](./examples.md)에 있다.
</content>
</invoke>
