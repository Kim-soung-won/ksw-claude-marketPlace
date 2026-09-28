# Changelog — wiki-manager-plugin

## [2.1.0] - 2026-09-28

### 변경
- wiki-manager 업무 절차를 호스트 중립 원본 `resources/wiki-manager/procedure.md`로 옮겼다.
  Claude 에이전트 본문, Codex 에이전트, `wiki-knowledge`·`wiki-ingest` 스킬(에이전트 미사용 시)이
  모두 이 문서를 직접 읽는다. 에이전트 본문의 설계 배경은 절차의 「설계 메모」로 옮겼다.
- Codex 전용 규칙(`KB_VAULT_PATH` 우선, 설정 env 임의 추가 금지, 실제 쓰기 권한 범위 준수,
  대화 캡처는 메인 에이전트 추출 후 위임, 이미 받은 입력 재질문 금지)을 절차 본문에 합쳤다.
  vault 경로 우선순위를 스킬과 같은 "지정 경로 → `KB_VAULT_PATH` → 기본값"으로 통일했다
  (`project-classify.md` 포함).
- Codex 에이전트 템플릿(`codex/agents/wiki-manager.json`)은 Claude frontmatter에서 생성한다
  (`scripts/generate-codex-agents.js`). 설명·sandbox를 따로 손으로 쓰지 않는다.
- Codex가 Claude 정의를 번역해 읽을 필요가 없어져 `codex/runtime.md`를 삭제했다.

## [2.0.0] - 2026-09-28

### 변경 (호환성 깨짐)
- `commands/`(`/log`·`/ingest`·`/new-project`)를 삭제하고 절차 원본을 `wiki-log`·`wiki-ingest`·
  `wiki-new-project` 스킬로 통합했다. Claude Code에서는 `/wiki-log`·`/wiki-ingest`·`/wiki-new-project`로
  호출한다. Claude·Codex가 같은 SKILL.md 하나를 원본으로 읽는다.
- 명시적 호출 전용 제약을 두 호스트에 모두 적용한다. Claude는 `disable-model-invocation: true`,
  Codex는 스킬별 `agents/openai.yaml`의 `policy.allow_implicit_invocation: false`.
  기존 공유 스킬 래퍼는 이 제약이 없어 양쪽에서 모델이 자동 호출할 수 있었다.
- 스킬 본문의 `${CLAUDE_PLUGIN_ROOT}`·`AskUserQuestion` 전용 표기를 상대 경로·호스트 중립 표현으로 바꿨다.
- Codex `shortDescription`을 잘리지 않는 요약문으로 교체했다.

## [1.3.0] - 2026-09-10

- Codex 카탈로그와 공통 스킬 배포 지원.
- Codex 실행 규약·에이전트 등록 또는 스킬 호출 경로 정리.

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
