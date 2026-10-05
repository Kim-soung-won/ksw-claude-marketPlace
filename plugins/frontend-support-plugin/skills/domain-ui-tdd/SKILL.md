---
name: domain-ui-tdd
description: 신규·기존 도메인의 UI 기능을 테스트 자체로 명세화하고 개발자 검토 후 RED·GREEN·리팩터링으로 구현하거나 기존 기능의 회귀 기준을 확보할 때 사용한다.
---

# 도메인 UI TDD 하네스

테스트가 실행 가능한 기능 명세다. 별도 UI 기능 명세서를 복제하지 않는다.
이 스킬은 단계·쓰기 범위·검토 기록을 관리하는 절차형 하네스이며 파일 접근을
기술적으로 차단하는 런타임은 아니다. 테스트 실행은 대상 프로젝트의 실행기를 사용한다.

시작할 때 [단계와 전환 조건](../../resources/domain-ui-tdd/workflow.md)을 읽는다.
검토·재개·최종 보고에는 [작업 기록 형식](../../resources/domain-ui-tdd/work-record.md)을 읽는다.

## 진입과 실행 연결

1. 대상 기능과 요청 범위(명세화만 / 변경 구현 포함)를 파악한다. 도메인 전체를
   신규·기존 중 하나로 고정하지 않고 기능별 계약·구현·테스트 상태를 조사한다.
2. `domain-knowledge-plugin`의 `domain-contracts` 스킬을 실제 설치된 위치에서
   찾아 읽는다. 저장소의 형제 플러그인 경로를 설치 경로로 가정하지 않는다.
   없으면 사용자에게 필요한 스킬 이름과 누락 단계를 알린다. 기존 계약 조사·테스트
   감사는 계속할 수 있지만, 계약 준비가 필요한 기능의 다음 단계는 보류한다.
3. 도메인 지식과 논리 계약을 준비한 뒤, [단위 테스트](../test-authoring/SKILL.md)와
   [통합 테스트](../integration-test-authoring/SKILL.md)를 `spec-first` 모드로 수행한다.
   기존 테스트는 먼저 읽고 재사용한다. [테스트 생명주기](../../resources/tdd/test-lifecycle.md)가
   모드별 완료 기준의 원본이다.
4. 실행 결과와 검토 가능한 테스트 diff를 제시한다. 개발자가 해당 버전을 승인한
   경우에만 기능 구현으로 전환한다. 같은 버전·범위의 기존 승인은 재사용한다.
5. 승인된 테스트를 유지하면서 기능별로 GREEN을 만들고 리팩터링·회귀 검증한다.
   명세화만 요청했다면 구현을 시작하지 않는다.

테스트 작성은 [test-writer](../../resources/test-writer/procedure.md),
[integration-test-writer](../../resources/integration-test-writer/procedure.md), 감사는
[test-reviewer](../../resources/test-reviewer/procedure.md)의 절차를 사용한다. 해당 에이전트가 등록되어 있고
위임 도구를 쓸 수 있는 경우에만 위임하며, 없으면 해당 절차 문서를 읽고 직접 수행한다. 전달 입력은 대상 기능·모드·근거·기존 실패·쓰기 범위·
작업 기록 경로다. 테스트 작성자에게 기능 구현이나 승인 판정을 맡기지 않는다.

UI에서 필드 값에 따라 노출·활성·라벨·허용 동작이 달라지면 도메인 `_scenario`의 화면 분기 근거와
`_domain`의 필드 의미를 따른다. 근거가 없는 분기는 구현에서 정하지 않고 개발자 검토 항목으로 남긴다.

UI 구현 시 [FSD 원본](../../resources/fsd-structure-architect/fsd-reference.md),
[컴포넌트 규칙](../component-design-patterns/SKILL.md)을 적용하고 필요한 경우
[Suspense 규칙](../suspense-boundary-patterns/SKILL.md)을 읽는다.
