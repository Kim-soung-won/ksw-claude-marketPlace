---
name: mfe-shared-query-client
description: >-
  Module Federation(React + rsbuild + `@module-federation/*`) 환경에서 Host 와 Remote 가
  react-query 캐시를 하나로 쓰게 하는 QueryClientBridge 패턴의 팀 표준 규약·기준 구현·
  적용/점검 절차. "react-query 캐시가 host랑 remote랑 따로 놀아", "QueryClient 중복",
  "QueryClientBridge", "getQueryClient", "remote에서 queryClient 어떻게 써",
  "host에서 조회가 안 돼", "setQueryData가 화면에 반영 안 돼", "fetchQuery가 캐시를 못 타",
  "ExportDependencyProvider에 QueryClientProvider 넣어도 돼?", "remote 단독 실행 queryClient",
  "Bridge 패턴 적용해줘", "Bridge 패턴 점검해줘", "Remote에 QueryClientBridge 이전해줘"
  같은 요청·질문에 트리거한다. 중복이 생기는 세 층(라이브러리·Provider·인스턴스)을 구분하고,
  Host 단일 Provider·렌더 중 등록·getQueryClient 폴백 규약과 기존 모듈 점검·이전
  체크리스트(grep 명령 포함)를 다룬다.
---

# MFE 공유 QueryClient — QueryClientBridge 패턴

Host 와 Remote 가 react-query 캐시를 **하나의 `QueryClient`** 로 쓰게 하는 팀 표준이다.
핵심은 "Provider 는 Host 하나, 컴포넌트 밖 코드는 `getQueryClient()` 하나"다.

> 증상에서 출발했다면(캐시가 안 맞는다, 화면에 반영이 안 된다) 이 문서 §1 로 층을 먼저 가른다.
> 상위 진단 절차와 shared 정책 원본은 §8 의 관련 문서를 본다.

---

## 1. 중복이 생기는 세 층

같은 "캐시가 따로 논다"라도 층마다 원인과 해법이 다르다. **위에서부터** 배제한다.

| 층 | 원인 | 증상 | 해법 |
|---|---|---|---|
| **1. 라이브러리** | `@tanstack/react-query` 가 Host·Remote 양쪽 `shared` 에 `singleton: true` 가 아니거나 버전 범위가 안 맞아 두 벌 로드 | Context 가 끊겨 `useQueryClient()` 자체가 `No QueryClient set` 으로 실패 | `shared` 정렬. **Bridge 로 못 고친다**(전제 조건) |
| **2. Provider** | Remote 노출 래퍼(`ExportDependencyProvider`)가 자체 `QueryClientProvider` 로 다시 감쌈 | Remote 화면 안의 훅이 Host 와 다른 캐시를 봄 | 노출 래퍼에서 `QueryClientProvider` 제거 |
| **3. 인스턴스 (핵심)** | 컴포넌트 밖 코드가 모듈 전역 `queryClient` 를 직접 import | Host 조립 시 조회 안 됨, `setQueryData` 가 화면에 반영 안 됨, `fetchQuery` 캐시 미스 | `getQueryClient()` 로 교체 + Bridge |

### 층 2 실제 사례

한 모듈은 노출 래퍼 안에 자체 `QueryClientProvider` **와** Bridge 를 같이 두고 있었다.
Bridge 는 가장 가까운 Provider 의 client 를 등록하므로, Host 가 아니라 **자기 client** 를
등록하고 있었다. Bridge 가 있어도 층 2 가 남아 있으면 소용없다.

### 층 3 이 생기는 구조

Remote 의 `export const queryClient = new QueryClient()` 는 import 되는 순간 인스턴스가 생긴다.

- **단독 실행** — standalone `QueryClientProvider` 가 이 인스턴스를 쓰므로 정상이다.
  이것은 단독 실행 방어책이므로 **지우지 않는다**.
- **Host 조립** — 화면은 Host 의 Provider 아래에서 렌더된다. 이때 컴포넌트 밖 코드
  (쿼리 클래스의 `initialData`·`setQueryData`, lib 함수의 `fetchQuery`)가 전역 `queryClient`
  를 직접 쓰면 **어떤 Provider 와도 연결되지 않은 고아 인스턴스**를 건드린다.
- 컴포넌트 안의 훅(`useQuery`·`useMutation`·`useQueryClient`)은 Context 를 타므로 문제없다.

---

## 2. 규약

| # | 규약 | 이유 |
|---|---|---|
| R1 | **Host 만 `QueryClientProvider` 를 소유한다.** Remote 노출 래퍼에는 `QueryClientProvider` 를 두지 않는다 | 래퍼에 두면 캐시가 갈린다(층 2). 대신 **Host 가 Remote 마운트 지점을 반드시 Provider 로 감싸야 한다**는 전제가 생긴다 |
| R2 | Remote 의 모듈 전역 `queryClient` 는 **유지한다** | standalone Provider 와 폴백용 |
| R3 | `QueryClientBridge` 를 **노출 래퍼**와 **standalone `QueryClientProvider`** 양쪽에서 **children 보다 앞**에 렌더한다 | 두 실행 경로 모두에서 활성 client 를 등록해야 한다 |
| R4 | 컴포넌트 밖 코드는 **`getQueryClient()` 만** 쓴다. 전역 `queryClient` 직접 import 는 standalone Provider 파일에서만 허용한다 | 층 3 차단 |
| R5 | Bridge 는 **렌더 중에** 등록한다(`useEffect` 아님) | 아래 "렌더 중 등록인 이유" |
| R6 | `getQueryClient()` 는 **throw 하지 않고** 모듈 singleton 으로 폴백한다 | 이전 구현은 throw 해서 첫 렌더의 `initialData` 에서 화면이 깨질 수 있었다 |
| R7 | Bridge 는 `useQueryClient()` 대신 **`useContext(QueryClientContext)`** 로 읽는다 | Provider 가 없어도 Bridge 자체가 터지지 않고 폴백한다 |

### 렌더 중 등록인 이유 (R3·R5)

- 쿼리 옵션의 `initialData` 함수 등은 **children 의 첫 렌더 중에** 실행된다.
  `useEffect` 는 렌더 이후에 돌므로, effect 로 등록하면 첫 렌더가 **등록 전 client** 를 본다.
- React 는 형제를 앞에서부터 렌더한다. children **앞**에 둔 Bridge 의 렌더 중 대입이
  children 렌더보다 먼저 일어난다. 뒤에 두면 이 보장이 사라진다.
- 같은 값을 다시 넣는 대입이라 리렌더·StrictMode 이중 렌더에도 **멱등**이다.

---

## 3. 기준 구현

아래를 그대로 쓴다. 기본 옵션 값은 모듈 사정에 맞게 조정해도 되지만 함수 구조는 바꾸지 않는다.

`src/shared/lib/react-query/queryClient.ts`:

```ts
import { QueryClient, QueryClientContext } from "@tanstack/react-query";
import { useContext } from "react";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false, staleTime: 1000 * 60 * 3 },
  },
});

let activeQueryClient: QueryClient | null = null;

export function setQueryClient(client: QueryClient) {
  activeQueryClient = client;
}

/** React 밖에서 현재 활성 QueryClient. 주입 전·standalone 이면 모듈 싱글턴으로 폴백 */
export function getQueryClient(): QueryClient {
  return activeQueryClient ?? queryClient;
}

/** 렌더 중에 대입한다(멱등). 반드시 children 보다 앞에 둔다. */
export function QueryClientBridge() {
  const hostQueryClient = useContext(QueryClientContext);
  setQueryClient(hostQueryClient ?? queryClient);
  return null;
}
```

`src/shared/lib/react-query/index.ts`:

```ts
export { queryClient, getQueryClient, QueryClientBridge } from "./queryClient";
```

### 노출 래퍼

```tsx
export const ExportDependencyProvider = ({ children }) => (
  <div className={process.env.VITE_MODULE_NAME}>
    {/* children 보다 앞에서 host 의 QueryClient 를 쿼리 클래스에 주입한다. */}
    <QueryClientBridge />
    <I18nextProvider i18n={i18nInstance}>
      <WeAiTemplateProvider>{children}</WeAiTemplateProvider>
    </I18nextProvider>
  </div>
);
```

노출 래퍼 자체(모듈 루트 `div`·i18n·템플릿 Provider)는 유지한다. 빠지는 것은
`QueryClientProvider` 하나다.

### standalone Provider

```tsx
<QueryClientProvider client={queryClient}>
  <QueryClientBridge />
  {children}
  <ReactQueryDevtools … />
</QueryClientProvider>
```

이 파일이 전역 `queryClient` 를 직접 import 할 수 있는 유일한 곳이다(R4).

### 사용처 변경

| 이전 | 이후 |
|---|---|
| `queryClient.getQueryData(k)` | `getQueryClient().getQueryData(k)` |
| `queryClient.setQueryData(k, v)` | `getQueryClient().setQueryData(k, v)` |
| `queryClient.fetchQuery(opts)` | `getQueryClient().fetchQuery(opts)` |
| BaseQueries 류의 `static setQueryClient(c)` + `_queryClient ?? remoteQueryClient` 게터 | `protected get queryClient() { return getQueryClient(); }` |
| `useEffect(() => BaseQueries.setQueryClient(useQueryClient()))` 같은 부분 주입 | 삭제. Bridge 로 통일 |

---

## 4. 기존 모듈 점검·이전 절차

아래 체크리스트를 응답에 복사해 모듈별로 진행 상황을 표시한다.

```
QueryClientBridge 점검: <module>
- [ ] 0. Host/Remote 판정 — exposes 가 없으면 Host 다(Bridge 대상 아님, Provider 소유 쪽만 확인)
- [ ] 1. shared 대조 — @tanstack/react-query 가 양쪽 singleton, 버전 범위 호환
- [ ] 2. 노출 래퍼에 QueryClientProvider 가 없음
- [ ] 3. 노출 래퍼·standalone Provider 양쪽에 Bridge 가 children 앞에 있음
- [ ] 4. Bridge 가 렌더 중 등록 + useContext 사용, getQueryClient 가 throw 하지 않음
- [ ] 5. 컴포넌트 밖의 전역 queryClient 직접 사용을 getQueryClient() 로 교체
- [ ] 6. 부분 주입(BaseQueries.setQueryClient 등) 제거
- [ ] 7. 검증 통과(tsc·eslint·host 조립 확인)
```

### 0. Host/Remote 판정

```bash
grep -n "exposes" <module>/rsbuild.config.ts
```

`exposes` 가 없으면 Host 다. Host 는 `QueryClientProvider` 가 Remote 마운트 지점을 감싸는지만
확인한다.

### 1. shared 대조

```bash
grep -n '"@tanstack/react-query"' -A4 <host>/rsbuild.config.ts <remote>/rsbuild.config.ts
grep -n '"@tanstack/react-query"' <host>/package.json <remote>/package.json
```

양쪽 모두 `singleton: true` 이고 `package.json` 버전 범위가 같은 major 를 가리켜야 한다.
여기서 어긋나면 층 1 이다 — 나머지 단계보다 먼저 고친다.

### 2·3. 노출 래퍼와 standalone Provider

```bash
grep -rn "QueryClientProvider\|QueryClientBridge" <remote>/src/export <remote>/src/app/providers
```

- 노출 래퍼에 `QueryClientProvider` 가 있으면 제거한다(층 2).
- Bridge 가 children **뒤**에 있거나 한쪽에만 있으면 R3 대로 고친다.

### 4. Bridge·getQueryClient 구현

```bash
grep -rn -A6 "export function QueryClientBridge\|export function getQueryClient" <remote>/src/shared/lib/react-query
```

`useEffect` 로 등록하거나, `useQueryClient()` 를 쓰거나, `getQueryClient` 가 `throw` 하면
§3 기준 구현으로 통째로 교체한다.

### 5. 전역 queryClient 직접 import 찾기

```bash
grep -rnE 'import \{ queryClient( as \w+)? \} from "@/shared/lib/react-query' src \
  | grep -v app/providers/QueryClientProvider
```

- 결과 파일마다 실제 사용처를 `getQueryClient()` 로 바꾸고 import 를 교체한다.
- **import 만 하고 쓰지 않는 파일은 건드리지 않는다**(이번 변경 범위 밖).
- 줄바꿈된 체이닝도 바꾼다. 아래처럼 `queryClient` 로 끝나는 줄을 따로 찾는다.
  ```bash
  grep -rnE '(^|[^.[:alnum:]_])queryClient\s*$' src
  ```
  ```ts
  // 이 형태도 대상이다
  queryClient
    .getQueryData(key)
  ```
- `as` 별칭(`queryClient as remoteQueryClient`)으로 들어온 경우 별칭 이름으로도 사용처를 찾는다.

### 6. 부분 주입 제거

```bash
grep -rn "setQueryClient(" src | grep -v shared/lib/react-query
```

`useEffect(() => BaseQueries.setQueryClient(useQueryClient()))` 류와 클래스의
`static setQueryClient` 는 지우고 §3 의 게터로 바꾼다.

### 7. 검증

1. `tsc --noEmit` — 오류가 나면 고치고 다시 실행한다.
2. eslint — 미사용 import(교체 후 남은 `queryClient`)를 정리한다.
3. **Host 조립 확인** — Host 에 Remote 를 붙여 Remote 화면에서 `setQueryData`·`invalidateQueries`
   를 일으키고, **Host 의 React Query Devtools** 에 해당 queryKey 가 보이는지 확인한다.
4. **단독 실행 확인** — Remote 를 단독으로 띄워 같은 화면이 정상인지 확인한다(R2 폴백 경로).

3 에서 키가 안 보이면 §1 의 층을 위에서부터 다시 배제한다.

---

## 5. 함정

- **효과 없는 `initialData`** — 같은 queryKey 를 읽는
  `initialData: () => getQueryClient().getQueryData(queryKey)` 는 아무 효과가 없다.
  캐시가 있으면 이미 그 값을 쓰고, 없으면 `undefined` 다. 발견하면 정리한다.
- **queryKey 타입 불일치** — 숫자 `id` 와 문자열 `` `${id}` `` 는 다른 queryKey 다.
  `[root, id]` 로 조회하면서 ``[root, `${id}`]`` 로 `initialData` 를 읽으면 연결이 어긋난다.
  키 팩토리에서 타입을 하나로 고정한다.
- **전역 가변 상태의 한계** — `activeQueryClient` 는 모듈 전역 하나다. 서로 다른
  `QueryClient` 를 쓰는 Host 가 동시에 둘이면 마지막 등록이 이긴다. 현 구조는 Host 1개라
  문제없지만, Host 가 늘어나는 구조로 바뀌면 §6 의 인자 전달 방식을 다시 검토한다.
- **Provider 없는 마운트** — R1 때문에 Host 가 Remote 마운트 지점을 감싸지 않으면 Remote
  훅이 실패한다. Bridge 는 폴백으로 버티지만 `useQuery` 는 버티지 못한다.

---

## 6. 검토했지만 채택하지 않은 대안

| 대안 | 장점 | 채택하지 않은 이유 |
|---|---|---|
| client 를 인자로 넘기기(react-query v5 의 `queryFn` context `client` + lib 함수 인자) | 전역 상태·렌더 타이밍 문제가 없다 | 컴포넌트 밖 코드마다 client 를 넘겨야 하고, 습관적 전역 import 를 막을 장치가 없다. 코드 수고가 적은 Bridge 를 택했다 |
| 노출 래퍼에 자체 `QueryClientProvider` | Remote 가 Host 에 의존하지 않는다 | 캐시가 갈린다(층 2). 금지 |

직접 import 실수를 기계적으로 막고 싶으면 ESLint `no-restricted-imports` 로
`@/shared/lib/react-query` 의 `queryClient` import 를 금지하고, standalone Provider 파일만
override 로 허용하는 선택지가 있다.

---

## 7. 보고 형식

점검·이전을 마치면 모듈별로 아래 형태로 요약한다.

```markdown
**모듈**: {이름} ({Host | Remote})
**층 판정**: {층 1/2/3 중 해당 항목, 없으면 "해당 없음"}
**변경 파일**: {경로 — 무엇을 바꿨는지}
**건드리지 않은 파일**: {import 만 하고 쓰지 않는 파일 등, 이유}
**검증**: {tsc / eslint / host 조립 Devtools 확인 / 단독 실행 결과}
**확인 필요**: {확인하지 못한 가설·남은 위험}
```

---

## 8. 관련 문서

- 증상에서 출발하는 진단 — 같은 플러그인의
  [`../mfe-runtime-troubleshooting/SKILL.md`](../mfe-runtime-troubleshooting/SKILL.md) §5(계열 D. 상태 공유)
- shared 정책·통신 규약 원본 —
  [`../../resources/mfe-config-architect/mf-config-reference.md`](../../resources/mfe-config-architect/mf-config-reference.md)
  (§3 `shared` 표, §7 모듈 간 통신 규약)
