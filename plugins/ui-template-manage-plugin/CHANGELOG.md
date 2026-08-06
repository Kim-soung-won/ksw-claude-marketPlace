# Changelog — ui-template-manage-plugin

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
