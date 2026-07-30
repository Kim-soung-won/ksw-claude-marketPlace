# capture 누락 트러블슈팅 — "처리할 커밋 없음" / 큐가 비어 있음

`session-feedback-summarizer`가 **"처리할 커밋 없음(distill 빈 배열)"**을 반환하거나,
방금 한 `git commit`이 `~/.agent-factory/queue.jsonl`·`processed.jsonl` **어디에도 없을** 때
읽는 문서다. capture 훅은 항상 exit 0 하고 흐름을 막지 않으므로, 누락은 조용히 일어나고
흔적은 `~/.agent-factory/errors.jsonl`에만 남는다.

## 증상

- summarizer가 "처리 커밋 0건 / 생성 파일 0건 / 전송 없음"으로 끝난다.
- git 히스토리엔 커밋이 멀쩡히 있는데 큐·처리로그엔 없다.
- `errors.jsonl`에 `capture … git commit 아닌 명령에 발동 — skip (cmd=…)`이 남아 있고,
  그 `cmd=`가 **실제로는 커밋 명령**이다.

## 원인은 두 층이다 — 반드시 구분한다

### 층 1 (게이트 오분류): `\`+개행으로 이어 붙인 복합 `git add && git commit`

capture 훅의 가드3(`GIT_COMMIT_RE`)은 트리거 Bash 명령이 진짜 `git commit`인지 본다.
셸 줄이음(`\` + 개행)으로 여러 줄에 걸친 복합 명령이 문제였다:

```bash
\
git add a b c && \
git commit -m "…"
```

이 문자열은 앞이 `\`+개행으로 시작하고, `git commit` 바로 앞이 `&& \`+개행이다. 구분자
클래스에 **개행이 없던** 옛 정규식 `/(^|[;&|]\s*)git\s+…commit\b/`은 `&&` 뒤의 ` \`(공백+
백슬래시)에서 `\s*`가 끊겨 매칭에 실패 → 커밋이 아닌 것으로 오판 → skip.

**이 층은 이미 고쳐졌다.** 구분자 클래스에 개행을 넣은
`/(^|[;&|\n]\s*)git\s+(?:…)*commit\b/`(커밋 `75dd9b9`, `883db32`)가 이 형태를 매칭한다.
즉 **저장소 HEAD의 훅 코드에는 이 결함이 없다.**

### 층 2 (진짜 근본 원인): 커밋 시점에 **라이브였던 훅이 캐시된 옛 버전**

관측된 실제 사례에서 층 1의 fix가 저장소엔 있었는데도 누락이 났다. 이유는 **실행된 훅이
저장소 파일이 아니라 플러그인 캐시의 옛 버전**이었기 때문이다.

플러그인은 설치 시 버전별 캐시 디렉터리로 복사된다:

```
~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/hooks/capture-commit-session.mjs
```

커밋 당시 라이브 버전은 층 1 fix **이전**(예: `0.12.4`, 정규식 `[;&|]` — 개행 없음)이었고,
fix가 담긴 버전(`0.12.6`, `[;&|\n]`)은 캐시에 있어도 **로드되지 않은 상태**였다. 훅 파일을
고치고 커밋해도, `/plugin update`(+ 필요 시 `/reload-plugins`)로 **새 버전을 라이브화하기
전까지는 옛 훅이 계속 돈다.** 이 저장소는 명시 버전이 캐시 갱신의 키이므로(루트
`CLAUDE.md` 참조), `plugin.json`의 `version`이 오르고 사용자가 업데이트해야 fix가 실제로 적용된다.

> 요약: **코드로 고칠 회귀가 아니었다.** 이미 고쳐진 fix가 리로드되지 않아 옛 버전이 돈 것이다.

## 진단 순서

1. **errors.jsonl 확인** — 누락된 커밋 시각 근처에 `git commit 아닌 명령에 발동 — skip`이
   있고 그 `cmd=`가 실제 커밋이면 게이트 오분류다(층 1 형태인지 `cmd` 앞부분으로 확인).
   ```bash
   grep 'capture' ~/.agent-factory/errors.jsonl | tail -20
   ```
2. **라이브 훅 vs 저장소 훅의 정규식 비교** — 라이브(캐시) 버전이 fix 이전인지 본다.
   ```bash
   find ~/.claude/plugins -name capture-commit-session.mjs \
     -exec grep -l '\[;&|\]' {} \;      # 개행 없는(옛) 정규식을 가진 사본
   grep -n '\[;&|' plugins/agent-factory-plugin/hooks/capture-commit-session.mjs   # 저장소 HEAD
   ```
   저장소엔 `[;&|\n]`인데 라이브가 `[;&|]`면 층 2(캐시 미갱신)다.
3. **어느 버전이 로드됐나** — `/plugin`으로 활성 버전을 확인하고, `plugin.json`의 `version`과
   비교한다. 다르면 `/plugin update` 후 `/reload-plugins`.

## 복구 — 이미 난 누락 커밋을 큐에 수동 백필

fix를 라이브화해도 **이미 놓친 커밋은 소급 캡처되지 않는다.** 원본 세션 JSONL은 남아
있으므로, 커밋별 델타 창의 바이트 오프셋을 계산해 큐 항목을 직접 만든다. (summarizer는
원본 JSONL을 직접 읽어 digest를 지어내지 않으므로, 큐에 넣어 주어야 처리한다.)

### 1) 각 커밋의 델타 창(바이트 오프셋) 계산

세션 JSONL을 앞에서부터 누적 바이트로 훑어, **각 커밋의 `tool_result`(결과에 `[main <sha>]`가
찍힌 라인)까지의 누적 바이트**를 그 커밋의 `to_offset`으로 삼는다. `from_offset`은 직전
커밋의 `to_offset`(첫 커밋은 0)이다 — 이렇게 하면 훅이 워터마크로 잡았을 "직전 커밋 이후 ~
이번 커밋" 델타와 동일해진다. 커밋 명령 문자열이 아니라 **결과 sha로 라인을 특정**한다
(진단·미리보기 명령이 같은 문자열을 담아 오탐이 나기 때문).

### 2) 큐 항목 스키마 (capture 훅과 동일)

```jsonc
{
  "session_id":   "<세션 UUID>",
  "commit":       "<40자 sha>",
  "commit_message":"<git log -1 --pretty=%B>",
  "jsonl_path":   "<…/projects/<slug>/<session>.jsonl>",
  "from_offset":  0,            // 직전 커밋 to_offset (첫 커밋은 0)
  "from_uuid":    null,         // 직전 커밋 to_uuid (첫 커밋은 null)
  "to_offset":    648122,       // 이 커밋 결과 라인까지 누적 바이트
  "to_uuid":      "<그 라인의 uuid>",
  "cwd":          "<레포 경로>",
  "git_root":     "<레포 루트>",  // 없으면 --all 이 귀속 못 해 큐에 남는다 — 필수
  "shrank":       false,
  "captured_at":  "<커밋 결과 timestamp(ISO)>",
  "processed":    false
}
```

작성한 두 항목을 `~/.agent-factory/queue.jsonl`에 `append`한다(각 항목 1줄 JSON).

### 3) 넣기 전에 읽기 전용으로 검증 (큐를 건드리지 않음)

`--all`/`--drain`은 큐를 **드레인(이동)**하므로 미리 돌리면 안 된다. 단일 구간 모드는 읽기
전용이라 창이 유효한 digest를 내는지 안전하게 확인할 수 있다:

```bash
node scripts/distill-session.mjs "<jsonlPath>" --from-offset 0 --to-offset 648122
# keys 에 event_count·agents·cost_tokens·timeline 등이 채워지면 정상
```

### 4) summarizer 재실행

`session-feedback-summarizer`를 호출하면 백필된 큐를 `--all`로 드레인·distill해 세션 요약과
피드백을 `~/.agent-factory/sessions/<slug>/<commit>.md`에 저장하고, 설정된 push 대상으로 전송한다.

## 예방

- **커밋 명령에 `\`+개행 줄이음을 쓰지 않는다.** `git commit`을 단독 실행하거나, 이어 붙이더라도
  줄이음 없는 한 줄 `&&` 체인으로 둔다. (층 1 fix가 이 형태를 이제 매칭하지만, 단순할수록 안전하다.)
- **훅을 고쳤으면 `plugin.json` `version`을 올리고 `/plugin update` + `/reload-plugins`로 라이브화**
  한다. 저장소 파일 수정만으로는 돌고 있는 옛 캐시 버전이 바뀌지 않는다.
- 가드2(커밋 최신성, 기본 300초 창)는 **실시간 캡처**에만 적용된다 — 단일 구간/큐 백필 경로는
  최신성 검사를 거치지 않으므로 시간이 지난 커밋도 백필로 복구할 수 있다.
