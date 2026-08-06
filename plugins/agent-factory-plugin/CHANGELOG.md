# Changelog — agent-factory-plugin

형식: [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) · 버전: [SemVer](https://semver.org/lang/ko/)

이 플러그인의 `version` 은 사용자 측 `/plugin marketplace update` 가 갱신을 인식하는 유일한
키다. patch 는 커밋 시 pre-commit 훅이 자동으로 올리고, minor·major 는 직접 올린다 — 판단
기준과 기록 방법은 루트 [README](../../README.md#버전과-changelog) 참고.

## [0.14.1] - 2026-08-06

CHANGELOG 도입 기준선이다. 이 버전까지의 변경 내역은 `git log -- plugins/agent-factory-plugin/` 에 있다.
아래는 0.14.1 시점에 이 플러그인이 제공하는 것이다.

### 훅
- `capture-commit-session` (PostToolUse) — 커밋마다 세션 JSONL 의 델타 구간을 사용자 레벨
  큐에 적재한다. 유령 커밋 기록과 세션 경계를 넘는 중복을 막는 4중 가드를 둔다.
- `allow-factory-paths` (PreToolUse) — 이 플러그인이 소유한 경로(`~/.agent-factory/`)와
  번들 스크립트 실행에 한해 권한을 자동 허용한다. 그 밖에는 판정하지 않는다.

### 스크립트
- `distill-session` — 적재된 델타에서 노이즈를 걷어내고, 턴별 컨텍스트 시계열과 급상승
  원인 라벨(도구 결과·사용자 입력)을 뽑는다.

### 에이전트
- `session-feedback-summarizer` — distill 결과를 근거로 세션 요약과 에이전트 사용 피드백을
  기록 파일로 남긴다.

### MCP
- Observer 서버 조회 도구 9종(전부 읽기 전용).

### 계약
- 이 플러그인은 작업 레포에 아무것도 쓰지 않는다. 산출물은 전부 `~/.agent-factory/` 에 둔다.
- 훅은 어떤 경우에도 커밋을 막지 않는다(항상 exit 0). 실패는 `errors.jsonl` 로만 남긴다.

### 검증
- `capture-commit-session` 회귀 테스트 39건 추가. 훅을 자식 프로세스로 띄워 실제 hook JSON 을
  먹이고 큐 적재·skip 사유로 판정한다. 두 번 회귀했던 커밋 명령 판정(`git -C … commit`,
  개행 구분자)과 4중 가드, 열화 환경에서의 exit 0 계약을 케이스로 고정했다.
