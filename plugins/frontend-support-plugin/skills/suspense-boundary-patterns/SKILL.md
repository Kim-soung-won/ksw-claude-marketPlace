---
name: suspense-boundary-patterns
description: >-
  React Suspense 경계(Suspense/ErrorBoundary)를 목록 조회·대시보드·상세 뷰에 어떻게
  배치하고, 검색·페이지네이션 같은 재조회 UX를 어떻게 매끄럽게 만들지 설계·리팩터링·리뷰할 때
  먼저 읽는 문서. "Suspense 적용", "useSuspenseQuery로 바꿔", "목록 로딩 처리", "검색하면
  화면 깜빡여", "페이지 넘길 때 스피너", "필터/목록 분리", "툴바가 사라져", "대시보드 로딩",
  "상세 다이얼로그 Suspense", "useDeferredValue", "keepPreviousData", "QueryErrorBoundary",
  "ErrorSuspenseBoundary", "StaleOverlay", "폴백이 전체를 덮어", "스켈레톤", "skeleton",
  "로딩 UI", "로딩 스피너 대신", "로딩하다 높이가 튀어", "레이아웃 출렁", "폴백 높이",
  "ErrorFallback", "PageErrorFallback", "오류 화면", "다시 시도", "에러 바운더리 계층",
  "폴백이 안 바뀌어" 키워드에 반응한다.
  최우선 원칙은 "최초 로드와 재조회를 분리한다"(최초=바운더리 폴백, 재조회=이전 데이터 유지)와
  "필터는 바운더리 밖, 데이터는 바운더리 안"(2레이어 분리)이며, useDeferredValue로 stale
  전환을 만들고, 대시보드는 위젯별 바운더리로 쪼갠다. 폴백 UI는 데이터의 모양이 정해졌는지로
  스피너·스켈레톤을 고르고 데이터 영역과 같은 크기를 차지하게 하며, 가장 가까운 Suspense가
  폴백을 정한다는 점을 따진다. 오류 폴백은 앱·페이지·위젯 계층으로 나누고 서버 메시지 우선·
  재조회 기반 다시 시도를 지킨다. 언제 Suspense를 쓰지 말아야 하는지
  (keepPreviousData 페이지네이션·폼 옵션 프리필·폴링)도 판별한다.
  데이터 패칭 콜로케이션의 기초는 component-design-patterns 스킬을 먼저 따른다.
---

# Suspense 경계 설계 패턴 (React + React Query)

목록 조회·대시보드·상세 뷰에 `useSuspenseQuery`를 도입할 때, **경계(Suspense/
ErrorBoundary)를 어디에 두고 재조회 UX를 어떻게 매끄럽게 만들지**를 일관되게
결정하기 위한 참조 문서다.

> 전제: "데이터 패칭은 컴포넌트와 함께 둔다", "pages 직속 목록·대시보드 기초 컴포넌트는
> `useSuspenseQuery`" 같은 기초는 **component-design-patterns** 스킬을 먼저 따른다.
> 이 문서는 그 위에서 **경계 배치와 재조회 UX**(규칙 1~5)와 **폴백 UI — 로딩·스켈레톤·오류
> 화면**(규칙 6~9)을 다룬다. mutation 결과 토스트와 쿼리 갱신은 **mutation-feedback-patterns**
> 를 따른다.

---

## 최우선 원칙: "최초 로드"와 "재조회"를 분리한다

`useSuspenseQuery`는 **쿼리 키가 바뀔 때마다 suspend**한다. 이 성질을 모르고 목록에
그냥 적용하면, 검색어를 치거나 페이지를 넘길 때마다 컴포넌트가 통째로 폴백으로
교체되어 **화면이 깜빡이고 입력 포커스가 날아간다**.

그래서 두 상황을 다르게 처리한다:

| 상황 | 처리 |
|------|------|
| **최초 로드** (캐시 없음) | Suspense 폴백(스켈레톤/스피너)을 보여준다 |
| **재조회** (페이지·필터·정렬 변경) | 이전 데이터를 **유지**하고 폴백을 띄우지 않는다 (dim만) |

이 원칙에서 아래 두 규칙이 파생된다: **바운더리 배치**(필터는 밖)와 **stale 유지**
(`useDeferredValue`).

---

## 규칙 1: 필터는 바운더리 밖, 데이터는 바운더리 안 (2레이어 분리)

검색 툴바·필터 컨트롤을 Suspense 바운더리 **안**에 두면, 목록이 재조회로 suspend될 때
**툴바까지 폴백으로 사라진다**. 그래서 컴포넌트를 두 레이어로 나눈다.

```
<FilterLayer>                     // 바운더리 밖 — 쿼리를 소비하지 않음
  <SearchToolbar />               // 항상 보임 (포커스 유지)
  <QueryErrorBoundary>            // = Suspense + ErrorBoundary
    <DataLayer />                 // 바운더리 안 — useSuspenseQuery로 소비
  </QueryErrorBoundary>
</FilterLayer>
```

- **필터 레이어**: 검색/필터 UI, 생성/삭제 버튼, 페이지 경로 UI 등 쿼리 결과에
  의존하지 않는 것. 여기서 바운더리를 소유한다.
- **데이터 레이어**: `useSuspenseQuery` + 테이블/목록 렌더. 로딩·에러는 바운더리가
  처리하므로 인라인 `isLoading/isError/isSuccess` 플래그는 상수(`false/true`)로 넘긴다.

> 코드 예시: [`examples.md`](./examples.md) §"필터/목록 2레이어 분리"

### 바운더리는 어디에 두나 — feature vs page

- 분리 후 **바운더리는 feature 컴포넌트(필터 레이어)가 소유**하게 두고, **페이지에서
  감싸던 바운더리는 제거**한다. 페이지가 감싸면 툴바가 다시 바운더리 안으로 들어간다.
- 페이지 바운더리가 `resetKeys`(필터 변경 시 에러 자동 해제)를 갖고 있었다면, 그
  `resetKeys`를 feature의 바운더리로 함께 옮긴다.

---

## 규칙 2: 재조회 폴백 방지 = `useDeferredValue` (+ StaleOverlay)

바운더리 밖으로 필터를 빼도, **데이터 레이어 자체**는 여전히 재조회 때 suspend해
테이블 영역이 깜빡인다. 이걸 막는 것이 `useDeferredValue`다.

지연된(이전) 값을 쿼리 키에 넣으면, 새 값으로의 재렌더가 suspend해도 React가
**폴백 대신 이전 화면을 유지**한다. 갱신 중임은 `isStale`로 판별해 dim 오버레이만
씌운다.

```tsx
const deferredKeyword = useDeferredValue(filterStore.keywords);
const deferredPage = useDeferredValue(filterStore.index);

const { data } = useSuspenseQuery(queryOptions({ keyword: deferredKeyword, page: deferredPage, ... }));

const isStale = deferredKeyword !== filterStore.keywords || deferredPage !== filterStore.index;
return <StaleOverlay isStale={isStale}>{/* 테이블 */}</StaleOverlay>;
```

> 코드 예시(공통 `useDeferredListFilter` 훅 + `StaleOverlay`): [`examples.md`](./examples.md) §"useDeferredValue로 stale 유지"

### 왜 `startTransition`이 아니라 `useDeferredValue`인가

- 상태 소스가 **Zustand 등 외부 스토어(`useSyncExternalStore`)** 면 `startTransition`이
  **먹지 않는다** — 외부 스토어 업데이트는 React가 항상 동기로 처리해 transition으로
  지연시킬 수 없다. `useDeferredValue`는 값 소스와 무관하게 동작하므로 이 구조의 정답이다.
- 상태가 `useState`로 컴포넌트 내부에 있으면 `startTransition(() => setState(...))`도
  가능하지만, 목록 필터는 대개 외부 스토어라 `useDeferredValue`로 통일하는 편이 안전하다.

### 부분 지연도 유효하다

쿼리 입력이 많으면(예: path/bucket/detailSearch 등) **상호작용 입력만**(keyword/page/
size/category/order) 지연하고, 폴더 이동·상세검색처럼 "맥락이 통째로 바뀌는" 입력은
직접 넘겨 자연스러운 최초-로드 폴백을 그대로 둔다. 지금 *바뀌는* 입력만 지연되면
그 전환은 매끄러워진다.

---

## 규칙 3: 대시보드는 위젯별 독립 바운더리

대시보드를 하나의 큰 바운더리로 묶으면 가장 느린 위젯 하나가 전체를 막는다.
위젯마다 Suspense를 두어 준비되는 대로 개별 렌더(progressive rendering)한다.

```tsx
<DashboardGrid>
  <QueryErrorBoundary colSpan={6}><RevenueCard /></QueryErrorBoundary>
  <QueryErrorBoundary colSpan={6}><TrafficChart /></QueryErrorBoundary>
</DashboardGrid>
```

- 병렬 로딩이 필요하면 한 컴포넌트에서 `useSuspenseQueries`로 묶거나, 라우트 진입 시
  `queryClient.prefetchQuery`로 render-as-you-fetch를 한다(워터폴 방지).

---

## 규칙 4: 툴바가 `refetch`/`isPending`에 얽혀 있으면 먼저 디커플링

툴바를 바운더리 밖으로 빼려는데 툴바의 버튼(생성/삭제/업로드)이나 자식이
`useSuspenseQuery`의 `refetch`·`isPending`을 쓰고 있으면, 그대로는 분리가 안 된다
(`refetch`는 바운더리 안 쿼리에서 나온다). 두 가지로 푼다:

1. **폴링이 이미 있으면** (`refetchInterval`) → 뮤테이션 후의 명시적 `refetch()`는 대개
   중복이다. 제거하면 폴링이 갱신을 대신한다. (수동 새로고침 버튼도 폴링과 중복이면 제거)
2. **폴링이 없거나 조건부면** → `refetch`를 `queryClient.refetchQueries({ queryKey: root })`
   /`invalidateQueries`로 바꿔 필터 레이어에서 호출한다. 바운더리 안 쿼리 인스턴스에
   의존하지 않으므로 툴바가 밖으로 나갈 수 있다.

> 코드 예시(refetch → queryClient 디커플링): [`examples.md`](./examples.md) §"refetch 디커플링"

---

## 규칙 5: 상세 뷰/다이얼로그 — 전체가 데이터에 의존하면 Suspense로

상세 다이얼로그 탭이나 상세 패널처럼 **컴포넌트 전체가 한 조회 결과에 의존**하면
`useSuspenseQuery` + 바운더리가 깔끔하다. 이때 자주 발견되는 버그를 함께 고친다:

- **에러와 빈 데이터 혼동**: `if (!isSuccess || !data) return <빈 데이터 />` 는 조회
  **실패**도 "데이터 없음"으로 잘못 표시한다. Suspense로 전환하면 **에러 → 바운더리의
  재시도 UI**, **빈 데이터 → 빈 메시지**로 정확히 분리된다.
- 기존 로딩 UI(예: `LoadingBlur`)는 버리지 말고 바운더리의 `fallback`으로 넘겨 UX를
  유지한다.
- 컴포넌트 **일부만** 데이터에 의존하면(상세 헤더는 즉시 표시 + 한 섹션만 로딩) 그
  **섹션만 서브 컴포넌트로 떼어** `useSuspenseQuery`로 감싼다. 통째로 전환하면 이미 있는
  데이터까지 폴백에 가려진다.

> 코드 예시(다이얼로그 탭 전환 / 섹션만 분리): [`examples.md`](./examples.md) §"상세 뷰 Suspense 전환"

### `<Dialog open>`은 닫히면 children을 언마운트하는가 확인

`enabled: open` 가드가 붙은 쿼리를 `useSuspenseQuery`로 옮기려면, 다이얼로그가 닫힌
동안 children을 **마운트하지 않는지** 먼저 확인한다(대개 `return open && createPortal(...)`
구조라 언마운트됨). 언마운트되면 `enabled: open`은 불필요해지고 안전하게 전환된다.
닫혀도 마운트되는 구조라면 suspend가 계속 걸리므로 전환하면 안 된다.

---

## 규칙 6: 로딩 폴백 고르기 — 스피너 vs 스켈레톤

폴백은 **"데이터가 오면 화면이 어떤 모양일지 지금 알 수 있는가"** 로 고른다.

| 상황 | 폴백 | 이유 |
|------|------|------|
| 모양이 정해진 영역(카드 묶음·표·상세 폼·로그인 같은 라우트 셸) | **스켈레톤** — 실제 레이아웃을 본뜬 회색 블록 | 자리를 미리 잡아 데이터가 와도 레이아웃이 움직이지 않고, 무엇이 뜰지 예고한다 |
| 모양이 데이터에 달린 영역(차트·자유 형식 결과·검색 결과 수가 크게 다른 목록) | **스피너** + 짧은 문구 | 틀린 모양을 그렸다가 바꾸면 스피너보다 더 크게 출렁인다 |
| 이미 데이터가 있는 재조회 | 폴백 없음 — 이전 데이터 유지 + dim | 규칙 2 |
| 수백 ms 안에 끝나는 조회 | 스피너(또는 지연 표시) | 스켈레톤이 번쩍이고 사라지기만 한다 |

- **스켈레톤은 실제 레이아웃을 본뜬다.** 같은 Grid·카드 개수·열 폭·줄 높이를 쓴다. 이름만
  `*.skeleton.tsx`이고 안에서 스피너를 그리면 스켈레톤이 아니다 — 파일 이름이 거짓말을 하지 않게
  스피너로 이름을 바꾸거나 실제 스켈레톤으로 만든다.
- **스켈레톤은 데이터 컴포넌트 옆에 둔다**(`usage-count-group.ui.tsx` ↔ `usage-count-group.skeleton.tsx`).
  레이아웃을 바꿀 때 함께 고치지 않으면 스켈레톤과 실제 화면이 어긋난다.
- 라우트 단위 지연 로딩(`lazy` + 라우트 `withSuspense`)은 **페이지 셸 스켈레톤**, 페이지 안
  데이터 영역은 그 영역 바운더리의 폴백 — 두 층이 같은 스피너를 겹쳐 그리지 않게 한다.

> 코드 예시(레이아웃을 본뜬 카드 스켈레톤): [`examples.md`](./examples.md) §"스켈레톤"

---

## 규칙 7: 폴백은 데이터 영역과 같은 크기를 차지한다

로딩·오류·빈 상태 UI가 데이터가 있을 때와 **다른 크기**를 차지하면, 상태가 바뀌는 순간
주변 레이아웃이 출렁인다.

- **높이가 정해진 영역**(차트 카드·고정 높이 표)은 폴백에 **같은 높이 값**을 준다. 같은 상수
  하나에서 파생해 두 값이 따로 놀지 않게 한다(숫자 px가 필요한 API와 CSS 길이가 필요한 API가
  섞이면 숫자 상수에서 문자열을 만든다).
- **남은 높이를 채우는 본문**(목록 페이지의 툴바 아래)은 폴백도 `flex: 1`로 채워 그 가운데에
  둔다. `height: 70vh` 같은 화면 기준 고정값은 다이얼로그·사이드 패널·작은 창에서 넘치거나
  위쪽에 붙는다.
- 낮은 자리(카드·차트·표 안)는 작은 크기의 상태 UI를 쓴다. 큰 스피너·큰 오류 화면을 넣고
  `overflow: hidden`으로 자르지 않는다.

> **사례**: 차트 카드의 로딩 영역이 라이브러리 기본값 220px, 데이터가 온 뒤 차트는 140px이라
> 로딩→데이터 전환마다 대시보드 아래쪽이 80px씩 위로 당겨졌다. 카드의 로딩 높이를 차트 높이
> 상수에서 파생해 해결했다.

---

## 규칙 8: 가장 가까운 Suspense가 폴백을 정한다

suspend는 **트리에서 가장 가까운** `Suspense`의 폴백을 띄운다. 바깥에 둔 바운더리의 폴백은
안쪽에 Suspense가 하나라도 있으면 보이지 않는다.

- 카드·차트 래퍼(HOC)가 **안에 Suspense를 내장**하고 있으면, 그 안쪽에 또 로딩 바운더리를 넣지
  않는다. 안쪽 바운더리가 래퍼의 폴백(전용 문구·높이)을 가로채 화면마다 로딩 UI가 달라진다.
  오류 처리가 필요하면 **래퍼 바깥**(그리드 칸 레벨)에서 감싼다 — 그러면 로딩은 래퍼가, 오류는
  바깥 바운더리가 카드 칸 전체를 대신한다.
- 반대로 페이지 바운더리 폴백을 보이고 싶은데 안 보이면, 그 사이에 다른 Suspense(래퍼 내장,
  라우트 `withSuspense`, 레이아웃 컴포넌트)가 있는지 먼저 찾는다.
- 바깥 바운더리에 그리드 칸 폭(`colSpan` 등)을 주는 컴포넌트를 래퍼 **안쪽**에 넣으면, 그리드가
  아닌 곳에 그리드 칸이 한 겹 더 생긴다.

> **사례**: 같은 차트 카드가 한 프로젝트는 "차트 데이터를 불러오는 중입니다" 문구와 고정 높이로,
> 다른 프로젝트는 문구 없는 큰 스피너로 보였다. 원인은 오류 바운더리를 카드 HOC **안**에 넣어
> 바운더리 자체 Suspense가 HOC 내장 Suspense보다 가까워진 것이었다.
>
> 코드 예시(래퍼 내장 Suspense와 바운더리 위치): [`examples.md`](./examples.md) §"내장 Suspense가 있는 래퍼"

---

## 규칙 9: 오류 폴백 — 계층과 문구

### 세 계층으로 둔다

| 계층 | 두는 곳 | 하는 일 |
|------|---------|---------|
| **앱·노출 모듈 최상위** | 라우터·MFE 노출 컴포넌트 루트의 `ErrorBoundary` | 마지막 방어선. 런타임 오류까지 받아 "예기치 않은 오류" 화면. 여기서 로딩 문구를 띄우지 않는다 |
| **페이지·feature** | 데이터 레이어 바깥의 쿼리 바운더리(규칙 1) | 목록·상세 조회 실패를 그 영역만 오류 화면으로 바꾸고 툴바는 남긴다 |
| **위젯** | 대시보드 카드·차트 칸(규칙 3) | 한 위젯 실패가 다른 위젯을 가리지 않게 칸 단위로 |

### 문구는 서버 메시지 우선

- 오류 화면 문구는 **서버가 보낸 메시지**(응답 본문 `message` → `error`)를 먼저 보여 주고,
  없을 때만 고정 문구를 쓴다. 서버는 실패 이유와 사용자가 할 일(권한·중복·한도)을 알고 있다.
- `error.message`는 쓰지 않는다 — axios 오류면 "Request failed with status code 500", 런타임·zod
  오류면 개발자용 원문이다. 상태 코드별 안내(예: 503이면 "외부 저장소 연결 안 됨")가 필요하면
  그 상태만 골라 문구를 정하고 나머지는 서버 메시지 규칙에 맡긴다.
- 제목은 "무엇을 못 했는지"(예: "배포 목록을 불러오지 못했습니다"), 본문은 서버가 알려 준 이유.

### 다시 시도는 실패한 조회의 재조회다

- react-query는 실패한 suspense 쿼리의 오류를 캐시에 남긴다. 바운더리만 리셋하면 다시 마운트된
  자식이 **같은 오류를 곧바로 다시 던진다** → `QueryErrorResetBoundary`의 `reset`으로 오류 상태를
  풀고 리셋해야 재조회가 된다. 바운더리에 `queryKey`를 받아 `refetchQueries`하는 방식은 범위가
  넓거나(루트 키 전체 재조회) 리셋 전에 다시 던져진다.
- 필터·검색어·선택 id가 바뀌면 `resetKeys`로 오류를 자동 해제한다. 해제 경로(버튼·resetKeys)
  양쪽에서 쿼리 오류 reset이 실행돼야 한다.
- `window.location.reload()`로 다시 시도하지 않는다 — 필터·스크롤·열린 패널을 잃고, MFE에서는
  호스트 전체가 다시 로드된다.
- 오류를 빈 데이터로 보여 주지 않는다(규칙 5) — 실패는 오류 화면, 성공했는데 비면 빈 상태.

> 코드 예시(계층별 오류 폴백 · 상태 코드별 문구): [`examples.md`](./examples.md) §"오류 폴백 계층"

---

## 언제 Suspense를 쓰지 말아야 하나 (안티패턴)

| 케이스 | 이유 | 대신 |
|--------|------|------|
| **`keepPreviousData` 페이지네이션 뷰** (페이지 넘기며 이전 페이지 유지) | suspend가 이전 데이터 유지를 깨뜨림. 페이지네이터가 `data`에 의존하면 매 페이지마다 사라짐 | `useQuery` + `placeholderData: keepPreviousData` |
| **폼 옵션 프리필** (select 옵션을 쿼리로 채움) | 폼 셸은 즉시 보여야 하는데 통째로 블로킹됨 | `useQuery`, `options={isSuccess ? ... : []}` |
| **낙관적 업데이트 / 폴링 표시** | 인라인 `isFetching` 오버레이가 더 단순·정확 | `useQuery` + 인라인 상태 |
| **동기 컴포넌트** | 비동기 리소스를 throw하지 않으면 폴백이 안 뜸 | Suspense 불필요 |

> 핵심 판별: **"페이지를 넘기며 이전 내용을 유지"** 하거나 **"셸을 먼저 보여주고 일부만
> 채우는"** UX라면 `useQuery`가 맞다. **"컴포넌트 전체가 한 결과에 의존"** 하면 Suspense.

---

## 레이아웃 주의: 오버레이/슬라이드가 `overflow`에 잘리지 않게

`position: absolute`로 부모를 덮는 슬라이드/오버레이(예: SlidingCard)를 데이터 레이어
안으로 옮기면, 상위 컨테이너의 `overflow: auto`에 **잘릴 수 있다**. 이런 요소는 필터
레이어(overflow 밖)에 두고, **열기 트리거만 콜백으로 데이터 레이어에 내린다**. 슬라이드가
쓰는 `refetch`는 규칙 4처럼 `queryClient` 기반으로 디커플링한다.

---

## 리뷰 체크리스트

- [ ] 검색·필터 툴바가 Suspense 바운더리 **밖**에 있는가 (재조회 시 유지되는가)
- [ ] 데이터 레이어가 `useSuspenseQuery`를 쓰고 인라인 로딩/에러 플래그를 상수로 넘기는가
- [ ] 재조회(페이지·필터·정렬) 시 `useDeferredValue`로 이전 데이터를 유지하는가 (`StaleOverlay`)
- [ ] 외부 스토어 상태에 `startTransition`을 헛되이 쓰지 않았는가 (→ `useDeferredValue`)
- [ ] 바운더리를 feature가 소유하고 페이지의 중복 바운더리를 제거했는가 (`resetKeys` 이전 포함)
- [ ] 대시보드가 위젯별 독립 바운더리로 쪼개졌는가 (거대한 단일 바운더리 아님)
- [ ] 툴바의 `refetch`/`isPending` 의존을 폴링·`queryClient`로 디커플링했는가
- [ ] 상세 뷰 전환 시 에러/빈 데이터 분기를 정정하고 기존 로딩 UI를 `fallback`으로 넘겼는가
- [ ] `keepPreviousData` 페이지네이션·폼 옵션 프리필·폴링을 Suspense로 잘못 바꾸지 않았는가
- [ ] `position:absolute` 오버레이/슬라이드가 `overflow` 컨테이너에 잘리지 않는가
- [ ] 모양이 정해진 영역은 실제 레이아웃을 본뜬 스켈레톤, 모양이 데이터에 달린 영역은 스피너인가
- [ ] `*.skeleton.tsx`가 실제로 스켈레톤을 그리는가 (이름만 스켈레톤인 스피너 아님)
- [ ] 로딩·오류·빈 상태 폴백이 데이터 영역과 같은 크기(고정 높이는 같은 상수, 남은 높이는 `flex: 1`)인가
- [ ] 내장 Suspense가 있는 래퍼 안쪽에 로딩 바운더리를 또 넣지 않고, 오류 바운더리는 래퍼 바깥에 있는가
- [ ] 앱 최상위·페이지·위젯 계층에 오류 폴백이 있고, 최상위 폴백이 로딩 문구가 아닌가
- [ ] 오류 화면이 서버 메시지를 먼저 보여 주고 `error.message`를 띄우지 않는가
- [ ] 다시 시도가 `QueryErrorResetBoundary` reset 기반 재조회이고 `reload()`가 아닌가
