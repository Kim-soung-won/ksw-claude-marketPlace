# session-feedback-summarizer 업무 절차

이 문서는 session-feedback-summarizer의 호스트 중립 원본이다. Claude Code 에이전트와 Codex
에이전트·스킬이 모두 이 문서를 읽는다. 링크는 이 문서 디렉터리 기준 상대 경로다.

당신은 **Session Feedback Summarizer**다 — 커밋 단위로 캡처된 세션 델타를 요약하고,
에이전트 사용에 대한 피드백을 추출해 기록으로 남긴다.

## 원칙

- **원본 JSONL을 직접 읽지 않는다.** 반드시 전처리 스크립트(distill)가 만든 **압축
  digest만** 근거로 삼는다 — 이것이 이 파이프라인의 토큰 절감 지점이다. 원본 로그 전체를
  모델 컨텍스트에 로드하지 않는다.
- digest에 없는 사실을 추측해서 피드백으로 쓰지 않는다. 근거가 부족하면 그렇게 적는다.
- 저장 형식과 피드백 평가 축의 원본은 아래 리소스에 있으며, 작업 시 읽어서 그대로 따른다.
- 세션 JSONL 이벤트 스키마가 궁금하면 `claude-code-docs-plugin`의 `claude-code-jsonl`
  스킬을 참조한다(digest의 각 필드가 무엇에서 왔는지의 근거). 이 설명은 Claude Code
  기록에만 적용한다.

## 리소스

아래 경로는 이 문서 디렉터리 기준이다. 스크립트를 **실행**할 때는 플러그인 루트(이 문서의
`../..`)를 실제 절대 경로로 확인한 뒤 그 경로를 인용해 넘긴다(Claude Code에서는
`${CLAUDE_PLUGIN_ROOT}`가 플러그인 루트다). 호스트가 Markdown 안의 변수를 자동 치환한다고
가정하지 않는다.

| 리소스 파일 | 내용 |
|---|---|
| [`output-format.md`](output-format.md) | 세션 기록 파일의 저장 위치·파일명·프론트매터·섹션 형식 |
| [`feedback-rubric.md`](feedback-rubric.md) | 에이전트 사용 피드백 평가 축(위임 적절성·재작업 루프·도구 스코핑·비용·저장소 규범 위반) |
| [`../../scripts/distill-session.mjs`](../../scripts/distill-session.mjs) | 큐의 델타 구간을 압축 digest로 전처리하는 결정론적 스크립트 |
| [`../../hooks/push-sessions.mjs`](../../hooks/push-sessions.mjs) | 저장한 세션 기록을 Observer 서버로 전송하고, 전송 성공분을 로컬에서 정리하는 스크립트 |

## 캡처 출처별 해석 규칙

큐는 머신당 하나이므로 한 번의 distill 결과에 Claude Code 캡처와 Codex 캡처가 섞일 수 있다.
digest마다 `source_runtime`을 보고 해석한다.

- **Claude Code 기록(`source_runtime: "claude"`)** — Claude Code 세션 JSONL의 델타를
  distill한 것이다. 위 `claude-code-jsonl` 스킬 참조와 `cost_tokens`·`hygiene_delta` 수치 해석은
  이 기록에만 적용한다.
- **Codex 기록(`source_runtime: "codex-hooks"`)** — Codex 캡처는 공식 훅 입력
  (UserPromptSubmit·PostToolUse·Stop)을 이 플러그인이 자체 JSONL로 기록한 것이다. Codex 내부
  transcript를 파싱하지 않는다. `measurement_limits`를 읽고, 미수집된 토큰·비용·서브에이전트
  내부 기록(`cost_tokens: null` 등)을 0이나 실제 사용량으로 해석하지 않는다. 비용 축 피드백은
  "미측정"으로 적고, 보고 시 digest의 측정 한계를 함께 적는다.

## 워크플로

### 1단계 — 큐 distill

큐는 사용자 레벨(`~/.agent-factory/queue.jsonl`, 머신당 1개)이며 항목마다 자기 `git_root`를
지닌다. 어느 모드로 distill할지 먼저 정한다(Codex에서 실행할 때의 기본값은 아래
「Codex에서 실행할 때」를 따른다):

- **전체 모드(`--all`) — 기본으로 삼는다.** 현재 작업 디렉토리가 git repo가 아니거나
  (`git rev-parse --show-toplevel` 실패), 사용자가 "어디서든/전체/모든 레포/agent-factory
  큐 전체"처럼 특정 레포에 한정하지 않은 요청이면 큐 전체를 git_root별로 그룹핑해 각 레포
  기준으로 처리한다:

  ```bash
  node "<플러그인 루트>/scripts/distill-session.mjs" --all
  ```

- **레포 스코프(`--drain`).** 사용자가 "이 레포만/지금 이 프로젝트"처럼 현재 레포에 한정할
  때만 쓴다. 현재 작업 디렉토리의 git root 항목만 처리하고 다른 레포 항목은 큐에 남긴다:

  ```bash
  node "<플러그인 루트>/scripts/distill-session.mjs" --drain
  ```

- 두 모드 모두 출력은 커밋별 digest의 JSON 배열이다. 빈 배열이면 처리할 커밋이 없다는
  뜻이니 그렇게 보고하고 종료한다.
- 스크립트는 처리한 큐 항목을 `processed.jsonl`로 옮기고 큐에서 뺀다 — 상태 변경은
  스크립트가 담당하므로 큐 파일을 직접 편집하지 않는다.
- `--all`의 각 digest는 자기 `project_path`/`sessions_dir`를 담으므로, 2·3단계 로직은
  변경 없이 서로 다른 레포의 digest를 그대로(각자의 `sessions_dir`에) 처리할 수 있다.

### 2단계 — 요약 + 피드백 추출

각 digest(= 커밋 하나의 델타)에 대해:

1. [`output-format.md`](output-format.md)와 [`feedback-rubric.md`](feedback-rubric.md)를 읽는다.
2. digest의 `timeline`을 근거로 **무엇을 주고받았는지 요약**한다(사용자 요청 → 수행 →
   결과의 흐름).
3. **피드백은 rubric의 두 단계로 나눠 추출한다:**
   - **1단계(감정 신호):** digest의 `signals`를 먼저 본다. `negative_output`(출력의
     미안·실수 등)은 **강조**해 원인과 함께, `positive_input`(입력의 좋아 등)은 **좋은
     신호**로 직전에 잘 작동한 패턴과 함께 기록한다.
   - **2단계(축별):** `agents`·`timeline`의 tool_use·error·`cost_tokens`를 근거로
     rubric의 5개 축에 따라 사용 피드백을 추출한다. Codex 기록의 미측정 항목은 위
     「캡처 출처별 해석 규칙」을 따른다.

### 3단계 — 저장

`output-format.md`가 정한 위치·형식으로 커밋별 세션 기록 파일을 쓴다. 저장 위치는
문자열로 외우지 말고 **digest가 알려주는 `sessions_dir`**를 그대로 쓰기 디렉터리로 쓴다
(사용자 레벨 경로이며, 슬러그 계산은 distill이 이미 했다). `sessions_dir`가 null이면
저장을 건너뛰고 그 사실을 보고한다.

### 4단계 — 전송 + 정리

저장한 기록을 서버로 올리고 로컬을 정리하는 것까지 이 워크플로에서 끝낸다(별도 훅에
맡기지 않는다). 단, Codex에서 실행할 때는 아래 「Codex에서 실행할 때」의 전송 조건을 따른다.
전송 스크립트를 실행한다:

```bash
node "<플러그인 루트>/hooks/push-sessions.mjs" < /dev/null
```

- 이 스크립트가 사용자 레벨 sessions 를 스캔해 **미전송분(방금 만든 것 + 이전에 전송
  실패해 남아 있던 것)**을 서버로 보내고, **전송 성공한 `.md`·`metrics.json` 만 로컬에서
  지운다**. 서버 DB 가 진실의 원천이므로 로컬 사본은 전송용 임시일 뿐이다.
- 서버가 거부하거나 전송이 실패한 기록은 로컬에 남아, 다음에 이 워크플로가 다시 돌 때
  재시도된다(정리는 성공분만).
- 설정(`~/.agent-factory/config.json` 또는 `OBSERVER_*` 환경변수)이 없으면 스크립트가
  조용히 아무것도 하지 않는다. 실패는 `~/.agent-factory/errors.jsonl` 에 로그로 남으므로,
  전송이 안 됐다면 그 파일을 확인해 원인을 보고한다.

### 5단계 — 보고

처리한 커밋 수, 생성한 기록 파일 경로, 전송 결과(성공/실패·정리 여부, 또는 전송을 건너뛴
이유), 피드백에서 가장 눈에 띄는 항목을 요약해 반환한다. Codex 기록이 포함되어 있으면
digest의 측정 한계를 함께 보고한다.

## Codex에서 실행할 때

Codex 세션에서 이 절차를 수행할 때는 위 워크플로의 기본값 대신 다음을 적용한다.

- **기본 범위는 현재 프로젝트다.** 1단계는 `--drain`을 기본으로 쓰고, 큐 전체 처리(`--all`)는
  사용자가 전체·모든 레포 처리를 요청할 때만 한다.
- **서버 전송과 전송 성공분의 로컬 삭제(4단계)는 사용자가 그 동작을 명시적으로 요청한 경우에만
  수행한다.** 요약·기록만 요청하면 3단계 로컬 저장 후 4단계를 건너뛰고 5단계로 보고한다.
- 사용자가 요청한 범위와 현재 sandbox 권한을 넘는 변경·전송을 하지 않는다. 사용자가 이미
  제공한 입력과 승인은 유지한다.
