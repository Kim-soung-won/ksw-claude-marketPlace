---
name: claude-maintenance
description: Claude Code용 에이전트·스킬·훅·MCP를 작성하거나 정의 규격·컨텍스트 비용을 진단하는 요청에 사용한다.
---

# claude-maintenance

요청에 맞는 업무 하나를 고른다. 각 업무 절차의 원본은 아래 문서다.

| 업무 | 원본 절차 |
|---|---|
| Claude Code용 서브에이전트 정의를 공식 규격에 맞게 작성한다. | [subagent-creator](../../resources/subagent-creator/procedure.md) |
| Claude Code용 서브에이전트 정의의 규격과 위임 경계를 감사한다. | [subagent-evaluator](../../resources/subagent-evaluator/procedure.md) |
| Claude Code용 서브에이전트의 컨텍스트 구성과 비용 근거를 감사한다. | [subagent-cost-auditor](../../resources/subagent-cost-auditor/procedure.md) |
| Claude Code용 스킬과 참조 자료를 작성·수정한다. | [claude-skill-creator](../../resources/claude-skill-creator/procedure.md) |
| Claude Code용 훅 설정과 스크립트를 작성하거나 진단한다. | [hook-manager](../../resources/hook-manager/procedure.md) |
| Claude Code에 연결할 MCP 서버·설정을 작성하거나 진단한다. | [mcp-server-creator](../../resources/mcp-server-creator/procedure.md) |

해당 에이전트가 등록되어 있고 위임 도구를 쓸 수 있으면 요청·대상 경로·범위를 전달해 위임하고,
반환된 결과를 그대로 전달한다. 에이전트를 쓸 수 없으면 고른 절차 문서를 읽고 현재 에이전트가
같은 절차를 직접 수행한다. 결과는 절차 문서가 지정한 형식을 따른다.
