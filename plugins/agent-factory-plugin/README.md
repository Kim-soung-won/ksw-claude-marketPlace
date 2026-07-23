# agent-factory-plugin

커밋을 단위로 **에이전트 사용 과정을 모니터링**하는 소프트웨어 팩토리의 시작 단계.
git commit이 일어난 세션의 델타 구간을 경량 캡처하고, 전처리로 노이즈를 걷어낸 뒤
세션 요약과 에이전트 사용 피드백을 추출·저장한다.

## 파이프라인

```
git commit (Claude가 실행)
  └─ PostToolUse hook: hooks/capture-commit-session.mjs   ← 경량 캡처(항상 exit 0)
        · session_id로 세션 JSONL 특정, 커밋 sha 기록
        · 직전 커밋 워터마크(cursors.json)와의 델타 구간을 queue.jsonl에 적재
        · 커밋 간 중복 오염 없음 (세션이 아니라 "직전 커밋 이후 ~ 이번 커밋"이 단위)
  ↓  (온디맨드)
session-feedback-summarizer 에이전트
  └─ scripts/distill-session.mjs --drain                  ← 결정론적 전처리(토큰 절감 지점)
        · 델타 구간을 요약·피드백에 필요한 신호만 남긴 압축 digest로 변환
        · signature·토큰 장부·파일 덤프·성공 stdout 등 부피 제거
  └─ digest만 읽고 요약 + 사용 피드백 추출
  ↓
.agent-factory/sessions/<commit>.md                        ← 세션 기록 저장
```

## 저장 구조 (커밋된 레포 안 `.agent-factory/`)

| 파일 | 성격 | 버전관리 |
|------|------|----------|
| `sessions/<commit>.md` | 세션 요약·피드백 기록 | **커밋 대상**(팀 공유) |
| `queue.jsonl` | 미처리 델타 큐 | 전이 상태(자동 gitignore) |
| `cursors.json` | 세션별 워터마크 | 전이 상태(자동 gitignore) |
| `processed.jsonl` | 처리 완료 큐 로그 | 전이 상태(자동 gitignore) |

hook이 `.agent-factory/.gitignore`를 최초 생성 시 자동으로 넣어 전이 상태 3종을 제외한다.

## 사용

1. 플러그인을 활성화한다. 이후 Claude가 `git commit`을 실행할 때마다 델타가 자동 캡처된다.
2. 쌓인 세션을 정리하려면 `session-feedback-summarizer`를 호출한다("세션 피드백 정리해줘").

## 의존

- Node.js (세션 JSONL 파싱·전처리). 대상 레포가 프론트엔드 프로젝트라 통상 이미 있다.
- 세션 JSONL 구조의 근거: `claude-code-docs-plugin`의 `claude-code-jsonl` 스킬.
