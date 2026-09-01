# 관측(observability): 리포트 읽기

트레이스 ID, 브라우저 리더 표현식, 컬렉터 출력, Node/SSR 출력, 빌드 출력,
Chrome DevTools 내보내기, 또는 이미 열려 있는 라이브 MF 페이지가 있을 때 이
레퍼런스를 사용한다.

## 소스별 경로 선택

- 아직 리포트가 없는 라이브 페이지의 경우 `observability-page.md`를 사용한다.
- 제공된 리포트 JSON/파일 또는 Chrome DevTools 내보내기의 경우, 해당 아티팩트를
  직접 읽고 `observability-analyze.md`로 이어간다.
- 현재 라이브 페이지, 트레이스 ID, 또는 리더 표현식의 경우, 아래의 Divebell MF
  익스텐션 경로를 사용한다.
- 로컬 컬렉터, Node/SSR, 또는 빌드 파일의 경우, 아래의 해당 파일 기반 경로를
  사용한다. 이들은 브라우저 평가를 요구하지 않는다.

CDP/WebSocket 리더를 작성하거나, 디버그 Chrome을 실행하거나, Playwright,
Puppeteer, Cypress, Electron, 또는 다른 브라우저 도구로 전환하지 말 것.

## 라이브 페이지 및 트레이스 빠른 경로

`divebell.md`를 전부 읽고 설치된 CLI 및 MF 명령 Skill을 따른다. 페이지는
탐색 전에 MF 진단과 함께 열려 있어야 한다:

```bash
divebell open "<target-url>" --mf
divebell mf status
```

이전에 닫힌 페이지의 `traceId`는 사이트를 다시 열어도 재구성할 수 없다. 현재
인가된 페이지나 저장된 레코드가 그 트레이스를 여전히 노출하지 않는다면, 트레이스가
읽혔다고 주장하는 대신 업로드된 `onReport` 레코드나 내보낸 리포트를 요청한다.

필요한 로딩이 상호작용 후에만 발생한다면, Divebell을 통해 재현하고 동일한 페이지
세션을 유지한다. 그런 다음 설치된 것 중 가장 작은 MF 명령을 선택한다:

```bash
divebell mf remote status "<remote>"
divebell mf remote trace "<remote/expose>" --trace-id "<trace-id>"
divebell mf shared status "<package>"
divebell mf shared trace "<package>" --trace-id "<trace-id>"
divebell mf bridge trace "<remote>"
```

설치된 `divebell mf --help`가 지원하는 셀렉터와 옵션만 포함한다. 대상 유형을 알 수
없다면 `mf status`부터 시작하고, 추측하는 대신 반환된 후보 명령 중 하나를 따른다.

경고, 권장 조치, 선택, 능력, 완전성을 먼저 읽는다. 이력 이벤트가 누락되었다는
것이 해당 작업이 결코 일어나지 않았다는 증거는 아니다. 증거가 늦게 시작되었거나
페이지 컨텍스트가 누락되었다면, `--mf`로 다시 열고 재현한 뒤 결론을 내리기 전에
재시도한다.

## 리더 표현식

제공된 `getReport`, `getLatestReport`, `getReports`, 또는 `findReports` 의도를
포괄하는 경우 구조화된 MF 익스텐션 명령을 우선한다. 익스텐션은 경계가 있고
직렬화 가능한 증거를 반환하며 비공개 런타임 객체 노출을 피한다.

사용자가 설치된 MF 명령으로 표현할 수 없는 리더 표현식을 제공했다면, 그 인가된
표현식만 Divebell을 통해 실행한다:

```bash
divebell eval "<supplied-reader-expression>"
```

표현식을 정확히 보존하고 현재 셸에 맞게 안전하게 인용한다. 임시 리더 스크립트를
구성하거나, 임의의 스코프를 검사하거나, `window.__FEDERATION__` 객체 전체를
덤프하지 말 것. 반환된 JSON을 원시 리포트로 저장하고 `observability-analyze.md`로
이어간다.

브라우저 출력이 의도적으로 비활성화되어 있고 익스텐션이 요청된 레코드를 노출할 수
없다면, 애플리케이션의 `onReport` 업로드 페이로드, 명시적 내보내기, 또는 저장된
리포트를 요청한다. 콘솔의 `traceId` 하나만으로 전체 리포트를 추론하지 말 것.

## 로컬 컬렉터

애플리케이션이 명시적으로 `ObservabilityPlugin({ collector: true })`를
활성화하거나, `collector: { enabled: true, port }`를 구성하거나, 사용자가 반복
가능한 로컬 컬렉터 루프를 요청할 때만 이것을 사용한다.

페이지를 열거나 리로드하기 전에 기존의 비브라우저 컬렉터를 시작한다:

```bash
node skills/mf/scripts/observability-collector.js --port 17891
divebell open "<target-url>" --mf
```

구성된 포트를 사용한다. 다른 포트가 필요하다면, 애플리케이션 구성이 동일한 값을
사용해야 한다. Divebell을 통해 사용자 경로를 재현한 후 읽는다:

```text
.mf/observability/collector/latest-session.json
.mf/observability/collector/<sessionId>/latest-report.json
.mf/observability/collector/<sessionId>/latest.json
.mf/observability/collector/<sessionId>/events.jsonl
```

`latest-report.json`을 먼저 읽는다. 대기 중인 트레이스나 이벤트 순서에는
`latest.json` 또는 `events.jsonl`을 사용한다. 사용자가 계속 수집하기를 요청하지
않는 한 분석 후 컬렉터를 중지한다.

일치하는 애플리케이션 컬렉터 구성이 없는 페이지에 대해 이 컬렉터를 시작하지 말고,
컬렉터 페이로드가 없다는 것을 MF 정상성의 증거로 취급하지 말 것.

## Chrome DevTools 내보내기

사용자가 Module Federation Chrome 익스텐션의 Loading Trace 탭에서 내보낸 JSON을
제공한다면, 그 파일을 리포트 소스로 취급하고 `observability-analyze.md`로
경로를 지정한다. 사용자의 수동 Chrome 익스텐션 워크플로가 다른 브라우저 도구로
그 탭을 제어하는 것을 인가하지는 않는다.

## Node 또는 SSR

`.mf/observability/latest.json`을 먼저 읽는다. 여러 트레이스나 이벤트 순서가
필요할 때만 `.mf/observability/events.jsonl`을 사용한다.

`latest.json`은 형식화된 최신 완전 리포트다.
`events.jsonl`은 `traceId`로 키가 지정된 추가 전용 이벤트 스트림이다.

## 빌드

빌드 실패에는 `.mf/observability/build-report.json`을, 성공한 빌드 사실에는
`.mf/observability/build-info.json`을 읽는다.

## 분석 경계

증거를 얻은 후 `observability-analyze.md`로 이어간다. 현재 상태를 캡처된 이력과
분리해서 유지하고, MF 런타임 성공을 UI 렌더 또는 비즈니스 준비 상태와 분리해서
유지한다.
