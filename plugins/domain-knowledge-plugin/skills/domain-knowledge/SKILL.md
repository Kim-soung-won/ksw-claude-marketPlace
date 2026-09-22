---
name: domain-knowledge
description: API 명세·도메인 규칙·시나리오를 기록·감사하거나 신규·기존 도메인의 논리 계약 준비와 테스트 명세화 절차로 연결할 때 사용한다.
---

# domain-knowledge

이 파일 기준 `../..`가 플러그인 루트다. Codex에서는 먼저
[실행 연결 규칙](../../codex/runtime.md)을 읽는다. Claude Code에서는 기존 네이티브
에이전트를 사용할 수 있다. 아래에서 요청에 맞는 업무 하나를 선택한다.

논리 계약 준비까지 요청받으면 [domain-contracts](../domain-contracts/SKILL.md)를 직접 수행한다.
UI의 테스트 명세화·검토 후 구현까지는 그 스킬의 `domain-ui-tdd` 연결을 따른다.
계약 준비 과정에서 지식 기록·감사만 전달받았다면 아래 절차만 수행하고 호출자에게 반환한다.

| 업무 | 원본 절차 |
|---|---|
| 제공된 API·시나리오·도메인 규칙을 프로젝트 스킬로 기록·갱신한다. | [domain-skill-manager](../../agents/domain-skill-manager.md) |
| 도메인 스킬의 명세·타입·연결 일관성과 관련 테스트의 존재·명세 연결을 읽기 전용으로 감사한다. | [domain-skill-reviewer](../../agents/domain-skill-reviewer.md) |

등록된 해당 에이전트와 위임 도구가 있으면 입력·범위·출력 형식을 전달해 위임한다.
없으면 선택한 원본을 읽고 같은 절차를 현재 에이전트가 수행한다. YAML frontmatter는
업무 설명이며 호스트 설정으로 실행하지 않는다. 결과는 원본의 지정 형식을 따른다.
