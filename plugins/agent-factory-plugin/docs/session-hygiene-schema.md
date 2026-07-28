# 세션 위생(컨텍스트 경계) 지표 스키마 — 소비측 미러링 계약

이 문서는 `metrics.json` 사이드카의 `session_hygiene` 필드 계약을 정의한다. **서버
(`/api/agent-factory/records`)와 UI 가 이 스키마를 미러링**해 저장·표시한다. 산출 코드는
`scripts/lib/distill/hygiene.mjs`(결정론적, LLM 없음)와 `core.mjs`의 `writeMetricsSidecar`다.

## 전송 경로

`push-sessions.mjs`(Stop 훅)가 `metrics.json`을 통째로 payload 에 실어 POST 한다 —
소비측은 `payload.records[].metrics.session_hygiene`로 받는다. metrics.json 스키마는
**순수 additive**라 push 코드 변경이 없다(구버전 metrics 에는 이 필드가 아예 없다).

## 지표가 답하는 질문

안티패턴은 "캐시읽기가 크다"가 **아니다** — 캐싱은 긴 세션의 완화제다. 진짜 안티패턴은
**관련 없는 컨텍스트를 작업 경계에서 리셋 없이 단조 누적**하는 것이고, 그 신호는 델타
하나로는 안 잡히고 커밋 간 기울기로만 드러난다. 그래서 지표를 두 스코프로 나눈다.

## 스키마

```jsonc
// metrics.json (커밋당 1개, 서버 직송)
{
  "commit": "…",
  "project_path": "…",
  "project_name": "…",
  "agent_costs": [ /* 기존 — 불변 */ ],
  "session_hygiene": {                        // ★ 신규 (additive)
    // ── 델타 스코프 (이 커밋 구간만, digest.hygiene_delta 유래) ──
    "cache_read":            46000,           // int
    "cache_creation":        1100,            // int
    "cr_gen_ratio":          41.8,            // float | null  (cache_creation=0 → null)
    "max_tool_result_len":   2000,            // int   — 델타 내 최대 tool_result 길이
    "tool_result_spikes":    [{ "len": 2000 }], // {len:int}[]  (최대 MAX_RESULT_SPIKES=10)
    "max_turn_context":      36000,           // int   — 턴 컨텍스트(input+cache_read) 최댓값
    "max_turn_context_jump": 29500,           // int   — 인접 턴 컨텍스트 최대 증가폭(단일 턴 급증)

    // ── 델타 스코프 (리셋 사실) ──
    "delta_shrank":          false,           // bool  — 이 커밋 델타에서 compact/clear 발생
    "context_size_sample":   36000,           // int | null — 이 커밋 시점 컨텍스트 크기

    // ── 세션 누적 스코프 (커밋 간 증분 복원, session-hygiene.json 유래) ──
    "session_resets":        0,               // int | null — 세션 누적 리셋 횟수(monotonic)
    "context_slope":         70000,           // float | null — 커밋당 컨텍스트 증가량(회귀 기울기)
    "context_samples":       3                // int | null — 기울기 산출에 쓴 샘플 수
  }
}
```

### 필드 출처 (digest vs 사이드카)

| 필드 | 출처 | 비고 |
|------|------|------|
| `cache_read`·`cache_creation`·`cr_gen_ratio` | digest.hygiene_delta | 델타 스코프 |
| `max_tool_result_len`·`tool_result_spikes` | digest.hygiene_delta | 출력 급증 |
| `max_turn_context`·`max_turn_context_jump` | digest.hygiene_delta | 컨텍스트 급증 |
| `delta_shrank`·`context_size_sample` | digest | 리셋 사실·크기 샘플 |
| `session_resets`·`context_slope`·`context_samples` | **사이드카 전용** | `hygiene.mjs`가 커밋 간 증분 복원. digest(=요약 .md)에는 없다 |

## null 의미

`null`은 "산출 불가"이지 0이 아니다:
- `cr_gen_ratio` null → `cache_creation`이 0(재청구할 캐시 생성이 없음).
- `context_slope`/`session_resets`/`context_samples` null → 세션 저장 실패(사이드카는 델타
  스코프만 담고 나감) 또는 샘플 < 2.

**소비측 스키마는 이 세 그룹 전부 nullable/optional 로 둔다** — 구버전 플러그인 metrics
(필드 자체 없음)와 하위호환된다.

## 소비측 해석 가이드 (UI 신호 기준)

| 신호 | 조건 | 읽는 법 |
|------|------|---------|
| 리셋 없는 단조 누적 | `context_slope` 큼 **+** `session_resets` 0 | **가장 강한 안티패턴** — 작업 경계에서 `/clear` 부재 |
| 단일 턴 대용량 덤프 | `max_turn_context_jump` 큼 | 대용량 Read 등을 컨텍스트에 들여 이후 턴마다 재청구 |
| 컨텍스트 세(稅) 과다 | `cr_gen_ratio` 큼 | 단독 판정 금지 — 세션 길이·기울기와 **함께** 볼 때만 낭비 |
| 재청구 유발 출력 | `tool_result_spikes` | 어떤 tool_result 가 이후 턴 내내 재청구됐는지 |

> `cr_gen_ratio`만으로 "낭비"를 판정하지 말 것. 캐싱이 없었다면 비용이 10배였다 — 높은
> 비율은 긴 세션의 자연스러운 결과이지 병의 증거가 아니다. 병은 **누적 + 리셋 부재**다.

## 상수 (튜닝 지점)

`scripts/lib/distill/constants.mjs`:
- `MAX_HYGIENE_SAMPLES=200` — 세션당 유지 컨텍스트 샘플 수(초과 시 오래된 앞부분 프루닝, `resets`는 별도 보존).
- `MAX_HYGIENE_SESSIONS=500` — `session-hygiene.json`이 담을 세션 수(초과 시 `updated_at` 오래된 세션부터 프루닝).
- `MAX_RESULT_SPIKES=10` — 델타당 `tool_result_spikes` 목록 상한.
- `RESULT_SPIKE_MIN=STDOUT_HEAD*4` — 스파이크로 볼 최소 tool_result 길이.
