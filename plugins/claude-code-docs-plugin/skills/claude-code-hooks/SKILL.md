---
name: claude-code-hooks
description: >-
  Claude Code hook 설정을 작성·수정·디버그할 때 읽는 기준 문서다.
  settings.json·.claude/settings.json·.claude/settings.local.json·플러그인
  hooks.json의 hooks 블록을 다룰 때, skill/agent frontmatter의 hooks 필드를 구성할 때 참조한다.
  PreToolUse·PostToolUse·UserPromptSubmit·Stop·SessionStart·PermissionRequest·Notification 등
  hook 이벤트, matcher·if 필드, exit code(0/2), stdin JSON 입력, hookSpecificOutput 구조화 출력,
  permissionDecision(allow/deny/ask), additionalContext 주입을 설계할 때 기준이 된다.
  Stop hook 무한 루프, 셸 프로파일 echo로 인한 JSON 파싱 실패, PostToolUse 되돌리기,
  hook 타임아웃, deny/allow 병합 우선순위 같은 증상을 진단할 때 근거 문서로 호출한다.
---

## 한 줄 정의

hook은 Claude Code 라이프사이클의 특정 시점에 실행되는 **사용자 정의 셸 명령**이다.
LLM의 판단에 맡기는 것이 아니라, 조건이 맞으면 **결정론적으로 항상 실행**됨을 보장한다.
로깅·포매팅·권한 게이팅·컨텍스트 주입처럼 "매번 반드시 일어나야 하는" 자동화에 쓴다.

---

## hook 타입 (`type`)

| type | 동작 |
|------|------|
| `command` | (기본) 셸 명령을 실행. stdin으로 이벤트 JSON을 받고, exit code·stdout으로 결과를 낸다 |
| `http` | 지정한 URL로 이벤트 JSON을 POST |
| `mcp_tool` | 연결된 MCP 도구를 호출 |
| `prompt` | 단일 턴 LLM 판정(기본 Haiku). 가볍게 예/아니오 수준의 판단을 위임 |
| `agent` | 멀티턴 검증. 서브에이전트를 spawn해 검증 (실험적) |

---

## 이벤트 라이프사이클

| event | 언제 fire되는가 |
|-------|----------------|
| `SessionStart` | 세션 시작 또는 재개 시 |
| `Setup` | `--init-only` 등 셋업 단계 |
| `UserPromptSubmit` | 사용자 프롬프트가 제출되기 직전 |
| `UserPromptExpansion` | 커맨드 확장 직전 (차단 가능) |
| `PreToolUse` | 도구 실행 직전 (차단 가능) |
| `PermissionRequest` | 권한 다이얼로그가 표시될 때 |
| `PermissionDenied` | auto 분류기가 거부했을 때. `{retry:true}`로 재시도를 지시할 수 있음 |
| `PostToolUse` | 도구가 성공한 후 |
| `PostToolUseFailure` | 도구가 실패한 후 |
| `PostToolBatch` | 병렬 도구 배치가 완료된 후 |
| `Notification` | 알림이 전송될 때 |
| `MessageDisplay` | 어시스턴트 메시지가 표시되는 중 |
| `SubagentStart` / `SubagentStop` | 서브에이전트 spawn / 종료 시 |
| `TaskCreated` / `TaskCompleted` | 태스크 생성 / 완료 시 |
| `Stop` | 응답(턴)이 종료될 때 |
| `StopFailure` | API 에러로 턴이 종료될 때 (출력·exit code 모두 무시됨) |
| `TeammateIdle` | 팀메이트가 유휴 상태가 될 때 |
| `InstructionsLoaded` | CLAUDE.md / `.claude/rules`가 로드될 때 |
| `ConfigChange` | 설정 파일이 변경될 때 |
| `CwdChanged` | 작업 디렉토리가 변경될 때 |
| `FileChanged` | 감시 중인 파일이 변경될 때 (matcher로 파일명 지정) |
| `WorktreeCreate` / `WorktreeRemove` | worktree 생성 / 제거 시 |
| `PreCompact` / `PostCompact` | 컨텍스트 압축 전 / 후 |
| `Elicitation` / `ElicitationResult` | elicitation 요청 / 결과 시 |
| `SessionEnd` | 세션 종료 시 |

---

## 입력 규약 (stdin JSON)

각 hook은 이벤트별 JSON을 **stdin**으로 전달받는다.

**공통 필드**: `session_id`, `cwd`, `hook_event_name`

이벤트별 추가 필드 예:

- `PreToolUse` — `tool_name`, `tool_input`
- `UserPromptSubmit` — `prompt`
- `SessionStart` — `source` (`startup` / `resume` / `clear` / `compact` / `fork`)

---

## 출력 규약 — exit code

| exit code | 의미 |
|-----------|------|
| `0` | 이의 없음. 정상 흐름 진행. `PreToolUse`에서는 승인이 아니라 "권한 흐름을 그대로 둠". `UserPromptSubmit` / `UserPromptExpansion` / `SessionStart`에서는 stdout이 **컨텍스트에 추가**됨 |
| `2` | 차단. stderr가 Claude에게 피드백으로 전달됨. 단 `SessionStart`·`Setup`·`Notification` 등 일부는 차단 불가 — 이 경우 stderr는 **사용자에게만** 표시 |
| 그 외 | 진행하되 오류로 표시 |

---

## 출력 규약 — 구조화 JSON (exit 0 + stdout JSON)

exit 0으로 종료하면서 stdout에 JSON을 출력하면 세밀한 제어가 가능하다.

| event | JSON 형태 |
|-------|-----------|
| `PreToolUse` | `hookSpecificOutput.permissionDecision` = `allow` / `deny` / `ask` (비대화형 `-p`에서는 `defer`) |
| `UserPromptSubmit` | `hookSpecificOutput.additionalContext`로 컨텍스트 주입 (top-level에 두면 무시됨) |
| `PostToolUse` / `Stop` | top-level `decision: "block"` |
| `PermissionRequest` | `hookSpecificOutput.decision.behavior` |

**핵심 규칙**

- `deny` 규칙은 hook의 `allow`보다 **항상 우선**한다.
- exit 2와 JSON 출력을 **섞지 않는다** — exit 2면 JSON은 무시된다.

---

## matcher

matcher가 없으면 해당 이벤트가 발생할 때마다 매번 fire한다. matcher는 이벤트별로
매칭 대상이 다르다.

| event | matcher 값 |
|-------|-----------|
| `PreToolUse` / `PostToolUse` 등 | 도구명 — `Bash`, `Edit\|Write`, `mcp__.*` (v2.1.191+는 콤마도 구분자) |
| `SessionStart` | `startup` / `resume` / `clear` / `compact` / `fork` |
| `Notification` | `permission_prompt` / `idle_prompt` / `auth_success` / `elicitation_*` / `agent_needs_input` / `agent_completed` |
| `ConfigChange` | `user_settings` / `project_settings` / `local_settings` / `policy_settings` / `skills` |

**matcher 미지원 이벤트** (항상 fire): `UserPromptSubmit`, `PostToolBatch`, `Stop`,
`CwdChanged`, `MessageDisplay` 등.

### `if` 필드 — 도구명 + 인자 단위 필터

권한 규칙 문법(예: `Bash(git *)`)으로 도구명뿐 아니라 인자까지 필터링할 수 있다.
`PreToolUse` / `PostToolUse` / `PostToolUseFailure` / `PermissionRequest` /
`PermissionDenied`에서만 지원한다.

---

## 설정 위치와 스코프

| 위치 | 적용 범위 |
|------|-----------|
| `~/.claude/settings.json` | 모든 프로젝트 |
| `.claude/settings.json` | 해당 프로젝트 (커밋 가능) |
| `.claude/settings.local.json` | 해당 프로젝트 (gitignore 대상) |
| 관리 정책 설정 | 조직 전체 |
| 플러그인 `hooks/hooks.json` | 플러그인 번들 |
| skill / agent frontmatter의 `hooks` | 해당 skill·agent 라이프사이클 |

- `/hooks` 메뉴는 **읽기 전용**이다. 편집은 JSON을 직접 수정한다.
- `disableAllHooks: true`로 모든 hook을 비활성화한다.

---

## 병합 / 실행 규칙

- 같은 이벤트에 매칭된 hook들은 **병렬 실행**되고, 완료 후 결과가 병합된다.
- 동일한 명령은 dedupe된다.
- `PreToolUse` 권한 결정은 **가장 제한적인 것 우선**: `deny` > `defer` > `ask` > `allow`.
- `additionalContext`는 전부 합쳐져 전달된다.
- 한 hook의 `deny`가 형제 hook의 실행을 막지는 않는다 (각자 실행되고 결정만 병합).

---

## 타임아웃

| type | 타임아웃 |
|------|----------|
| `command` / `http` / `mcp_tool` | 10분 (단 `UserPromptSubmit`는 30초, `MessageDisplay`는 10초) |
| `prompt` | 30초 |
| `agent` | 60초 |

---

## 자주 겪는 함정 (troubleshooting)

### Stop hook 무한 루프

`Stop` hook은 태스크 완료가 아니라 **Claude 응답이 종료될 때마다** fire한다.
사용자 인터럽트에는 fire하지 않는다. `decision: "block"`으로 계속 차단하면 루프가
생길 수 있어 **연속 8회 차단 시 override**된다. 입력 JSON의 `stop_hook_active`
필드를 확인해 스스로 조기 종료하도록 짠다. 상한은 환경변수
`CLAUDE_CODE_STOP_HOOK_BLOCK_CAP`로 올릴 수 있다.

### 셸 프로파일 echo로 인한 JSON 파싱 실패

셸 프로파일(`.zshrc`·`.bashrc` 등)의 무조건 `echo`가 hook의 JSON 출력 앞에 붙어
파싱이 깨진다. 프로파일의 echo를 인터랙티브 가드로 감싼다:

```bash
case $- in
  *i*) echo "welcome" ;;
esac
```

### PostToolUse는 되돌릴 수 없다

`PostToolUse`는 **이미 실행된** 도구 뒤에 돈다. 도구 실행 자체를 막으려면
`PreToolUse`를 쓴다.

### PermissionRequest는 비대화형에서 안 돈다

`PermissionRequest`는 `-p` 비대화형 실행에서 fire하지 않는다. 비대화형에서도
게이팅이 필요하면 `PreToolUse`를 쓴다.

### 스크립트 실행 준비

- 스크립트에 실행 권한을 준다 (`chmod +x`).
- 경로는 절대경로 또는 `$CLAUDE_PROJECT_DIR`을 사용한다.
