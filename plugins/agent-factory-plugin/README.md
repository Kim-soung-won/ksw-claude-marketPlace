# agent-factory-plugin

커밋을 단위로 **에이전트 사용 과정을 모니터링**하는 소프트웨어 팩토리의 시작 단계.
git commit이 일어난 세션의 델타 구간을 경량 캡처하고, 전처리로 노이즈를 걷어낸 뒤
세션 요약과 에이전트 사용 피드백을 추출·저장한다.

## 파이프라인

```
git commit (Claude가 실행)
  └─ PostToolUse hook: hooks/capture-commit-session.mjs   ← 경량 캡처(항상 exit 0)
        · 훅 입력의 transcript_path로 세션 JSONL 특정, 커밋 sha 기록
        · 직전 커밋 워터마크와의 델타 구간을 큐에 적재 (git_root를 항목에 포함)
        · 커밋 간 중복 오염 없음 (세션이 아니라 "직전 커밋 이후 ~ 이번 커밋"이 단위)
  ↓  (온디맨드 — "세션 피드백 정리해줘")
session-feedback-summarizer 에이전트
  1) scripts/distill-session.mjs --drain --dir <gitRoot>   ← 결정론적 전처리(토큰 절감 지점)
        · 큐에서 해당 레포 항목만 뽑는다 (다른 레포 것은 큐에 남는다)
        · 델타 구간을 요약·피드백에 필요한 신호만 남긴 압축 digest로 변환
        · timeline 유계화(TIMELINE_LIMIT) + metrics.json 사이드카 저장
  2) digest만 읽고 요약 → ~/.agent-factory/sessions/<projectSlug>/<commit>.md 저장
  3) hooks/push-sessions.mjs 실행                          ← 전송 + 정리
        · 사용자 레벨 sessions 스캔, project_path로 프로젝트 복원해 전송
        · 미전송분(방금 것 + 이전 실패분) 전송, 내용 해시로 중복 회피
        · 전송 성공한 .md·metrics.json만 로컬 삭제(실패분은 남겨 다음에 재시도)
        · 실패는 ~/.agent-factory/errors.jsonl 에 기록
  ↓
Observer 서버 → Postgres → 대시보드
```

**전송·정리를 Stop 훅이 아니라 summarizer 워크플로에서 끝내는 이유**: "정리해줘" 한 번에
요약→전송→로컬 정리까지 완결돼 타이밍이 명확하고(다음 턴 Stop 을 기다리지 않는다),
서버 DB 가 진실의 원천이므로 전송 성공분은 로컬에 남길 이유가 없다. 재시도 안전망은
잃지 않는다 — 실패분은 로컬에 남아 다음 요약 때 push 가 자동 재시도한다. 전송 로직은
에이전트에 인라인하지 않고 `push-sessions.mjs` 스크립트를 호출해 재사용한다.

## 저장 구조 — 레포에는 아무것도 남지 않는다

이 플러그인은 마켓플레이스로 배포돼 임의의 레포에서 돌아간다. 그래서 지키는 규칙이 있다:

> **자기 소유가 아닌 레포에 아무것도 쓰지 않는다.**

세션 요약 `.md`·계량치 `metrics.json`을 포함해 이 플러그인이 만드는 **모든** 파일은
사용자 레벨에 둔다. 팀 공유는 Observer 서버 DB가 담당하므로 레포에 요약을 커밋할 이유가
없다 — 레포 저장은 남의 레포 오염·개인 회고 프라이버시 노출·서버와의 이중 저장·레포 간
분산만 낳는다.

### 사용자 레벨 (`~/.agent-factory/`, 머신당 1벌)

| 파일 | 성격 |
|------|------|
| `config.json` | 서버 접속 설정 (**토큰 포함** — `chmod 600` 권장) |
| `cursors.json` | 세션별 워터마크 |
| `queue.jsonl` | 미처리 델타 큐 (항목마다 `git_root`) |
| `processed.jsonl` | 처리 완료 로그 |
| `state.json` | 업로드 완료 해시 (`<repoPath>::<fileName>` 키) |
| `errors.jsonl` | 파이프라인 실패 로그(capture·distill·push). 흐름은 안 막고 진단만 — 전송이 안 되면 여기부터 본다 |
| `sessions/<projectSlug>/<commit>.md` | 세션 요약·피드백 기록 (전송 성공 시 삭제) |
| `sessions/<projectSlug>/<sha7>.metrics.json` | 기계 정밀 계량치 (전송 성공 시 삭제) |

`<projectSlug>`는 레포 경로 기반 결정론적 슬러그(`<basename>-<경로해시8>`)라, 레포별로
하위 디렉터리가 갈려 레포 간 sha7 충돌이 없다. 파일이 레포 밖에 있으므로 각 기록은
`metrics.json`·`.md` frontmatter에 `project_path`를 담아 어느 프로젝트 것인지 스스로 밝힌다.

`AGENT_FACTORY_HOME` 으로 위치를 바꿀 수 있다(테스트·격리용).

**레포에 아무것도 두지 않는 이유**: 훅이 남의 레포에 `.gitignore`를 대신 써 줄 이유가
없어지고, 토큰도 worktree 밖에 있어 새지 않는다(자동 gitignore는 `git add -f`·전역
gitignore 충돌·서브모듈 규칙 차이에서 새는 완화책일 뿐이다).

## 업로드 설정

`~/.agent-factory/config.json` 하나면 모든 레포에 적용된다:

```bash
mkdir -p ~/.agent-factory
cat > ~/.agent-factory/config.json <<'EOF'
{ "apiBase": "http://localhost:3001", "token": "<서버 AUTH_TOKEN 과 같은 값>" }
EOF
chmod 600 ~/.agent-factory/config.json
```

`OBSERVER_API_BASE` / `OBSERVER_TOKEN` 환경변수가 이 파일을 덮어쓴다(CI·일회성 override용).
다만 환경변수만 쓰는 것은 권하지 않는다 — GUI로 뜬 Claude Code는 셸 프로필을 상속받지
못할 수 있어, 터미널에선 되고 앱에선 조용히 무동작한다.

설정이 없으면 업로드 단계만 건너뛴다(캡처·요약은 그대로 동작).

### 예전 버전에서 올라온 경우

레포 안의 `.agent-factory/` 에 남은 파일들은 더 이상 쓰이지 않으니 지워도 된다:

- 전이 상태(`queue.jsonl`·`cursors.json`·`processed.jsonl`·`pushed.json`·`observer.json`·
  `.gitignore`) — 0.2.x 이하에서 레포에 두던 것. 이제 사용자 레벨로 옮겨졌다.
- **세션 기록·계량치(`sessions/<sha>.md`·`sessions/<sha>.metrics.json`)** — 0.4.x 이하에서
  레포에 두던 것. 0.5.0부터 사용자 레벨(`~/.agent-factory/sessions/<projectSlug>/`)에 쌓인다.

자동 마이그레이션은 하지 않는다(새 기록부터 새 위치에 쌓인다). 워터마크·업로드 상태가
초기화되더라도 다음 커밋이 좀 더 큰 델타를 잡거나 서버가 내용 해시로 `unchanged` 처리해
자연히 수렴한다.

## 사용

1. 플러그인을 활성화한다. 이후 Claude가 `git commit`을 실행할 때마다 델타가 자동 캡처된다.
2. 쌓인 세션을 정리하려면 `session-feedback-summarizer`를 호출한다("세션 피드백 정리해줘").

## 의존

- Node.js (세션 JSONL 파싱·전처리). 대상 레포가 프론트엔드 프로젝트라 통상 이미 있다.
- 세션 JSONL 구조의 근거: `claude-code-docs-plugin`의 `claude-code-jsonl` 스킬.
