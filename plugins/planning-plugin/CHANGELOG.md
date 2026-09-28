# Changelog — planning-plugin

## [0.2.1] - 2026-09-28

- Codex `interface.shortDescription`이 글자 수로 잘려 단어 중간에서 끊기던 것을 요약문으로 교체했다.

## [0.2.0] - 2026-09-10

- Codex 카탈로그와 공통 스킬 배포 지원.
- Codex 실행 규약·에이전트 등록 또는 스킬 호출 경로 정리.

형식: [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) · 버전: [SemVer](https://semver.org/lang/ko/)

이 플러그인의 `version` 은 사용자 측 `/plugin marketplace update` 가 갱신을 인식하는 유일한
키다. patch 는 커밋 시 pre-commit 훅이 자동으로 올리고, minor·major 는 직접 올린다 — 판단
기준과 기록 방법은 루트 [README](../../README.md#버전과-changelog) 참고.

## [0.1.1] - 2026-08-06

CHANGELOG 도입 기준선이다. 이 버전까지의 변경 내역은 `git log -- plugins/planning-plugin/` 에 있다.
아래는 0.1.1 시점에 이 플러그인이 제공하는 것이다.

### 에이전트
- `change-planner` — 기존 코드베이스를 전제로 한 변경 계획 JSON 수립. 영향 범위를 분석하고
  재호출 시 직전 critique 의 미해결 이슈를 우선 처리한다.
