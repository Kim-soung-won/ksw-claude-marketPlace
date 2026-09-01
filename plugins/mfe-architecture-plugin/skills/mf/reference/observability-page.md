# 관측(Observability): 페이지 관측

"이 URL을 열기/방문", "MF 로딩 상황 봐줘", 또는 아직 리포트가 없는 로딩 진단처럼
일회성 라이브 페이지 확인에 이 참조 문서를 사용하세요.

## 라우팅

- 사용자가 이미 리포트 JSON/파일 또는 Chrome DevTools 익스포트를 제공했으면
  `observability-analyze.md`로 라우팅하세요.
- 사용자가 `traceId`, 리더 표현식, 컬렉터 경로, Node 출력, 또는 빌드 출력을
  제공했으면 `observability-read.md`로 라우팅하세요.
- 그렇지 않으면 여기서 계속하세요. 애플리케이션 통합을 먼저 검사하거나 변경하지
  마세요. 일회성 확인은 프로젝트에 관측 플러그인을 추가할 필요가 없습니다.

## Divebell 준비

`divebell.md`를 전체 읽으세요. 그것은 CLI 설치, CLI Skill 발견, MF 익스텐션
설치, 명령 Skill 발견, 인증, 그리고 단일 브라우저 세션 규칙을 정의합니다.

그런 다음 페이지를 준비하고 여세요:

```bash
divebell setup
divebell open "<target-url>" --mf
```

사용자 경로가 요구할 때만 명시적으로 인증된 `--profile` 또는 `--state`를
사용하세요. 일회성 진단을 위해 디버그 Chrome을 실행하거나, CDP 포트를
노출하거나, 이 skill 자체 스크립트를 주입하거나, 애플리케이션에
`@module-federation/observability-plugin`을 추가하지 마세요.

MF 익스텐션은 내비게이션 전에 자체 경계가 지정된 진단을 설치합니다.
애플리케이션이 이미 호환 가능한 Observability 리더를 노출하면 익스텐션이 그
리더를 사용할 수 있습니다. 그렇지 않으면 자체 주입 수집 경로를 사용합니다.

## 현재 MF 상태 검사

다음으로 시작하세요:

```bash
divebell mf status
```

그런 다음 설치된 MF 익스텐션 Skill이 선택한 가장 작은 명령을 사용하세요:

- 해석된 리모트 메타데이터에는 `module-info [remote]`;
- 프로듀서 모듈 및 페이지 타이밍 증거에는 `module-perf [remote/expose]`;
- 간결한 현재 리모트 상태에는 `remote status <remote>`;
- 로드 또는 프리로드 체인에는 `remote trace [remote/expose]`;
- 공유 상태, 등록, 버전 선택, 로딩 이력에는 `shared status [package]` 또는
  `shared trace [package]`; 그리고
- Bridge 라이프사이클 증거에는 `bridge trace [remote]`.

사용자가 통합 성능 리포트나 사람이 읽을 수 있는 타임라인을 명시적으로 요청하지
않는 한 `--report`나 터미널 타임라인 뷰를 추가하지 마세요. 선택이 모호할 때는
익스텐션 출력의 복사 가능한 후보 명령을 따르세요.

결론을 내리기 전에 경고, 권장 조치, 선택, 능력, 완전성을 읽으세요. 명령이 늦은
주입, 페이지 컨텍스트 누락, 또는 불완전한 이전 이력을 보고하면 `--mf`로 다시
열고, 동일한 인증된 경로를 재현한 다음, 다시 시도하세요.

## 상호작용으로 트리거되는 로딩 재현

페이지를 Divebell 안에 유지하세요:

```bash
divebell page-snapshot --interactive
divebell click "<ref|selector|visible-text>"
divebell fill "<ref|selector>" "<value>"
divebell select "<ref|selector>" "<value>"
divebell wait --load networkidle
```

각 명령의 설치된 `--help`를 검사하고 보고된 사용자 경로에 필요한 액션만
사용하세요. 더 긴 워크플로우의 경우 `browser-debug/long-chain.md`를 따르세요.

액션 후에는 관련 MF status 또는 trace 명령을 다시 실행하세요. 하나의 리모트나
공유 이벤트를 전체 페이지가 준비되었다는 증거로 취급하지 마세요.

## 브라우저 폴백 및 검증

MF 익스텐션이 노출하지 않는 사실에 대해서만 다음을 사용하세요:

```bash
divebell errors
divebell console --level error
divebell network --url "<relevant-url-fragment>"
divebell page-snapshot
```

빈 `divebell stack` 탐지는 페이지가 MF가 아니라는 증거가 아닙니다. 설치된
탐지기가 일치하지 않았다는 의미일 뿐입니다. `data.failures`와 MF 명령 자체의
경고를 검사하세요.

MF 증거가 무엇을 증명하는지, 무엇이 여전히 알려지지 않았는지, 그리고 소비하는
UI가 요청된 페이지 결과에 도달했는지를 명시하며 마무리하세요. MF 런타임 로딩
성공만으로는 렌더 또는 비즈니스 준비 상태를 증명하지 않습니다.
