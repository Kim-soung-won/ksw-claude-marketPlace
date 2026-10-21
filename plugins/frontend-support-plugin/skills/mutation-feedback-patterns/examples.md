# Mutation 피드백 패턴 — 코드 예시

SKILL.md의 각 규칙에 대응하는 최소 예시. TypeScript + @tanstack/react-query v5 기준이며,
토스트는 `useToast()`가 `{ success, error, loading, dismiss }`를 돌려준다고 가정한다.

## 목차

- 서버 메시지 추출
- 실패 문구와 필드 오류
- early return 버그
- 공통 래퍼 useToastMutation
- 낙관적 업데이트와 cancel
- 서버 상태 불변 작업

---

## 서버 메시지 추출

```ts
// shared/api/get-server-error-message.ts
import { isAxiosError } from "axios";

/** 응답 본문의 사용자용 메시지. message → error 순, 없으면 undefined. */
export function getServerErrorMessage(error: unknown): string | undefined {
  if (!isAxiosError(error)) return undefined; // 런타임·zod 오류는 사용자에게 보일 문구가 아니다
  const body = error.response?.data as { message?: unknown; error?: unknown } | undefined;
  if (typeof body?.message === "string" && body.message) return body.message;
  if (typeof body?.error === "string" && body.error) return body.error;
  return undefined; // error.message("Request failed with status code 500")로 대체하지 않는다
}
```

---

## 실패 문구와 필드 오류

서버가 필드 단위 검증 오류를 주면 폼에 표시하고, 그 경우만 토스트를 끈다.

```tsx
const { setError } = useForm<AgentForm>();

const createAgent = useToastMutation({
  mutationKey: ["agent", "create"],
  mutationFn: agentApi.create,
  // 함수형 errorMessage: false를 반환하면 이 실패는 토스트를 띄우지 않는다
  errorMessage: (error) => {
    const fieldErrors = getFieldErrors(error); // { name: "이미 사용 중인 이름입니다" } | undefined
    if (!fieldErrors) return undefined;        // undefined = 기본 문구(요약 + 서버 메시지)
    for (const [field, message] of Object.entries(fieldErrors)) {
      setError(field as keyof AgentForm, { message });
    }
    return false;
  },
});
```

---

## early return 버그

```ts
// ❌ before: 서버 메시지가 있는 실패에서만 갱신·호출자 onError가 빠진다
onError: (error, variables, onMutateResult, context) => {
  const serverMessage = getServerErrorMessage(error);
  if (serverMessage) {
    toast.error(`${summary}: ${serverMessage}`);
    return; // ← 아래가 전부 건너뛰어진다
  }
  toast.error(summary);
  queryClient.invalidateQueries({ queryKey: [namespace] });
  options.onError?.(error, variables, onMutateResult, context);
},

// ✅ after: 분기는 문구 계산에만, 후처리는 끝까지
onError: async (error, variables, onMutateResult, context) => {
  const serverMessage = getServerErrorMessage(error);
  toast.error(serverMessage ? `${summary}: ${serverMessage}` : summary);
  if (invalidateOnError) await invalidate();
  await options.onError?.(error, variables, onMutateResult, context);
},
```

---

## 공통 래퍼 useToastMutation

`entities/base` 같은 공용 계층 한 곳에 둔다. 나머지 `UseMutationOptions`는 그대로 통과한다.

```ts
// entities/base/api/use-toast-mutation.ts
import { useRef } from "react";
import {
  useMutation,
  useQueryClient,
  type QueryKey,
  type UseMutationOptions,
} from "@tanstack/react-query";

type ToastText<TError> = string | false | ((error: TError) => string | false | undefined);

export interface ToastMutationOptions<TData, TError, TVariables, TOnMutateResult>
  extends UseMutationOptions<TData, TError, TVariables, TOnMutateResult> {
  mutationKey: readonly [namespace: string, action: string];
  successMessage?: string | false;
  errorMessage?: ToastText<TError>;
  loadingMessage?: string;
  invalidateKeys?: QueryKey[] | false;
  invalidateOnError?: boolean;
  cancelKeys?: QueryKey[];
}

export function useToastMutation<TData = unknown, TError = Error, TVariables = void, TOnMutateResult = unknown>({
  mutationKey,
  successMessage,
  errorMessage,
  loadingMessage,
  invalidateKeys,
  invalidateOnError = false,
  cancelKeys,
  onMutate,
  onSuccess,
  onError,
  onSettled,
  ...rest
}: ToastMutationOptions<TData, TError, TVariables, TOnMutateResult>) {
  const queryClient = useQueryClient();
  const toast = useToast();
  const loadingIdRef = useRef<string | number | undefined>(undefined);
  const [namespace, action] = mutationKey;

  const keys = invalidateKeys === false ? [] : invalidateKeys ?? [[namespace]];
  const invalidate = () =>
    Promise.all(keys.map((queryKey) => queryClient.invalidateQueries({ queryKey })));

  const resolveError = (error: TError): string | false => {
    const custom = typeof errorMessage === "function" ? errorMessage(error) : errorMessage;
    if (custom !== undefined) return custom;
    const summary = buildFailureText(namespace, action);   // "에이전트를 삭제하지 못했습니다"
    const serverMessage = getServerErrorMessage(error);
    return serverMessage ? `${summary}: ${serverMessage}` : summary;
  };

  return useMutation<TData, TError, TVariables, TOnMutateResult>({
    ...rest,
    mutationKey,
    onMutate: async (variables, context) => {
      if (cancelKeys) {
        await Promise.all(cancelKeys.map((queryKey) => queryClient.cancelQueries({ queryKey })));
      }
      if (loadingMessage) loadingIdRef.current = toast.loading(loadingMessage);
      // 호출자의 반환값을 가로채지 않는다 (낙관적 업데이트 롤백용 스냅샷)
      return onMutate?.(variables, context) as TOnMutateResult | Promise<TOnMutateResult>;
    },
    onSuccess: async (data, variables, onMutateResult, context) => {
      if (successMessage !== false) {
        toast.success(successMessage ?? buildSuccessText(namespace, action)); // "에이전트를 삭제했습니다"
      }
      await invalidate(); // await → mutateAsync 호출자가 갱신된 목록 위에서 다이얼로그를 닫는다
      await onSuccess?.(data, variables, onMutateResult, context);
    },
    onError: async (error, variables, onMutateResult, context) => {
      const text = resolveError(error);
      if (text !== false) toast.error(text);
      if (invalidateOnError) await invalidate();
      await onError?.(error, variables, onMutateResult, context);
    },
    onSettled: async (data, error, variables, onMutateResult, context) => {
      if (loadingIdRef.current !== undefined) {
        toast.dismiss(loadingIdRef.current); // 성공·실패 모두에서 닫는다
        loadingIdRef.current = undefined;
      }
      await onSettled?.(data, error, variables, onMutateResult, context);
    },
  });
}
```

- `buildSuccessText` / `buildFailureText`는 `[namespace, action]`에서 문구를 만드는 규칙
  함수다. i18n이면 `<namespace>.entity`·`common.action.<action>` 키를 조합해 `t("common.message.success", { entity, action })`로 만든다.
- loading 토스트는 `onSettled`에서 닫히고, 결과 토스트는 `onSuccess`/`onError`에서 새로 뜬다.
  라이브러리가 같은 id로 교체(`toast.success(msg, { id })`)를 지원하면 그 방식도 된다.

사용 예:

```tsx
const deleteAgent = useToastMutation({
  mutationKey: ["agent", "delete"],
  mutationFn: agentApi.remove,
  invalidateKeys: [["agent"], ["dashboard", "agent-stats"]], // 다른 도메인 집계도 갱신
});

<Button disabled={deleteAgent.isPending} onClick={async () => {
  await deleteAgent.mutateAsync(id);
  closeDialog();
}} />;
```

`mutateAsync`는 실패 시 reject하므로, 토스트는 래퍼가 띄우고 호출부에서는 reject를 삼키거나
(`.catch(() => {})`) `mutate` + 훅 옵션 콜백을 쓴다.

---

## 낙관적 업데이트와 cancel

cancel은 `setQueryData` 직전에만 쓰고, 실패 시 롤백 후 `onSettled`에서 서버와 다시 맞춘다.

```ts
const toggleFavorite = useToastMutation({
  mutationKey: ["agent", "favorite"],
  mutationFn: agentApi.toggleFavorite,
  successMessage: false,                // 즉시 반영되는 토글은 성공 토스트가 소음이다
  cancelKeys: [["agent", "list"]],      // 진행 중 조회가 낙관적 값을 덮지 못하게
  invalidateOnError: true,              // 롤백 후 서버 상태와 다시 맞춘다
  onMutate: (id: string) => {
    const previous = queryClient.getQueryData<Agent[]>(["agent", "list"]);
    queryClient.setQueryData<Agent[]>(["agent", "list"], (list) =>
      list?.map((a) => (a.id === id ? { ...a, favorite: !a.favorite } : a)),
    );
    return { previous };
  },
  onError: (_error, _id, onMutateResult) => {
    queryClient.setQueryData(["agent", "list"], onMutateResult?.previous);
  },
});
```

---

## 서버 상태 불변 작업

내보내기·다운로드·미리보기는 갱신·취소를 끈다. 오래 걸리면 loading 토스트를 붙인다.

```ts
// ❌ before: 공통 기본값(시작 시 cancel + 성공 시 [namespace] invalidate)
//   → 클릭 한 번에 표의 전량 조회가 취소·재조회되어 깜빡인다

// ✅ after
const exportFeedback = useToastMutation({
  mutationKey: ["feedback", "export"],
  mutationFn: feedbackApi.exportExcel,
  invalidateKeys: false,                       // 서버 상태가 바뀌지 않는다
  loadingMessage: "피드백을 Excel로 내보내는 중입니다…",
  successMessage: "피드백을 Excel로 내보냈습니다",
  onSuccess: (blob) => downloadBlob(blob, "feedback.xlsx"),
});
```
