# component-skill-manager — 결과 리포트 형식

> 이 파일은 `agents/component-skill-manager.md`에서 분리된 정적 참고 자료다.
> 자가 검증 후 결과 리포트를 출력하기 직전에 Read로 읽고 아래 형식 그대로
> 출력한다. SKILL.md 작성 포맷 규칙 자체는 같은 디렉터리의
> `skill-md-format-rules.md`를 참고한다.

---

## 결과 리포트 형식

```
📁 모드: CREATE / UPDATE
📄 파일 경로: {full path}
🧩 컴포넌트: {name}  (카테고리: {Category} / 단독 모듈)
📝 변경 요약: {한 줄}

🔍 소스 근거:
  - 읽은 소스 파일: {경로 목록}
  - 추출한 export: {n}개 (컴포넌트 {a} / 타입 {b} / 훅·유틸 {c})
  - unconfirmed 항목: {n}개

🔍 자가 검증: PASS {n}개 / FAIL {n}개
  - FAIL: {항목명} — {조치 내용}

⚠️ unconfirmed 항목 목록:
  - {무엇을}: {왜 확인이 필요한가 / 어디를 확인해야 하는가}

📋 후속 제안:
  - {같은 카테고리의 다른 컴포넌트 스킬 필요 여부, variant 우산 스킬 필요 여부 등}
```

FAIL 항목이 있으면 파일을 수정한 뒤 해당 항목을 재검증하고, 최신 결과로 위 형식을
다시 채워 출력한다.
