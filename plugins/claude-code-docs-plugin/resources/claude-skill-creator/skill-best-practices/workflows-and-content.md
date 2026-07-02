# skill-best-practices — 워크플로 및 피드백 루프(체크리스트·validate-fix-repeat), 콘텐츠 가이드라인(시간에 민감한 정보·용어 일관성), 일반적인 패턴(템플릿·예시·조건부 워크플로)

> 출처: https://platform.claude.com/docs/ko/agents-and-tools/agent-skills/best-practices
> (Claude Developer Platform 공식 문서, 2026-07-02 스냅샷)
> 이 파일은 `skill-best-practices/index.md`에서 분리된 하위 문서다.
> 전체 목차와 공유 전 체크리스트는 index.md를 먼저 확인한다.

---

## 워크플로 및 피드백 루프

### 복잡한 작업에 워크플로 사용하기

복잡한 작업을 명확하고 순차적인 단계로 나눈다. 특히 복잡한 워크플로의 경우,
Claude가 응답에 복사하여 진행하면서 체크할 수 있는 체크리스트를 제공한다.

**예시 1: 연구 종합 워크플로** (코드가 없는 Skill용):

````markdown
## Research synthesis workflow

Copy this checklist and track your progress:

```
Research Progress:
- [ ] Step 1: Read all source documents
- [ ] Step 2: Identify key themes
- [ ] Step 3: Cross-reference claims
- [ ] Step 4: Create structured summary
- [ ] Step 5: Verify citations
```

**Step 1: Read all source documents**
...(각 단계마다 무엇을 확인해야 하는지 구체적으로 기술)
````

**예시 2: PDF 양식 작성 워크플로** (코드가 있는 Skill용) — "분석 스크립트
실행 → 필드 매핑 편집 → 검증 스크립트 실행 → 채우기 스크립트 실행 → 출력
검증 스크립트 실행"처럼 각 단계에 정확한 명령어를 명시하고, 검증 실패 시
어느 단계로 돌아가야 하는지도 명시한다.

명확한 단계는 Claude가 중요한 검증을 건너뛰는 것을 방지한다. 체크리스트는
Claude와 사용자 모두가 다단계 워크플로의 진행 상황을 추적하는 데 도움이
된다.

### 피드백 루프 구현하기

**일반적인 패턴: 검증기 실행 → 오류 수정 → 반복.** 이 패턴은 출력 품질을
크게 향상시킨다.

- **코드가 없는 예시(스타일 가이드 준수)**: "가이드라인에 따라 초안 작성 →
  체크리스트로 검토(용어 일관성, 예시 형식, 필수 섹션) → 문제 발견 시 구체적
  섹션 참조와 함께 수정 → 모든 요구 사항 충족 시에만 진행"
- **코드가 있는 예시(문서 편집)**: "XML 수정 → 즉시
  `python ooxml/scripts/validate.py unpacked_dir/`로 검증 → 실패 시 수정 후
  재검증 → 통과 시에만 재빌드 → 결과물 테스트"

검증 루프는 오류를 조기에 포착한다.

## 콘텐츠 가이드라인

### 시간에 민감한 정보 피하기

"2025년 8월 이전에는 구버전 API를 쓰라"처럼 오래되면 잘못된 정보가 될
문구는 넣지 않는다. 대신 "이전 패턴" 섹션(예: `<details><summary>Legacy v1
API (deprecated 2025-08)</summary>...</details>`)으로 분리해 주요 콘텐츠를
어지럽히지 않으면서 역사적 컨텍스트를 제공한다.

### 일관된 용어 사용하기

하나의 용어를 선택하고 Skill 전체에서 사용한다. 예: 항상 "API endpoint"
(URL·API route·path 혼용 금지), 항상 "field"(box·element·control 혼용
금지), 항상 "extract"(pull·get·retrieve 혼용 금지). 일관성은 Claude가
지침을 이해하고 따르는 데 도움이 된다.

## 일반적인 패턴

### 템플릿 패턴

출력 형식에 대한 템플릿을 제공하되 엄격함의 수준을 필요에 맞춘다.

- **엄격한 요구 사항** (API 응답·데이터 형식 등): "ALWAYS use this exact
  template structure" + 고정된 마크다운 골격
- **유연한 지침** (적응이 유용할 때): "다음은 합리적인 기본 형식이지만
  분석 내용에 맞춰 최선의 판단으로 조정하라"

### 예시 패턴

출력 품질이 예시를 보는 것에 의존하는 Skill은 입력/출력 쌍을 제공한다.
예: 커밋 메시지 생성 Skill에서 "Input: Added user authentication with JWT
tokens" → "Output: feat(auth): implement JWT-based authentication\n\nAdd
login endpoint and token validation middleware" 형태로 2~3개의 예시를
나열하고 마지막에 공통 규칙("type(scope): brief description, then detailed
explanation")을 요약한다. 예시는 설명만으로는 전달하기 어려운 원하는
스타일과 세부 수준을 Claude가 더 명확하게 이해하도록 돕는다.

### 조건부 워크플로 패턴

의사 결정 지점을 통해 Claude를 안내한다: "1. 수정 유형을 판단한다 → 신규
생성이면 'Creation workflow'를, 기존 편집이면 'Editing workflow'를 따른다."

> **팁**: 워크플로가 많은 단계로 커지거나 복잡해지면 별도의 파일로 분리하고
> Claude에게 현재 작업에 따라 적절한 파일을 읽도록 지시하는 것을 고려한다.


---

## 관련 파일

- [index.md](index.md) — 전체 목차, 공유 전 체크리스트, 라우팅 표
- [core-writing.md](core-writing.md)
- [evaluation-and-antipatterns.md](evaluation-and-antipatterns.md)
- [advanced-code-skills.md](advanced-code-skills.md)
