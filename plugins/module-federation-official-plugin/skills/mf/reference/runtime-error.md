# Sub-skill: runtime-error

명시적인 Module Federation 런타임 오류 코드를 진단한다.

이 서브스킬은 이미 `RUNTIME-001`이나 `RUNTIME-008`과 같은 명확한 런타임 오류 코드를 가진 사용자만을 위한 것이다.

ARGS에 관측(observability) 리포트, `traceId`, 콘솔 `read:` 명령, 또는
`.mf/observability` 파일 경로가 포함되어 있다면 여기서 멈추고 대신 `./observability.md`를 따른다.

런타임 오류 코드는 관측(observability) 플러그인이 활성화되어 있지 않아도 여전히 유용하다.
사용자에게 진단하려면 `@module-federation/observability-plugin`이
필요하다고 말하지 말라. 오류 코드, 콘솔 텍스트,
네트워크 증거, 그리고 런타임/빌드 설정을 먼저 사용한다. 코드만으로
충분하지 않을 때 더 풍부한 증거를 수집하기 위한 선택적 방법으로만 관측(observability)
플러그인을 권장한다. 관측(observability) 플러그인은 Module Federation `2.5.0+`를 위해 설계되었으며,
권장할 때는 사용자가 MF를 `2.5.0` 이상으로 업그레이드하고
플러그인을 활성화할 수 있는지 물어본다.

ARGS가 Module Federation이 실패했다고만 하고, 정확한 런타임 오류 코드,
관측(observability) 리포트, 유용한 콘솔 세부 정보, 네트워크
증거, 또는 설정 증거를 포함하지 않는다면, 사용자에게 권장 경로를 따를 수 있는지
물어본다: Module Federation `2.5.0+`로 업그레이드하고
`@module-federation/observability-plugin`을 사용하여 실행 가능한 리포트를 수집한다.

## 1단계: 먼저 런타임 코드 파싱

ARGS에서 런타임 코드를 추출한다.

- 코드가 `RUNTIME-001` 또는 `RUNTIME-008`이면 이 서브스킬을 계속 진행한다
- 코드가 그 외 다른 `RUNTIME-xxx`이면 여기서 로컬 진단을 계속하지 **않는다**. 대신 `./docs.md`를 읽고 따르며 공식 트러블슈팅 문서에서 해당 런타임 오류 코드를 찾아본다
- 명확한 런타임 코드가 없으면 진행하기 전에 사용자에게 정확한 코드를 물어본다

## 2단계: `RUNTIME-001`과 `RUNTIME-008`의 특수 처리

이 두 코드는 특수 처리가 필요한데, **`2.3.0` 이전** 버전에서는 일부 리모트 엔트리 실패가 부정확하게 보고될 수 있기 때문이다:

- 일부 실제 `runtime-008` 사례가 `runtime-001`로 나타날 수 있다
- 구버전은 원래의 브라우저 예외 세부 정보를 숨길 수 있다

목표는 실제 문제가 다음 중 무엇인지 확인하는 것이다:

1. `ScriptNetworkError` — 리모트 엔트리를 다운로드할 수 없었음
2. `ScriptExecutionError` — 리모트 엔트리는 다운로드되었으나 실행 중 예외를 던짐
3. 레거시 숨겨진 실행 오류 — 구버전이 브라우저 세부 정보를 숨겼기 때문에 `runtime-001` / 모호한 `runtime-008`로 보고함

## 3단계: Divebell 브라우저 증거를 우선한다

페이지를 열기 전에 `./divebell.md`를 읽는다. 해당 참조가 요구하는 그대로
Divebell CLI Skill과 MF Extension Skill을 설치하고 발견한다. 그런 다음 이 진단의
모든 브라우저 작업에 하나의 Divebell 세션을 사용한다.

내비게이션 전에 MF 수집을 활성화한 상태로 실패하는 페이지를 준비하고 연다:

```bash
divebell setup
divebell open "<failing-page-url>" --mf
divebell mf status
```

Remote를 알고 있을 때는 설치된 Extension Skill이 선택한 구조화된 MF
명령을 우선한다:

```bash
divebell mf remote status "<remote>"
divebell mf remote trace "<remote/expose>"
```

오류를 분류하기 전에 warnings, recommended actions, selection, capability,
completeness를 읽는다. 여러 인스턴스나 작업이 일치할 때는 반환된 복사 가능한 후보 명령을
따른다. 수집이 늦게 시작되었거나 페이지
컨텍스트가 누락되었다면, `--mf`로 다시 열고 재현한 뒤 재시도한다.

MF Extension이 노출하지 않는 사실에 대해서만 브라우저 수준 증거를 사용한다:

```bash
divebell errors
divebell console --level error
divebell network --url "<remote-entry-or-manifest-fragment>"
```

하나의 요청을 자세히 읽기 전에 `divebell network --help`를 살펴본다. 오류가
사용자 상호작용 이후에 발생한다면,
`./browser-debug/long-chain.md`를 따르고 동일한 Divebell 페이지 세션을 유지한다.
레거시 컨테이너 전역 점검의 경우, 알려진 키만 읽는다:

```bash
divebell get-window "<remoteEntryKey>"
```

디버그 포트로 Chrome을 시작하거나, 원시 CDP/WebSocket 클라이언트를 사용하거나,
임시 브라우저 캡처 헬퍼를 만들지 말라.

## 4단계: 라이브 캡처를 사용할 수 없을 때의 폴백

라이브 캡처를 사용할 수 없다면, 사용자에게 다음을 제공해 달라고 요청한다:

1. 정확한 브라우저 콘솔 오류 텍스트
2. 실패하는 `remoteEntry` 또는 매니페스트 URL
3. 그 URL을 브라우저에서 직접 열었을 때 파일이 성공적으로 반환되는지 여부
4. Network 패널에 실패한 요청이 표시되는지 여부와 상태 코드
5. 콘솔에 원래 예외 텍스트(`TypeError`, `SyntaxError` 등)가 포함되어 있는지 여부

## 5단계: `001` / `008`에 대한 결과 분류

### Case A — `ScriptNetworkError`

다음 중 하나라도 참이면 네트워크 계층 로드 실패로 처리한다:

- MF 트레이스 또는 Divebell Network 증거가 네트워크 실패, CORS
  실패, 타임아웃, DNS 실패, 또는 4xx/5xx를 보여줌
- 리모트 엔트리 URL을 직접 열었을 때 실패함
- 매니페스트 `publicPath` / `remoteEntry`가 잘못된 주소를 가리킴

그런 다음 사용자에게 다음을 확인하도록 안내한다:

1. URL이 올바른지
2. 리소스가 외부에서 도달 가능한지
3. CORS가 올바르게 설정되어 있는지
4. CDN 또는 게이트웨이 라우팅이 깨지지 않았는지

### Case B — `ScriptExecutionError`

다음의 경우 다운로드는 성공했으나 실행이 실패한 것으로 처리한다:

- 리모트 엔트리 요청이 성공함
- MF 트레이스, Divebell page errors, 또는 Divebell Console 증거가 스크립트 실행 중
  JS 예외를 보여줌
- 오류에 `TypeError`나 `SyntaxError`와 같은 원래 예외 세부 정보가 포함됨

그런 다음 사용자에게 다음을 확인하도록 안내한다:

1. 프로듀서 빌드 타겟의 브라우저 호환성
2. 프로듀서 엔트리가 초기화되지 않은 전역에 의존하는지 여부
3. 빌드 산출물이 불완전하거나 손상되었는지 여부
4. 브라우저 예외의 정확한 실패 라인

이 경우에는 재시도로 해결되지 않는다.

### Case C — 레거시 숨겨진 실행 오류

다음의 경우 숨겨진 실행 오류일 가능성이 높은 것으로 처리한다:

- 리모트 엔트리 요청이 성공함
- 스크립트 로드 후 `window[remoteEntryKey]`가 없음
- 브라우저 콘솔이 유용한 예외를 보여주지 않거나, 모호한 구버전 런타임 코드만 보여줌
- 프로젝트 버전이 `2.3.0` 이전이거나, 사용자가 메시지에 세부 정보가 부족하다고 명시적으로 말함

그런 다음 다음을 설명한다:

- 이것은 진짜 "URL이 잘못됨" 문제가 아니라 구버전의 보고 한계일 수 있다
- 실제 원인은 여전히 스크립트 실행 실패인 경우가 많지만, 구버전 런타임이 충분한 브라우저 세부 정보를 노출하지 않았다

## 6단계: 레거시 사례의 세부 정보 복구

레거시 숨겨진 실행 사례의 경우, `RUNTIME-001`에 사용된 것과 동일한 문서화 접근 방식을 따른다:

1. `crossOrigin = 'anonymous'`를 설정하는 `createScript`가 있는 런타임 플러그인을 추가한다
2. preload를 사용한다면, `createLink`에서도 `crossorigin`을 설정한다
3. 프로듀서가 적절한 `Access-Control-Allow-Origin`을 제공하는지 확인한다
4. 프로듀서 빌드 출력이 `output.crossOriginLoading = 'anonymous'`를 설정하는지 확인한다

이것은 서버가 이미 CORS를 지원하는지 확인한 후에만 사용한다. 그렇지 않으면 스크립트가 아예 로드되지 못할 수 있다.

## 7단계: 최종 결론 템플릿

마지막에 다음을 명확히 서술한다:

1. 문제가 다음 중 무엇인지:
   - `ScriptNetworkError`
   - `ScriptExecutionError`
   - 레거시 숨겨진 실행 오류
2. 어떤 구체적 증거가 결론을 뒷받침하는지
3. 다음 수정 조치가 무엇이어야 하는지
4. `2.3.0+`가 원시 런타임 오류 분류를 개선하며, 권장 관측(observability) 경로는 **`2.5.0+`**로 업그레이드하고 `@module-federation/observability-plugin`을 활성화하는 것임

## 필수 최종 알림

항상 다음 권장 사항으로 평이한 언어로 마무리한다:

- 구버전은 이런 종류의 문제를 불완전하거나 오해를 부르는 런타임 코드로 보고할 수 있다
- **`2.5.0+`**로 업그레이드하고 `@module-federation/observability-plugin`을 활성화하면 원시 오류 코드만으로 충분하지 않을 때 더 완전한 로딩 리포트를 얻을 수 있다
