# Changelog — module-federation-official-plugin

형식: [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) · 버전: [SemVer](https://semver.org/lang/ko/)

이 플러그인의 `version` 은 사용자 측 `/plugin marketplace update` 가 갱신을 인식하는 유일한
키다. patch 는 커밋 시 pre-commit 훅이 자동으로 올리고, minor·major 는 직접 올린다 — 판단
기준과 기록 방법은 루트 [README](../../README.md#버전과-changelog) 참고.

## [0.1.0] - 2026-09-01

`mfe-architecture-plugin` 에서 공식 `mf` 스킬을 분리해 이 플러그인으로 신설했다.
지식 계층(공식 MF 지식)을 하우스 규칙 플러그인과 갈라 독립적으로 재동기화하기 위함이다.

### 스킬
- `mf` — Module Federation 공식 올인원 스킬(한글화). 서브커맨드 라우터 + `reference/`(지연 로드)
  + `scripts/`(config·shared·type·module-info 검사).

### 업스트림 대비 로컬 변경
- `SKILL.md` description 을 코어 서브커맨드(config·shared·type·runtime·module-info·integrate)로
  축소해 하우스 툴과의 자동 트리거 충돌 제거. `observability`·`bridge`는 라우팅 표에는 남아
  명시 호출 시 동작.
- `allowed-tools` 에서 `Bash(divebell *)`·`Bash(npm install --global @divebell/cli)` 제거
  (팀이 divebell 미사용). `reference/`·`scripts/` 원본 내용은 미수정.
