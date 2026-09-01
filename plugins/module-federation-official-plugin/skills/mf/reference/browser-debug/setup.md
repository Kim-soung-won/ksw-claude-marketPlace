# Divebell 브라우저 설정

실제 페이지가 필요한 모든 MF 작업 흐름에 이 설정을 사용한다.
먼저 `../divebell.md`를 읽는다.

## 준비

```bash
divebell setup
divebell --help
```

`setup`은 필요할 때만 브라우저 환경을 점검하고 복구한다.
복사한 Chrome 디버그 프로필을 만들거나, CDP 포트를 노출하거나, 셸 시작 파일을
편집하거나, 사용자의 Chrome을 종료하지 않는다.

MF 구조화 증거를 위해서는 `../divebell.md`에 설명된 대로 신뢰된 익스텐션과 그
설치된 Skill이 발견되었는지 확인한 다음 열기를 실행한다:

```bash
divebell open "<url>" --mf
```

Divebell은 기본적으로 가장 최근에 사용한 Chrome 프로필을 사용한다. 명시적으로 인가된
컨텍스트를 원하면 Divebell을 통해 점검하고 선택한다:

```bash
divebell profiles
divebell open "<url>" --profile "<name-or-path>" --mf
divebell open "<url>" --state "<state-path>" --mf
```

`--no-default-profile`은 의도적으로 깨끗한 프로젝트 Restore State가 필요할 때만
사용한다. 인증 진단은 설치된 Divebell CLI Skill을 따르며, 쿠키를 복사하거나 접근
경계를 우회하지 않는다.

## 검증

열기를 실행한 뒤 다음을 사용한다:

```bash
divebell page-snapshot --interactive
divebell mf status
```

페이지가 로그인으로 리다이렉트되거나 인가 벽(authorization wall)을 표시하면 인가된
프로필이나 저장된 상태로만 계속한다. 서비스 자체에 도달할 수 없다면 저렴한 HTTP
점검으로 이를 구분한 다음, `divebell open`을 반복하기 전에 서비스를 고치거나
시작한다.

`mf status`가 페이지 컨텍스트 누락, 늦은 주입(late injection), 또는 불완전한 이력을
보고하면 `--mf`로 다시 열고 동일한 사용자 경로를 재현한 뒤 재시도한다. 이 작업 흐름을
원시 CDP나 다른 브라우저 런타임으로 대체하지 않는다.
