# 단일 Divebell 캡처

한 페이지를 열고 진단에 필요한 증거만 수집한다. 먼저 `../divebell.md`를 읽는다.

## 열기 및 점검

```bash
divebell setup
divebell open "https://example.com/dashboard" --mf --timeout 30000
divebell page-snapshot --interactive
divebell mf status
```

설치된 Skill이 지정한 가장 작은 MF 익스텐션 명령을 사용한다. 일반적인 선택지는
다음과 같다:

```bash
divebell mf remote status "<remote>"
divebell mf remote trace "<remote/expose>"
divebell mf shared status "<package>"
divebell mf shared trace "<package>"
```

구조화된 익스텐션 명령이 질문에 답할 수 있을 때는 비공개 MF 전역 객체를 덤프하지
않는다.

## 폴백 브라우저 증거

MF 결과가 불완전하거나 질문이 브라우저 수준 동작에 관한 것일 때만 Divebell 내장
명령을 사용한다:

```bash
divebell errors
divebell console --level error
divebell network --url "<remote-entry-or-manifest-fragment>"
divebell get-window "<specific-dotted-path>"
```

네트워크 항목 하나의 세부 정보를 요청하기 전에 `divebell network --help`를 점검한다.
`get-window`나 `eval`은 MF 익스텐션이 노출하지 않는 특정하고 한정된 값에 대해서만
사용한다. Remote, Shared, Bridge, 또는 trace 명령을 대체하려고 모든 비공개 런타임
객체를 직렬화하지 않는다.

`divebell screenshot`은 시각적 페이지 상태가 관련될 때만 사용한다. MF 런타임 성공이
소비 UI가 렌더링되었거나 비즈니스 준비가 되었음을 증명하지는 않으므로, 요청된 페이지
결과를 별도로 검증한다.
