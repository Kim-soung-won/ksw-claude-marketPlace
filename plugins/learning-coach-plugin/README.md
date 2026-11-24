# Learning Coach

목표 중심의 개인 기술 학습을 지원한다. 두 호스트는 같은 스킬과 리소스를 읽는다.

## 시작

설치 후 “이 주제를 배우고 싶어”, “어제 학습 이어가자”처럼 자연스럽게 요청한다. 일반 코드 질문에는 학습을 강요하지 않는다.

- [공통 스킬](skills/learning-coach/SKILL.md)
- [인터뷰 확정 의도와 요구사항 반영표](resources/learning-coach/intent-traceability.md)
- [학습 진행](resources/learning-coach/teaching.md)
- [평가·복습](resources/learning-coach/assessment.md)
- [기록·Notion 동기화](resources/learning-coach/persistence.md)
- [학습 화면 양식](resources/learning-coach/assets/worksheet.md)
- [기록 양식](resources/learning-coach/assets/records.md)

## 제공 범위

예시 파일을 먼저 작성하고 IDE의 같은 Markdown과 Mermaid로 설명한다. 막히면 바로 설명하고, 단위 종료는 명확한 2~3문항으로 확인한다. 확장 중 원래 목표와 복귀 경로를 유지하며 사용자 작업·종료 요청을 우선한다.

학습은 학습 전용 저장소 단위로 진행한다. 사람이 읽는 기록은 `docs/`(학습 개요 `README.md`, 단위별 `units/`의 설명·실험·평가·회고와 조언)에, 세션 원본 이력과 Notion 동기화 상태는 `.learning/`에 둔다. 최초 설정 때 사용자 확인을 받아 프로젝트 AGENTS.md에 학습 프로젝트 구간을 추가하고, CLAUDE.md는 `@AGENTS.md`로 같은 내용을 가져온다. 새 Claude Code·Codex 세션이 이 지침으로 기록 위치를 찾는다.

학습 시작·종료 시 에이전트가 Notion 연결 도구를 사용해 보류 기록을 반영하는 절차를 제공한다. 연결이 없으면 프로젝트에 원문과 미동기화 상태를 남긴다. 대상 페이지는 학습 프로젝트에서 설정하며 인증 정보를 번들하지 않는다.

현재는 지침과 양식이다. 원자적 상태 저장, 동시 수정 충돌 검사, outbox 재시도 엔진은 미구현이다. 실제 두 호스트의 자연어 선택·학습 대화·Notion 동기화·장치 간 인계는 별도 사용 검증이 필요하다.

마켓플레이스 등록과 실제 사용자 설치는 구분한다. 별도 에이전트·훅·MCP 서버는 포함하지 않는다. 개발 검증은 저장소 루트에서 node scripts/validate-all.js로 수행한다.
