---
name: frontend-workflows
description: FSD 구조 생성·검토 또는 Vitest 테스트 작성·감사를 요청할 때 해당 업무 절차를 선택해 수행한다.
---

# frontend-workflows

이 파일 기준 `../..`가 플러그인 루트다. Codex에서는 먼저
[실행 연결 규칙](../../codex/runtime.md)을 읽는다. Claude Code에서는 기존 네이티브
에이전트를 사용할 수 있다. 아래에서 요청에 맞는 업무 하나를 선택한다.

| 업무 | 원본 절차 |
|---|---|
| 대상 모듈의 Vitest 테스트를 작성·실행하고 결과를 요약한다. | [test-writer](../../agents/test-writer.md) |
| 기존 테스트의 구현 결합과 계약 누락을 읽기 전용으로 감사한다. | [test-reviewer](../../agents/test-reviewer.md) |
| 팀 FSD 규칙에 맞게 프론트엔드 구조를 생성하거나 검토한다. | [fsd-structure-architect](../../agents/fsd-structure-architect.md) |

등록된 해당 에이전트와 위임 도구가 있으면 입력·범위·출력 형식을 전달해 위임한다.
없으면 선택한 원본을 읽고 같은 절차를 현재 에이전트가 수행한다. YAML frontmatter는
업무 설명이며 호스트 설정으로 실행하지 않는다. 결과는 원본의 지정 형식을 따른다.
