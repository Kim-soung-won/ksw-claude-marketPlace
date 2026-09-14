# MSW v2 골드 스니펫 (Node/vitest 통합 테스트)

`SKILL.md`의 v2 API를 통합 테스트에 바로 배치한 형태다. `integration-test-authoring`
규약의 "HTTP 경계만 MSW로 가로챈다"와 "응답은 도메인 스킬 `*_api.md` 계약 그대로
만든다"(최우선 원칙 0)를 함께 지킨 예시로, 그대로 복사해 URL·필드만 계약에 맞춘다.

## 목차

- 1. handlers.ts — 해피패스 핸들러 묶음 (전역 등록용)
- 2. server.ts + 라이프사이클 — setupServer 한 번, listen/reset/close
- 3. 테스트별 오버라이드 — 401 / 500 / 네트워크 에러 / 지연
- 4. POST 바디 검증 핸들러 — request.json() 으로 요청 계약 확인

---

## 1. handlers.ts — 해피패스 핸들러 묶음

모든 흐름의 **정상 응답**을 한곳에 모아 전역 등록한다. 실패/엣지는 여기 넣지 않고
각 테스트에서 오버라이드한다.

```ts
// test/msw/handlers.ts
import { http, HttpResponse } from 'msw'

// 응답 본문·상태코드·필드는 도메인 스킬 auth_api.md / orders_api.md 계약 그대로.
// (integration-test-authoring 최우선 원칙 0 — 상상으로 지어내지 않는다)
export const handlers = [
  // api: POST /api/auth/login 200 → { token, user } (auth_api.md)
  http.post('/api/auth/login', () =>
    HttpResponse.json({ token: 'tok_ok', user: { id: 1, name: 'Ada' } }),
  ),

  // api: GET /api/orders 200 → Order[] (orders_api.md)
  http.get('/api/orders', () =>
    HttpResponse.json([
      { id: 'o-1', total: 12000, status: 'PAID' },
      { id: 'o-2', total: 3000, status: 'PENDING' },
    ]),
  ),

  // api: GET /api/orders/:id 200 → Order (orders_api.md)
  http.get<{ id: string }>('/api/orders/:id', ({ params }) =>
    HttpResponse.json({ id: params.id, total: 12000, status: 'PAID' }),
  ),
]
```

---

## 2. server.ts + 라이프사이클

`setupServer`는 **한 번만** 호출한다(파일당 서버 하나). 테스트 파일은 이 서버를
import해 라이프사이클만 건다.

```ts
// test/msw/server.ts
import { setupServer } from 'msw/node'
import { handlers } from './handlers'

export const server = setupServer(...handlers)
```

```ts
// test/pages/orders/OrderListPage.integration.test.tsx 상단
import { beforeAll, afterEach, afterAll } from 'vitest'
import { server } from '@test/msw/server'

// 미매칭 요청을 에러로 드러내 누락 핸들러를 조기에 잡는다.
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
// server.use 오버라이드를 되돌려 케이스 간 격리를 지킨다.
afterEach(() => server.resetHandlers())
afterAll(() => server.close())
```

> zustand 스토어·react-query 캐시 리셋은 통합 테스트 규약(`integration-test-authoring`)의
> 라이프사이클과 함께 건다. 여기서는 MSW 서버 부분만 보인다.

---

## 3. 테스트별 오버라이드 — 401 / 500 / 네트워크 에러 / 지연

실패·엣지 시나리오는 그 테스트 안에서 `server.use(...)`로만 만든다. 전역 핸들러를
고치지 않는다.

```ts
import { http, HttpResponse, delay } from 'msw'
import { server } from '@test/msw/server'

it('자격증명 오류(401)면 에러 배너를 보여준다', async () => {
  // scenario: "로그인 흐름" — 401 실패 시 에러 배너 (auth_scenario.md)
  // api: POST /api/auth/login 401 → { code: 'INVALID_CREDENTIALS' } (auth_api.md)
  server.use(
    http.post('/api/auth/login', () =>
      HttpResponse.json({ code: 'INVALID_CREDENTIALS' }, { status: 401 }),
    ),
  )
  // …제출 후 findByText로 에러 메시지 노출을 관찰
})

it('서버 오류(500)면 재시도 안내를 보여준다', async () => {
  // api: GET /api/orders 500 (바디 없는 상태 응답)
  server.use(
    http.get('/api/orders', () => new HttpResponse(null, { status: 500 })),
  )
})

it('네트워크가 끊기면 오프라인 안내를 보여준다', async () => {
  // 상태코드 에러(4xx/5xx)가 아니라 응답 자체가 없는 네트워크 실패.
  server.use(http.get('/api/orders', () => HttpResponse.error()))
})

it('응답이 느리면 스피너가 보였다가 사라진다', async () => {
  // 로딩 UI 검증: 지연 중 스피너 등장 → 응답 후 소멸을 findBy*로 관찰
  server.use(
    http.get('/api/orders', async () => {
      await delay(500)
      return HttpResponse.json([{ id: 'o-1', total: 12000, status: 'PAID' }])
    }),
  )
})
```

> "첫 요청 실패 → 재시도 성공" 흐름은 세 번째 인자 `{ once: true }`로 만든다:
> `http.get('/api/orders', () => new HttpResponse(null, { status: 500 }), { once: true })`
> — 첫 매칭만 500을 주고 이후는 전역 해피패스로 폴백한다.

---

## 4. POST 바디 검증 핸들러 — request.json()

핸들러가 요청 바디를 읽어 **요청 계약대로 보냈는지**까지 검증한다. `request`는
Fetch Request이므로 `await request.json()`으로 읽는다.

```ts
// api: POST /api/orders — 요청 { items: [{ sku, qty }] } → 201 { id } (orders_api.md)
server.use(
  http.post('/api/orders', async ({ request }) => {
    const body = (await request.json()) as { items: { sku: string; qty: number }[] }

    // 요청 계약 위반이면 400 — 흐름이 계약대로 직렬화하는지 검증한다.
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return HttpResponse.json({ code: 'EMPTY_CART' }, { status: 400 })
    }

    return HttpResponse.json({ id: 'o-new' }, { status: 201 })
  }),
)
```

```ts
// path 파라미터 + 쿼리 파라미터를 함께 읽는 예시
http.get<{ id: string }>('/api/orders/:id', ({ request, params }) => {
  const id = params.id                                   // 항상 string
  const expand = new URL(request.url).searchParams.get('expand')  // 쿼리
  return HttpResponse.json({ id, items: expand ? [] : undefined })
})
```

> 바디를 두 번 읽어야 하면(예: 로깅 후 파싱) 먼저 `request.clone()` 한다 —
> 스트림은 한 번만 소비된다.
</content>
