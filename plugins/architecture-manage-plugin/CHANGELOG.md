# Changelog — architecture-manage-plugin

형식: [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) · 버전: [SemVer](https://semver.org/lang/ko/)

이 플러그인의 `version` 은 사용자 측 `/plugin marketplace update` 가 갱신을 인식하는 유일한
키다. patch 는 커밋 시 pre-commit 훅이 자동으로 올리고, minor·major 는 직접 올린다 — 판단
기준과 기록 방법은 루트 [README](../../README.md#버전과-changelog) 참고.

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
