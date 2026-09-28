# Changelog — architecture-manage-plugin

## [0.6.0] - 2026-09-28

### 변경
- c4-schema-reader 업무 절차를 호스트 중립 원본 `resources/c4-schema-reader/procedure.md`로 옮겼다.
  Claude 에이전트 본문과 Codex 에이전트가 모두 이 문서를 직접 읽는다.
- Codex 에이전트 템플릿(`codex/agents/c4-schema-reader.json`)은 Claude frontmatter에서 생성한다
  (`scripts/generate-codex-agents.js`). 설명·sandbox를 따로 손으로 쓰지 않는다.
- 스킬의 스키마 경로 규칙(`.claude/schema`)과 Codex용 `codex/runtime.md`는 그대로 유지한다.

## [0.5.2] - 2026-09-28

- Codex `interface.shortDescription`이 글자 수로 잘려 단어 중간에서 끊기던 것을 요약문으로 교체했다.
- `c4-modeling` 스킬의 질문 규칙을 호스트 중립 표현(호스트의 질문 도구)으로 바꿨다.

## [0.5.1] - 2026-09-14

### 변경
- 세 진입점(c4-modeling·syncing-c4-model·c4-schema-reader)의 description 트리거를
  `C4`·`JSON` 전문용어 밖으로 넓혔다 — `아키텍처 다이어그램`·`시스템 구조도`·
  `서비스 구성도`(+`서비스 연결도`) 자연어 동의어를 세 곳 모두에 심고, 의도를 가르는
  동사(생성=만들다/그리다, 갱신=동기화/반영, 읽기=파악/설명)를 각자 긍정 트리거로 보강했다.

## [0.5.0] - 2026-09-14

### 변경
- 스킬·검증기의 리소스 경로 표기를 `<플러그인 루트>/schema/` → `.claude/schema/`로
  통일하고, `validate.mjs` 사용법·에러 메시지도 같은 경로로 맞췄다.
- `c4-modeling` — 입력 형식을 `argument-hint` frontmatter로 옮기고, 선택지형 질문을
  `AskUserQuestion`으로 묻도록 명시했다.
- `syncing-c4-model` — `allowed-tools`에 `Bash(python3 -m json.tool *)`를 추가하고,
  형제 스킬·에이전트 참조를 `.claude/` 경로로 정리했다.

### 제거
- `c4-briefing` 스킬 — 브리핑 역할을 `c4-schema-reader` 에이전트 직접 호출로 대체하고
  래퍼 스킬을 제거했다.

## [0.4.0] - 2026-09-10

- Codex 카탈로그와 공통 스킬 배포 지원.
- Codex 실행 규약·에이전트 등록 또는 스킬 호출 경로 정리.

형식: [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) · 버전: [SemVer](https://semver.org/lang/ko/)

이 플러그인의 `version` 은 사용자 측 `/plugin marketplace update` 가 갱신을 인식하는 유일한
키다. patch 는 커밋 시 pre-commit 훅이 자동으로 올리고, minor·major 는 직접 올린다 — 판단
기준과 기록 방법은 루트 [README](../../README.md#버전과-changelog) 참고.

## [0.3.0] - 2026-09-10

구조 개편 — 소스코드 전용 생성 에이전트와 문답 전용 스킬을 하나의 대화형 모델링
스킬로 통합하고, 스키마 권위 소스를 번들 JSON Schema + 검증기로 옮겼다.

### 추가
- `c4-modeling` 스킬 — 메인 세션 안에서 대화로 C4 JSON을 만들어 완성한다. 개발자뿐
  아니라 기획자·디자이너·고객 등 페르소나별 입력 언어를 C4 개념으로 번역하며, 지정한
  자료(코드·기획서·API 스펙·인프라 설정)를 세션에서 직접 읽어 초안을 만들고 대화로
  채운다. 매 턴 `designIntent`(결정·이유·용어·미결·범위밖)를 1급 자산으로 함께 기록한다.
- `schema/c4-model.schema.json` + `schema/validate.mjs` — 앱 코드(`c4ModelFile.ts`)에서
  생성된 JSON Schema를 스키마의 **단일 진실 소스**로 번들하고, id 고유성·계층 참조·
  connection 동일 레벨·deployment 3계층 부모·`designIntent.why` 강제까지 기계 검증한다.
- `syncing-c4-model/reference.md` — 동기화 스킬 전용 스키마 참조.

### 변경
- `syncing-c4-model` — 검증을 눈으로 하지 않고 번들 `validate.mjs`로 기계 검증하도록
  절차를 고쳤다. 전체 재생성·신규 생성은 `c4-modeling` 스킬에 위임한다.

### 제거
- `c4-schema-generator` 에이전트 — 소스코드 분석 생성 역할을 `c4-modeling` 스킬의
  "자료 읽기" 단계로 흡수했다.
- `/c4-interview` 스킬 — 문답식 모델링을 `c4-modeling` 스킬로 통합했다.
- `resources/c4-model/schema-spec.md` — 스펙 권위 소스를 `schema/`(생성된 JSON Schema)로
  옮기고, 사람용 요약은 `skills/c4-modeling/reference/schema-spec.md`로 이관했다.

## [0.2.1] - 2026-09-04

### 변경
- `c4-schema-generator` — 분석 근거를 애플리케이션 소스코드로 단정하지 않도록 확장.
  IaC(Terraform 등)·docker-compose·Helm 차트·k8s 매니페스트만 있는 저장소도 대상으로
  판별하며, 유형별 근거 수집 규칙(compose services, Terraform resource → 관리형 서비스
  매핑, Chart dependencies·probe → healthCheck 등)을 추가했다. 배포 정의만으로 내부
  구현을 알 수 없는 앱 컨테이너는 technology를 추측하지 않고 분석 한계로 보고한다.

## [0.2.0] - 2026-09-04

### 에이전트
- `c4-schema-generator` — 소스코드 프로젝트를 구조 파일 위주로 분석해 C4 Modelizer
  schemaVersion 2 flat JSON을 생성한다. 노드별 technology 카탈로그 id·healthCheck 후보
  추출, 레이어드 흐름 position 배치를 포함한다.
- `c4-schema-reader` — 기존 C4 모델 JSON을 읽고 스키마 검증·참조 무결성 확인 후,
  상위 에이전트가 후속 작업 컨텍스트로 바로 쓸 수 있는 아키텍처 브리핑을 반환한다 (읽기 전용).

### 스킬
- `/c4-interview` — 개발자와 다중 턴 질의응답으로 C4 JSON을 점진적으로 채우는 인터뷰
  모델링. 매 턴 저장·커버리지 표·다음 질문 루프.
- `syncing-c4-model` — 코드 수정 중 아키텍처 영향 변경(노드·외부 의존성·통신·기술 스택·
  컴포넌트 변화)이 생기면 같은 턴에 C4 JSON을 증분 동기화한다.

### 리소스
- `resources/c4-model/schema-spec.md` — schemaVersion 2 flat 스키마·technology 카탈로그·
  position 배치·healthCheck·검증 체크리스트의 **단일 소스 스펙**. 에이전트·스킬 본문에
  중복 기술하던 스펙(구 syncing-c4-model/reference.md 포함)을 이 파일로 통합했다.

## [0.1.0] - 2026-09-04

플러그인 신설 — 매니페스트(`plugin.json`)와 마켓플레이스 등록만 포함한 빈 골격.
