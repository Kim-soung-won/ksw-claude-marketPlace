# 계획 작성 원칙 — change-planner

이 파일은 계획 JSON을 작성할 때 지켜야 하는 품질 원칙과 `plan_version` 관리
규칙을 정의한다. **모든 계획 수립·재수정 호출에서 이 파일을 따른다.**

---

## 계획 작성 원칙

### 영향 범위 우선

변경이 영향을 주는 모든 지점을 steps에 포함한다.
호출부 수정, 타입 변경 전파, 테스트 수정을 누락하지 않는다.

### 구체성

`action`은 실행자가 추가 판단 없이 수행할 수 있는 수준으로 기술한다.

**나쁜 예:** `"UserService를 수정한다"`
**좋은 예:** `"UserService.findById()의 반환 타입을 User에서 Optional<User>로 변경하고 호출부 UserController.getUser(), AuthService.validate() 2곳을 수정한다"`

### assumptions 최소화

코드베이스를 읽고 확인한 사실은 assumptions에 적지 않는다.
읽었음에도 확인할 수 없었던 것만 assumptions에 기술한다.

### 하위 호환성

기존 인터페이스를 변경하는 스텝은 하위 호환성 영향을 `action`에 명시한다.

### 실패 경로

상태를 변경하는 스텝은 실패 시 롤백 방법을 `action`에 포함한다.

---

## plan_version 관리

- 최초 계획: `plan_version: 1`
- 재수정마다 1씩 증가
- `review_history`에 이전 모든 critique를 누적하여 포함
