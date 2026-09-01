# Divebell 브라우저 및 MF 익스텐션

MF 워크플로가 실제 브라우저 페이지를 열거나, 검사하거나, 조작하기 전에 이
레퍼런스를 읽는다.

Divebell은 에이전트 머신에 설치되어 있다. 진단 대상 애플리케이션에
`@divebell/cli`나 `@divebell/extension-mf`를 추가하지 말 것.

## CLI Skill 설치 및 탐색

가능하면 기존의 전역 `divebell` 명령을 사용한다. 그렇지 않으면 전역으로
설치한다:

```bash
npm install --global @divebell/cli
```

그런 다음 설치된 CLI를 검사하고 번들된 Skill을 읽는다:

```bash
divebell --help
divebell skill
```

`divebell skill`은 설치된 Divebell `SKILL.md`의 절대 경로를 출력한다. 첫 브라우저
작업 전에 그 파일을 전부 읽고 인증, 세션, 명령 탐색, 증거 규칙을 따른다. 출력된
경로가 없거나 읽을 수 없다면, 동일한 전역 설치 명령으로 배포된 CLI를
재설치/업데이트하고, `divebell skill`을 다시 실행하며, 워크플로를 기억으로부터
추측하지 말 것.

설치된 `--help` 출력을 명령의 신뢰할 수 있는 원천으로 취급한다:

```bash
divebell setup
divebell <command> --help
```

## MF 익스텐션 Skill 설치 및 탐색

MF 명령이 이미 설치되어 있는지 확인한다:

```bash
divebell mf --help
```

CLI가 알 수 없는 `mf` 명령을 보고하면, 신뢰된 MF 익스텐션을 설치한다:

```bash
divebell extensions add @divebell/extension-mf
```

다른 패키지 이름을 추론하지 말 것. 설치 후, 실제 명령과 그 명령별 Skill을
탐색한다:

```bash
divebell --help
divebell mf --help
divebell mf --skill
```

`divebell mf --skill`은 설치된 익스텐션 Skill 경로를 출력한다. MF 하위 명령을
실행하기 전에 그 `SKILL.md`를 전부 읽는다. 이 저장소가 기억하는 릴리스가 아니라
설치된 명령 Skill이 명령 선택, 결과 필드, 모호성 처리, 호환성 경고를 관장한다.

커스텀 배포판이 다른 명령 이름을 노출한다면, `divebell --help` 또는
`divebell stack`이 표시하는 이름을 사용한 뒤 `divebell <command> --skill`을
실행한다. 나머지 작업 동안 그 명령 이름을 유지한다.

## 페이지 열기

MF 구조화된 증거가 필요한 모든 페이지를 익스텐션의 open 훅을 활성화한 채로 연다:

```bash
divebell open "<url>" --mf
```

`divebell open`의 단독 `--mf`는 탐색 전에 진단을 활성화한다. 이는 일부
`divebell mf` 하위 명령의 `--mf <name>`과 다르며, 후자는 페이지가 열린 후 보이는
MF 인스턴스 하나만 선택한다.

기본적으로 Divebell은 현재 OS 사용자의 가장 최근에 사용된 Chrome 프로파일을
재사용한다. 작업에 특정한 준비된 계정이나 환경이 필요할 때만 `divebell profiles`,
`open --profile`, 또는 `open --state`를 사용한다. 깨끗한 프로젝트 Restore State가
의도된 경우에만 `--no-default-profile`을 사용한다. Chrome 프로파일을 복사하거나,
`--remote-debugging-port`로 Chrome을 실행하거나, 사용자의 Chrome을 종료하거나,
인가를 우회하지 말 것.

MF 명령이 늦은 주입, 누락된 페이지 컨텍스트, 또는 불완전한 이전 이력을
보고한다면, 페이지를 `--mf`로 다시 열고, 동일한 인가된 사용자 경로를 재현하며,
가장 관련성 높은 가장 작은 명령을 다시 실행한다.

## 브라우저 조작 규칙

Divebell을 선택한 후, 모든 브라우저 동작과 브라우저에서 파생된 사실을 동일한
Divebell 세션 내에서 유지한다:

- 페이지 상호작용에는 `page-snapshot`, `click`, `fill`, `select`, `press`,
  `wait`를 사용한다;
- MF 상태, Remote, Shared, Bridge, 트레이스, 모듈 성능 증거에는 설치된 MF
  익스텐션 명령을 사용한다;
- MF 익스텐션이 노출하지 않는 증거에만 `console`, `errors`, `network`, `eval`,
  `get-window`, `screenshot`를 사용한다; 그리고
- 최종 페이지 결과를 MF 런타임 로딩 성공과 분리하여 검증한다.

Divebell을 원시 CDP/WebSocket 클라이언트, Playwright, Puppeteer, Cypress,
Electron 테스트 브라우저, 다른 브라우저 제어 skill, 또는 임시 브라우저
스크립트와 섞지 말 것. 페이지를 검사하기 위해서만 Runtime SDK 통합을 추가하지
말 것.
