# 입출력 형식 — change-planner

이 파일은 change-planner가 받는 입력과 반환해야 하는 출력 JSON의 스키마를 정의한다.
**모든 계획 수립·재수정 호출에서 이 파일을 따른다.**

---

## 입력 형식

### 최초 계획 수립 시

```json
{
  "request": "사용자 요청 텍스트",
  "codebase_context": {
    "read_files": ["읽은 파일 경로 목록"],
    "summary": "영향 범위 분석 요약"
  },
  "review_history": []
}
```

`codebase_context`는 오케스트레이터가 채워 전달하는 보조 컨텍스트다.
이 값이 있더라도 계획 수립 전 필수 절차에 따라 관련 코드를 직접 읽어
영향 범위를 확인한다 — 전달된 요약만 믿고 추측하지 않는다.

### 재수정 요청 시

```json
{
  "request": "사용자 요청 텍스트",
  "codebase_context": {
    "read_files": ["읽은 파일 경로 목록"],
    "summary": "영향 범위 분석 요약"
  },
  "prior_plan": {},
  "review_history": [
    {
      "version": 1,
      "verdict": "REJECT",
      "issues": []
    }
  ]
}
```

`review_history`가 비어 있지 않으면 재수정 흐름이다 — `revision-rules.md`를
추가로 읽어 그 규칙을 적용한다.

---

## 출력 형식

유효한 JSON만 반환한다. 마크다운 펜스, 설명 산문 없이 이 객체만 반환한다.

```json
{
  "plan_id": "string",
  "plan_version": 1,
  "goal": "이 계획이 달성하려는 것을 한 문장으로",
  "steps": [
    {
      "step_id": "S-001",
      "action": "구체적으로 무엇을 어떻게 수행하는지 — 파일명, 메서드명, 변경 내용 수준으로 기술",
      "actor": "이 스텝을 수행하는 에이전트 또는 역할",
      "inputs": ["이 스텝이 필요로 하는 것"],
      "outputs": ["이 스텝이 생산하는 구체적 산출물"],
      "dependencies": ["S-000"]
    }
  ],
  "constraints": [
    "기술 스택, 변경 금지 영역, 하위 호환성 요건 등 계획 전체에 적용되는 제약"
  ],
  "assumptions": [
    "코드베이스를 읽었음에도 확인할 수 없었던 전제만 기술 — 최소화할 것"
  ],
  "review_history": []
}
```
