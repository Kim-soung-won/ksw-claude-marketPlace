---
name: change-planning
description: 기존 코드베이스 변경 계획이나 계획 재검토 반영을 요청할 때 코드를 조사하고 지정된 계획 JSON을 반환한다.
---

# change-planning

업무 절차의 원본은 [change-planner 절차](../../resources/change-planner/procedure.md)다.

change-planner 에이전트가 등록되어 있고 위임 도구를 쓸 수 있으면 요청 텍스트·관련 코드베이스
컨텍스트·`review_history`를 전달해 위임하고, 반환된 계획 JSON을 그대로 전달한다.
에이전트를 쓸 수 없으면 위 절차 문서를 읽고 현재 에이전트가 같은 절차를 직접 수행한다.
