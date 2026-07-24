# 세션 기록 저장 형식 — session-feedback-summarizer

전처리된 digest 하나(= 커밋 하나. 같은 커밋의 여러 델타 구간은 distill 이 하나로 병합)당
세션 기록 파일 하나를 남긴다.

## 저장 위치·파일명

- 위치: **사용자 레벨** — `digest.sessions_dir`가 가리키는 경로
  (`~/.agent-factory/sessions/<projectSlug>/`). summarizer 는 이 값을 그대로 Write
  디렉터리로 쓰고 슬러그를 직접 계산하지 않는다(해시 계산은 distill 이 이미 했다).
  레포에는 아무것도 쓰지 않는다 — 팀 공유는 Observer 서버 DB 가 담당한다.
- `digest.sessions_dir`가 null 이면(단일 구간 디버그 모드) 저장을 건너뛰고 그 사실을 보고한다.
- 파일명: `<커밋 sha 앞 7자>.md` (커밋 sha가 없으면 `<captured_at 날짜시간>.md`).
  레포별 하위 디렉터리로 갈리므로 레포 간 sha7 충돌은 없다.
- 한 번의 distill 안에서는 커밋당 digest 가 1개라 `-r2` 가 생기지 않는다. `-r2` 접미사는
  **이전 distill 에서 만든 `.md` 가 아직 push 로 정리되지 않은 채 같은 커밋이 다시 큐에
  잡혀 재처리되는 교차-distill 재처리** 시에만, 기존 파일을 덮어쓰지 않으려고 남긴다.

## 파일 형식

```markdown
---
commit: <full sha>
commit_subject: <digest.commit_message의 첫 줄. 없으면 생략>
session_id: <session id>
project_path: <digest.project_path>
project_name: <digest.project_name>
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

- timeline 의 tool 항목에 `repeat:n`이 있으면 **동일 도구·동일 주체(by)의 n회 연속 호출**을
  하나로 접은 것이다. 개별 N행으로 부풀리지 말고 비고에 "n회 연속"으로 표기한다.

## 피드백

feedback-rubric.md의 축별로, digest에서 실제로 근거가 있는 항목만 적는다. 각 항목은
**관찰(무엇을 봤는지) → 판단(적절/과함/누락) → 개선 제안** 순으로. 근거가 약하면
"digest만으로는 판단 불가"라고 명시한다.

## 비용 메모

`cost_tokens` 기준 이 델타의 토큰 소비와, 눈에 띄는 낭비(불필요한 재작업·중복 spawn 등)가
있었다면 그 지점.

- `digest.timeline_meta`의 `collapsed_runs`·`dropped_stdout`·`dropped_tools`가 0이 아니면
  timeline 이 상한(TIMELINE_LIMIT)으로 압축·절단된 것이다(원본 `total_original`개). 절단된
  부분은 요약·피드백의 근거로 삼지 않는다. 절단 규모가 크면 그 자체가 "델타가 과도하게
  컸다"는 비용 신호이니 관찰로 남긴다.
```

## 작성 규칙

- digest에 없는 사실을 지어내지 않는다. timeline·agents·cost_tokens에서 확인되는 것만 쓴다.
- `timeline_meta`가 절단을 표시하면 요약이 timeline 전체를 반영하지 못할 수 있음을 인지한다.
  단 `signals`·`agents`·`cost_tokens`·`agent_costs`는 상한과 무관하게 항상 완전하다.
- 요약·피드백은 한국어로 간결하게. 원본 파일 내용 전문을 다시 붙여넣지 않는다(이미
  distill 단계에서 걷어낸 부피를 되살리지 않는다).
