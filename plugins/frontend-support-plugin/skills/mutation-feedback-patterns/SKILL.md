---
name: mutation-feedback-patterns
description: >-
  React Query useMutation으로 생성·수정·삭제·업로드·내보내기를 실행할 때 사용자 피드백(성공·실패
  토스트, loading 토스트)과 연관 쿼리 갱신(invalidateQueries·cancelQueries)을 설계·리팩터링·리뷰할
  때 먼저 읽는 문서. "useMutation 토스트", "저장 후 목록 갱신", "invalidateQueries",
  "mutation 후 refetch", "loading 토스트", "업로드 진행 토스트", "useToastMutation",
  "실패 메시지 표시", "서버 에러 메시지 토스트", "onError 안 불려", "다이얼로그 닫으면 이전 목록이 보여",
  "내보내기 하면 표가 깜빡여", "cancelQueries", "낙관적 업데이트" 키워드에 반응한다.
  최우선 원칙은 "성공은 무엇을 했는지, 실패는 서버 메시지를 우선 보여 준다"와 "서버 상태를 바꾼
  mutation만 그 데이터를 쓰는 키를 invalidate한다"이며, 공통 래퍼가 호출자 콜백을 항상 끝까지
  실행하는지, loading 토스트를 onSettled에서 반드시 닫는지 판별한다. 사내 공용 UI 라이브러리
  @we/ai-template의 useToast·getServerErrorMessage 대응표를 포함한다.
---

# Mutation 피드백 패턴 (React Query v5)

`useMutation` 실행 결과를 사용자에게 **어떻게 알리고(토스트)**, 서버 상태 변경을 화면에
**어떻게 반영할지(쿼리 갱신)** 를 일관되게 결정하기 위한 참조 문서다. 토스트 API는
라이브러리 중립적으로 `toast.success / error / loading / dismiss(id)` 형태로 쓴다.

> 관련 스킬:
> - 조회 쪽 경계와 재조회 UX는 **suspense-boundary-patterns** 를 따른다. 특히 규칙 4
>   (툴바의 `refetch`를 `queryClient` 기반으로 디커플링)가 이 문서의 규칙 2와 이어진다.
> - 데이터 패칭을 컴포넌트와 함께 두는 기초는 **component-design-patterns** 를 먼저 따른다.

---

## 최우선 원칙

| 결과 | 사용자에게 | 화면 데이터 |
|------|-----------|-------------|
| **성공** | "무엇을 했는지" (대상 + 동작) | 바뀐 서버 상태를 쓰는 키를 `invalidateQueries` |
| **실패** | 실패 요약 + **서버가 보낸 메시지** | 서버 상태가 일부 바뀌었을 수 있을 때만 invalidate |
| **서버 상태 불변** (내보내기·다운로드·미리보기) | 결과만 알림 | **갱신·취소하지 않는다** |

그리고 공통 래퍼는 이 기본 동작을 제공하되, **호출자 콜백을 분기와 무관하게 끝까지
실행**하고, 문구·갱신을 호출별로 덮거나 끌 수 있어야 한다.

---

## 규칙 1: 성공·실패 토스트 문구

### 성공 = 무엇을 했는지

대상 + 동작을 쓴다: "에이전트를 삭제했습니다", "MCP 서버 설정을 저장했습니다".
"성공했습니다"·"완료"처럼 무엇이 끝났는지 모르는 문구는 쓰지 않는다.

### 실패 = 실패 요약 + 서버 메시지

서버는 실패 이유와 사용자가 할 일(권한 없음·이름 중복·한도 초과)을 알고 있다. 그래서
응답 본문의 `message` → `error` 순으로 꺼내 **우선 표출**하고, 서버 메시지가 없을 때만
고정 문구("삭제하지 못했습니다. 잠시 후 다시 시도해 주세요")를 쓴다.

```ts
const serverMessage = getServerErrorMessage(error); // body.message → body.error → undefined
toast.error(serverMessage ? `삭제하지 못했습니다: ${serverMessage}` : "삭제하지 못했습니다.");
```

- **`error.message`를 토스트에 쓰지 않는다.** axios 오류에서는 "Request failed with status
  code 500" 같은 axios 자체 문구이고, 런타임·zod 오류에서는 개발자용 원문이다. 둘 다
  사용자가 할 일을 알려 주지 않는다. 디버깅용 원문은 콘솔·로깅으로 보낸다.
- **화면 안에서 이미 보이는 실패는 토스트로 중복하지 않는다.** 서버가 필드 단위 검증 오류를
  돌려주면 폼 필드 오류(예: react-hook-form `setError`)로 표시하고, 그 호출은 실패 토스트를
  끈다(규칙 5의 `errorMessage`를 함수로 받아 `false` 반환).

### 문구는 공통 래퍼에서 규칙으로 만든다

`mutationKey: [namespace, action]`(예: `["agent", "delete"]`)을 문구 생성 규칙의 입력으로
쓴다. i18n 프로젝트면 `<namespace>.entity` · `common.action.<action>` 키를 조합한다. 호출별로
`successMessage` / `errorMessage`를 덮어쓰거나 `false`로 끌 수 있게 한다.

```ts
const [namespace, action] = mutationKey;
const success = t("common.message.success", {
  entity: t(`${namespace}.entity`),
  action: t(`common.action.${action}`),
});
// "에이전트를 삭제했습니다"
```

> 코드 예시(서버 메시지 추출 · 필드 오류 분기): [`examples.md`](./examples.md) §"실패 문구와 필드 오류"

---

## 규칙 2: 연관 쿼리 갱신

### 성공 후에는 `invalidateQueries`

서버 상태가 바뀌면 그 데이터를 쓰는 쿼리를 `queryClient.invalidateQueries`로 갱신한다.
바운더리 안 쿼리 인스턴스의 `refetch`를 mutation 쪽으로 끌어오지 않는다 — 그러면 툴바가
바운더리 안에 묶인다(→ suspense-boundary-patterns 규칙 4).

- **범위**: 바뀐 데이터를 쓰는 키. 보통 `[namespace]` 루트 하나면 목록·상세·카운트가 함께
  갱신된다. 다른 도메인이 영향받으면(예: 에이전트 삭제 → 대시보드 집계) 그 키도 넣는다.
- **닫기 전에 await**: 다이얼로그를 닫거나 페이지를 이동하기 전에 최신 목록이 보여야 하면
  invalidate를 await한 뒤 닫는다. await하지 않으면 다이얼로그가 닫힌 직후 **이전 목록이 잠깐
  보였다가** 바뀐다. v5에서 `onSuccess`가 Promise를 반환하면 mutation은 그것을 기다린 뒤
  `mutateAsync`를 resolve하고 `mutate(…, { onSuccess })`를 호출한다.

```ts
onSuccess: async () => {
  await queryClient.invalidateQueries({ queryKey: ["agent"] });
},
// 호출부
await deleteAgent.mutateAsync(id);
closeDialog(); // 갱신된 목록 위에서 닫힌다
```

- **실패 후에도 invalidate하는 경우**: 부분 성공(일괄 삭제 중 일부만 실패), 낙관적 업데이트
  롤백 후처럼 서버 상태가 일부 바뀌었거나 캐시와 어긋났을 수 있을 때. 이때는 `onSettled`에서
  invalidate한다.

### `cancelQueries`는 낙관적 업데이트 직전에만

`cancelQueries`의 목적은 진행 중 조회가 `setQueryData`로 넣은 낙관적 값을 덮어쓰지 못하게
하는 것이다. 낙관적 업데이트가 없는 mutation에서 네임스페이스 전체를 cancel하면 **진행 중
조회가 끊겼다가 재조회되어 화면이 깜빡인다.** 그래서 공통 래퍼의 cancel은 기본 끔이다.

### 서버 상태를 바꾸지 않는 작업은 갱신·취소하지 않는다

내보내기·다운로드·미리보기는 서버 상태를 바꾸지 않으므로 invalidate도 cancel도 하지 않는다.

> **사례**: 피드백 Excel 내보내기에 공통 훅(시작 시 `[namespace]` cancel + 성공 시 invalidate)을
> 그대로 쓰자, 클릭 한 번에 표의 전량 조회가 취소·재조회되어 표가 깜빡였다. 결국 그 훅을 못
> 쓰고 내보내기만 따로 구현했다. → 공통 래퍼에 **갱신 끄기 옵션(`invalidateKeys: false`)** 이
> 있어야 이런 작업도 같은 피드백 규칙을 공유할 수 있다.

> 코드 예시(낙관적 업데이트 · 내보내기): [`examples.md`](./examples.md) §"낙관적 업데이트와 cancel", §"서버 상태 불변 작업"

---

## 규칙 3: 호출자 콜백은 항상 실행된다

> **사례**: 공통 래퍼의 `onError`가 서버 메시지가 있으면 그 토스트를 띄우고 `return`으로
> 빠졌다. 그 아래에 있던 invalidate와 호출자 `onError`가 건너뛰어져, **서버 메시지가 있는
> 실패에서만** 목록이 갱신되지 않고 호출자의 정리 로직(로딩 해제·선택 초기화)도 빠졌다.
> 서버 메시지가 없는 실패에서는 정상이라 재현 조건이 좁아 오래 발견되지 않았다.

- 래퍼의 성공/실패 경로는 **문구 분기와 갱신 분기를 값 계산으로만** 처리하고, 공통 후처리
  (토스트 → 갱신 → 호출자 콜백)를 분기 밖에서 끝까지 실행한다. 경로 중간의 `return`을 두지 않는다.
- 호출자 콜백의 **인자를 그대로 전달**한다. v5 시그니처:
  `onMutate(variables, context)`, `onSuccess(data, variables, onMutateResult, context)`,
  `onError(error, variables, onMutateResult, context)`,
  `onSettled(data, error, variables, onMutateResult, context)`. 래퍼가 인자를 줄이거나 순서를
  바꾸면 호출자의 낙관적 업데이트 롤백이 깨진다.
- 호출자 `onMutate`의 반환값(`onMutateResult`)은 래퍼가 가로채지 않고 그대로 돌려준다. 래퍼가
  자기 상태(loading 토스트 id 등)를 들고 있어야 하면 ref에 둔다(규칙 4).
- `mutate(vars, { onSuccess })`처럼 **호출 단위로 넘긴 콜백은 컴포넌트가 언마운트되면 실행되지
  않는다**(react-query 동작). 다이얼로그를 먼저 닫고 콜백을 기대하면 "onError가 안 불린다".
  반드시 실행돼야 하는 처리는 훅 옵션(`useMutation({ onError })`)에 두거나 `mutateAsync`를
  await한다.

> 코드 예시(early return 버그 전후): [`examples.md`](./examples.md) §"early return 버그"

---

## 규칙 4: loading 토스트

- **쓰는 곳**: 수 초 이상 걸리거나, 사용자가 다른 화면으로 옮겨 가도 진행을 알아야 하는 작업 —
  업로드·백업·대량 삭제·대용량 내보내기. 짧은 CRUD는 버튼의 `isPending`(로딩 버튼·비활성)으로
  충분하다. 짧은 작업에 loading 토스트를 띄우면 곧바로 결과 토스트로 바뀌며 깜빡이기만 한다.
- **반드시 닫는다**: loading 토스트는 자동으로 닫히지 않는다. `onSettled`(성공·실패 모두)에서
  dismiss하고 결과 토스트(success/error)로 바꾼다. `onSuccess`에서만 닫으면 실패 시 영원히 남는다.
- **id 보관**: `onMutate`에서 `toast.loading()`으로 만든 id를 `onMutateResult`로 반환해
  `onSettled`에서 받거나, 래퍼라면 ref에 둔다(호출자의 `onMutateResult`를 오염시키지 않기 위해).
- **중복 실행 방지**: 진행 중에는 같은 작업 버튼을 `isPending`으로 비활성화한다. 중복 클릭은
  loading 토스트와 요청을 중복시키고, ref 하나로 id를 들고 있는 래퍼에서는 앞의 토스트가
  고아가 된다.

```ts
useMutation({
  mutationFn: uploadFiles,
  onMutate: () => ({ toastId: toast.loading("파일을 업로드하는 중입니다…") }),
  onSettled: (_data, _error, _vars, onMutateResult) => {
    if (onMutateResult) toast.dismiss(onMutateResult.toastId);
  },
  onSuccess: () => toast.success("파일 3개를 업로드했습니다"),
});
```

> 코드 예시(래퍼 내 ref 보관): [`examples.md`](./examples.md) §"공통 래퍼 useToastMutation"

---

## 규칙 5: 공통 래퍼(`useToastMutation`) 설계 지침

- **한 곳에 둔다.** FSD라면 `entities/base` 같은 공용 계층 하나에 두고 모든 feature가 그것을
  쓴다. 프로젝트·모듈마다 복제하지 않는다.
  > **사례**: 같은 래퍼가 5개 프로젝트에 복제되었고, 그중 한 곳만 서버 메시지 표시 방식이
  > 달라져 같은 실패가 프로젝트마다 다른 문구로 보였다.
- **옵션** (나머지 `UseMutationOptions`는 그대로 통과):

| 옵션 | 기본값 | 용도 |
|------|--------|------|
| `mutationKey` | 필수 `[namespace, action]` | 문구 규칙·기본 갱신 키의 입력 |
| `successMessage` | 규칙으로 생성 | 문자열로 덮기, `false`로 끄기 |
| `errorMessage` | 요약 + 서버 메시지 | 문자열·`(error) => string \| false`로 덮기, `false`로 끄기(필드 오류) |
| `loadingMessage` | 없음 | 지정 시에만 loading 토스트 (규칙 4) |
| `invalidateKeys` | `[[namespace]]` | 추가 도메인 키 지정, `false`로 끄기(내보내기 등) |
| `invalidateOnError` | `false` | 부분 성공·롤백 시 실패 후에도 갱신 |
| `cancelKeys` | 없음(끔) | 낙관적 업데이트 때만 지정 |

> 코드 예시(전체 구현): [`examples.md`](./examples.md) §"공통 래퍼 useToastMutation"

---

## 하지 말아야 할 것

| ❌ 패턴 | 왜 | 대신 |
|---------|----|------|
| 실패 토스트에 `error.message` | axios 자체 문구·개발자용 원문이 노출된다 | 서버 본문 `message` → `error`, 없으면 고정 문구 |
| 서버 메시지가 있는데 고정 문구만 | 권한·중복·한도처럼 사용자가 할 일을 숨긴다 | 실패 요약 + 서버 메시지 |
| 필드 검증 오류를 토스트로도 표시 | 같은 실패가 두 번 보인다 | `setError`로 필드에 표시하고 토스트는 끈다 |
| 래퍼에서 토스트 후 `return` | 그 분기에서만 갱신·호출자 콜백이 빠진다 | 분기는 값만 계산, 후처리는 끝까지 |
| mutation에 바운더리 안 쿼리의 `refetch` 전달 | 툴바가 바운더리에 묶인다 | `queryClient.invalidateQueries` |
| invalidate를 기다리지 않고 다이얼로그 닫기 | 닫힌 뒤 이전 목록이 잠깐 보인다 | `await` 후 닫기 (`mutateAsync`) |
| 모든 mutation에서 네임스페이스 `cancelQueries` | 진행 중 조회가 끊겨 화면이 깜빡인다 | 낙관적 업데이트 직전에만 |
| 내보내기·다운로드에 갱신 기본값 적용 | 표가 전량 취소·재조회된다 | `invalidateKeys: false` |
| 짧은 CRUD에 loading 토스트 | 곧바로 바뀌며 깜빡이기만 한다 | 버튼 `isPending` |
| loading 토스트를 `onSuccess`에서만 닫기 | 실패 시 토스트가 남는다 | `onSettled`에서 dismiss |
| 반드시 필요한 처리를 `mutate(vars, { onError })`에 | 언마운트되면 실행되지 않는다 | 훅 옵션 또는 `mutateAsync` + await |
| 프로젝트마다 래퍼 복제 | 문구·동작이 갈라진다 | 공용 계층 하나 |

---

## `@we/ai-template` 사용 프로젝트 대응표

사내 공용 UI 라이브러리 `@we/ai-template`를 쓰는 프로젝트에서는 위의 추상 API를 다음으로
바꿔 읽는다. 정확한 import 경로는 해당 프로젝트의 기존 사용처를 따른다.

| 이 문서의 표기 | `@we/ai-template` |
|----------------|-------------------|
| `toast.success(message)` | `const { success } = useToast(); success(message)` |
| `toast.error(message)` | `useToast().error(message)` |
| `toast.loading(message)` → id | `useToast().loading(message)` → id |
| `toast.dismiss(id)` | `useToast().dismissToast(id)` |
| `getServerErrorMessage(error)` | `getServerErrorMessage(error)` — axios 응답 본문 `message` → `error`, 없으면 `undefined` |

- loading 토스트를 결과로 바꿀 때는 `dismissToast(id)` 후 `success`/`error`를 새로 띄운다.
- `useToast()`는 훅이므로 래퍼 훅 안에서 호출하고, 콜백 안에서 호출하지 않는다.

---

## 리뷰 체크리스트

- [ ] 성공 토스트가 대상 + 동작을 말하는가 ("성공했습니다" 아님)
- [ ] 실패 토스트가 서버 메시지(`message` → `error`)를 우선 표시하고, 없을 때만 고정 문구인가
- [ ] `error.message`를 사용자 토스트에 쓰지 않았는가
- [ ] 필드 검증 오류는 필드에 표시하고 토스트를 끄는가
- [ ] 성공 후 바뀐 데이터를 쓰는 키(다른 도메인 포함)를 `invalidateQueries`로 갱신하는가
- [ ] 닫기·이동 전에 최신 목록이 필요하면 invalidate를 await한 뒤 닫는가
- [ ] 부분 성공·롤백이 있으면 실패 후에도 갱신하는가
- [ ] `cancelQueries`가 낙관적 업데이트 직전에만 있는가
- [ ] 내보내기·다운로드·미리보기가 갱신·취소를 끄고 있는가
- [ ] 래퍼의 어떤 분기에서도 호출자 콜백이 실행되는가 (중간 `return` 없음)
- [ ] 래퍼가 v5 콜백 인자와 호출자 `onMutate` 반환값을 그대로 전달하는가
- [ ] loading 토스트가 오래 걸리는 작업에만 있고 `onSettled`에서 닫히는가
- [ ] 진행 중 버튼이 `isPending`으로 비활성화되는가
- [ ] 래퍼가 공용 계층 한 곳에만 있는가
