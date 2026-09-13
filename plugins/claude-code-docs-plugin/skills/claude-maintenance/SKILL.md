---
name: claude-maintenance
description: Claude Code용 에이전트·스킬·훅·MCP를 작성하거나 정의 규격·컨텍스트 비용을 진단하는 요청에 사용한다.
---

# claude-maintenance

이 파일 기준 `../..`가 플러그인 루트다. Codex에서는 먼저
[실행 연결 규칙](../../codex/runtime.md)을 읽는다. Claude Code에서는 기존 네이티브
에이전트를 사용할 수 있다. 아래에서 요청에 맞는 업무 하나를 선택한다.

| 업무 | 원본 절차 |
|---|---|
| Claude Code용 서브에이전트 정의를 공식 규격에 맞게 작성한다. | [subagent-creator](../../agents/subagent-creator.md) |
| Claude Code용 서브에이전트 정의의 규격과 위임 경계를 감사한다. | [subagent-evaluator](../../agents/subagent-evaluator.md) |
| Claude Code용 서브에이전트의 컨텍스트 구성과 비용 근거를 감사한다. | [subagent-cost-auditor](../../agents/subagent-cost-auditor.md) |
| Claude Code용 스킬과 참조 자료를 작성·수정한다. | [claude-skill-creator](../../agents/claude-skill-creator.md) |
| Claude Code용 훅 설정과 스크립트를 작성하거나 진단한다. | [hook-manager](../../agents/hook-manager.md) |
| Claude Code에 연결할 MCP 서버·설정을 작성하거나 진단한다. | [mcp-server-creator](../../agents/mcp-server-creator.md) |

등록된 해당 에이전트와 위임 도구가 있으면 입력·범위·출력 형식을 전달해 위임한다.
없으면 선택한 원본을 읽고 같은 절차를 현재 에이전트가 수행한다. YAML frontmatter는
업무 설명이며 호스트 설정으로 실행하지 않는다. 결과는 원본의 지정 형식을 따른다.
