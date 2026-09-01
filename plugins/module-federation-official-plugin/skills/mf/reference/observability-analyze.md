# 관측(Observability): 리포트 분석

관측 리포트, Chrome DevTools 익스포트, 브라우저 리더 출력, Node 리포트 파일, 또는
빌드 관측 파일을 확보한 후에 이 참조 문서를 사용하세요.

## 필드를 순서대로 읽기

`events`부터 시작하지 마세요.

리포트는 `undefined` 필드를 생략합니다. 특정 실패 가이드가 그 필드가 반드시
존재해야 한다고 명시하지 않는 한, 없는 선택적 필드는 "관측되지 않았거나 관련
없음"으로 취급하세요.

읽는 순서:

1. `diagnosis.status`
2. `diagnosis.title`
3. `diagnosis.ownerHint`
4. `diagnosis.errorCode`
5. `diagnosis.facts`
6. `diagnosis.actions`
7. `summary.outcome`
8. `summary.error`
9. `summary.phases`
10. `summary.flags`
11. `summary.shared`
12. `build`
13. `moduleInfo`
14. `events`

## 로딩 성공 판단

원시 `events`를 읽기 전에 `summary.outcome`을 사용하세요:

- `runtime-loaded`: 리모트 모듈이 Module Federation 런타임에 의해 로드되었습니다.
- `component-loaded`: 컴포넌트 수준의 성공 신호가 관측되었습니다. 이는 비즈니스
  `markComponentLoaded` 신호이거나, 프로듀서가 주입된 `onMFRemoteLoaded`
  콜백을 호출한 것일 수 있습니다.
- `shared-resolved`: 공유 의존성이 성공적으로 해석되었습니다. `shared.name`,
  `shared.provider`, `shared.requiredVersion`, `shared.selectedVersion`,
  `shared.availableVersions`를 읽어 어떤 프로바이더와 버전이 선택되었는지
  설명하세요.
- `failed`: 로딩이 실패했습니다. `summary.error`, `diagnosis.actions`,
  `failedPhase`를 사용하세요.
- `recovered`: 로딩이 먼저 실패한 다음, 런타임 폴백 또는 복구 경로가 결과를
  반환했습니다.

공유 로딩의 경우, `summary.outcome: "recovered"`는 런타임이 커스텀 shared-info
누락을 처리했다는 의미일 수도 있습니다. `summary.phases.shared.status`가
`"complete"`이고 `shared.reason`이 `"custom-share-info-unmatched"`이면 Module
Federation 로딩이 실패했다고 말하지 마세요. 빌드 플러그인이 `customShareInfo`를
공급했지만 등록된 공유 프로바이더가 일치하지 않아서 런타임이 처리된 경로를 통해
계속 진행했다고 말하세요. 사용자가 특정 프로바이더/버전이 선택되기를 기대했을
때만 공유 설정을 검사하도록 요청하세요.

관측 플러그인은 `@module-federation/retry-plugin` 자체가 성공했는지 판단할 수
없습니다. 그것은 retry-plugin의 내부 상태가 아니라 Module Federation 로딩 체인과
최종 리소스 결과를 기록합니다. URL 변경, retry-plugin 콘솔 라인, 또는 페이지가
결국 렌더링되는 것만으로 재시도 성공을 추론하지 마세요. 사용자가 재시도
성공/실패 판단이 필요하면 `onRetry`, `onSuccess`, `onError` 같은 retry-plugin
훅에 자체 증거를 추가한 다음 그 출력을 읽도록 요청하세요. 그러한 훅 기록이나
사용자가 제공한 재시도 이벤트가 없으면 리모트가 결국 로드되었다고만 말하세요.

`summary.loadCompleted`는 "loadRemote 플로우가 끝났다"라는 의미로만 사용하세요.
그것 자체가 성공을 증명하지 않습니다. 리모트 모듈 성공에는
`summary.runtimeLoaded`를, 컴포넌트 수준 성공에는 `summary.componentLoaded`를
사용하세요.

`summary.componentLoaded: false`는 그 자체로 React 컴포넌트가 렌더링에
실패했다는 증거가 아닙니다. 컴포넌트 수준의 준비 신호가 관측되지 않았다는
의미일 뿐입니다. `react.injectLoadedCallback: true`가 활성화되어 있지만
`componentLoaded`가 false이면:

1. 먼저 프로듀서 소스가 있다면 검사하고, 컴포넌트가
   `props.onMFRemoteLoaded?.(...)`를 받아 호출하는지 확인하세요
2. 프로듀서 소스가 있고 콜백이 호출되지 않으면, 리모트 리소스는 로드되었지만
   프로듀서가 콜백을 추가하기 전까지 컴포넌트 준비 상태는 알 수 없다고
   설명하세요
3. 프로듀서 소스가 없으면 사용자에게 프로듀서가 `onMFRemoteLoaded`를 호출하는지
   물어보세요. 플래그가 false라는 이유만으로 컴포넌트가 실패했다고 주장하지
   마세요
4. React 에러, 에러 바운더리 상태, 예상 UI 누락, 또는 프로듀서/런타임 에러
   이벤트 같은 추가 증거가 있을 때만 컴포넌트가 실패했다고 결론 내리세요

`events`가 필요한 경우, 리모트 모듈 성공은 보통 다음과 같습니다:

- `phase: "loadRemote"`
- `status: "success"`
- `lifecycle: "onLoad"`
- `message: "remote:loaded"`

React 콜백 주입은 옵트인입니다. 래퍼 컴포넌트를 반환하여 리모트 React
컴포넌트에 `onMFRemoteLoaded` prop을 주입할 수 있습니다. 프로듀서가 그 prop을
호출하면, 결과로 나오는 `component:business-loaded` 이벤트를 프로듀서 자체의
준비 신호로 취급하세요. 이 플러그인으로부터 React 마운트 성공을 추론하지 마세요.
그것은 더 이상 React 렌더 라이프사이클 이벤트를 관측하지 않습니다. 콜백 주입은
컴포넌트 참조를 변경하므로, 이를 임시 프로덕션 디버깅 스위치로 취급하고 문제가
해결된 후 제거하도록 사용자에게 요청하세요.

## 공유 증거의 한계

공유 의존성 분석을 기본 경로로 만들지 마세요. 사용자가 공유 의존성에 대해 묻지
않았고 리포트가 공유 로딩을 가리키지 않으면, 공유 필드가 없다는 이유만으로
리더를 다시 실행하지 마세요.

공유 의존성 증거는 페이지가 Module Federation `>= 2.5.0`을 사용하고 활성 런타임
경로가 공유 관측 이벤트를 방출할 때만 기대할 수 있습니다. 버전을 알 수 없거나
`2.5.0` 미만이면, 이 리포트에서 공유 의존성 세부 정보를 얻을 수 없었다고
말하세요. 그것을 실패한 읽기로 취급하지 말고, 공유 의존성이 확실히 괜찮다고
주장하지 마세요.

## 유력한 소유자 판단

먼저 `diagnosis.ownerHint`를 사용하세요:

- `host`: 호스트 리모트, 요청 id, 매니페스트 URL, 런타임 호출을 검사하세요.
- `remote`: 프로듀서 exposes, remoteEntry 타입/글로벌, 노출된 모듈 실행을
  검사하세요.
- `shared`: 호스트와 리모트 공유 설정, 선택된 프로바이더, 버전, shareScope,
  singleton, strictVersion, eager를 검사하세요.
- `network`: URL 도달 가능성, CORS, 상태 코드, 응답 본문, 타임아웃, CDN,
  게이트웨이, 또는 프록시를 검사하세요.
- `build`: build-report, 번들러 출력, 관측 출력 경로를 검사하세요.
- `unknown`: `summary.phases`를 사용해 처음으로 누락/에러가 발생한 단계를 찾은
  다음, `events`를 검사하세요.

## 진단 액션 따르기

`diagnosis.actions`를 우선순위가 매겨진 체크리스트로 취급하세요. 각 액션에 대해:

1. 참조된 설정 또는 런타임 사실을 검사하세요
2. `diagnosis.facts`와 비교하세요
3. 빌드 증거가 필요할 때 `.mf/observability/build-info.json`과 비교하세요
4. 가장 작은 코드/설정 수정을 하세요
5. 실패하는 앱 또는 표적 테스트로 검증하세요

## 빌드 증거를 올바르게 사용하기

런타임 리포트에는 `summary.build`가 없습니다.

런타임 리포트는 빌드 사실도 포함하지 않습니다. 빌드 증거가 필요하면
`.mf/observability/build-info.json` 또는
`.mf/observability/build-report.json`을 별도 파일로 읽고 런타임 리포트와
비교하세요.

`moduleInfo`는 스냅샷/moduleInfo 의존 실패에만 나타납니다. 그것은
`__FEDERATION__.moduleInfo`의 잘린 뷰이며 전체 덤프가 아닙니다. 다음만
사용하세요:

- `entries[].name`
- `entries[].publicPath`
- `entries[].getPublicPath`
- `entries[].remoteEntry`
- `entries[].globalName`
- `totalCount`
- `matchedCount`
- `availableNames`

`modules`, `shared`, assets 같은 큰 필드는 의도적으로 제거됩니다. `publicPath`,
`getPublicPath`, `remoteEntry` 로케이터 필드는 쿼리/해시 데이터를 보존하며, 배포
플랫폼이 종종 그 값을 사용해 모듈을 라우팅하기 때문에 길이만 제한됩니다.

`moduleInfo.availableNames`를 컴포넌트 목록, expose 목록, 또는 프리페치 목록으로
설명하지 마세요. 그것은 실패한 리모트에 일치하는 엔트리가 없을 때 사용 가능했던,
배포가 제공한 moduleInfo 리모트 후보 키의 잘린 목록입니다.

## 런타임 에러 코드를 참조로 사용하기

런타임 에러 코드는 안정적인 진입점이지만, 이 관측 skill은 전체 `RUNTIME-xxx`
트러블슈팅 매뉴얼 역할을 해서는 안 됩니다.

리포트에 `diagnosis.errorCode`, `summary.error.errorCode`, 또는 콘솔
`RUNTIME-xxx` 코드가 포함되어 있을 때:

1. 코드를 사용해 관련 런타임 트러블슈팅 문서를 선택하세요
2. 이 리포트를 사용해 실제 단계, 소유자, 요청, 리모트, 공유, `moduleInfo`,
   타이밍 증거를 확인하세요
3. 리포트 필드가 코드와 모순되면 코드만으로 수정하지 마세요
4. 관측 리포트가 없으면 리포트, 트레이스 id, 브라우저 리더 출력, Node 리포트
   파일, 또는 충분한 콘솔/네트워크 증거를 요청하세요

설명을 리포트 증거에 집중시키세요. 코드별 정의와 수정에 대해서는 그 내용을
여기서 중복하지 말고 런타임 트러블슈팅 문서를 참조하세요.

## 최종 응답 형태

보고할 때는 구체적으로 유지하세요:

1. 어떤 리포트 소스가 사용되었는지
2. 유력한 소유자
3. 핵심 증거
4. 무엇이 변경되었거나 무엇을 변경해야 하는지
5. 어떻게 검증되었는지

리포트가 없으면 불완전한 콘솔 텍스트로부터 추측하지 말고
`reference/observability-page.md` 또는 `reference/observability-read.md`로 다시
라우팅하세요.
