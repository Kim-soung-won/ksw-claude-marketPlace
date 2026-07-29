# [agent-factory] 훅이 세션 cwd 로만 git root 를 찾아, 커밋이 통째로 누락되거나 엉뚱한 레포에 오귀속된다

- **상태**: RESOLVED (agent-factory-plugin 0.12.0, C안 적용)
- **대상**: `plugins/agent-factory-plugin/hooks/capture-commit-session.mjs`
- **발견일**: 2026-07-29
- **해결일**: 2026-07-29
- **심각도**: HIGH — 무음 실패다. 누락은 "기록 없음"과 "작업 없음"을 구분 불가능하게
  만들고, 오귀속은 **실제로 만들어지지 않은 커밋에 남의 대화를 붙인 거짓 기록**을
  서버로 보낸다. 커밋을 막지는 않는다.

## 증상

이 저장소에서 커밋 2건(`c1ee9a0`, `dc5b91b`)을 만들었는데 큐·`processed.jsonl`·서버
어디에도 기록이 남지 않았다. `errors.jsonl` 에만 흔적이 있었다:

```
2026-07-29T02:53:46.719Z | capture | git root 를 찾지 못함 (cwd=/Users/metabuild/.agent-factory)
2026-07-29T02:53:58.371Z | capture | git root 를 찾지 못함 (cwd=/Users/metabuild/.agent-factory)
```

해당 세션의 작업 디렉터리가 `~/.agent-factory`(git 레포가 아님)였고, 커밋은
`cd <레포> && git commit ...` 형태로 실행했다.

## 원인

훅은 git root 를 **훅 입력의 `cwd`** 로만 찾는다. 명령 문자열은 `GIT_COMMIT_RE`
매칭에만 쓰이고, 그 안의 경로(`cd <path>`, `git -C <path>`)는 보지 않는다.

```js
const cwd = input.cwd || process.cwd();
...
const gitRoot = safeGit(cwd, ["rev-parse", "--show-toplevel"]);
if (!gitRoot) {
  appendLog("capture", `git root 를 찾지 못함 (cwd=${cwd})`);
  return;
}
const commit = safeGit(cwd, ["rev-parse", "HEAD"]) || "";
```

`gitRoot` 뿐 아니라 **`commit`·`commit_message` 조회도 전부 `cwd` 기준**이라는 점이
두 번째 결함으로 이어진다.

## 실측 (격리 환경)

임시 레포 2개 + 비-레포 디렉터리를 만들고 훅에 stdin JSON 을 직접 먹여 확인했다.

| # | 세션 cwd | 실행한 명령 | 결과 |
|---|---|---|---|
| 1 | 비-레포 | `cd repoB && git commit -m x` | **queue=0 — 통째로 누락** |
| 2 | 비-레포 | `git -C repoB commit -m x` | **queue=0 — 통째로 누락** |
| 3 | repoA | `cd repoB && git commit -m x` | **queue=1 — 그러나 `git_root=repoA`, 메시지 `"A의 커밋"`** |
| 4 | repoA | `git commit -m x` | queue=1 (정상) |

### 케이스 3 이 가장 나쁘다

repoB 에 커밋했는데 **repoA 의 (방금 만들어지지도 않은) 기존 HEAD** 가 기록된다.
즉 존재하는 sha 이긴 하나 이 세션이 만든 커밋이 아니며, 그 커밋에 이 세션의 대화
델타가 붙는다. 결과는 서버로 전송되는 **거짓 귀속 기록**이다.

가드2(커밋 최신성 백스톱)가 이걸 잡지 못하는 이유가 분명하다 — 명령이 `git commit`
으로 확정되면(`commandConfirmsCommit === true`) 가드2 자체를 건너뛰기 때문이다:

```js
if (!commandConfirmsCommit) {
  // ... HEAD 커밋이 방금 만들어졌는지 검사
}
```

명령이 `git commit` 인 것은 사실이므로 가드3 도 통과한다. 즉 **현재 4중 가드 중
어느 것도 "커밋 대상 레포와 조회 대상 레포가 다르다"를 보지 않는다.**

0.11.0 의 가드1b(레포 스코프 커서)는 이 케이스를 **반복 시에만** 부분 완화한다 —
같은 sha 가 두 번째로 들어오면 차단되지만, 첫 거짓 기록은 그대로 통과한다.

## 재현 절차

1. git 레포가 아닌 디렉터리에서 Claude Code 세션을 연다.
2. `cd <레포> && git commit -m "x"` 로 커밋한다.
3. `~/.agent-factory/queue.jsonl` 에 항목이 없고, `errors.jsonl` 에
   `git root 를 찾지 못함` 만 남는다.

오귀속 재현은 1단계에서 **다른 레포** 안에서 세션을 열면 된다.

## 수정 방향 (제안)

핵심은 "명령이 실제로 어느 레포에 커밋했는가"를 훅이 알아야 한다는 것이다.

- **A. 명령 문자열에서 대상 경로를 파싱한다.** `git -C <path>` 와 선행 `cd <path>` 를
  뽑아 `cwd` 대신(또는 우선해서) 쓴다. 정확하지만 셸 문법 변형(따옴표·변수 전개·
  `pushd`·복합 `&&` 체인)에 취약하고, 파싱 실패 시 조용히 틀린 경로를 고를 위험이
  있다. 파싱 결과가 실제 git 레포인지 `rev-parse` 로 반드시 확인해야 한다.
- **B. 커밋 최신성 검사를 무조건 실행한다.** 지금은 `commandConfirmsCommit` 이면
  가드2 를 건너뛰는데, 이 면제가 케이스3 을 통과시킨다. 명령 확정 여부와 무관하게
  "HEAD 가 방금 만들어졌는가"를 보면 오귀속(케이스3)은 **막힌다**. 다만 누락
  (케이스1·2)은 여전히 남고, 커밋 후 오래 이어진 한 줄 명령에서 진짜 커밋을 놓칠
  위험이 생긴다(가드2 면제가 원래 그것을 막으려던 장치다).
- **C. A + B 조합.** A 로 대상 레포를 찾고, B 로 그 레포의 HEAD 가 방금 만들어졌는지
  확인한다. 경로 파싱이 실패해도 B 가 거짓 기록을 막는 안전망이 된다.

**C 를 권장한다.** A 단독은 파싱 취약성이 그대로 무음 오귀속으로 이어지고, B 단독은
누락을 못 고친다.

추가로 고려할 것:

- **누락을 관측 가능하게 만든다.** 지금은 `errors.jsonl` 에만 남아 사용자가 열어보지
  않으면 모른다. 최소한 "커밋은 있었는데 캡처는 없다"를 나중에 대조할 수 있는 형태가
  필요하다(예: skip 도 큐에 `skipped` 항목으로 남기거나, 서버가 커밋 목록과 대조).
- **한 명령이 여러 레포에 커밋하는 경우**(`cd a && git commit && cd ../b && git commit`)
  는 이번 범위 밖으로 두되, 파싱이 첫 번째만 잡는다는 점을 문서화한다.

## 해결 (0.12.0, C안)

권장대로 **C(A + B)** 를 적용했다.

- **A. 명령 문자열에서 대상 경로 파싱** — `parseCommitTargetDir()` 신설. `git -C <path>` 와
  선행 `cd <path>`(상대 cd 체인 누적 포함)를 뽑아 세션 cwd 보다 우선하는 후보로 쓴다.
  각 후보가 실제 git 레포인지 `rev-parse` 로 확인하고 첫 성공을 `effectiveCwd` 로 삼는다.
  이후 모든 git 조회(HEAD·메시지·최신성)를 `effectiveCwd` 기준으로 한다. 셸 변형
  (`$`·`*`·백틱·pushd 등)은 파싱하지 않고 null 로 물러서며, 그 경우 cwd 폴백 + 가드2 가 받는다.
- **B. 커밋 최신성 검사 무조건 실행** — 가드2 의 `commandConfirmsCommit` 면제를 제거했다.
  명령이 `git commit` 으로 확정돼도 `effectiveCwd` 의 HEAD 가 창(300s) 안에 만들어졌는지
  항상 본다. 파싱이 빗나가 엉뚱한 레포를 가리켜도 거짓 기록을 막는 안전망이다.
- **부수 결함**: `GIT_COMMIT_RE` 가 `git commit` 인접만 매칭해 `git -C <repo> commit` 을
  가드3 에서 비-커밋으로 오분류했다(케이스2 누락의 실제 경로). subcommand 앞의 전역 옵션
  (`-C`·`-c`·`--foo`)을 허용하도록 정규식을 넓혔다.

### 검증 (격리 환경, `AGENT_FACTORY_HOME` 로 홈 분리)

| # | 세션 cwd | 명령 | 수정 전 | 수정 후 |
|---|---|---|---|---|
| 1 | 비-레포 | `cd repoB && git commit` | queue=0 누락 | **queue=1, git_root=repoB** |
| 2 | 비-레포 | `git -C repoB commit` | queue=0 누락 | **queue=1, git_root=repoB** |
| 3 | repoA | `cd repoB && git commit` | queue=1, **repoA 오귀속** | **queue=1, git_root=repoB(정확)** |
| 4 | 자기 레포 | `git commit`(신선) | queue=1 | queue=1 (회귀 없음) |
| 5 | 자기 레포 | `git add . && git commit` | queue=1 | queue=1 (복합 유지) |
| 6 | 비-레포 | `pushd repoB && git commit`(파싱불가) | queue=0 | queue=0 안전 스킵(거짓기록 없음) |

### 남은 트레이드오프

- 가드2 면제 제거로 `git commit && <300s 초과 작업>` 한 줄에서 훅이 창 밖에 늦게 발동하면
  진짜 커밋을 놓칠 수 있다(수정 방향 B 에서 예고된 위험). 오귀속 방지를 위해 이 방향을 택했다.
- 파싱은 첫 대상 레포만 잡는다 — `cd a && git commit && cd ../b && git commit` 는 범위 밖.

## 영향 범위 메모

이 결함은 **레포 밖에서 세션을 열고 여러 레포를 오가며 작업하는 패턴**에서 통째로
빈 구멍을 만든다. 모니터링 도구로서 가장 곤란한 실패 방식이다 — 데이터가 틀린 게
아니라 **없는데, 없다는 사실조차 드러나지 않는다.**

## 관련

- [[001-cross-session-duplicate-capture]] — 같은 훅의 귀속 결함이지만 축이 다르다.
  001 은 "같은 커밋이 여러 번" (중복), 이 이슈는 "커밋이 아예 없거나 엉뚱한 것에"
  (누락·오귀속).
