# Changelog — domain-knowledge-plugin

## [1.6.0] - 2026-10-06

### 추가
- `_scenario` 스킬에 선택 섹션 `## 화면 미사용 필드`를 추가했다. 화면 구현 후 UPDATE에서 화면 코드 참조를
  확인해 응답·Entity 필드 중 화면에서 쓰지 않는 필드를 검색 범위·기준 시점·사유·근거와 함께 기록한다.
  CREATE 시점에는 만들지 않으며, 미사용 필드도 API 계약과 실행 스키마에서 지우지 않는다.
- domain-skill-reviewer가 미사용으로 마킹됐지만 화면 코드에서 참조되는 필드(낡은 마킹)와
  화면 코드가 있는데 마킹이 없는 도메인을 보고한다.

## [1.5.0] - 2026-10-06

### 추가
- `_domain` 스킬에 `## 필드 의미` 섹션을 필수로 추가했다. 플래그·enum·nullable 등 의미가 자명하지 않은
  필드는 값별로 현실·시스템에서 가리키는 상태, 전환 주체·시점, 근거(확정·inferred·unconfirmed)를 기록한다.
- 필드 의미를 이름에서 단정하거나 필드명을 되풀이하는 서술을 금지하고 자가 검증 항목에 반영했다.
- 입력 형식에 `[필드 의미]` 블록을 추가했다.
- `_scenario` 스킬에 `## 화면 분기 근거` 섹션을 추가했다. 필드 값에 따라 화면이 달라지면
  `필드 = 값`, `[[_domain]]` 필드 의미 출처, 화면 반응, 근거를 적는다. 의미 재정의와 근거 없는 화면 반응은 금지한다.
- domain-skill-reviewer가 `_domain` 필드 의미·`_scenario` 화면 분기 근거 누락과 의미 불일치를 검사한다.
- 계약 준비 결과가 UI 테스트에 화면 분기 근거와 필드 의미 항목을 함께 전달한다.

## [1.4.0] - 2026-09-28

### 변경
- domain-skill-manager·domain-skill-reviewer 업무 절차를 호스트 중립 원본
  `resources/<agent>/procedure.md`로 옮겼다. Claude 에이전트 본문, Codex 에이전트,
  `domain-knowledge` 스킬이 모두 이 문서를 직접 읽는다.
- 호스트별 출력 위치(Claude Code `.claude/skills/`, Codex `.agents/skills/`)와 Codex 명명·도메인 기록·
  공통 관심사 위치 규칙을 절차 문서에 통합했다. 기존 스킬은 두 위치를 모두 탐색한다.
- Codex 에이전트 템플릿(`codex/agents/*.json`)은 Claude frontmatter에서 생성한다
  (`scripts/generate-codex-agents.js`). 설명·sandbox를 따로 손으로 쓰지 않는다.
- Codex가 Claude 정의를 번역해 읽을 필요가 없어져 `codex/runtime.md`를 삭제했다.

## [1.3.0] - 2026-09-22

- 도메인 리뷰에 테스트 존재·명세 연결 검사와 현황 표 추가. 기존 기능의 누락, 선작성 예정, 비활성 골격, 확인 불가를 구분하며 실행 통과와 분리해 보고.

- 신규·기존 도메인의 문서·Swagger·코드 대조와 논리 계약 준비를 위한 `domain-contracts` 스킬 추가.
- 실행 스키마 참조, 기존 계약 재사용, 미구현과 명세 불일치를 구분하는 검토 지원.
- 프론트엔드 TDD 하네스로 근거·계약·검증 결과를 전달하는 절차 추가.

## [1.2.2] - 2026-09-14

CHANGELOG 정합성 정리(1.2.1 항목 기록 커밋에서 pre-commit 훅이 자동 상승한 분). 플러그인 동작 변경 없음.

## [1.2.1] - 2026-09-14

- 서브에이전트 `domain-skill-manager`·`domain-skill-reviewer` 모델을 `opus`로 상향(토큰 여유 반영).

## [1.2.0] - 2026-09-10

- Codex 카탈로그와 공통 스킬 배포 지원.
- Codex 실행 규약·에이전트 등록 또는 스킬 호출 경로 정리.

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
