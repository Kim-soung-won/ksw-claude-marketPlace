# Suspense 경계 설계 패턴 — 코드 예시

SKILL.md의 각 규칙에 대응하는 최소 예시. 실제 목록/대시보드/상세 뷰에서 추출·단순화했다.

---

## 필터/목록 2레이어 분리

검색 툴바를 바운더리 밖에 두고, 데이터만 바운더리 안에서 `useSuspenseQuery`로 소비한다.

```tsx
// group-table.ui.tsx

// 필터 레이어 — 바운더리 "밖". 쿼리를 소비하지 않으므로 suspend되지 않는다.
export function GroupTable({ filterStore, groupQueryOptions }: Props) {
  const setKeywords = useCallback(
    (keyword: string) => filterStore.setKeywords(keyword),
    [filterStore.setKeywords],
  );

  return (
    <>
      {/* withEnhancedTable의 TableToolbar prop 대신, 툴바를 직접 형제로 렌더 */}
      <div className="d-flex justify-content-start w-100">
        <GroupTableToolbar
          handleSearch={setKeywords}
          TopButtons={<CreateGroupButton />}
        />
      </div>
      <QueryErrorBoundary queryKey={GroupQueries.keys.root}>
        <GroupTableData
          filterStore={filterStore}
          groupQueryOptions={groupQueryOptions}
        />
      </QueryErrorBoundary>
    </>
  );
}

// 데이터 레이어 — 바운더리 "안". 로딩/에러는 바운더리가 처리하므로 플래그는 상수.
function GroupTableData({ filterStore, groupQueryOptions }: Props) {
  const { keyword, page, size, isStale } = useDeferredListFilter({
    keyword: filterStore.keywords,
    page: filterStore.index,
    size: filterStore.size,
  });

  const { data } = useSuspenseQuery(groupQueryOptions({ size, page, keyword }));

  return (
    <StaleOverlay isStale={isStale}>
      <GroupTableContent
        isLoading={false}
        isError={false}
        isSuccess={true}
        rows={data}
        onPageChange={filterStore.setIndex}
        {/* ...renderCells, selection 등 */}
      />
    </StaleOverlay>
  );
}
```

페이지에서는 바운더리를 제거한다(feature가 소유):

```tsx
// group-page.ui.tsx  — 변경 전/후
// ❌ before: 페이지가 감싸면 툴바까지 바운더리 안
// <QueryErrorBoundary queryKey={GroupQueries.keys.root}>
//   <GroupTable ... />
// </QueryErrorBoundary>

// ✅ after: feature가 바운더리를 소유
return <GroupTable filterStore={filterStore} groupQueryOptions={bound} />;
```

---

## useDeferredValue로 stale 유지

재조회 중 이전 데이터를 유지하기 위한 공통 훅과 오버레이. `@/shared/ui`로 공통화한다.

```tsx
// shared/ui/List/use-deferred-list-filter.ts
import { useDeferredValue } from "react";

interface ListFilterValues { keyword: string; page: number; size: number; }

export function useDeferredListFilter({ keyword, page, size }: ListFilterValues) {
  const deferredKeyword = useDeferredValue(keyword);
  const deferredPage = useDeferredValue(page);
  const deferredSize = useDeferredValue(size);

  const isStale =
    deferredKeyword !== keyword || deferredPage !== page || deferredSize !== size;

  return { keyword: deferredKeyword, page: deferredPage, size: deferredSize, isStale };
}
```

```tsx
// shared/ui/List/stale-overlay.ui.tsx
export function StaleOverlay({
  isStale,
  children,
  style,
}: {
  isStale: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        opacity: isStale ? 0.6 : 1,
        pointerEvents: isStale ? "none" : "auto",
        transition: "opacity 0.2s ease",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
```

정렬 등 입력이 더 많으면 직접 지연하고 `isStale`을 합산한다:

```tsx
const deferredKeyword = useDeferredValue(filterStore.keywords);
const deferredPage = useDeferredValue(filterStore.index);
const deferredOrder = useDeferredValue(filterStore.order);
const deferredOrderBy = useDeferredValue(filterStore.orderBy);

const { data } = useSuspenseQuery(
  listQuery({ page: deferredPage + 1, keyword: deferredKeyword, sortBy: deferredOrderBy, order: deferredOrder }),
);

const isStale =
  deferredPage !== filterStore.index ||
  deferredKeyword !== filterStore.keywords ||
  deferredOrder !== filterStore.order ||
  deferredOrderBy !== filterStore.orderBy;
```

---

## refetch 디커플링

툴바를 바운더리 밖으로 빼려면, 툴바 버튼이 쓰던 `refetch`를 바운더리 안 쿼리에서
떼어낸다.

### 폴링이 있으면 refetch 제거

```tsx
// 쿼리에 refetchInterval: 1500 이 이미 있으면
// ❌ before: 생성/삭제 후 명시적 refetch (폴링과 중복)
//   <CreateJobButton onSuccess={() => refetch()} />
//   <DeleteJobButton documentId={id} onSuccess={() => refetch()} />
// ✅ after: 폴링이 갱신을 대신하므로 제거 (최대 폴링 주기 내 반영)
//   <CreateJobButton />
//   <DeleteJobButton documentId={id} />
```

### 폴링이 없거나 조건부면 queryClient로

```tsx
export function StorageTable({ filterStore, queryOptions }: Props) {
  const queryClient = useQueryClient();

  // 바운더리 안 useSuspenseQuery의 refetch 대신 루트 키를 갱신
  const refresh = useCallback(() => {
    queryClient.refetchQueries({ queryKey: StorageQueries.keys.root });
  }, [queryClient]);

  return (
    <>
      <Toolbar
        TopButtons={
          <>
            <DeleteButton refetch={refresh} />
            <UploadButton refetch={refresh} />
          </>
        }
      />
      <QueryErrorBoundary queryKey={StorageQueries.keys.root}>
        <StorageTableData filterStore={filterStore} queryOptions={queryOptions} />
      </QueryErrorBoundary>
    </>
  );
}
```

---

## 상세 뷰 Suspense 전환

### 다이얼로그 탭 전체 전환 (에러/빈데이터 분기 정정)

```tsx
// ❌ before: 에러도 "데이터 없음"으로 잘못 표시
export function EntityTab({ documentId }: Props) {
  const { data, isSuccess, isFetching } = useQuery(entityQuery(documentId));
  if (isFetching && !isSuccess) return <LoadingBlur />;
  if (!isSuccess || !data || data.nodes.length === 0) return <Empty />; // 에러가 여기로 샘
  return <EntityGraph data={data} />;
}

// ✅ after: useSuspenseQuery — 에러는 바운더리, 빈 데이터만 여기서
export function EntityTab({ documentId }: Props) {
  const { data } = useSuspenseQuery(entityQuery(documentId));
  if (!data || data.nodes.length === 0) return <Empty />;
  return <EntityGraph data={data} />;
}

// 호스트 다이얼로그 — 기존 로딩 UI는 fallback으로 유지
{activeTab === "entity" && (
  <QueryErrorBoundary
    queryKey={[...Queries.keys.root, "entity-graph", documentId]}
    fallback={<LoadingBlur />}
  >
    <EntityTab documentId={documentId} />
  </QueryErrorBoundary>
)}
```

### 일부 섹션만 데이터 의존 → 그 섹션만 분리

```tsx
// 파일 상세(즉시 표시) + 버킷 정보(조회) 가 섞인 경우
export function DocumentDetails({ row }: { row: OriginalStorage }) {
  return (
    <div className="grid grid-cols-2 gap-8">
      <FileInfoTable row={row} />        {/* row에서 바로 — 즉시 렌더 */}
      <QueryErrorBoundary
        queryKey={BucketQueries.keys.root}
        fallback={<LoadingText />}       {/* 기존 로딩 UI 유지 */}
      >
        <BucketSection bucketName={row.bucket} />  {/* 이 섹션만 suspend */}
      </QueryErrorBoundary>
    </div>
  );
}

function BucketSection({ bucketName }: { bucketName: string }) {
  const { data } = useSuspenseQuery(BucketQueries.bucketsQuery({ pageNo: -1 }));
  const bucket = data.list.find((b) => b.dataName === bucketName);
  if (!bucket) return <NotFound />;
  return <BucketTable bucket={bucket} />;
}
```

---

## 대시보드 위젯별 바운더리

```tsx
// ❌ 하나로 묶으면 가장 느린 위젯이 전체를 막는다
// <QueryErrorBoundary><Dashboard /></QueryErrorBoundary>

// ✅ 위젯마다 독립 바운더리 → 준비되는 대로 개별 렌더
<Grid>
  <QueryErrorBoundary colSpan={6}><RevenueCard /></QueryErrorBoundary>
  <QueryErrorBoundary colSpan={6}><UsersCard /></QueryErrorBoundary>
  <QueryErrorBoundary colSpan={12}><TrafficChart /></QueryErrorBoundary>
</Grid>
```
