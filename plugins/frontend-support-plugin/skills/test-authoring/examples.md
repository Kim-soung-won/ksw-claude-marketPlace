# 테스트 작성 규약 — 골드 예시

`SKILL.md`의 이원화 원칙을 실제 프로젝트에 적용해 커밋한 두 사례. 단언을 어디서
어떻게 끌어올지 판단이 서지 않을 때 읽는다. 두 예시는 "단언의 출처"가 정반대다.

## 목차

- 예시 A — 스킬 기반: zustand 스토어 (`server-id-store.test.ts`)
- 예시 B — 계약 기반: 검증 함수 (`node-validator.test.ts`)
- 두 예시의 대비 요약

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
</content>
