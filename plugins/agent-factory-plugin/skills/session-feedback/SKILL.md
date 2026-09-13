---
name: session-feedback
description: 캡처된 커밋 세션 큐를 요약하고 에이전트 사용 피드백을 정리·기록하거나 agent-factory 큐 처리를 요청할 때 사용한다.
---

# session-feedback

이 파일 기준 `../..`가 플러그인 루트다. Codex에서는 먼저
[실행 연결 규칙](../../codex/runtime.md)을 읽는다. Claude Code에서는 기존 네이티브
에이전트를 사용할 수 있다. 아래에서 요청에 맞는 업무 하나를 선택한다.

| 업무 | 원본 절차 |
|---|---|
| 캡처된 커밋 세션을 digest로 전처리하고 근거 기반 사용 피드백을 기록한다. | [session-feedback-summarizer](../../agents/session-feedback-summarizer.md) |

등록된 해당 에이전트와 위임 도구가 있으면 입력·범위·출력 형식을 전달해 위임한다.
없으면 선택한 원본을 읽고 같은 절차를 현재 에이전트가 수행한다. YAML frontmatter는
업무 설명이며 호스트 설정으로 실행하지 않는다. 결과는 원본의 지정 형식을 따른다.

Codex 세션은 digest의 측정 한계를 함께 보고한다. 로컬 요약 요청만으로 서버 전송과
전송 성공분 삭제를 수행하지 않는다. 해당 동작이 요청된 경우에만 전송 단계를 실행한다.
