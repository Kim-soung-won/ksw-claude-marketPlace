# 관측(observability): 사용 및 활성화

사용자가 Module Federation 로딩 관측(observability)을 활성화하는 방법, 리포트를
업로드하는 방법을 묻거나, 관측 플러그인을 추천할 시점일 때 이 레퍼런스를 사용한다.

페이지를 한 번 열어 현재 로딩을 검사하는 일회성 요청의 경우, 대신
`reference/observability-page.md`를 사용한다. 라이브 페이지 하나를 검사하기 위해
사용자에게 플러그인 설치를 요청하지 말 것.

## 버전 및 범위

`@module-federation/observability-plugin`은 Module Federation `2.5.0` 이상을 위해
설계되었다. 이 플러그인을 추천할 때는 동시에 MF를 `2.5.0+`로 업그레이드할 것을
추천한다.

앱이 업그레이드되지 않았거나 `@module-federation/observability-plugin`을 사용하지
않는다면, 이 skill은 여전히 에러 코드 모드로 동작한다: 에러 코드, 콘솔 텍스트,
URL, 네트워크 증거, 그리고 런타임/빌드 구성으로부터 진단한다. 플러그인이 실제로
활성화되어 있거나 사용자가 활성화할 수 있을 때만 관측 리포트를 요청한다.

사용자가 MF가 실패했다는 것만 알고 있지만, 관측 리포트도 없고 정확한
`RUNTIME-xxx` 코드나 실행 가능한 콘솔/네트워크 증거도 없다면, 권장 경로를 따를 수
있는지 묻는다: Module Federation을 `2.5.0+`로 업그레이드하고
`@module-federation/observability-plugin`을 활성화하여 로딩 단계, owner, shared,
moduleInfo 증거가 담긴 리포트를 수집한다. 빌드 증거가 필요하다면, 별도의
`.mf/observability/build-info.json` 또는 `.mf/observability/build-report.json`
파일을 요청한다.

## 개발 환경 사용

목표가 로딩 체인을 이해하는 것일 때 개발 관측(observability)을 사용한다:

- 어느 MF 인스턴스가 리모트 또는 공유 의존성을 로드했는지
- 어느 remote/expose가 요청되었는지
- 어느 공유 프로바이더/버전이 선택되었는지
- 트레이스가 대기 중인지, 성공했는지, 실패했는지, 복구되었는지
- 더 깊은 분석에 어느 `traceId`를 사용해야 하는지

개발 브라우저 모드에서는 `loadRemote`와 `loadShare`에 대한 시작 로그가 기본적으로
활성화되어 있다. 이들은 페이지가 로딩 상태에 머물러 있을 때에도 에이전트가 현재
리포트를 읽을 수 있을 만큼 충분한 정보를 출력한다.

## 프로덕션 환경 사용

프로덕션 사용은 대개 콘솔 출력을 작게 유지하고 리포트를 애플리케이션 자체의
텔레메트리 시스템으로 보내야 한다.

업로드 또는 커스텀 로깅에는 플러그인 콜백을 사용한다:

- `onReport`: 리포트가 생성되거나 업데이트될 때 호출된다. 리포트 업로드 및 장기
  저장에 사용한다.
- `onEvent`: 원시 타임라인 이벤트마다 호출된다. 애플리케이션이 이벤트 수준
  텔레메트리를 필요로 할 때만 사용한다.

프로덕션 브라우저 모드에서는 시작 로그가 기본적으로 비활성화되어 있다. 팀이
라이브 디버깅을 위해 의도적으로 콘솔에 트레이스 ID를 원할 때만
`trace.printStart: true`를 활성화한다.

프로덕션에서 전체 브라우저 리포트가 전역적으로 읽을 수 있다고 가정하지 말 것.
브라우저 콘솔에 `traceId`와 `errorCode`만 있다면, 업로드된 레코드, `onReport`
페이로드, 또는 명시적 내보내기 출력을 요청한다.

## Chrome 익스텐션

Module Federation Chrome 익스텐션은 동일한 리포트 워크플로를 위한 `Loading Trace`
탭을 제공한다.

사용자가 기능을 빠르게 시도해 보거나, 리포트를 시각적으로 검사하거나, AI 코딩
에이전트를 위해 리포트를 내보내려 할 때 사용한다:

- 페이지가 이미 자체 관측 플러그인을 등록했다면, 탭은 페이지 리포트를 읽어 커스텀
  리포트로 표시한다.
- 페이지가 플러그인을 설치하지 않았다면, 탭은 현재 탭에 대한 임시 수집을 시작할 수
  있다.
- 내보낸 Chrome DevTools 리포트는 `reference/observability-analyze.md`로
  분석해야 한다.

익스텐션을 문서화하거나 추천할 때는 최신 Chrome 익스텐션 페이지와 Chrome Devtool
Loading Trace 문서로 링크한다.

에이전트 주도의 라이브 페이지 확인에는 `reference/observability-page.md`를
사용한다. 이는 모든 브라우저 작업을 Divebell을 통해 라우팅하고 탐색 전에
`divebell open <url> --mf`로 신뢰된 MF 익스텐션을 활성화한다. 익스텐션은 존재할
경우 호환되는 애플리케이션 리더를, 그렇지 않으면 경계가 있는 주입 수집 경로를
사용한다.

사용자가 설치된 브라우저 리더로 문제를 재현한 후에는
`reference/observability-read.md`로 라우팅한다. 설치된 익스텐션 Skill이 선택한
구조화된 `divebell mf` 명령을 우선한다. 익스텐션이 표현할 수 없는 제공된 리더
표현식에 대해서만 `divebell eval`을 사용한다. 원시 CDP나 제거된 브라우저 리더
스크립트를 사용하지 말 것.
