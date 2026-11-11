---
name: domain-knowledge
description: API 명세·도메인 규칙·시나리오를 프로젝트 스킬로 기록·갱신하거나 코드와의 어긋남을 감사할 때 사용한다.
---

# domain-knowledge

아래에서 요청에 맞는 업무 하나를 선택한다. 각 업무 절차의 원본은 호스트 중립 문서다.

| 업무 | 원본 절차 |
|---|---|
| 제공된 API·시나리오·도메인 규칙을 프로젝트 스킬로 기록·갱신한다. | [domain-skill-manager 절차](../../resources/domain-skill-manager/procedure.md) |
| 도메인 스킬의 명세·타입·연결 일관성과 관련 테스트의 존재·명세 연결을 읽기 전용으로 감사한다. | [domain-skill-reviewer 절차](../../resources/domain-skill-reviewer/procedure.md) |

해당 에이전트(`domain-skill-manager`·`domain-skill-reviewer`)가 등록되어 있고 위임 도구를
쓸 수 있으면 입력·범위·출력 형식을 전달해 위임하고, 반환된 결과를 그대로 전달한다.
에이전트를 쓸 수 없으면 선택한 절차 문서를 읽고 현재 에이전트가 같은 절차를 직접 수행한다.
결과는 절차 문서가 지정한 형식을 따른다.
