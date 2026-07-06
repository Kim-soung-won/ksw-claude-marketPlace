# domain-skill-manager — 결과 리포트 형식

> 이 파일은 `agents/domain-skill-manager.md`에서 분리된 정적 참고 자료다.
> 5단계(자가 검증 후 결과 리포트)에서 최종 결과를 출력하기 직전에 Read로 읽고
> 아래 형식 그대로 출력한다. SKILL.md 작성 포맷 규칙 자체는 같은 디렉터리의
> `skill-md-format-rules.md`를 참고한다.

---

## 결과 리포트 형식

```
📁 모드: CREATE / UPDATE
📄 파일 경로: {full path}
📝 변경 요약: {한 줄}

🔍 검사 결과:
  - 타입 권위 체크: {재정의 차단 {n}건 / 충돌 발견 {n}건}
  - 일관성 게이트: PASS / CONFLICT {n}건
  - 미확인 항목: {confidence.unconfirmed 개수}개
  - 자가 검증: PASS {n}개 / FAIL {n}개
    - FAIL: {항목명} — {조치 내용}

⚠️ 미확인 항목 목록:
  - {topic}: {note}

📋 trio 현황:
  - {도메인}_domain: 존재 / 없음
  - {도메인}_api: 존재 / 없음
  - {도메인}_scenario: 존재 / 없음
```

FAIL 항목이 있으면 파일을 수정한 뒤 해당 항목을 재검증하고, 최신 결과로 위 형식을
다시 채워 출력한다.
