# [agent-factory] 가드1(HEAD 전진 검증)이 세션 스코프라 세션 간 중복 적재를 막지 못한다

- **상태**: RESOLVED (0.11.0) — 대응 내역은 문서 하단 참조
- **대상**: `plugins/agent-factory-plugin/hooks/capture-commit-session.mjs`
- **발견일**: 2026-07-28
- **심각도**: MEDIUM — 커밋을 막지는 않으나, 같은 커밋이 여러 델타로 큐에 쌓여
  요약 비용이 중복 발생하고 세션 기록이 중복 생성된다.

## 증상

유실 델타 복구 중 발견. 델타 레코드 39건을 커밋 SHA로 중복 제거하니 **고유 커밋은
13개**였다. 즉 26건이 같은 커밋에 대한 추가 캡처였다.

## 원인 분석

중복은 두 갈래이고, 하나는 이미 고쳐졌고 하나는 남아 있다.

### (1) 세션 내 중복 — 이미 해소됨

`a217321`이 한 세션(`c5657264`)에서 11회, `8b1ae20`이 3회 캡처됐다. offset은
연속·비중첩으로 이어진다:

```
06:58  1357049 -> 1382763
08:34  1382763 -> 1591955
08:35  1591955 -> 1603921
...    (HEAD 는 계속 a217321)
```

같은 데이터의 재적재가 아니라, **HEAD가 그대로인데 델타 구간만 계속 잘려 쌓인 것**이다.
당시 설치돼 있던 훅이 가드 도입 이전 버전(0.7.x)이었기 때문이다 — 가드를 도입한 커밋이
바로 `a217321`("유령 커밋 기록을 3중 가드로 차단")인데, 그 시점 사용자 캐시는
아직 갱신 전이었다. 현재 캐시는 `0.10.1`(2026-07-28 15:01 설치)이고 가드1이 들어 있어
이 경로는 재현되지 않는다.

### (2) 세션 간 중복 — 미해결 (이 이슈의 본체)

가드1은 커서를 **`session_id`로만** 키잉한다:

```js
const cursors = readJson(CURSORS_PATH(), {}) || {};
const prev = cursors[sessionId] || { offset: 0, uuid: null, commit: null };

if (commit && prev.commit && commit === prev.commit) {
  appendLog("capture", `HEAD 미전진(${commit.slice(0, 7)}) — skip (session=${sessionId})`);
  return;
}
```

커서가 세션별로 독립이므로, **다른 세션이 같은 레포에서 같은 HEAD를 다시 캡처하는 것은
막지 못한다.** 새 세션의 `prev.commit`은 `null`이라 가드1을 그대로 통과한다.

실측 증거 — 같은 커밋이 서로 다른 세션에서 중복 캡처됨:

| 커밋 | 캡처 | 고유 세션 |
|---|---|---|
| `17a2eb3` | 7회 | 2 (`c5657264`, `d39fd705`) |
| `5f8e289` | 3회 | 2 (`9c52e9c9`, `7214b557`) |
| `e494d7d` | 2회 | 2 (`4426b798`, `9c52e9c9`) |

`5f8e289`의 경우 `9c52e9c9`가 05:37에 잡은 뒤, `7214b557`이 05:46·05:50에 같은 HEAD를
`offset 0`부터 다시 잡았다.

## 재현 절차

1. 레포 A에서 세션 1을 열고 커밋한다 → 큐에 델타 1건 적재, 커서 갱신.
2. 같은 레포에서 **새 세션 2**를 연다(커밋하지 않음).
3. 세션 2에서 `git commit`을 포함한 명령을 실행한다(예: 실패하는 커밋, 또는
   `git add . && git commit` 형태로 아무 변경 없이 시도).
4. HEAD는 1단계와 동일한데도 큐에 델타가 한 건 더 쌓인다.

## 수정 방향 (제안)

가드1의 판정 키를 세션이 아니라 **`git_root` + `commit`** 조합으로 넓힌다. 후보:

- **A. 레포별 마지막 캡처 커밋을 별도 커서에 기록**한다. `cursors.json`에
  `repos: { "<git_root>": { last_commit } }` 를 병기하고, 가드1을
  `세션 커서 OR 레포 커서` 중 하나라도 같은 SHA면 skip으로 바꾼다.
  세션별 offset 워터마크는 지금 그대로 유지해야 한다(델타 구간 계산에 필요).
- **B. 큐 적재 직전에 `queue.jsonl` + `processed.jsonl`에서 같은 `commit`이
  이미 있는지 확인**한다. 단순하지만 파일이 커질수록 훅이 무거워져
  "가볍게, 커밋을 막지 않는다"는 훅 계약과 충돌한다 — 비권장.

A안이 훅 경량 계약을 지키면서 세션 경계를 넘는다. 다만 같은 커밋을 의도적으로 두 세션에서
각각 요약하고 싶은 경우가 있는지는 확인이 필요하다(현재로선 없다고 본다 — 델타 구간
단위 설계상 커밋 1개 = 요약 1개가 전제).

## 참고: 함께 관찰된 것 (별건)

- **고아 metrics 사이드카.** `~/.agent-factory/sessions/` 하위에 짝 `.md` 없이
  `*.metrics.json`만 남는 경우가 있다. `push-sessions.mjs`가 `.md`만 스캔하므로
  이 파일들은 전송되지도 정리되지도 않는다. distill이 사이드카를 먼저 쓰고 요약 생성
  전에 중단되면 발생한다.
- **가드3 로그 노이즈.** 커밋과 무관한 Bash 호출마다 훅이 깨어나
  `git commit 아닌 명령에 발동 — skip`을 `errors.jsonl`에 남긴다. 동작은 정상이지만
  정상 skip을 에러 로그에 쌓는 것이라 `if` 게이트 매칭을 좁히거나 로그 레벨을 분리할 여지가 있다.

---

# 대응 (2026-07-29, 0.11.0)

A안을 채택했다. `change-planner`가 낸 실행 계획(`af-capture-cross-session-dedup-001`,
verdict PASS / open_critical 0)을 10스텝으로 수행했다.

## 무엇을 바꿨나

### 1. 레포 스코프 커서 네임스페이스 — `lib/factory-home.mjs`

```js
/**
 * cursors.json 안에서 레포별 마지막 캡처 커밋을 담는 예약 최상위 키.
 * 세션 키(UUID)와 같은 네임스페이스를 쓰므로 이 이름은 세션 키로 절대 쓰지 않는다.
 */
export const CURSORS_REPO_NS = "repos";
```

기존 export의 시그니처는 하나도 건드리지 않았다(순수 additive).

### 2. 가드1b 신설 — `hooks/capture-commit-session.mjs`

가드1(세션 커서) **바로 아래**, 가드2(커밋 최신성)보다 **위**에 배치했다.

```js
const repoCursor = repoCursors[gitRoot];
const repoLastCommit =
  repoCursor && typeof repoCursor === "object" ? repoCursor.last_commit : null;
if (commit && repoLastCommit && commit === repoLastCommit && !forceCapture) {
  appendLog(
    "capture",
    `HEAD 이미 캡처됨(repo:${commit.slice(0, 7)}) — skip ` +
      `(session=${sessionId}, root=${gitRoot}, prev_session=${repoCursor.last_session_id ?? "?"})`,
  );
  return;
}
```

배치 근거: `gitRoot`·`commit`은 앞에서 이미 구해져 있어 **추가 git 호출이 0**이고,
가드2보다 앞에 두면 중복 케이스에서 `git log -1 --format=%ct` 호출조차 생략된다.
로그 문구를 가드1(`HEAD 미전진`)과 다르게 두어 `errors.jsonl`에서 두 원인을 구분해
관측할 수 있다.

**핵심**: 이 가드는 `return`만 하므로 큐 적재·커서 갱신에 도달하지 않는다. 따라서
세션 offset 워터마크가 전진하지 않고, 그 사이 작업 델타는 해당 세션의 다음 진짜
커밋이 온전히 이어받는다 — 작업 유실이 없다.

### 3. 커서 갱신 — 세션 + 레포 양쪽, 쓰기는 여전히 1회

```js
if (commit) {
  repoCursors[gitRoot] = {
    last_commit: commit,
    last_session_id: sessionId,
    updated_at: capturedAt,
  };
  cursors[CURSORS_REPO_NS] = repoCursors;
}
```

`commit`이 빈 문자열(HEAD 조회 실패 엣지)이면 레포 커서를 쓰지 않는다 — 빈 sha로
이후 캡처를 잘못 막지 않기 위함이다. `writeJson`이 false를 반환하면 로그만 남기고
그대로 종료한다(커밋을 막지 않는다). 적재 순서는 기존대로 **큐 append → 커서 write**를
유지했다: 중간 크래시 시 최악이 '중복 1건'이며, 반대 순서였다면 델타 유실이 된다.

### 4. 오탐 탈출구 — `AGENT_FACTORY_FORCE_CAPTURE=1`

같은 HEAD를 의도적으로 다시 캡처해야 할 때 **중복 가드(가드1·가드1b)만** 우회한다.
가드2·가드3(진짜 커밋인지 검증)은 우회되지 않는다 — 유령 커밋 방지는 어떤 경우에도
풀지 않는다. 발동 시 `errors.jsonl`에 `FORCE_CAPTURE` 로그를 남겨 관측 가능하다.
환경변수 미설정 시 동작은 기존과 완전히 동일하다.

### 5. 예약 키 오염 방지

`session_id === "repos"`면 즉시 skip한다. 세션 id는 UUID라 정상 상황에선 발생하지
않지만, 발생하면 `repos` 버킷을 세션 커서로 덮어쓰는 사고가 되므로 원천 차단했다.

## 하위 호환

- `repos` 키가 없는 기존 `cursors.json`에서 시작해도 빈 객체로 출발해 첫 캡처 때
  자연 생성된다. **backfill 스크립트나 파일 재작성은 하지 않는다**(훅 경량 계약).
- 기존 세션 키 항목의 필드(`offset`·`uuid`·`commit`·`updated_at`) 의미·타입 불변.
  `git_root`를 additive로 추가했으나 읽는 쪽이 없다.
- `cursors.json`을 읽는 코드는 이 훅 한 곳뿐임을 전수 확인했다 —
  `scripts/lib/distill/*.mjs`, `scripts/distill-session.mjs`, `hooks/push-sessions.mjs`
  어디에도 `CURSORS_PATH` 참조가 없다. 소비측 수정 불필요.

## 검증 (실측)

임시 git 레포 + `AGENT_FACTORY_HOME=<임시 디렉터리>`로 훅에 stdin JSON을 직접 먹이는
격리 시나리오 7건을 실행했다(실제 `~/.agent-factory`는 건드리지 않음). **전건 통과**:

| # | 시나리오 | 결과 |
|---|---|---|
| 1 | 세션A 캡처 → 세션B 동일 HEAD | 차단됨, `HEAD 이미 캡처됨(repo:)` 로그 확인 |
| 2 | 세션B가 새 커밋 생성 | 정상 적재, `from_offset=0` (워터마크 의미 불변) |
| 3 | `git commit --amend` | 통과 (sha 변경 → 오탐 없음) |
| 4 | rebase 후 커밋 | 통과 |
| 5 | `git worktree` 별도 트리 | 통과 — `rev-parse --show-toplevel`이 워크트리 경로를 반환해 별도 `repos` 키가 됨 (가정 확정) |
| 6 | 레거시 `cursors.json`(세션 키 16개, `repos` 없음) | exit 0, `repos` 자동 생성, 기존 세션 키 전부 보존 |
| 7 | `AGENT_FACTORY_FORCE_CAPTURE=1` | 재캡처 통과, `FORCE_CAPTURE` 로그 확인 |

모든 케이스에서 훅 종료 코드는 0이었다.

저장소 검증기(`node scripts/validate-all.js`)도 4/4 통과했다(매니페스트·에이전트·스킬·
개인경로 유출).

## 훅 계약 준수 확인

| 항목 | 상태 |
|---|---|
| 추가 git 호출 | **0** (가드1b는 이미 구한 `gitRoot`·`commit`만 사용) |
| 추가 파일 I/O | **0** (`cursors.json` write 1회로 불변) |
| LLM 호출 | 없음 |
| 세션 JSONL 통째 읽기 | 없음 (기존 `stat` + 마지막 줄 파싱 유지) |
| 항상 exit 0 | 유지 (try/catch/finally 불변) |

## 남은 갭 (의도적)

- **레포별 첫 1건.** 0.11.0 미만에서 올라오면 `repos`가 비어 있어, 각 레포의 첫 캡처
  1건에 한해 세션 간 중복이 여전히 가능하다. 1회성이므로 backfill 대신 README에
  명시하는 쪽을 택했다.
- **동시 커밋 경쟁.** 두 세션이 같은 순간 `cursors.json`을 read-modify-write 하는
  케이스는 방어하지 않는다(현행과 동일). 최악이 중복 1건이고 훅은 여전히 exit 0이다.
  파일 락은 훅 경량 계약과 상충해 채택하지 않았다.
- **`reset --soft` 후 완전 동일 sha 재생성.** 차단된다. 다만 이 경우 대상이 문자
  그대로 동일한 커밋 객체이고, 세션 워터마크가 전진하지 않아 델타는 다음 실커밋에
  이어진다 — 작업 유실은 없다.

## 이번 변경 범위 밖 (비목표)

- 이미 큐·`processed.jsonl`에 쌓인 과거 중복의 소급 정리 — 별건으로 39건 중 고유
  커밋 13건만 재distill해 복구·전송 완료했다.
- `cursors.json` 세션 키의 무한 증가 프루닝.
- distill 측 중복 병합 로직.

## 변경 파일

| 파일 | 변경 |
|---|---|
| `plugins/agent-factory-plugin/lib/factory-home.mjs` | `CURSORS_REPO_NS` export 추가, 구조 주석 갱신 |
| `plugins/agent-factory-plugin/hooks/capture-commit-session.mjs` | 가드1b, 예약 키 가드, 탈출구, 커서 갱신, 헤더 JSDoc |
| `plugins/agent-factory-plugin/README.md` | cursors 스키마·중복 가드·마이그레이션·탈출구 문서화 |
| `plugins/agent-factory-plugin/.claude-plugin/plugin.json` | `0.10.1` → `0.11.0` (minor: 캡처 동작 변경 + 상태 파일 스키마 확장 + 새 환경변수 인터페이스) |
