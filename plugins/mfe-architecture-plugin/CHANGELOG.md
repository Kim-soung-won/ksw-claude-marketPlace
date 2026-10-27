# Changelog — mfe-architecture-plugin

## [0.6.0] - 2026-10-27

### 추가
- 스킬 `mfe-shared-query-client`: Host·Remote react-query 인스턴스 통합 규약. 중복이 생기는 세 층
  (라이브러리·Provider·모듈 전역 인스턴스), 렌더 중 주입·standalone 폴백 `QueryClientBridge` 기준 구현,
  기존 모듈 점검·이전 절차, 검토 후 채택하지 않은 대안(client 인자 전달)을 담는다.

### 변경
- `mfe-runtime-troubleshooting` 사례 4와 계열 D 표, `mf-config-reference.md` §7 서버 캐시 규약을
  새 기준 구현에 맞췄다. `useEffect` 주입·주입 전 throw 구현 예시를 걷어냈다.

## [0.5.0] - 2026-09-28

### 변경
- `mfe-config-architect`·`remote-contract-manager` 업무 절차를 호스트 중립 원본
  `resources/<agent>/procedure.md`로 옮겼다. Claude 에이전트 본문, Codex 에이전트,
  `mfe-workflows` 스킬이 모두 이 문서를 직접 읽는다.
- 계약 스킬의 호스트별 위치·명명(Claude Code `.claude/skills/MFE_{RemoteName}`, Codex
  `.agents/skills/mfe-{remote-name}`)과 실제 모듈 이름·`loadRemote` 접두사 보존, 기존 스킬 이름·
  사용자 지정 위치 보존 규칙을 `remote-contract-manager` 절차에 명시했다.
- Codex 에이전트 템플릿(`codex/agents/*.json`)은 Claude frontmatter에서 생성한다
  (`scripts/generate-codex-agents.js`). 설명·sandbox를 따로 손으로 쓰지 않는다.
- Codex가 Claude 정의를 번역해 읽을 필요가 없어져 `codex/runtime.md`를 삭제했다.

## [0.4.3] - 2026-09-28

- Codex `interface.shortDescription`이 글자 수로 잘려 단어 중간에서 끊기던 것을 요약문으로 교체했다.

## [0.4.2] - 2026-09-14

CHANGELOG 정합성 정리(0.4.1 항목 기록 커밋에서 pre-commit 훅이 자동 상승한 분). 플러그인 동작 변경 없음.

## [0.4.1] - 2026-09-14

- 서브에이전트 `mfe-config-architect`·`remote-contract-manager` 모델을 `opus`로 상향(토큰 여유 반영).

## [0.4.0] - 2026-09-10

- Codex 카탈로그와 공통 스킬 배포 지원.
- Codex 실행 규약·에이전트 등록 또는 스킬 호출 경로 정리.

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
