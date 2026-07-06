# domain-skill-manager — SKILL.md 포맷 규칙

> 이 파일은 `agents/domain-skill-manager.md`에서 분리된 정적 참고 자료다.
> 본문(워크플로 로직)과 분리해 4단계(SKILL.md 작성)에 진입했을 때만 Read로
> 읽는다. 결과 리포트 출력 형식은 같은 디렉터리의 `report-format.md`를 참고한다.

---

## Frontmatter

```yaml
---
name: {도메인}_{타입}
description: >-
  {아래 "description 작성 규칙"에 따라 타입별 패턴으로 작성}
metadata:
  type: domain-skill
  collaborators:          # 협업자가 있는 경우만 포함
    - {이름} ({역할/팀})
  confidence:             # NEW — 지식 확신도 추적
    unconfirmed:          # 협업자 확인이 아직 안 된 항목
      - topic: "{무엇이 불확실한가}"
        note: "{왜 불확실하고, 무엇을 확인해야 하는가}"
    inferred:             # 코드·문서에서 추론한 항목 (직접 확인 안 됨)
      - topic: "{추론한 내용}"
        note: "{어디서 추론했는가}"
---
```

**`confidence` 섹션 작성 기준**:

| 분류 | 언제 사용 |
|------|-----------|
| `confirmed` (기본) | 협업자가 직접 말한 내용. 별도 표기 없음 (스킬 본문이 곧 confirmed) |
| `unconfirmed` | 입력에 "확인 필요", "아직 모름", "추정"이 포함된 경우. 기존 TODO 주석 대체 |
| `inferred` | 협업자 발언 없이 코드나 타 스킬에서 추론한 내용 |

`unconfirmed` 항목이 있으면 body 섹션의 해당 부분에 `⚠️ unconfirmed` 주석으로 위치를 표시한다:

```markdown
| `schemaUsed` | `{ id, name }[] \| null` | ⚠️ unconfirmed: 단수/복수 미확인 |
```

---

## description 작성 규칙

> **description은 스킬 자동 호출의 트리거 조건이다.**
> Claude는 description을 읽고 "지금 이 스킬을 호출해야 하는가?"를 판단한다.

세 가지 패턴 모두 **호출 상황(파일·작업 맥락)** + **필요한 정보 유형** + **cross-reference** 구조를 따른다.

### `_api` 패턴

```
`src/shared/api/{도메인}/` 또는 `src/entities/{도메인}/`를 작성·수정할 때,
{엔드포인트} API의 경로·파라미터·Request/Response 구조가 필요하면 호출한다.
도메인 타입·관계는 [[{도메인}_domain]], UI 흐름은 [[{도메인}_scenario]]를 호출한다.
```

### `_domain` 패턴

```
계층 무관하게 {Entity}가 무엇인지, {관계·불변조건}이 무엇인지 알아야 할 때 읽는다.
`src/features/`와 `src/entities/` 모두에서 타입을 참조할 때 기준 문서가 된다.
API 명세는 [[{도메인}_api]], UI 흐름은 [[{도메인}_scenario]]를 읽는다.
```

### `_scenario` 패턴

```
`src/features/{도메인}/` 또는 `src/pages/{도메인}/`에서
{기능}의 UI 흐름·폴링 전략·에러 처리·폼 로직을 구현·수정할 때 읽는다.
타입·불변조건은 [[{도메인}_domain]], API 명세는 [[{도메인}_api]]를 읽는다.
```

---

## 바디 섹션 구조

| 섹션 | 필수/선택 | 포함 기준 |
|------|-----------|-----------|
| 한 줄 정의 | **필수** | 항상 |
| API 명세 | **필수** (API 있을 때) | HTTP method별 필수 항목 규칙 참고 |
| 에러 응답 | **필수** (API 있을 때) | 확인된 케이스만. 없으면 `<!-- unconfirmed -->` 명시 |
| 핵심 제약사항 | **필수** | 항상. 없으면 `- 없음` 명시 |
| 도메인 구조 | 선택 | 엔티티 관계 2개 이상일 때 |
| 핵심 의사 결정 | 선택 | 비자명한 설계 판단이 있을 때 |
| 시나리오 / 처리 흐름 | **필수** (`_scenario`) | 성공 흐름 + 실패/에러 흐름 모두 |
| 실패 처리 | **필수** (`_scenario`) | `overallStatus === "failed"` 이후 UI 흐름 |

**HTTP method별 API 명세 필수 항목**:

| Method | Query/Path | Request Body | Response | 에러 응답 |
|--------|------------|--------------|----------|-----------|
| `GET` | **필수** | 해당 없음 | **필수** | 확인된 케이스 |
| `POST` | 있으면 포함 | **필수** | 있으면 포함 | 확인된 케이스 |
| `PUT/PATCH` | 있으면 포함 | **필수** | 있으면 포함 | 확인된 케이스 |
| `DELETE` | 있으면 포함 | body 있으면 필수 | 있으면 포함 | 확인된 케이스 |

에러 응답이 제공되지 않은 경우:
```markdown
> ⚠️ unconfirmed: 에러 응답 구조 미확인. 공통 에러 포맷은 [[error-contract]] 참고.
```

---

## 실패 흐름 작성 기준 (`_scenario` 전용)

`_scenario` 스킬은 반드시 성공 흐름과 실패 흐름을 모두 포함한다.

```markdown
## 실패 처리

### {기능명} 실패 시

```
overallStatus === "failed" 감지
  → 폴링 중단
  → UI: {실패 상태 표시 방법}  ⚠️ unconfirmed: 표시 방법 미확인
  → 재시도: {재시도 가능 여부 및 방법}  ⚠️ unconfirmed: 재시도 엔드포인트 미확인
```

실패 흐름 정보가 없는 경우 `⚠️ unconfirmed`로 표시하고 `confidence.unconfirmed`에 등록한다.

---

## 작성 지침

1. **API 명세는 실제 JSON 그대로** — 사용자가 전달한 Request/Response Body를 가공 없이 포함.
   필드 의미가 불명확한 경우 이름에서 유추해 간략히 주석 추가.

2. **한국어 + 영어 혼용** — 도메인 용어는 코드에서 사용되는 영어 식별자를 병기.

3. **UPDATE 시 기존 내용 보존** — 기존 섹션을 삭제하지 않는다. 새 정보를 추가하거나 변경된 부분만 수정.

4. **타입 중앙화 원칙** — 동일 타입은 `_domain` 스킬 한 곳에만 정의한다.
   `_api`와 `_scenario`에서 같은 타입이 필요하면 `[[도메인_domain]] 참고`로 처리.
   2.7단계(타입 권위 체크)를 통해 중복 정의를 사전에 차단한다.

5. **추측 금지 + unconfirmed 표기**:
   - 확인되지 않은 정보는 `⚠️ unconfirmed:` 인라인 주석 + frontmatter `confidence.unconfirmed` 에 등록.
   - 기존 body 내 `<!-- TODO -->` 는 `⚠️ unconfirmed:` 로 대체. (단, 레거시 스킬 호환을 위해 TODO도 허용)
   - **절대 금지**: 추측으로 필드값·동작을 채우는 것

6. **trio 완성 유도** — `_api`만 만들었다면 `_domain`·`_scenario`가 필요한지 사용자에게 확인.
   이미 존재하면 description의 cross-reference(`[[]]`)가 정확한지 검토.
   trio 중 누락된 스킬이 있으면 결과 리포트에 명시한다.

7. **횡단 관심사 분리** — 인증, 에러 포맷, HTTP 클라이언트 설정을 도메인 스킬에 기술하려 할 때,
   `[[common/concern-name]]` 참조로 대체하고 해당 common 스킬 생성을 제안한다.

---

## 자가 검증 체크리스트

SKILL.md 작성 완료 후 다음을 순서대로 확인한다. 결과 리포트에 PASS/FAIL 수를 포함한다.

### Frontmatter 검증

- [ ] `name`이 폴더명과 정확히 일치하는가?
- [ ] `name`이 `{도메인}_{타입}` 형식인가? (타입은 `_api` · `_domain` · `_scenario` 중 하나)
- [ ] `collaborators`에 TODO가 없는가?
- [ ] `description`이 타입에 맞는 트리거 패턴을 따르는가?
- [ ] `description`의 `[[링크]]`가 실제 존재하는 스킬명과 일치하는가?
- [ ] `confidence.unconfirmed`가 body의 `⚠️ unconfirmed` 항목과 일치하는가?

### 스킬명 검증

- [ ] 스킬명에 오타 패턴이 없는가? (flle, tpye, shcema 등)
- [ ] 폴더명 = frontmatter `name` = 사용자가 의도한 이름, 모두 일치하는가?

### Body 검증

- [ ] `## 한 줄 정의` 섹션이 존재하는가?
- [ ] `## 핵심 제약사항` 섹션이 존재하는가?
- [ ] API가 있다면 에러 응답이 명시되어 있거나 `⚠️ unconfirmed` 표기가 있는가?
- [ ] `_scenario` 스킬이라면 실패 흐름(`overallStatus === "failed"` 이후)이 포함되어 있는가?
- [ ] UPDATE 모드라면 기존 섹션이 삭제되지 않았는가?
- [ ] `⚠️ unconfirmed`가 있다면 frontmatter `confidence.unconfirmed`에 등록되어 있는가?

**API 명세 method별 검증**:

- [ ] `GET` API가 있다면 Query/Path Parameters와 Response가 모두 명시되어 있는가?
- [ ] `POST·PUT·PATCH` API가 있다면 Request Body가 명시되어 있는가?
- [ ] `DELETE` API가 있고 Body가 존재한다면 Request Body가 명시되어 있는가?
- [ ] 사용자가 제공하지 않은 Response를 추측으로 채우지 않았는가?

### 일관성 검증 (4.5단계 결과 반영)

- [ ] 연결 스킬(`[[링크]]`)에서 타입 충돌이 발견되지 않았는가?
- [ ] 연결 스킬의 제약사항과 모순되는 내용이 없는가?

### trio 완성도

- [ ] 동일 도메인의 `_api`, `_domain`, `_scenario` 세 스킬이 모두 존재하는가?
   - 없는 스킬: `{없는 스킬명}` ← 결과 리포트에 명시
