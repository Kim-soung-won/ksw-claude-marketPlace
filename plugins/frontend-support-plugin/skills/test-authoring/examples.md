# 테스트 작성 규약 — 골드 예시

`SKILL.md`의 이원화 원칙을 실제 프로젝트에 적용해 커밋한 두 사례. 단언을 어디서
어떻게 끌어올지 판단이 서지 않을 때 읽는다. 두 예시는 "단언의 출처"가 정반대다.

## 목차

- 예시 A — 스킬 기반: zustand 스토어 (`server-id-store.test.ts`)
- 예시 B — 계약 기반: 검증 함수 (`node-validator.test.ts`)
- 두 예시의 대비 요약
- RTL 실전 함정 — 컴포넌트 테스트에서 반복해 부딪힌 것들

---

## 예시 A — 스킬 기반: zustand 스토어 상태 머신

- **대상**: `src/shared/store/mcp/server-id-store.ts` (`useServerIdStore`)
- **테스트**: `test/shared/store/mcp/server-id-store.test.ts`
- **단언 출처**: 도메인 스킬 `.claude/skills/a2a-server_scenario.md`의
  "상태 관리 흐름" · "Step 0 성공 후 상태 전환" · "핵심 제약사항"
- **환경**: node (스토어라 DOM 불필요, `getState`/`setState`로 검증)

### 어떻게 유도했나

`_scenario.md`의 항목이 테스트 케이스로 거의 1:1 매핑됐다.

| scenario 항목 | 테스트 케이스 | 단언 |
|---|---|---|
| `[추가]` 클릭 → `{ serverId:"", apigId:"", step:0 }` | 초기 상태 | `step === 0`, 두 id 비어 있음 |
| Step 0 성공 → `setServerId(id, apig_id)` | setServerId 동작 | serverId·apigId 함께 설정 |
| 메타 등록 성공 → `setStep(1)`로 Connection 탭 전환 | step 전이 | `toMatchObject({..., step:1})` |
| 배포 완료/다이얼로그 닫힘 → `reset()` | reset 동작 | 모든 상태 초기값 복귀 |
| **핵심 제약**: 닫힘 시 reset 필수, 안 하면 이전 serverId 잔류 | 잔류 가드 | reset 없이는 잔류, reset 후 해소 |

### 배울 점

- 각 `it`의 주석에 `// scenario: …` 근거를 남겨, 스펙이 바뀌면 어느 테스트를
  고칠지 추적 가능하게 했다.
- 마지막 "핵심 제약" 케이스는 "reset을 안 하면 잔류한다"는 **부정적 동작을
  명시적으로 가드**한다 — 왜 reset이 필수인지가 테스트로 문서화된다.
- 스토어가 모듈 싱글턴이므로 `beforeEach`에서 `setState`로 초기 스냅샷을 강제해,
  `reset()` 정확성 검증과 테스트 격리를 분리했다(reset이 깨져도 다른 케이스가
  오염되지 않음).

### 선행 게이트

이 테스트를 쓰기 전에 `a2a-server_scenario.md`가 현재 코드와 어긋나지 않았는지
`domain-skill-reviewer`로 신뢰도를 확인했다. 스킬이 낡았다면 이 테스트 전체가
낡은 스펙을 박제했을 것이다.

---

## 예시 B — 계약 기반: 검증 함수

- **대상**: `src/entities/workflow/workflow/node-validator.ts`
  (`validateNode`, `validateAllNodes`)
- **테스트**: `test/entities/workflow/workflow/node-validator.test.ts`
- **단언 출처**: **대응 스킬 없음.** 함수 계약 — 시그니처, 반환 타입
  (`ValidationResult` / `AllNodesValidationResult`), JSDoc·코드에 명문화된 규칙,
  구조 불변식
- **환경**: node (순수 로직)

### 어떻게 유도했나 — 불변식에 무게를 싣기

가장 중요한 케이스는 개별 분기가 아니라 **불변식**을 검증한다:

> 여러 입력(설정 누락 / 정상 / 알 수 없는 타입)에 대해 반환이 항상
> `{ isValid, errors, edgeErrors }` 구조이고, **`isValid ⇔ errors.length === 0`**
> 이 성립하는지 확인.

이 불변식은 내부 분기 로직을 리팩터링해도 유지되어야 하는 안정적 계약이므로,
change-detector가 되지 않는다.

### 문서화된 규칙에서 유도하되 문자열 일치는 최소화

- `validateAllNodes([], [])` → JSDoc/코드에 명문화된 "노드 없음" 규칙에서 유도.
- `mcp_tool_child`는 검증 대상에서 제외된다는 **필터 규칙** → child만 있으면
  "노드 없음"과 동일 취급.
- 에러 문자열은 `toContain(...)` / `.some(e => e.includes(...))`로 **핵심 부분만**
  확인한다. 전체 문장 정확 일치는 문구를 바꾸는 순간 깨지는 구현 결합이므로,
  규칙을 대표하는 최소 토큰에만 묶는다.

### 배울 점

- 스킬이 없다고 구현을 베끼지 않았다. "이 함수가 지켜야 할 계약"을 먼저 세우고
  거기서 케이스를 뽑았다.
- 파일 상단 JSDoc에 "이 모듈에는 대응 스킬이 없어 계약에서 유도한다"는 판단
  근거와 change-detector 회피 의도를 남겼다 — 리뷰어가 단언의 성격을 즉시 안다.

---

## 두 예시의 대비 요약

| | 예시 A (스킬 기반) | 예시 B (계약 기반) |
|---|---|---|
| 대응 도메인 스킬 | 있음 (`a2a-server_*`) | 없음 |
| 단언 출처 | scenario given/when/then·상태 전이·핵심 제약 | 시그니처·JSDoc·반환 불변식 |
| 선행 게이트 | `domain-skill-reviewer`로 스킬 신뢰도 확인 | 불필요 |
| 문자열 단언 | 상태 값 비교 중심 | `toContain`/`includes`로 최소화 |
| change-detector 회피 | 구현 아닌 명세에서 유도 | 구현 분기 아닌 불변식에서 유도 |
| 환경 | node | node |

공통점: 둘 다 **구현 코드를 베끼지 않고** 각자의 출처(명세/계약)에서 "해야 하는
것"을 유도했고, 근거를 주석으로 남겼으며, node 환경으로 충분했다. RTL 렌더가
필요한 경우에만 `// @vitest-environment jsdom` + 공용 test-utils 하니스로 전환한다.

---

## RTL 실전 함정 — 컴포넌트 테스트에서 반복해 부딪힌 것들

feature 컴포넌트에 테스트를 붙이며 실제로 만난 함정들이다. 대부분 **증상이
단언 실패로 위장**해서, 모르면 멀쩡한 단언을 약화시키는 쪽으로 잘못 고치게 된다.
컴포넌트 테스트를 시작하기 전에 훑어본다.

| 증상 | 진짜 원인 | 대응 |
|---|---|---|
| `getByText`가 "Found multiple elements"로 실패 | RTL 자동 cleanup 미등록 → 이전 테스트 DOM 누적 | setup 파일에서 명시적 `cleanup()` |
| 클립보드 목이 호출되지 않음 | `userEvent.setup()`이 `navigator.clipboard`를 자체 스텁으로 교체 | 클립보드 목을 **setup 이후에** 설치 |
| 닫기 버튼 조회가 multiple match | 헤더 X와 푸터 버튼의 접근명이 동일 | `findAllByRole` + 인덱스 선택 |
| 쿼리 캐시를 심었는데 에러 바운더리로 튐 | 해당 훅이 `throwOnError: true` | 캐시 주입 대신 그 훅만 교체 |

### 1. RTL 자동 cleanup은 vitest globals가 꺼져 있으면 등록되지 않는다

`@testing-library/react`의 auto-cleanup은 전역 `afterEach`가 있을 때만 스스로
등록된다. vitest에서 `globals: true`를 쓰지 않는 프로젝트라면 **cleanup이 아예
일어나지 않아** 같은 파일의 이전 테스트가 렌더한 DOM이 그대로 쌓인다.

증상은 엉뚱하게 나타난다 — 두 번째 이후 케이스에서 `getByText`가
"Found multiple elements"로 실패한다. 이때 단언을 `getAllByText[0]`으로 눅여
넘어가면 격리 없는 테스트가 그대로 굳는다.

setup 파일에서 명시적으로 정리한다(공용 하니스가 흡수해야 할 책임이다):

```ts
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
});
```

> 참고: `@testing-library/jest-dom`은 `@testing-library/dom`을 peer로 요구한다.
> 누락 시 매처 등록 단계에서 "Cannot find package" 로 스위트 전체가 죽는다.

### 2. `userEvent.setup()`은 `navigator.clipboard`를 갈아끼운다

복사 기능을 검증하려고 `navigator.clipboard`를 목킹했는데 호출이 잡히지 않는다면
순서 문제다. `userEvent.setup()`이 내부적으로 클립보드를 자체 스텁으로 교체하므로,
**setup 이전에 설치한 목은 덮어써진다.**

setup → 목 설치 순서를 헬퍼로 캡슐화하고 이유를 주석으로 남긴다.

```ts
function setupUser() {
  const user = userEvent.setup(); // 먼저
  const writeText = vi.fn();      // 그 다음 목 설치
  Object.assign(navigator, { clipboard: { writeText } });
  return { user, writeText };
}
```

### 3. 디자인 시스템 다이얼로그는 닫기 버튼이 둘일 수 있다

헤더의 X와 푸터의 "닫기"가 **같은 접근명**을 갖는 컴포넌트가 있다. 이때
`getByRole("button", { name: "닫기" })`는 multiple match로 실패한다.

여기서 `getByText`나 클래스 셀렉터로 우회하면 구현 결합이 된다. 역할·접근명은
유지한 채 복수 매칭을 명시적으로 다룬다.

```ts
const closeButtons = await screen.findAllByRole("button", { name: "닫기" });
await user.click(closeButtons[0]); // 헤더 X
```

### 4. `throwOnError` 훅은 캐시 주입으로 제어되지 않는다

react-query 컴포넌트를 테스트할 때 보통은 격리된 QueryClient에
`setQueryData`로 캐시를 심는 편이 목킹보다 실제 동작에 가깝다. 하지만 래퍼 훅이
`throwOnError: true`로 설정돼 있으면, 캐시가 채워져 있어도 **백그라운드 refetch
실패가 에러 바운더리로 튀어** 테스트가 불안정해진다.

이 경우엔 캐시 주입을 고집하지 말고 해당 훅만 교체한다. 나머지는 실제 구현을
그대로 쓰는 것이 원칙이다.

```ts
vi.mock("@/shared/lib/react-query", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useFallbackQuery: vi.fn(), // 이 훅만 교체
}));
```

### 공통 교훈

이 함정들의 공통점은 **인프라 문제가 단언 실패로 위장한다**는 것이다. 단언을
약화시켜 통과시키기 전에 "이게 정말 컴포넌트 동작 문제인가, 환경 문제인가"를
먼저 묻는다. 그리고 한 번 밝혀진 함정은 개별 테스트가 아니라 **공용 하니스나
이 문서가 흡수**해서, 다음 사람이 같은 자리에서 다시 넘어지지 않게 한다.
</content>
