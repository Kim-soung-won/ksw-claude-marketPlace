---
name: domain-knowledge
description: API 명세·도메인 규칙·시나리오를 기록·감사하거나 신규·기존 도메인의 논리 계약 준비와 테스트 명세화 절차로 연결할 때 사용한다.
---

# domain-knowledge

아래에서 요청에 맞는 업무 하나를 선택한다. 각 업무 절차의 원본은 호스트 중립 문서다.

논리 계약 준비까지 요청받으면 [domain-contracts](../domain-contracts/SKILL.md)를 직접 수행한다.
UI의 테스트 명세화·검토 후 구현까지는 그 스킬의 `domain-ui-tdd` 연결을 따른다.
계약 준비 과정에서 지식 기록·감사만 전달받았다면 아래 절차만 수행하고 호출자에게 반환한다.

| 업무 | 원본 절차 |
|---|---|
| 제공된 API·시나리오·도메인 규칙을 프로젝트 스킬로 기록·갱신한다. | [domain-skill-manager 절차](../../resources/domain-skill-manager/procedure.md) |
| 도메인 스킬의 명세·타입·연결 일관성과 관련 테스트의 존재·명세 연결을 읽기 전용으로 감사한다. | [domain-skill-reviewer 절차](../../resources/domain-skill-reviewer/procedure.md) |

해당 에이전트(`domain-skill-manager`·`domain-skill-reviewer`)가 등록되어 있고 위임 도구를
쓸 수 있으면 입력·범위·출력 형식을 전달해 위임하고, 반환된 결과를 그대로 전달한다.
에이전트를 쓸 수 없으면 선택한 절차 문서를 읽고 현재 에이전트가 같은 절차를 직접 수행한다.
결과는 절차 문서가 지정한 형식을 따른다.
