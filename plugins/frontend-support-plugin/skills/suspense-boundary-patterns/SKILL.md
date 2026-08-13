---
name: suspense-boundary-patterns
description: >-
  React Suspense 경계(Suspense/ErrorBoundary)를 목록 조회·대시보드·상세 뷰에 어떻게
  배치하고, 검색·페이지네이션 같은 재조회 UX를 어떻게 매끄럽게 만들지 설계·리팩터링·리뷰할 때
  먼저 읽는 문서. "Suspense 적용", "useSuspenseQuery로 바꿔", "목록 로딩 처리", "검색하면
  화면 깜빡여", "페이지 넘길 때 스피너", "필터/목록 분리", "툴바가 사라져", "대시보드 로딩",
  "상세 다이얼로그 Suspense", "useDeferredValue", "keepPreviousData", "QueryErrorBoundary",
  "ErrorSuspenseBoundary", "StaleOverlay", "폴백이 전체를 덮어" 키워드에 반응한다.
  최우선 원칙은 "최초 로드와 재조회를 분리한다"(최초=바운더리 폴백, 재조회=이전 데이터 유지)와
  "필터는 바운더리 밖, 데이터는 바운더리 안"(2레이어 분리)이며, useDeferredValue로 stale
  전환을 만들고, 대시보드는 위젯별 바운더리로 쪼갠다. 언제 Suspense를 쓰지 말아야 하는지
  (keepPreviousData 페이지네이션·폼 옵션 프리필·폴링)도 판별한다.
  데이터 패칭 콜로케이션의 기초는 component-design-patterns 스킬을 먼저 따른다.
---

# Suspense 경계 설계 패턴 (React + React Query)

목록 조회·대시보드·상세 뷰에 `useSuspenseQuery`를 도입할 때, **경계(Suspense/
ErrorBoundary)를 어디에 두고 재조회 UX를 어떻게 매끄럽게 만들지**를 일관되게
결정하기 위한 참조 문서다.

> 전제: "데이터 패칭은 컴포넌트와 함께 둔다", "pages 직속 목록·대시보드 기초 컴포넌트는
> `useSuspenseQuery`" 같은 기초는 **component-design-patterns** 스킬을 먼저 따른다.
> 이 문서는 그 위에서 **경계 배치와 재조회 UX**를 다룬다.

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
