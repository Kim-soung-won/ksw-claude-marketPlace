# 컴포넌트 설계 패턴 — 코드 예시

`SKILL.md`의 각 원칙·패턴에 대응하는 상세 코드 예시. 규칙만으로 판단이 서지 않을 때만 읽는다.

---

## 한 .tsx = 한 컴포넌트 (SRP)

```tsx
// ❌ 안티패턴 — 한 파일에 여러 컴포넌트 function
export function UserCard({ user }: { user: User }) {
  return (
    <div>
      <Avatar src={user.avatar} />
      <Actions userId={user.id} />
    </div>
  );
}
function Avatar({ src }: { src: string }) {
  // 같은 파일 안 두 번째 컴포넌트 → 금지
  return <img src={src} alt="" />;
}
function Actions({ userId }: { userId: string }) {
  // 세 번째 → 금지
  return <button>...</button>;
}
```

```tsx
// ✅ user-card/user-card.tsx — function 하나만. 하위는 각자의 파일에서 import.
import { UserCardAvatar } from "./components/user-card-avatar";
import { UserCardActions } from "./components/user-card-actions";
import type { UserCardProps } from "./user-card.types";

export function UserCard({ user }: UserCardProps) {
  return (
    <div>
      <UserCardAvatar src={user.avatar} />
      <UserCardActions userId={user.id} />
    </div>
  );
}
```

```tsx
// ✅ user-card/components/user-card-avatar/user-card-avatar.tsx — sub 컴포넌트도 파일 하나 = function 하나
interface UserCardAvatarProps {
  src: string;
}

export function UserCardAvatar({ src }: UserCardAvatarProps) {
  return <img src={src} alt="" />;
}
```

---

## 데이터 패칭 콜로케이션

### 일반: `useQuery` + 자체 분기

```tsx
// user-list.tsx — 패칭과 렌더링이 한 파일. isPending/isError를 스스로 처리.
export function UserList() {
  const { data, isPending, isError } = useQuery(userQueries.list());

  if (isPending) {
    return <Skeleton />;
  }
  if (isError) {
    return <ErrorState />;
  }
  return (
    <ul>
      {data.map((user) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

### 페이지 기초: `useSuspenseQuery`로 간결하게

```tsx
// user-dashboard.tsx — 페이지의 기초 컴포넌트. 분기 없이 간결.
export function UserDashboard() {
  // useSuspenseQuery는 data가 항상 정의됨 → isPending/isError 분기 불필요
  const { data } = useSuspenseQuery(userQueries.dashboard());
  return <DashboardMetrics metrics={data.metrics} />;
}

// pages/dashboard/dashboard.page.tsx — 로딩/에러 "경계"는 페이지가 제공
export function DashboardPage() {
  return (
    <ErrorBoundary fallback={<ErrorState />}>
      <Suspense fallback={<Skeleton />}>
        <UserDashboard />
      </Suspense>
    </ErrorBoundary>
  );
}
```

### Mutation도 컴포넌트와 함께

```tsx
// delete-user-button.tsx
export function DeleteUserButton({ userId }: { userId: string }) {
  const { mutate, isPending } = useMutation(userMutations.remove());
  return (
    <button disabled={isPending} onClick={() => mutate(userId)}>
      삭제
    </button>
  );
}
```

---

## Container / Presentational

```tsx
// user-profile.presentational.tsx — props만 받는다. 훅·API 없음.
interface UserProfileViewProps {
  name: string;
  email: string;
  isLoading: boolean;
  onEdit: () => void;
}

export function UserProfileView({
  name,
  email,
  isLoading,
  onEdit,
}: UserProfileViewProps) {
  if (isLoading) {
    return <Skeleton />;
  }
  return (
    <section>
      <h2>{name}</h2>
      <p>{email}</p>
      <button onClick={onEdit}>편집</button>
    </section>
  );
}

// user-profile.container.tsx — 데이터·핸들러를 준비해 내려준다.
export function UserProfileContainer({ userId }: { userId: string }) {
  const { data, isLoading } = useQuery(userQueries.detail(userId));
  const navigate = useNavigate();

  return (
    <UserProfileView
      name={data?.name ?? ""}
      email={data?.email ?? ""}
      isLoading={isLoading}
      onEdit={() => navigate(`/users/${userId}/edit`)}
    />
  );
}
```

> ⚠️ 패칭에는 이 분리를 적용하지 않는다("데이터 패칭 콜로케이션" 우선). Presentational
> 분리는 **패칭 없는 순수 UI**가 실제로 재사용·단독 테스트될 때만 쓴다.

---

## Custom Hooks 로직 분리

```tsx
// use-user-profile.ts — 로직만. JSX 없음.
interface UseUserProfileResult {
  name: string;
  email: string;
  isLoading: boolean;
  edit: () => void;
}

export function useUserProfile(userId: string): UseUserProfileResult {
  const { data, isLoading } = useQuery(userQueries.detail(userId));
  const navigate = useNavigate();

  return {
    name: data?.name ?? "",
    email: data?.email ?? "",
    isLoading,
    edit: () => navigate(`/users/${userId}/edit`),
  };
}

// user-profile.tsx — 훅 호출 + 렌더링. 한 파일로 충분.
export function UserProfile({ userId }: { userId: string }) {
  const { name, email, isLoading, edit } = useUserProfile(userId);

  if (isLoading) {
    return <Skeleton />;
  }
  return (
    <section>
      <h2>{name}</h2>
      <p>{email}</p>
      <button onClick={edit}>편집</button>
    </section>
  );
}
```
