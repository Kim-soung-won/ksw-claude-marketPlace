# subagent-docs — 기능 제어 — 도구, 권한 모드, MCP, 메모리, skills 미리 로드, hook

> 출처: https://code.claude.com/docs/ko/sub-agents (Claude Code 공식 문서, 2026-07-02 스냅샷)
> 이 파일은 `subagent-docs/index.md`에서 분리된 하위 문서다. 전체 목차와
> 자주 쓰는 필드 요약은 index.md를 먼저 확인한다.

---

### Subagent 기능 제어

#### 사용 가능한 도구

Subagent는 기본적으로 주 대화에서 사용 가능한 내부 도구 및 MCP 도구를 상속합니다.
`tools`(허용 목록) 또는 `disallowedTools`(거부 목록)로 제한합니다.

```yaml
---
name: safe-researcher
description: Research agent with restricted capabilities
tools: Read, Grep, Glob, Bash
---
```

```yaml
---
name: no-writes
description: Inherits every tool except file writes
disallowedTools: Write, Edit
---
```

둘 다 설정되면 `disallowedTools`가 먼저 적용되고 `tools`가 남은 풀에 대해 해결됩니다.

두 필드 모두 MCP 서버 수준 패턴을 허용합니다: `mcp__<server>` 또는 `mcp__<server>__*`는
명명된 서버의 모든 도구를 부여/제거. `disallowedTools`에서 `mcp__*`는 모든 서버의 모든
MCP 도구를 제거합니다.

```yaml
---
name: local-only
description: Inherits every tool except those from the github MCP server
disallowedTools: mcp__github
---
```

#### 생성할 수 있는 subagent 제한

`claude --agent`로 주 스레드로 실행될 때 Agent 도구로 subagent를 생성할 수 있습니다.
`tools` 필드의 `Agent(agent_type)` 구문으로 허용 목록을 지정합니다(v2.1.63부터 Task →
Agent로 이름 변경, 기존 `Task(...)` 참조는 별칭으로 계속 동작).

```yaml
---
name: coordinator
description: Coordinates work across specialized agents
tools: Agent(worker, researcher), Read, Bash
---
```

제한 없이 모두 허용하려면 괄호 없이 `Agent`. `tools` 목록에서 `Agent`를 완전히 생략하면
subagent를 생성할 수 없습니다. 이 구문은 `claude --agent`로 주 스레드로 실행되는
에이전트에만 적용됩니다; subagent 정의의 `tools`에 `Agent`를 나열하면 중첩 subagent
생성이 가능하지만 괄호 내 유형 목록은 무시됩니다.

#### Subagent에 MCP 서버 범위 지정

`mcpServers` 필드로 주 대화에서 사용할 수 없는 MCP 서버 접근 권한을 부여합니다. 인라인
정의는 subagent 시작 시 연결, 완료 시 연결 해제됩니다. 문자열 참조는 부모 세션 연결을
공유합니다.

```yaml
---
name: browser-tester
description: Tests features in a real browser using Playwright
mcpServers:
  - playwright:
      type: stdio
      command: npx
      args: ["-y", "@playwright/mcp@latest"]
  - github
---
```

인라인 정의는 `.mcp.json` 서버 항목(`stdio`, `http`, `sse`, `ws`)과 동일한 스키마를
사용하며 서버 이름으로 키가 지정됩니다.

`mcpServers` 필드는 Agent 도구/@-mention으로 생성된 subagent와, `--agent` 또는 `agent`
설정으로 시작된 주 세션 양쪽에 적용됩니다.

(v2.1.153+) 주 세션에 적용되는 MCP 제한(`--strict-mcp-config`, `--bare`, Enterprise 관리
MCP 구성, `allowedMcpServers`/`deniedMcpServers` 정책)은 subagent frontmatter에서
선언된 서버도 포함합니다. 차단되면 건너뛰고 경고를 표시합니다. `--strict-mcp-config`는
`--agents` 또는 SDK `agents` 옵션으로 인라인 전달하는 서버는 필터링하지 않습니다(명시적
호출자 입력이므로).

#### 권한 모드

`permissionMode` 필드는 subagent가 권한 프롬프트를 처리하는 방식을 제어합니다.

| 모드 | 동작 |
|---|---|
| `default` | 프롬프트를 사용한 표준 권한 확인 |
| `acceptEdits` | 파일 편집 및 작업 디렉토리/`additionalDirectories` 경로에 대한 일반적인 파일시스템 명령 자동 수락 |
| `auto` | Auto mode: 백그라운드 분류기가 명령을 검토, 보호된 디렉토리 쓰기 등 처리 |
| `dontAsk` | 권한 프롬프트 자동 거부(명시적으로 허용된 도구는 여전히 작동) |
| `bypassPermissions` | 권한 프롬프트 건너뛰기 |
| `plan` | Plan mode(읽기 전용 탐색) |

> `bypassPermissions`는 주의해서 사용. 승인 없이 `.git`, `.config/git`, `.claude`,
> `.vscode`, `.idea`, `.husky`, `.cargo`, `.devcontainer`, `.yarn`, `.mvn` 등에 대한
> 쓰기를 포함해 작업을 실행할 수 있음. 명시적 `ask` 규칙 및 루트/홈 디렉토리 제거(예:
> `rm -rf /`)는 여전히 프롬프트됨.

부모가 `bypassPermissions` 또는 `acceptEdits`를 사용하면 우선하며 재정의 불가. 부모가
auto mode면 subagent는 auto mode를 상속하고 frontmatter의 `permissionMode`는 무시됨.

#### Subagent에 skills 미리 로드

`skills` 필드로 시작 시 subagent 컨텍스트에 skill 콘텐츠를 주입합니다.

```yaml
---
name: api-developer
description: Implement API endpoints following team conventions
skills:
  - api-conventions
  - error-handling-patterns
---

Implement API endpoints. Follow the conventions and patterns from the preloaded skills.
```

각 skill의 전체 콘텐츠가 주입됩니다. 이 필드가 없어도 subagent는 실행 중 Skill 도구로
프로젝트/사용자/플러그인 skills를 여전히 검색·호출 가능. 완전히 막으려면 `tools`에서
`Skill`을 생략하거나 `disallowedTools`에 추가. `disable-model-invocation: true`인
skills는 미리 로드할 수 없습니다.

#### 지속적 메모리 활성화

`memory` 필드는 subagent에 대화 간 유지되는 지속적 디렉토리를 제공합니다.

```yaml
---
name: code-reviewer
description: Reviews code for quality and best practices
memory: user
---

You are a code reviewer. As you review code, update your agent memory with
patterns, conventions, and recurring issues you discover.
```

| 범위 | 위치 | 사용 시기 |
|---|---|---|
| `user` | `~/.claude/agent-memory/<name-of-agent>/` | 모든 프로젝트 간 학습을 기억해야 할 때 |
| `project` | `.claude/agent-memory/<name-of-agent>/` | 프로젝트별이고 버전 제어로 공유 가능할 때 |
| `local` | `.claude/agent-memory-local/<name-of-agent>/` | 프로젝트별이지만 버전 제어에 체크인하지 않아야 할 때 |

메모리 활성화 시: 시스템 프롬프트에 메모리 읽기/쓰기 지침 포함, `MEMORY.md`의 처음
200줄/25KB 포함(초과 시 큐레이션 지침 포함), Read/Write/Edit 도구 자동 활성화.

팁: `project`가 권장 기본 범위. 작업 시작 전/완료 후 메모리 확인·업데이트를 명시적으로
요청. Subagent의 markdown 파일에 메모리 유지 지침을 직접 포함 가능.

#### Hook을 사용한 조건부 규칙

`PreToolUse` hook으로 실행 전 작업을 검증합니다.

```yaml
---
name: db-reader
description: Execute read-only database queries
tools: Bash
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-readonly-query.sh"
---
```

Hook 입력은 JSON으로 stdin을 통해 전달됩니다. 검증 스크립트가 쓰기 작업을 감지하면
종료 코드 2로 종료해 차단합니다:

```bash
#!/bin/bash
# ./scripts/validate-readonly-query.sh

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty')

if echo "$COMMAND" | grep -iE '\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE)\b' > /dev/null; then
  echo "Blocked: Only SELECT queries are allowed" >&2
  exit 2
fi

exit 0
```

Windows에서는 PowerShell로 작성하고 hook 항목에 `shell: powershell`을 추가합니다.

#### 특정 subagent 비활성화

설정의 `deny` 배열에 `Agent(subagent-name)` 형식으로 추가:

```json
{
  "permissions": {
    "deny": ["Agent(Explore)", "Agent(my-custom-agent)"]
  }
}
```

내장/사용자 정의 subagent 모두에 작동. `--disallowedTools "Agent(Explore)"` CLI 플래그도
가능.

### Subagent에 대한 hook 정의

두 가지 방법:

- **Subagent frontmatter에서**: 해당 subagent가 활성화된 동안만 실행, 완료 시 정리
- **`settings.json`에서**: subagent가 시작/중지될 때 주 세션에서 실행

#### Subagent frontmatter의 hook

Agent 도구/@-mention으로 생성될 때, 또는 `--agent`/`agent` 설정으로 주 세션 실행될 때
발생. 주 세션인 경우 `settings.json`에 정의된 hook과 함께 실행됩니다.

| 이벤트 | Matcher 입력 | 실행 시기 |
|---|---|---|
| `PreToolUse` | 도구 이름 | subagent가 도구를 사용하기 전 |
| `PostToolUse` | 도구 이름 | subagent가 도구를 사용한 후 |
| `Stop` | (없음) | subagent가 완료될 때(런타임에 `SubagentStop`으로 변환) |

```yaml
---
name: code-reviewer
description: Review code changes with automatic linting
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-command.sh $TOOL_INPUT"
  PostToolUse:
    - matcher: "Edit|Write"
      hooks:
        - type: command
          command: "./scripts/run-linter.sh"
---
```

#### Subagent 이벤트에 대한 프로젝트 수준 hook

`settings.json`에서 `SubagentStart`/`SubagentStop` 이벤트를 구성합니다. Matcher 값은
프로젝트/사용자 subagent의 경우 frontmatter `name`, 플러그인 subagent의 경우
`my-plugin:db-agent`와 같은 범위 지정 식별자입니다. 콜론 포함 시 고정되지 않은 정규식으로
평가되므로 `^my-plugin:db-agent$`처럼 고정해야 합니다.

```json
{
  "hooks": {
    "SubagentStart": [
      {
        "matcher": "db-agent",
        "hooks": [
          { "type": "command", "command": "./scripts/setup-db-connection.sh" }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          { "type": "command", "command": "./scripts/cleanup-db-connection.sh" }
        ]
      }
    ]
  }
}
```

하이픈 있는 matcher는 v2.1.195+에서 정확히 일치. 이전 버전에서는 `^db-agent$`처럼
고정 필요.


---

## 관련 파일

- [index.md](index.md) — 전체 목차, 내장 subagent 요약, frontmatter 필드 이름 목록, 라우팅 표
- [scope-and-fields.md](scope-and-fields.md)
- [invocation-and-lifecycle.md](invocation-and-lifecycle.md)
- [examples.md](examples.md)
