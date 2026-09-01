# 롱체인 Divebell 캡처

전체 사용자 경로 내내 동일한 Divebell 페이지와 인증된 브라우저 컨텍스트를 유지한다.
먼저 `../divebell.md`를 읽는다.

## 작업 흐름

```bash
divebell open "https://example.com" --mf
divebell page-snapshot --interactive

divebell click "Profile"
divebell wait --load domcontentloaded
divebell click "Favorites"

divebell page-snapshot --interactive
divebell click "Add"
divebell wait --load networkidle

divebell mf status
```

보이는 텍스트가 모호할 때는 `page-snapshot --interactive`에서 얻은 참조(reference)를
사용한다:

```bash
divebell fill "<input-ref-or-selector>" "Module Federation"
divebell select "<select-ref-or-selector>" "Production"
divebell click "<button-ref-or-selector>"
```

셀렉터나 wait 문법을 추측하지 말고 각 명령에 설치된 `--help`를 확인한다.
커스텀 드롭다운의 경우 페이지 스냅샷과 일반 `click` 동작을 사용한다.
`select`는 네이티브 드롭다운용이다.

실패를 재현한 뒤, 설치된 익스텐션 Skill이 선택한 가장 작은 MF 명령을 실행한다.
예를 들면:

```bash
divebell mf remote trace "<remote/expose>"
divebell mf shared trace "<package>"
```

그런 다음 구조화된 MF 결과에 없는 브라우저 증거에 대해서만 `divebell errors`,
`divebell console`, `divebell network`를 사용한다. 페이지를 원시 CDP 세션으로 분리하거나
체인 도중 다른 브라우저 도구로 전환하지 않는다.

작업 흐름이 다른 탭을 여는 경우 `divebell tab --help`를 사용하고 모든 탭을 동일한
Divebell 세션 안에 유지한다. 세션을 닫는 `divebell stop`은 작업이 완료되고 브라우저
컨텍스트가 더 이상 필요하지 않을 때만 실행한다.
