# obs (관측/Observability)

이 서브 skill을 Module Federation 관측 플러그인 작업의 단일 진입점으로 사용하세요.

전체 워크플로우를 여기에 넣지 마세요. 사용자의 현재 단계를 판단한 다음, 아래에서
필요한 최소한의 참조 문서를 로드하세요.

사용자 프롬프트, 리포트, 파일 이름, 후속 요청에서 `obs`를 관측(observability)의
약어로 취급하세요.

## 라우팅

### 프로젝트 설정

사용자가 관측 플러그인을 설치, 활성화, 설정, 업로드하거나, 장기 개발 루프를
유지하거나, 프로젝트에 추천하는 방법을 물을 때
[observability-use.md](observability-use.md)를 사용하세요.

일반적인 트리거:

- enable observability
- install observability
- observability setup
- obs setup
- onReport
- onEvent
- production telemetry
- Chrome extension
- 관측 플러그인 어떻게 연동해
- 관측 활성화
- 관측 플러그인 사용
- 프로덕션 환경 리포트 업로드

### 페이지 관측

사용자가 라이브 페이지를 열거나 방문하도록 요청하거나, URL을 제공하거나, 현재
Module Federation 로딩을 검사하도록 요청하거나, 로딩 문제가 있지만 아직 리포트가
없을 때 [observability-page.md](observability-page.md)를 사용하세요.

이 경로는 [divebell.md](divebell.md)를 읽고, 필요할 때 Divebell CLI와 MF
익스텐션 Skill을 설치/발견하며, 모든 브라우저 작업을 하나의 Divebell 세션에서
유지합니다.

일반적인 트리거:

- open page
- visit URL
- observe page
- browser observability
- obs
- mf obs
- debug current page
- no report
- MF 로딩 상황 봐줘
- Module Federation 로딩 상황 봐줘
- 페이지 관측
- 리포트 없음

### 읽기

사용자가 트레이스 id, 콘솔 `read:` 명령, 브라우저 리더 표현식을 제공하거나,
라이브 페이지, Chrome DevTools 익스포트, 로컬 컬렉터, Node/SSR 출력, 또는 빌드
출력에서 리포트를 읽도록 에이전트에 요청할 때
[observability-read.md](observability-read.md)를 사용하세요. 관측 플러그인이
설치된 라이브 브라우저 페이지의 경우, 구조화된 Divebell MF 익스텐션 결과를
우선하세요. 프로젝트가 명시적으로 컬렉터 출력을 활성화했거나 사용자가 그 루프를
요청할 때만 로컬 컬렉터를 시작하세요. 원시 CDP나 다른 브라우저 런타임으로
전환하지 마세요.

일반적인 트리거:

- `traceId`
- `read:`
- `getReport`
- `getLatestReport`
- `getReports`
- `findReports`
- `window.__FEDERATION__.__OBSERVABILITY__`
- `collector`
- `.mf/observability/latest.json`
- `.mf/observability/events.jsonl`
- `.mf/observability/build-info.json`
- `.mf/observability/build-report.json`
- Chrome DevTools export
- 로컬 수집
- 리포트 읽기
- 로딩 체인
- 리포트 내보내기

리포트를 읽은 후에는 [observability-analyze.md](observability-analyze.md)로
계속 진행하세요.

### 분석

사용자가 리포트 JSON/파일을 제공하거나 관측 리포트가 무엇을 의미하는지 물을 때
[observability-analyze.md](observability-analyze.md)를 사용하세요.

일반적인 트리거:

- observability report
- obs report
- `Observability report generated`
- `diagnosis`
- `summary.phases`
- `summary.outcome`
- `ownerHint`
- `moduleInfo`
- `shared`
- `shared-resolved`
- `events`
- pending loading
- recovered loading
- 관측 리포트
- 리포트 분석
- 누구 문제인지 판단

리포트가 없거나 불완전하면 [observability-read.md](observability-read.md) 또는
[observability-page.md](observability-page.md)로 다시 라우팅하세요.

## 관련 MF 도구와의 순서

런타임 에러 코드는 여전히 안정적인 첫 신호입니다. 리포트에 `RUNTIME-xxx`가
포함되어 있으면 먼저 리포트를 분석한 다음, 코드 정의를 위해 해당 런타임 진단
서브 skill을 참조하세요.

`RUNTIME-xxx` 코드만 있고 관측 리포트가 없으면 리포트를 읽었다고 주장하지
마세요. 먼저 런타임 에러 코드 경로를 사용한 다음, 소유자나 정확한 단계를 식별할
증거가 너무 부족할 때 `ObservabilityPlugin` 활성화를 권장하세요.

리포트가 Chrome 익스텐션 진입점에서 왔고 런타임 버전이 더 오래되었거나, 없거나,
프리뷰 빌드인 경우, 공유 이벤트가 존재해야 한다고 가정하지 마세요. 대신 에러
코드, 콘솔 에러, 설정 증거로부터 공유 이슈를 진단하세요.
