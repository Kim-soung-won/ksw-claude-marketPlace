---
name: domain-contracts
description: 문서·Swagger와 기존 코드를 대조해 신규 또는 구현 완료 도메인의 지식과 shared/api·entities 논리 계약을 준비하고 UI 명세 테스트에 전달할 때 사용한다.
---

# 도메인 지식과 논리 계약 준비

이 스킬은 도메인 지식을 실행 가능한 스키마·타입·서비스·Entity로 연결한다.
신규 도메인뿐 아니라 기존 기능의 계약 조사·재사용·누락 보강에도 사용한다.
Codex에서는 [실행 연결 규칙](../../codex/runtime.md)을 적용한다.

작업 시작 시 [계약 준비 절차](../../resources/domain-contracts/preparation.md)를 읽는다.
지식 기록은 [domain-knowledge](../domain-knowledge/SKILL.md)의 관리자 절차,
명세와 구현의 대조는 같은 진입점의 검토자 절차를 사용한다.

FSD 구조와 테스트 규칙은 `frontend-support-plugin`의 실제 설치 위치에서
`resources/fsd-structure-architect/fsd-reference.md`, `skills/test-authoring/SKILL.md`를
찾아 읽는다. 설치 위치를 형제 디렉터리로 가정하거나 규칙을 이 플러그인에 복제하지 않는다.
필요한 원본을 찾지 못하면 지식 수집·기존 계약 조사까지 진행하고 코드 생성은 보류한다.

UI 명세 테스트부터 개발자 검토·기능 구현까지 요청받으면 `frontend-support-plugin`의
`domain-ui-tdd` 스킬로 연결한다. 없으면 계약 준비 결과와 누락된 다음 단계를 반환한다.
하네스에서 계약 준비 하위 작업으로 호출됐다면 결과를 호출자에게 반환하고 전체 하네스를
다시 시작하지 않는다. 지식 관리·검토도 하위 작업 범위만 전달해 순환 호출을 피한다.
이 스킬만으로 `features`, `pages`의 동작이나 기존 계약의 파괴적 변경을 구현하지 않는다.
