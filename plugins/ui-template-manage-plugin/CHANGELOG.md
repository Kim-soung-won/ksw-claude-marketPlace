# Changelog — ui-template-manage-plugin

## [1.2.0] - 2026-09-28

### 변경
- component-skill-manager 업무 절차를 호스트 중립 원본 `resources/component-skill-manager/procedure.md`로
  옮겼다. Claude 에이전트 본문, Codex 에이전트, `component-documentation` 스킬이 모두 이 문서를 직접 읽는다.
- 호스트별 출력 위치(Claude Code `.claude/skills/`, Codex `.agents/skills/`)와 Codex 명명 규칙을
  절차 문서에 통합했다. 기존 스킬은 두 위치를 모두 탐색하고 자동 이동하지 않는다.
- Codex 에이전트 템플릿(`codex/agents/component-skill-manager.json`)은 Claude frontmatter에서 생성한다
  (`scripts/generate-codex-agents.js`). 설명·sandbox를 따로 손으로 쓰지 않는다.
- Codex가 Claude 정의를 번역해 읽을 필요가 없어져 `codex/runtime.md`를 삭제했다.

## [1.1.3] - 2026-09-28

- Codex `interface.shortDescription`이 글자 수로 잘려 단어 중간에서 끊기던 것을 요약문으로 교체했다.

## [1.1.2] - 2026-09-14

CHANGELOG 정합성 정리(1.1.1 항목 기록 커밋에서 pre-commit 훅이 자동 상승한 분). 플러그인 동작 변경 없음.

## [1.1.1] - 2026-09-14

- 서브에이전트 `component-skill-manager` 모델을 `opus`로 상향(토큰 여유 반영).

## [1.1.0] - 2026-09-10

- Codex 카탈로그와 공통 스킬 배포 지원.
- Codex 실행 규약·에이전트 등록 또는 스킬 호출 경로 정리.

형식: [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) · 버전: [SemVer](https://semver.org/lang/ko/)

이 플러그인의 `version` 은 사용자 측 `/plugin marketplace update` 가 갱신을 인식하는 유일한
키다. patch 는 커밋 시 pre-commit 훅이 자동으로 올리고, minor·major 는 직접 올린다 — 판단
기준과 기록 방법은 루트 [README](../../README.md#버전과-changelog) 참고.

## [1.0.2] - 2026-08-06

CHANGELOG 도입 기준선이다. 이 버전까지의 변경 내역은 `git log -- plugins/ui-template-manage-plugin/` 에 있다.
아래는 1.0.2 시점에 이 플러그인이 제공하는 것이다.

### 에이전트
- `component-skill-manager` — 공용 React 컴포넌트 라이브러리(`@we/ai-template` 등)의
  인터페이스·사용법을 SKILL.md 로 문서화한다.
