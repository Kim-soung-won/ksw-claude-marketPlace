---
name: domain-knowledge
description: API 명세·도메인 규칙·시나리오를 프로젝트 스킬로 기록하거나 기존 도메인 스킬의 일관성을 감사할 때 사용한다.
---

# domain-knowledge

이 파일 기준 `../..`가 플러그인 루트다. Codex에서는 먼저
[실행 연결 규칙](../../codex/runtime.md)을 읽는다. Claude Code에서는 기존 네이티브
에이전트를 사용할 수 있다. 아래에서 요청에 맞는 업무 하나를 선택한다.

| 업무 | 원본 절차 |
|---|---|
| 제공된 API·시나리오·도메인 규칙을 프로젝트 스킬로 기록·갱신한다. | [domain-skill-manager](../../agents/domain-skill-manager.md) |
| 도메인 스킬의 명세·타입·연결 일관성을 읽기 전용으로 감사한다. | [domain-skill-reviewer](../../agents/domain-skill-reviewer.md) |

등록된 해당 에이전트와 위임 도구가 있으면 입력·범위·출력 형식을 전달해 위임한다.
없으면 선택한 원본을 읽고 같은 절차를 현재 에이전트가 수행한다. YAML frontmatter는
업무 설명이며 호스트 설정으로 실행하지 않는다. 결과는 원본의 지정 형식을 따른다.
