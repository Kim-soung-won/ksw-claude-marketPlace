# Changelog — domain-knowledge-plugin

형식: [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) · 버전: [SemVer](https://semver.org/lang/ko/)

이 플러그인의 `version` 은 사용자 측 `/plugin marketplace update` 가 갱신을 인식하는 유일한
키다. patch 는 커밋 시 pre-commit 훅이 자동으로 올리고, minor·major 는 직접 올린다 — 판단
기준과 기록 방법은 루트 [README](../../README.md#버전과-changelog) 참고.

## [1.1.2] - 2026-08-06

CHANGELOG 도입 기준선이다. 이 버전까지의 변경 내역은 `git log -- plugins/domain-knowledge-plugin/` 에 있다.
아래는 1.1.2 시점에 이 플러그인이 제공하는 것이다.

### 에이전트
- `domain-skill-manager` — 협업자·기획자에게 받은 도메인 지식(API 스펙·시나리오·도메인
  규칙)을 SKILL.md 트리오로 기록한다.
- `domain-skill-reviewer` — 기록된 도메인 스킬이 코드 현실과 어긋난 지점을 전수 진단한다.
  파일을 고치지 않고 우선순위 리포트만 낸다.
