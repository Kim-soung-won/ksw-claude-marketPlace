# Changelog — frontend-support-plugin

## [1.7.1] - 2026-09-28

- Codex `interface.shortDescription`이 글자 수로 잘려 단어 중간에서 끊기던 것을 요약문으로 교체했다.

## [1.7.0] - 2026-09-22

- `domain-ui-tdd` 절차형 하네스 추가: 기능별 진단, 테스트 명세화, 개발자 검토, GREEN·리팩터링·재개 기록.
- 단위·통합 테스트의 verify/spec-first 모드와 특성화·유효 RED·환경 오류·회귀 구분 추가.
- 테스트 감사·출력 형식과 FSD 생성 범위를 단계에 맞게 정리하고 통합 테스트 진입점 연결.

## [1.6.0] - 2026-09-15

### 에이전트
- `integration-test-writer`(보강) — 워크플로에 **2단계 "렌더 경계 점검"** 신설(테스트 작성 직전,
  소프트 보고). jsdom이 못 그리는 leaf(canvas 차트·가상 스크롤·파일 DnD·포털 등)를 조용히
  축소하지 않고 폴리필→하니스 목 컨텍스트→leaf stub→정직한 축소→E2E 이관 사다리로 대응하거나
  축소 사유를 명시하도록 동작 원칙 추가.

### 리소스
- `integration-test-writer/rendering-boundaries.md`(신설) — 렌더 경계 대응 사다리와 전략별 카탈로그
  (ResizeObserver·IntersectionObserver·matchMedia·scrollIntoView·createObjectURL 폴리필,
  react-virtuoso `VirtuosoMockContext`, ECharts/미디어 leaf stub, getBoundingClientRect·portal·
  framer-motion·react-dropzone·SSE 함정). 폴리필·하니스는 프로젝트 인프라이고 이 리소스는 레시피만
  나른다는 경계 명시.

### 스킬
- `integration-test-authoring`(보강) — 원칙 1에 "네트워크 경계 vs 렌더 경계" 구분 문단 추가. 네트워크
  경계는 MSW로만(클라이언트 목 금지), 렌더 경계는 leaf 시각화만 stub하되 데이터 흐름은 실제 유지하고
  픽셀·위치는 E2E로. 구체 절차·카탈로그는 `rendering-boundaries.md`로 링크.

## [1.5.0] - 2026-09-14

### 에이전트
- `integration-test-writer` — 페이지/사용자 흐름 하나를 여러 모듈(컴포넌트+상태+로직+API 요청 코드)을
  실제로 연결한 채 vitest+RTL 통합 테스트로 작성·실행·통과 확인(요약만 반환). 네트워크 경계는 MSW로
  HTTP 레벨에서만 모킹하고, 단언은 사용자가 관찰하는 화면 변화(RTL 접근성 쿼리)에서 유도한다.
  여러 흐름 병렬 fan-out 워커로도 쓴다.

### 스킬
- `integration-test-authoring` — 통합 테스트 규약(단위 규약 `test-authoring`의 대칭짝). 내부 연결은
  실제로·경계만 MSW, 단언은 관찰 동작에서 유도, 작성 단위는 페이지/흐름. 프로젝트 `./.claude/skills/`의
  도메인 스킬(`*_api.md`/`*_scenario.md`/`*_domain.md`)을 MSW 응답·케이스·단언의 1순위 근거로 삼고,
  신뢰도 의심 시 `domain-skill-reviewer` 선행 게이트를 둔다.
- `msw-mocking` — Mock Service Worker **v2** API 레퍼런스(공식 docs 근거). `http` 핸들러·`HttpResponse`·
  `msw/node`의 `setupServer` 라이프사이클·`server.use` 2계층 오버라이드·`delay`를 정확한 v2 문법으로
  정리하고 v1(`rest`/`res(ctx)`) 문법을 명시 배제한다. `integration-test-writer`가 MSW 핸들러 작성 시 참조.
- `test-authoring`(보강) — 단위 테스트도 대응 도메인 스킬을 `./.claude/skills/`에서 능동 탐색해 단언
  근거로 삼도록 A절·워크플로에 탐색 절차를 명시(도메인 지식 참조 가이드라인).

### 실패·방어 경로 커버 가이드라인(스킬 보강)
- `integration-test-authoring` — 성공 응답만 박제하지 않도록 "최우선 원칙 4" 신설: MSW로 계약 위반
  응답(필드 누락·타입 불일치·`null`·빈 배열)을 세워 zod 검증 throw → ErrorBoundary → ErrorPage 전환을
  관찰 단언, null/undefined·부분 데이터 경계는 ErrorPage vs 빈 상태 중 무엇이 계약인지 도메인 스킬에서
  유도. examples에 계약 위반 → ErrorPage 오버라이드 스니펫 추가.
- `test-authoring` — nullish/무효 입력 방어를 필수 케이스로 규약화: `null`/`undefined`/빈 배열/누락 필드에
  throw인지 안전 처리인지 계약·스킬에서 유도해 단언, 검증 함수는 유효·무효 입력 둘 다(`parse` throw /
  `safeParse` `success:false`). examples에 nullish·zod 무효 입력 스니펫 추가.

### 리소스
- `integration-test-writer/dependency-preflight.md` — 통합 테스트 필수 의존성(`msw`·RTL·jsdom·공용
  test-utils 하니스) 부재 시 대응 절차. 깨진 테스트를 남기지 않고, 패키지 매니저별 설치 명령과 함께
  차단 보고한다.

## [1.4.1] - 2026-09-14

- 서브에이전트 `fsd-structure-architect` 모델을 `opus`로 상향(토큰 여유 반영).

## [1.4.0] - 2026-09-10

- Codex 카탈로그와 공통 스킬 배포 지원.
- Codex 실행 규약·에이전트 등록 또는 스킬 호출 경로 정리.

## [1.3.0] - 2026-09-10

- Codex 마켓플레이스와 공통 스킬 배포 매니페스트 추가.
- Codex 에이전트 3종의 등록 템플릿과 설치 스크립트 추가.
- 공통 리소스 상대 경로와 양쪽 도메인 스킬 탐색 지원.

형식: [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) · 버전: [SemVer](https://semver.org/lang/ko/)

이 플러그인의 `version` 은 사용자 측 `/plugin marketplace update` 가 갱신을 인식하는 유일한
키다. patch 는 커밋 시 pre-commit 훅이 자동으로 올리고, minor·major 는 직접 올린다 — 판단
기준과 기록 방법은 루트 [README](../../README.md#버전과-changelog) 참고.

## [1.2.8] - 2026-09-01

CHANGELOG·`version` 정합성 정리(1.2.7 자동 상승분 반영). 플러그인 동작 변경 없음.

## [1.2.6] - 2026-09-01

### 스킬
- `console-logging-policy` — `console.error`/`warn`/`log` 의 프로덕션 잔존 여부와 레벨 판정,
  에러 객체 축약(토큰·응답 본문 유출 방지) 규약. `rsbuild.config.ts` 의 `removeConsole` 설정도 다룬다.

## [1.2.5] - 2026-08-31

### 스킬
- `suspense-boundary-patterns` — Suspense/ErrorBoundary 배치와 재조회 UX(최초 로드 대 재조회 분리, 2레이어 필터/데이터 분리) 설계 규약

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
