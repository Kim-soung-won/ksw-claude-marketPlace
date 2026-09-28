---
name: frontend-workflows
description: 신규·기존 도메인의 TDD 하네스, FSD 구조 생성·검토 또는 단위·통합 테스트 작성·감사를 요청할 때 해당 업무 절차를 선택해 수행한다.
---

# frontend-workflows

아래에서 요청에 맞는 업무 하나를 선택한다. 각 업무 절차의 원본은 표의 procedure.md다.

테스트를 기능 명세로 삼아 개발하거나 기존 기능을 명세화하려면
[domain-ui-tdd](../domain-ui-tdd/SKILL.md)를 먼저 수행한다. 아래 작성자에게는 그 단계의
테스트 모드와 쓰기 범위를 전달한다. 일반 테스트 요청은 기존 `verify` 모드를 유지한다.

| 업무 | 원본 절차 |
|---|---|
| 대상 모듈의 Vitest 테스트를 작성·실행하고 결과를 요약한다. | [test-writer 절차](../../resources/test-writer/procedure.md) |
| 페이지·사용자 흐름의 통합 테스트를 작성·실행한다. | [integration-test-writer 절차](../../resources/integration-test-writer/procedure.md) |
| 기존 테스트의 구현 결합과 계약 누락을 읽기 전용으로 감사한다. | [test-reviewer 절차](../../resources/test-reviewer/procedure.md) |
| 팀 FSD 규칙에 맞게 프론트엔드 구조를 생성하거나 검토한다. | [fsd-structure-architect 절차](../../resources/fsd-structure-architect/procedure.md) |

해당 이름의 에이전트가 등록되어 있고 위임 도구를 쓸 수 있으면 입력·범위·출력 형식을
전달해 위임하고, 반환된 결과를 그대로 전달한다. 에이전트를 쓸 수 없으면 선택한 절차
문서를 읽고 현재 에이전트가 같은 절차를 직접 수행한다. 결과는 절차가 지정한 형식을 따른다.
