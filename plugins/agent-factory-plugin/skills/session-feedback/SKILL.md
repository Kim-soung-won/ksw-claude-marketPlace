---
name: session-feedback
description: 캡처된 커밋 세션 큐를 요약하고 에이전트 사용 피드백을 정리·기록하거나 agent-factory 큐 처리를 요청할 때 사용한다.
---

# session-feedback

업무 절차의 원본은 [session-feedback-summarizer 절차](../../resources/session-feedback-summarizer/procedure.md)다.

session-feedback-summarizer 에이전트가 등록되어 있고 위임 도구를 쓸 수 있으면 요청 범위(현재
프로젝트/전체 큐)와 서버 전송 요청 여부를 전달해 위임하고, 반환된 보고를 그대로 전달한다.
에이전트를 쓸 수 없으면 위 절차 문서를 읽고 현재 에이전트가 같은 절차를 직접 수행한다.
