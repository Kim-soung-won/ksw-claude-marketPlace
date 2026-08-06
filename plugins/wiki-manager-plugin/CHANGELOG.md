# Changelog — wiki-manager-plugin

형식: [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) · 버전: [SemVer](https://semver.org/lang/ko/)

이 플러그인의 `version` 은 사용자 측 `/plugin marketplace update` 가 갱신을 인식하는 유일한
키다. patch 는 커밋 시 pre-commit 훅이 자동으로 올리고, minor·major 는 직접 올린다 — 판단
기준과 기록 방법은 루트 [README](../../README.md#버전과-changelog) 참고.

## [1.2.2] - 2026-08-06

CHANGELOG 도입 기준선이다. 이 버전까지의 변경 내역은 `git log -- plugins/wiki-manager-plugin/` 에 있다.
아래는 1.2.2 시점에 이 플러그인이 제공하는 것이다.

### 에이전트
- `wiki-manager` — Obsidian vault 의 노트 캡처와 위키링크 연계

### 커맨드
- `/log` — 현재 대화의 핵심을 오늘의 Daily Note 에 append 하는 캡처층. repo 로 프로젝트를
  자동 분류하되 정식 노트화는 하지 않는다.
- `/ingest` — 다시 찾아볼 가치가 있는 지식을 정식 위키 노트로 결정화해 `_inbox/` 에 저장
- `/new-project` — 필수 입력을 먼저 받고 Overview + Decisions Log 척추를 스캐폴딩한 뒤
  Project Map 에 등록. 빈 스텁은 만들지 않는다.
