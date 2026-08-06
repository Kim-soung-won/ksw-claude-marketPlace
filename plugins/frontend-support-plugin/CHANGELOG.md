# Changelog — frontend-support-plugin

형식: [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) · 버전: [SemVer](https://semver.org/lang/ko/)

이 플러그인의 `version` 은 사용자 측 `/plugin marketplace update` 가 갱신을 인식하는 유일한
키다. patch 는 커밋 시 pre-commit 훅이 자동으로 올리고, minor·major 는 직접 올린다 — 판단
기준과 기록 방법은 루트 [README](../../README.md#버전과-changelog) 참고.

## [1.2.4] - 2026-08-06

CHANGELOG 도입 기준선이다. 이 버전까지의 변경 내역은 `git log -- plugins/frontend-support-plugin/` 에 있다.
아래는 1.2.4 시점에 이 플러그인이 제공하는 것이다.

### 에이전트
- `fsd-structure-architect` — 팀 하우스 스타일 4계층 구조 scaffold·검토
- `test-writer` — 대상 모듈의 vitest 테스트를 작성하고 통과까지 확인
- `test-reviewer` — 작성된 테스트가 구현을 박제한 change-detector 인지 감사(리포트만)

### 스킬
- `test-authoring` — 단언의 출처를 도메인 스킬 명세와 함수 계약으로 이원화하는 규약
- `component-design-patterns` — 컴포넌트 분리 단위와 데이터 패칭 배치 기준
- `dependency-cleanup` — 미사용 의존성을 자동 도구 결과에 의존하지 않고 교차 검증해 제거
