# Changelog — mfe-architecture-plugin

형식: [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) · 버전: [SemVer](https://semver.org/lang/ko/)

이 플러그인의 `version` 은 사용자 측 `/plugin marketplace update` 가 갱신을 인식하는 유일한
키다. patch 는 커밋 시 pre-commit 훅이 자동으로 올리고, minor·major 는 직접 올린다 — 판단
기준과 기록 방법은 루트 [README](../../README.md#버전과-changelog) 참고.

## [0.3.0] - 2026-09-01

### 제거
- `mf` (공식 올인원 skill)을 신설 `module-federation-official-plugin` 으로 **분리**했다.
  공식 MF 지식(업스트림 재동기화 대상)과 팀 하우스 규칙을 플러그인 단위로 갈라, 이 플러그인은
  순수 하우스 규칙(설정 규약·경계 설계·런타임 진단·계약 문서)만 남긴다. 공식 스킬이 필요하면
  `module-federation-official-plugin` 을 설치한다.

## [0.2.0] - 2026-09-01

### 스킬
- `mf` — Module Federation 오픈소스가 공식 지원하는 올인원 skill을 한글화해 번들.
  개념·설정·런타임 API·shared/exposes/remotes·타입(dts)·RUNTIME 에러 트러블슈팅·관측(observability)·
  성능·Bridge 통합을 서브커맨드로 라우팅하며, `scripts/`(config/shared/bridge/type 검사 등)와
  `reference/`(browser-debug 포함) 리소스를 포함한다.

## [0.1.1] - 2026-08-06

CHANGELOG 도입 기준선이다. 이 버전까지의 변경 내역은 `git log -- plugins/mfe-architecture-plugin/` 에 있다.
아래는 0.1.1 시점에 이 플러그인이 제공하는 것이다.

### 에이전트
- `mfe-config-architect` — Module Federation Host/Remote 설정 생성·검토
- `remote-contract-manager` — Remote 공개 계약 문서화

### 스킬
- `mfe-boundary-design` — 무엇을 별도 모듈로 떼고 무엇을 셸에 남길지의 판단 기준
- `mfe-runtime-troubleshooting` — 원격 모듈 로드 실패·화면 미표시의 진단 절차
