# 브라우저 점검 리소스

실행 중인 화면을 임시 Chrome 으로 열어 점검할 때 읽는 문서 묶음이다. 필요한 문서만 골라 읽는다.

## 성격

정해진 점검 순서는 없다. 지켜야 할 것은 스킬 본문의 "지켜야 할 것" 다섯 가지뿐이고, 나머지는 점검하는 쪽이 판단한다.
아래 문서는 그 판단에 쓰는 참고 자료다. 문서에 "~한다"로 적힌 것은 지금까지의 경험에서 나온 기본값이며,
상황에 맞지 않으면 따르지 않고 이유를 보고서에 적는다.

## 문서 고르기

| 상황 | 읽을 문서 |
|------|-----------|
| 무엇을 볼지 정한다, 계획을 바꾼다, 막혔다 | [judgment.md](judgment.md) |
| 점검을 시작한다(Chrome 실행, 접속, 로그인, 빌드 로드 확인) | [setup.md](setup.md) |
| 어떤 측정 방법이 있는지 본다 | [measurements.md](measurements.md) |
| 버튼을 눌러도 되는지 판단한다 | [safety.md](safety.md) |
| 스크린샷을 찍을지·열지 판단한다 | [screenshots.md](screenshots.md) |
| 결과가 이상하다, 스크립트가 실패한다 | [pitfalls.md](pitfalls.md) |
| 결과를 정리해 보고한다 | [report-format.md](report-format.md) |
| 점검을 마쳤다 — 배운 것을 남긴다 | [improvement-log.md](improvement-log.md) |

## 스크립트

`scripts/` 에 있다. 절차가 아니라 부품이다 — 그대로 쓰거나 고치거나 새로 써도 된다. 동작은 [scripts/FLOW.md](scripts/FLOW.md) 를 본다.

| 파일 | 용도 |
|------|------|
| `launch-chrome.sh` | 별도 프로필·디버깅 포트로 임시 Chrome 실행 |
| `setup.sh` | 작업 폴더에 `playwright-core` 설치 |
| `lib.cjs` | 접속·측정·스크린샷 공통 함수 |
| `survey.cjs` | 화면 구성을 읽는 한 가지 방법(구성 + 폭별 넘침 + layout shift) |
| `example-dialog.cjs` | 다이얼로그 점검을 스크립트로 쓴 예시(형식 참고용) |
