# 세션 기록 저장 형식 — session-feedback-summarizer

전처리된 digest 하나(= 커밋 하나의 델타 구간)당 세션 기록 파일 하나를 남긴다.

## 저장 위치·파일명

- 위치: 작업 레포의 `.agent-factory/sessions/`
- 파일명: `<커밋 sha 앞 7자>.md` (커밋 sha가 없으면 `<captured_at 날짜시간>.md`)
- 같은 파일이 이미 있으면 덮어쓰지 않고 재처리 표시(`-r2` 등 접미사)로 남긴다.

## 파일 형식

```markdown
---
commit: <full sha>
commit_subject: <digest.commit_message의 첫 줄. 없으면 생략>
session_id: <session id>
captured_at: <ISO8601>
event_count: <n>
agents: [<attributionAgent 목록>]
cost_tokens: { input: <n>, output: <n>, cache_read: <n>, cache_creation: <n> }
---

## 신호

1단계 감정 신호 스캔 결과를 최상단에 둔다(feedback-rubric.md 1단계).

- **🔴 부정(출력):** `signals.negative_output`이 있으면 강조해서 나열 — assistant가
  미안/실수/잘못 등을 뱉은 지점과 그 원인. 없으면 생략.
- **🟢 긍정(입력):** `signals.positive_input`이 있으면 나열 — 사용자가 좋아/잘했 등을
  전달한 지점과 직전에 잘 작동한 패턴. 없으면 생략.
- 둘 다 없으면 "감정 신호 없음".

## 요약

이 커밋 델타에서 사용자와 에이전트가 주고받은 흐름을 3~8줄로. "무엇을 요청했고 →
무엇을 수행했고(어떤 에이전트/스킬/도구) → 무슨 결과가 나왔는지"를 순서대로.

## 에이전트·도구 사용 내역

| 순서 | 주체 | 도구/에이전트 | 대상 | 비고 |
|------|------|--------------|------|------|
| 1 | (main/attributionAgent) | Agent(subagent_type) / Skill / Edit … | 파일·인자 요지 | 에러·재시도 여부 |

## 피드백

feedback-rubric.md의 축별로, digest에서 실제로 근거가 있는 항목만 적는다. 각 항목은
**관찰(무엇을 봤는지) → 판단(적절/과함/누락) → 개선 제안** 순으로. 근거가 약하면
"digest만으로는 판단 불가"라고 명시한다.

## 비용 메모

`cost_tokens` 기준 이 델타의 토큰 소비와, 눈에 띄는 낭비(불필요한 재작업·중복 spawn 등)가
있었다면 그 지점.
```

## 작성 규칙

- digest에 없는 사실을 지어내지 않는다. timeline·agents·cost_tokens에서 확인되는 것만 쓴다.
- 요약·피드백은 한국어로 간결하게. 원본 파일 내용 전문을 다시 붙여넣지 않는다(이미
  distill 단계에서 걷어낸 부피를 되살리지 않는다).
