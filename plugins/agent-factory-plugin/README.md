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
  ↓  (온디맨드)
session-feedback-summarizer 에이전트
  └─ scripts/distill-session.mjs --drain --dir <gitRoot>  ← 결정론적 전처리(토큰 절감 지점)
        · 큐에서 해당 레포 항목만 뽑는다 (다른 레포 것은 큐에 남는다)
        · 델타 구간을 요약·피드백에 필요한 신호만 남긴 압축 digest로 변환
        · signature·토큰 장부·파일 덤프·성공 stdout 등 부피 제거
  └─ digest만 읽고 요약 + 사용 피드백 추출
  ↓
.agent-factory/sessions/<commit>.md                        ← 세션 기록 저장
  ↓
Stop hook: hooks/push-sessions.mjs                         ← 미전송분만 업로드
     · 내용 해시로 이미 보낸 파일은 건너뜀 (~/.agent-factory/state.json)
     · 설정이 없거나 서버가 죽어 있으면 조용히 넘어감 (항상 exit 0)
  ↓
Observer 서버 → Postgres → 대시보드
```

업로드 시점이 커밋이 아니라 **세션 종료(Stop)**인 이유: 요약 `.md`는 summarizer가
커밋보다 나중에 쓰므로 커밋 훅에서는 아직 보낼 것이 없다. 또한 커밋 훅에 네트워크
I/O를 얹으면 "가볍고 커밋을 막지 않는다"는 그 훅의 규칙이 깨진다.

## 저장 구조 — 레포에는 산출물만 남는다

이 플러그인은 마켓플레이스로 배포돼 임의의 레포에서 돌아간다. 그래서 지키는 규칙이 있다:

> **자기 소유가 아닌 레포에 추적되지 않는 파일을 쓰지 않는다.**

### 작업 레포

| 경로 | 성격 | 버전관리 |
|------|------|----------|
| `.agent-factory/sessions/<commit>.md` | 세션 요약·피드백 기록 | **커밋 대상**(팀 공유) |

이게 전부다. 전이 상태도 설정도 레포에 두지 않으므로 훅이 `.gitignore`를 대신
써 줄 이유가 없다.

### 사용자 레벨 (`~/.agent-factory/`, 머신당 1벌)

| 파일 | 성격 |
|------|------|
| `config.json` | 서버 접속 설정 (**토큰 포함** — `chmod 600` 권장) |
| `cursors.json` | 세션별 워터마크 |
| `queue.jsonl` | 미처리 델타 큐 (항목마다 `git_root`) |
| `processed.jsonl` | 처리 완료 로그 |
| `state.json` | 업로드 완료 해시 (`<repoPath>::<fileName>` 키) |

`AGENT_FACTORY_HOME` 으로 위치를 바꿀 수 있다(테스트·격리용).

**토큰을 레포에 두지 않는 이유**: 자동 gitignore는 완화책이지 방지책이 아니다.
`git add -f`, 전역 gitignore 충돌, 모노레포·서브모듈의 ignore 규칙 차이 어디서든 샌다.

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

### 0.2.x 에서 올라온 경우

레포 안의 `.agent-factory/` 에 남은 `queue.jsonl`·`queue.retry.jsonl`·`cursors.json`·
`processed.jsonl`·`pushed.json`·`observer.json`·`.gitignore` 는 더 이상 쓰이지 않는다.
지워도 된다
(워터마크가 초기화되면 다음 커밋이 좀 더 큰 델타를 잡고, 업로드 상태가 초기화되면
서버가 내용 해시로 `unchanged` 처리하므로 둘 다 자연히 수렴한다).

## 사용

1. 플러그인을 활성화한다. 이후 Claude가 `git commit`을 실행할 때마다 델타가 자동 캡처된다.
2. 쌓인 세션을 정리하려면 `session-feedback-summarizer`를 호출한다("세션 피드백 정리해줘").

## 의존

- Node.js (세션 JSONL 파싱·전처리). 대상 레포가 프론트엔드 프로젝트라 통상 이미 있다.
- 세션 JSONL 구조의 근거: `claude-code-docs-plugin`의 `claude-code-jsonl` 스킬.
