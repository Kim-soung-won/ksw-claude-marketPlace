# 사용자 정의 subagent 만들기

> 출처: https://code.claude.com/docs/ko/sub-agents (Claude Code 공식 문서, 2026-07-02 스냅샷)
> 전체 문서 인덱스: https://code.claude.com/docs/llms.txt

Claude Code에서 작업별 워크플로우 및 향상된 컨텍스트 관리를 위한 특화된 AI subagent를
만들고 사용합니다.

Subagent는 특정 유형의 작업을 처리하는 특화된 AI 어시스턴트입니다. 부작업이 검색 결과,
로그 또는 다시 참조하지 않을 파일 콘텐츠로 주 대화를 넘칠 때 하나를 사용하세요: subagent는
자신의 컨텍스트에서 해당 작업을 수행하고 요약만 반환합니다. 동일한 지침으로 동일한 종류의
워커를 계속 생성할 때 사용자 정의 subagent를 정의합니다.

각 subagent는 자체 컨텍스트 윈도우에서 실행되며 사용자 정의 시스템 프롬프트, 특정 도구
액세스 및 독립적인 권한을 가집니다. Claude가 subagent의 설명과 일치하는 작업을 만나면
해당 subagent에 위임하고, subagent는 독립적으로 작동하여 결과를 반환합니다.

> Subagent는 단일 세션 내에서 작동합니다. 많은 독립적인 세션을 병렬로 실행하고 한 곳에서
> 모니터링하려면 background agents를 참조하세요. 서로 통신하는 세션의 경우 agent teams를
> 참조하세요.

Subagent는 다음을 도와줍니다:

- **컨텍스트 보존** - 탐색 및 구현을 주 대화에서 분리하여 유지
- **제약 조건 적용** - subagent가 사용할 수 있는 도구 제한
- **구성 재사용** - 사용자 수준 subagent를 통해 프로젝트 간 구성 재사용
- **동작 특화** - 특정 도메인을 위한 집중된 시스템 프롬프트
- **비용 제어** - Haiku와 같은 더 빠르고 저렴한 모델로 작업 라우팅

Claude는 각 subagent의 설명을 사용하여 작업을 위임할 시기를 결정합니다. Subagent를 만들
때 Claude가 언제 사용할지 알 수 있도록 명확한 설명을 작성하세요.

Claude Code에는 **Explore**, **Plan**, **general-purpose**와 같은 여러 내장 subagent가
포함되어 있습니다. 특정 작업을 처리하기 위해 사용자 정의 subagent를 만들 수도 있습니다.

## 내장 subagent

Claude Code에는 Claude가 적절할 때 자동으로 사용하는 내장 subagent가 포함되어 있습니다.
각각은 추가 도구 제한이 있는 부모 대화의 권한을 상속합니다.

Explore와 Plan은 연구를 빠르고 저렴하게 유지하기 위해 CLAUDE.md 파일과 부모 세션의 git
상태를 건너뜁니다. 다른 모든 내장 및 사용자 정의 subagent는 둘 다 로드합니다.

### Explore

코드베이스 검색 및 분석에 최적화된 빠른 읽기 전용 에이전트입니다.

- **모델**: Haiku (빠름, 낮은 지연시간)
- **도구**: 읽기 전용 도구 (Write 및 Edit 도구에 대한 액세스 거부)
- **목적**: 파일 검색, 코드 검색, 코드베이스 탐색

Claude는 변경 없이 코드베이스를 검색하거나 이해해야 할 때 Explore에 위임합니다. 이렇게
하면 탐색 결과가 주 대화 컨텍스트에서 벗어납니다.

Explore를 호출할 때 Claude는 철저함 수준을 지정합니다: 대상 조회의 경우 **quick**, 균형
잡힌 탐색의 경우 **medium**, 포괄적인 분석의 경우 **very thorough**.

### Plan

plan mode 중에 계획을 제시하기 전에 컨텍스트를 수집하는 데 사용되는 연구 에이전트입니다.

- **모델**: 주 대화에서 상속
- **도구**: 읽기 전용 도구 (Write 및 Edit 도구에 대한 액세스 거부)
- **목적**: 계획을 위한 코드베이스 연구

plan mode에 있고 Claude가 코드베이스를 이해해야 할 때 연구를 Plan subagent에 위임하므로
탐색 출력이 별도의 컨텍스트 윈도우에 유지되고 주 대화는 읽기 전용으로 유지됩니다.

### General-purpose

탐색과 작업 모두를 필요로 하는 복잡한 다단계 작업을 위한 유능한 에이전트입니다.

- **모델**: 주 대화에서 상속
- **도구**: 모든 도구
- **목적**: 복잡한 연구, 다단계 작업, 코드 수정

Claude는 작업이 탐색과 수정 모두를 필요로 하거나, 결과를 해석하기 위한 복잡한 추론이
필요하거나, 여러 종속 단계가 필요할 때 general-purpose에 위임합니다.

### 기타 내장 에이전트

Claude Code에는 특정 작업을 위한 추가 도우미 에이전트가 포함되어 있습니다. 이들은
일반적으로 자동으로 호출되므로 직접 사용할 필요가 없습니다.

| 에이전트 | 모델 | Claude가 사용하는 경우 |
|---|---|---|
| statusline-setup | Sonnet | `/statusline`을 실행하여 상태 표시줄을 구성할 때 |
| claude-code-guide | Haiku | Claude Code 기능에 대한 질문을 할 때 |

내장 subagent는 항상 대화형 세션에 등록됩니다. 특정 내장 유형을 차단하려면:

- 특정 내장 유형을 차단하려면 `permissions.deny`에 `Agent(agent-name)` 형식으로 추가
- Claude가 어떤 subagent에도 위임하는 것을 방지하려면 `permissions.deny`를 사용하여
  `Agent` 도구 자체를 거부
- 비대화형 모드 및 Agent SDK에서는 `CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1`을 설정하여
  모든 내장 유형을 제거하고 자신의 것만 제공

## 빠른 시작: 첫 번째 subagent 만들기

Subagent는 YAML frontmatter가 있는 Markdown 파일로 정의됩니다. 수동으로 만들거나
`/agents` 명령을 사용할 수 있습니다.

`/agents` 명령을 실행하면:

1. **Library** 탭으로 전환하고 **Create new agent** → **Personal** 선택
   (`~/.claude/agents/`에 저장, 모든 프로젝트에서 사용 가능)
2. **Generate with Claude** 선택 후 subagent를 자연어로 설명하면 Claude가 식별자, 설명,
   시스템 프롬프트를 생성
3. 도구 선택 (읽기 전용 검토자면 Read-only tools만 남기고 나머지 선택 해제; 모든 도구를
   선택하면 주 대화의 모든 도구를 상속)
4. 모델 선택 (Sonnet/Opus/Haiku/Fable 등)
5. 표시 색상 선택
6. 메모리 범위 선택 (User scope 선택 시 `~/.claude/agent-memory/`에 지속적 메모리 제공,
   원치 않으면 None)
7. 저장 후 즉시 사용 가능

Markdown 파일로 수동으로 만들거나, CLI 플래그를 통해 정의하거나, 플러그인을 통해 배포할
수도 있습니다.

## Subagent 구성

### /agents 명령 사용

`/agents` 명령은 subagent를 관리하기 위한 탭 인터페이스를 엽니다.

- **Running** 탭: 라이브 및 최근에 완료된 subagent를 나열, 열거나 중지 가능
- **Library** 탭: 사용 가능한 모든 subagent 보기(내장/사용자/프로젝트/플러그인), 새
  subagent 만들기, 기존 subagent 구성 편집, 삭제, 중복 확인

### Subagent 범위 선택

Subagent는 YAML frontmatter가 있는 Markdown 파일입니다. 범위에 따라 다른 위치에
저장합니다. 여러 subagent가 같은 이름을 공유할 때 더 높은 우선순위 위치가 우선합니다.

| 위치 | 범위 | 우선순위 | 만드는 방법 |
|---|---|---|---|
| 관리되는 설정 | 조직 전체 | 1 (최고) | 관리되는 설정을 통해 배포 |
| `--agents` CLI 플래그 | 현재 세션 | 2 | Claude Code 시작 시 JSON 전달 |
| `.claude/agents/` | 현재 프로젝트 | 3 | 대화형 또는 수동 |
| `~/.claude/agents/` | 모든 프로젝트 | 4 | 대화형 또는 수동 |
| 플러그인의 `agents/` 디렉토리 | 플러그인이 활성화된 위치 | 5 (최저) | 플러그인과 함께 설치 |

**프로젝트 subagent** (`.claude/agents/`)는 코드베이스에 특정한 subagent에 이상적이며
버전 제어에 체크인해 팀이 협업할 수 있습니다. 현재 작업 디렉토리에서 위로 이동하며 저장소
루트까지의 모든 `.claude/agents/`가 스캔됩니다. 동일한 `name`을 정의하는 중첩 디렉토리가
여러 개면 작업 디렉토리에 가장 가까운 정의가 사용됩니다(v2.1.178+).

`--add-dir`로 추가된 디렉토리 내의 `.claude/agents/`도 프로젝트 subagent와 함께 로드됩니다.

**사용자 subagent** (`~/.claude/agents/`)는 모든 프로젝트에서 사용 가능한 개인 subagent
입니다.

`.claude/agents/` 및 `~/.claude/agents/`는 재귀적으로 스캔되므로 하위 폴더로 구성할 수
있습니다. 하위 디렉토리 경로는 식별/호출 방식에 영향을 주지 않습니다(ID는 `name`
frontmatter 필드에서만 나옴). 전체 트리에서 `name` 값을 고유하게 유지해야 하며, 같은
범위 내 두 파일이 같은 이름을 선언하면 하나만 로드됩니다.

플러그인 `agents/` 디렉토리도 재귀적으로 스캔되지만, 하위 폴더는 범위가 지정된 식별자의
일부가 됩니다. 예: 플러그인 `my-plugin`의 `agents/review/security.md`는
`my-plugin:review:security`로 등록됩니다.

**CLI 정의 subagent**는 `claude --agents '{...}'` JSON으로 세션에만 존재하며 디스크에
저장되지 않습니다. `description`, `prompt`, `tools`, `disallowedTools`, `model`,
`permissionMode`, `mcpServers`, `hooks`, `maxTurns`, `skills`, `initialPrompt`,
`memory`, `effort`, `background`, `isolation`, `color` 필드를 지원합니다(`prompt`가
markdown body에 해당).

**관리되는 subagent**는 조직 관리자가 관리되는 설정 디렉토리 내 `.claude/agents/`에
배포하며, 같은 이름의 프로젝트/사용자 subagent보다 우선합니다.

**플러그인 subagent**는 설치한 플러그인에서 제공되며 `/agents`에서 사용자 정의 subagent와
함께 나타납니다. 보안상 플러그인 subagent는 `hooks`, `mcpServers`, `permissionMode`
frontmatter 필드를 지원하지 않습니다(로드 시 무시됨). 필요하면 `.claude/agents/` 또는
`~/.claude/agents/`로 파일을 복사합니다.

### Subagent 파일 작성

```markdown
---
name: code-reviewer
description: Reviews code for quality and best practices
tools: Read, Glob, Grep
model: sonnet
---

You are a code reviewer. When invoked, analyze the code and provide
specific, actionable feedback on quality, security, and best practices.
```

> Subagent는 세션 시작 시 로드됩니다. 디스크에서 파일을 직접 추가/편집하면 세션을
> 다시 시작해야 로드됩니다. `/agents` 인터페이스를 통해 생성하면 즉시 적용됩니다.

Frontmatter는 메타데이터와 구성을, 본문은 시스템 프롬프트를 정의합니다. Subagent는 이
시스템 프롬프트만 받으며(작업 디렉토리 등 기본 환경 세부 정보 포함), 전체 Claude Code
시스템 프롬프트는 받지 않습니다.

Subagent는 주 대화의 현재 작업 디렉토리에서 시작합니다. Subagent 내 `cd` 명령은 Bash/
PowerShell 도구 호출 간 유지되지 않으며 주 대화의 작업 디렉토리에 영향을 주지 않습니다.
저장소의 격리된 복사본이 필요하면 `isolation: worktree`를 설정합니다.

### 지원되는 frontmatter 필드

`name`과 `description`만 필수입니다.

| 필드 | 필수 | 설명 |
|---|---|---|
| `name` | 예 | 소문자 및 하이픈을 사용한 고유 식별자. Hooks는 이 값을 `agent_type`으로 받음. 파일 이름이 일치할 필요 없음 |
| `description` | 예 | Claude가 이 subagent에 위임해야 할 때를 설명 |
| `tools` | 아니오 | subagent가 사용할 도구. 생략하면 모든 도구 상속. Skills를 미리 로드하려면 `Skill`을 나열하는 대신 `skills` 필드 사용 |
| `disallowedTools` | 아니오 | 거부할 도구, 상속되거나 지정된 목록에서 제거됨 |
| `model` | 아니오 | `sonnet`, `opus`, `haiku`, `fable`, 전체 모델 ID, 또는 `inherit`. 기본값: `inherit` |
| `permissionMode` | 아니오 | `default`, `acceptEdits`, `auto`, `dontAsk`, `bypassPermissions`, `plan`. 플러그인 subagent에서는 무시됨 |
| `maxTurns` | 아니오 | subagent가 중지되기 전 최대 에이전트 턴 수 |
| `skills` | 아니오 | 시작 시 컨텍스트에 로드할 Skills. 전체 콘텐츠가 주입됨(호출 가능하게 만드는 것 아님). 목록에 없는 skill도 Skill 도구로 여전히 호출 가능 |
| `mcpServers` | 아니오 | 이 subagent에서 사용 가능한 MCP servers. 문자열 참조(이미 구성된 서버) 또는 인라인 정의. 플러그인 subagent에서는 무시됨 |
| `hooks` | 아니오 | 이 subagent로 범위가 지정된 라이프사이클 hooks. 플러그인 subagent에서는 무시됨 |
| `memory` | 아니오 | 지속적 메모리 범위: `user`, `project`, `local`. 교차 세션 학습 활성화 |
| `background` | 아니오 | 항상 background task로 실행하려면 `true`. 기본값: `false` |
| `effort` | 아니오 | 활성화 시 노력 수준(세션 노력 수준 재정의): `low`, `medium`, `high`, `xhigh`, `max` |
| `isolation` | 아니오 | `worktree`로 설정 시 임시 git worktree에서 실행, 격리된 저장소 복사본 제공. 기본 분기에서 분기됨(부모 HEAD 아님). 변경 없으면 자동 정리 |
| `color` | 아니오 | 표시 색상: `red`, `blue`, `green`, `yellow`, `purple`, `orange`, `pink`, `cyan` |
| `initialPrompt` | 아니오 | 이 에이전트가 주 세션 에이전트로 실행될 때(`--agent` 또는 `agent` 설정) 첫 사용자 턴으로 자동 제출. Commands/Skills 처리됨. 사용자 프롬프트 앞에 붙음 |

다음 도구는 주 대화의 UI/세션 상태에 의존하므로 `tools`에 나열되어도 subagent에서 사용할
수 없습니다: `AskUserQuestion`, `EnterPlanMode`, `ExitPlanMode`(permissionMode가 `plan`인
경우 제외), `ScheduleWakeup`, `WaitForMcpServers`.

### 모델 선택

`model` 필드 값:

- **모델 별칭**: `sonnet`, `opus`, `haiku`, `fable`
- **전체 모델 ID**: 예) `claude-opus-4-8`, `claude-sonnet-5`
- **inherit**: 주 대화와 동일한 모델 사용
- **생략됨**: 기본값 `inherit`

Claude가 subagent를 호출할 때 호출별 `model` 매개변수를 전달할 수도 있습니다. 해결 순서:

1. `CLAUDE_CODE_SUBAGENT_MODEL` 환경 변수(설정된 경우)
2. 호출별 `model` 매개변수
3. subagent 정의의 `model` frontmatter
4. 주 대화의 모델

(v2.1.196+) `CLAUDE_CODE_SUBAGENT_MODEL=inherit`는 설정하지 않은 것과 동일하게 동작하며
해결이 계속 진행됩니다. 이전 버전에서는 `inherit`이 주 대화 모델을 강제했습니다.

환경 변수/호출별 매개변수/frontmatter 값은 조직의 `availableModels` 허용 목록에 대해
확인되며, 제외된 모델로 해결되면 상속된 모델로 대체 실행됩니다.

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

## Subagent 작업

### 자동 위임 이해

Claude는 요청의 작업 설명, subagent 구성의 `description` 필드, 현재 컨텍스트를 기반으로
자동 위임합니다. 적극적 위임을 장려하려면 description에 "use proactively" 같은 문구를
포함합니다.

### Subagent를 명시적으로 호출

- **자연어**: 프롬프트에서 subagent 이름을 지정(Claude가 위임할지 결정)
- **@-mention**: 한 작업에 대해 특정 subagent가 실행되도록 보장
  (`@"code-reviewer (agent)"`처럼 typeahead에서 선택, 또는 `@agent-<name>` 수동 입력.
  플러그인 subagent는 `@agent-my-plugin:code-reviewer`)
- **세션 전체**: `claude --agent <name>` 또는 `.claude/settings.json`의 `"agent": "..."`
  로 전체 세션이 해당 subagent의 시스템 프롬프트/도구/모델을 사용

`--agent`로 실행 시 subagent의 시스템 프롬프트가 기본 Claude Code 시스템 프롬프트를
완전히 대체하지만, `CLAUDE.md`/프로젝트 메모리는 여전히 일반 메시지 흐름으로 로드됩니다.

### Subagent를 foreground 또는 background에서 실행

- **Foreground**: 완료까지 주 대화를 차단, 권한 프롬프트가 사용자에게 바로 전달
- **Background**: 계속 작업하면서 동시 실행. (v2.1.186+) 권한 필요한 도구 호출 시
  주 세션에 프롬프트 표시, 승인 또는 Esc로 해당 호출만 거부(subagent는 중지 안 됨).
  그 이전 버전은 자동 거부.

`CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`로 모든 background 기능 비활성화 가능.
`CLAUDE_CODE_FORK_SUBAGENT=1`이면 `background` 필드와 무관하게 모든 subagent 생성이
background에서 실행됩니다.

### 일반적인 패턴

- **대량 작업 격리**: 테스트 실행, 문서 가져오기, 로그 처리처럼 출력이 많은 작업을
  subagent에 위임해 자세한 출력은 subagent 컨텍스트에 유지하고 요약만 반환
- **병렬 연구**: 독립적인 조사에 여러 subagent를 동시 생성(경로가 서로 의존하지 않을 때
  가장 효과적). 단, subagent 완료 시 결과가 주 대화로 반환되므로 자세한 결과를 반환하는
  subagent를 많이 실행하면 컨텍스트를 상당히 소비함. 지속적 병렬성/컨텍스트 초과 작업은
  agent teams 고려
- **Subagent 체인**: 다단계 워크플로우에서 순차적으로 subagent를 사용, Claude가 결과를
  다음 subagent에 전달

### Subagent와 주 대화 중 선택

**주 대화**: 빈번한 왕복/반복 개선 필요, 여러 단계가 컨텍스트를 공유(계획→구현→테스트),
빠른 대상 변경, 지연시간이 중요할 때(subagent는 새로 시작해 컨텍스트 수집 시간 소요)

**Subagent**: 자세한 출력이 주 컨텍스트에 불필요, 특정 도구 제한/권한 적용, 자체 완결적
작업으로 요약 반환 가능할 때

격리된 subagent 컨텍스트가 아닌 주 대화 컨텍스트에서 실행되는 재사용 가능한 프롬프트/
워크플로우가 필요하면 Skills를 고려. 대화에 이미 있는 항목에 대한 빠른 질문은 `/btw`
사용(전체 컨텍스트 보되 도구 액세스 없음, 기록에 추가 안 됨).

### 중첩된 subagent 생성

(v2.1.172+) subagent는 자신의 subagent를 생성할 수 있습니다. 위임된 작업이 병렬 하위
작업으로 분할될 때 사용(예: 검토자가 각 발견에 검증자를 발송). 최상위 subagent의 요약만
사용자에게 반환됩니다.

깊이는 각 수준이 foreground/background 여부와 무관하게 주 대화 아래 subagent 수준 수로
계산됩니다. 깊이 5의 subagent는 Agent 도구를 받지 않으며 추가 생성 불가(고정, 구성
불가). (v2.1.187+) background subagent의 깊이는 처음 생성 시 고정되며 재개해도 변경되지
않습니다.

특정 subagent가 다른 subagent를 생성하지 못하게 하려면 `tools`에서 `Agent`를 생략하거나
`disallowedTools`에 추가. fork는 다른 fork를 생성할 수 없지만(다른 subagent 유형 생성은
가능하며 깊이 제한에 포함).

### Subagent 컨텍스트 관리

#### 시작 시 로드되는 항목

각 subagent는 새로운 격리된 컨텍스트 윈도우로 시작합니다(대화 기록, 이미 호출한 skills,
Claude가 이미 읽은 파일을 보지 못함). 예외는 fork(새로 시작하는 대신 부모 대화 상속).

비fork subagent의 초기 컨텍스트:

- **시스템 프롬프트**: 에이전트 자신의 프롬프트 + Claude Code 환경 세부 정보(전체
  Claude Code 시스템 프롬프트 아님)
- **작업 메시지**: Claude가 작성하는 위임 프롬프트
- **CLAUDE.md 및 메모리**: 주 대화가 로드하는 메모리 계층 구조 전체
  (`~/.claude/CLAUDE.md`, 프로젝트 규칙, `CLAUDE.local.md`, 관리되는 정책 파일). 내장
  Explore/Plan은 건너뜀
- **Git 상태**: 부모 세션 시작 시 스냅샷(Git 저장소 아니거나
  `includeGitInstructions: false`면 없음). Explore/Plan은 건너뜀
- **미리 로드된 skills**: `skills` 필드에 명명된 모든 skill의 전체 내용(내장 에이전트는
  미리 로드 안 함)

Explore/Plan만 CLAUDE.md 및 git 상태를 생략합니다. 주 대화는 전체 CLAUDE.md 컨텍스트로
Explore/Plan 결과를 읽으므로, 규칙이 subagent 자체에 도달해야 한다면 위임 프롬프트에
다시 명시해야 합니다.

#### Subagent 재개

각 subagent 호출은 새 인스턴스를 만듭니다. 기존 작업을 계속하려면 Claude에 재개를
요청합니다. 재개된 subagent는 전체 대화 기록(이전 도구 호출/결과/추론)을 유지합니다.

내장 Explore/Plan은 일회성이며 에이전트 ID를 반환하지 않아 재개 불가(계속 작업이
필요하면 general-purpose 또는 사용자 정의 subagent 사용). Claude는 `SendMessage`
도구로 에이전트 ID/이름을 `to` 필드로 사용해 재개합니다. 중단된 subagent가
`SendMessage`를 받으면 새 `Agent` 호출 없이 background에서 자동 재개됩니다.

에이전트 ID는 `~/.claude/projects/{project}/{sessionId}/subagents/`의
`agent-{agentId}.jsonl` 트랜스크립트에서 찾을 수 있습니다.

Subagent 트랜스크립트는 주 대화와 독립적으로 유지:

- 주 대화 압축 시 subagent 트랜스크립트는 영향받지 않음(별도 파일)
- 세션 내에서 유지(같은 세션 재개 후 subagent 재개 가능)
- `cleanupPeriodDays` 설정(기본 30일) 기반 자동 정리

#### 자동 압축

Subagent는 주 대화와 동일한 로직으로 자동 압축을 지원하며 `CLAUDE_AUTOCOMPACT_PCT_OVERRIDE`
가 동일하게 적용됩니다. 압축 이벤트는 트랜스크립트 파일에
`{"type": "system", "subtype": "compact_boundary", "compactMetadata": {"trigger": "auto", "preTokens": N}}`
형태로 기록됩니다.

## 현재 대화 포크

> 포크된 subagent는 Claude Code v2.1.117 이상 필요. (v2.1.161+) `/fork` 명령은 기본
> 활성화. 이전 버전은 `CLAUDE_CODE_FORK_SUBAGENT=1` 환경 변수 필요. Claude 자체가 포크를
> 생성하는 것은 실험적 기능.

포크는 새로 시작하는 대신 지금까지의 전체 대화를 상속하는 subagent입니다. 주 세션과
동일한 시스템 프롬프트/도구/모델/메시지 기록을 보므로 상황을 다시 설명할 필요가 없지만,
포크의 자체 도구 호출은 여전히 대화에서 벗어나고 최종 결과만 돌아와 주 컨텍스트 윈도우가
깨끗하게 유지됩니다.

`CLAUDE_CODE_FORK_SUBAGENT`를 `1`(활성화)/`0`(비활성화)으로 설정해 명시적으로 제어
가능(대화형 모드, SDK, `claude -p` 모두 인정). 활성화 시:

- Claude가 `fork` subagent 유형을 명시적으로 요청 가능(유형 없이 생성하면
  general-purpose 사용)
- 모든 subagent 생성이 background에서 실행(동기 유지하려면
  `CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1`)

변수 설정과 무관하게 `/fork <지시문>`으로 포크를 직접 시작할 수 있습니다:

```text
/fork draft unit tests for the parser changes so far
```

포크는 패널에 나타나 background로 실행되며 완료 시 결과가 주 대화 메시지로 도착합니다.

### 포크와 명명된 subagent의 차이점

| | 포크 | 명명된 subagent |
|---|---|---|
| 컨텍스트 | 전체 대화 기록 | 전달하는 프롬프트를 사용한 새로운 컨텍스트 |
| 시스템 프롬프트 및 도구 | 주 세션과 동일 | 정의 파일에서 |
| 모델 | 주 세션과 동일 | subagent의 `model` 필드에서 |
| 권한 | 프롬프트가 터미널에 표시됨 | background 실행 중이면 프롬프트가 주 세션에 표시됨 |
| 프롬프트 캐시 | 주 세션과 공유 | 별도 캐시 |

포크는 시스템 프롬프트/도구가 부모와 동일하므로 첫 요청이 부모의 프롬프트 캐시를
재사용해 새 subagent 생성보다 저렴합니다. Agent 도구로 포크 생성 시 `isolation:
"worktree"`를 전달하면 파일 편집이 별도 git worktree에 기록됩니다.

### 제한 사항

`CLAUDE_CODE_FORK_SUBAGENT=1`은 대화형 세션/비대화형 모드/Agent SDK 모두에서 포크 모드를
활성화, `0`은 서버 측 롤아웃 포함 모든 곳에서 비활성화. 포크는 추가 포크를 생성할 수
없습니다.

## 예제 subagent

**모범 사례**:

- **집중된 subagent 설계**: 각 subagent는 특정 작업에서 탁월해야 함
- **자세한 설명 작성**: Claude는 설명을 사용해 위임 시기 결정
- **도구 액세스 제한**: 보안 및 집중을 위해 필요한 권한만 부여
- **버전 제어에 체크인**: 프로젝트 subagent를 팀과 공유

### 코드 검토자 (읽기 전용)

```markdown
---
name: code-reviewer
description: Expert code review specialist. Proactively reviews code for quality, security, and maintainability. Use immediately after writing or modifying code.
tools: Read, Grep, Glob, Bash
model: inherit
---

You are a senior code reviewer ensuring high standards of code quality and security.

When invoked:
1. Run git diff to see recent changes
2. Focus on modified files
3. Begin review immediately

Review checklist:
- Code is clear and readable
- Functions and variables are well-named
- No duplicated code
- Proper error handling
- No exposed secrets or API keys
- Input validation implemented
- Good test coverage
- Performance considerations addressed

Provide feedback organized by priority:
- Critical issues (must fix)
- Warnings (should fix)
- Suggestions (consider improving)

Include specific examples of how to fix issues.
```

### 디버거 (수정 가능)

```markdown
---
name: debugger
description: Debugging specialist for errors, test failures, and unexpected behavior. Use proactively when encountering any issues.
tools: Read, Edit, Bash, Grep, Glob
---

You are an expert debugger specializing in root cause analysis.

When invoked:
1. Capture error message and stack trace
2. Identify reproduction steps
3. Isolate the failure location
4. Implement minimal fix
5. Verify solution works

Debugging process:
- Analyze error messages and logs
- Check recent code changes
- Form and test hypotheses
- Add strategic debug logging
- Inspect variable states

For each issue, provide:
- Root cause explanation
- Evidence supporting the diagnosis
- Specific code fix
- Testing approach
- Prevention recommendations

Focus on fixing the underlying issue, not the symptoms.
```

### 데이터 과학자 (도메인 특화)

```markdown
---
name: data-scientist
description: Data analysis expert for SQL queries, BigQuery operations, and data insights. Use proactively for data analysis tasks and queries.
tools: Bash, Read, Write
model: sonnet
---

You are a data scientist specializing in SQL and BigQuery analysis.

When invoked:
1. Understand the data analysis requirement
2. Write efficient SQL queries
3. Use BigQuery command line tools (bq) when appropriate
4. Analyze and summarize results
5. Present findings clearly

Key practices:
- Write optimized SQL queries with proper filters
- Use appropriate aggregations and joins
- Include comments explaining complex logic
- Format results for readability
- Provide data-driven recommendations

For each analysis:
- Explain the query approach
- Document any assumptions
- Highlight key findings
- Suggest next steps based on data

Always ensure queries are efficient and cost-effective.
```

### 데이터베이스 쿼리 검증자 (hook 기반 제어)

```markdown
---
name: db-reader
description: Execute read-only database queries. Use when analyzing data or generating reports.
tools: Bash
hooks:
  PreToolUse:
    - matcher: "Bash"
      hooks:
        - type: command
          command: "./scripts/validate-readonly-query.sh"
---

You are a database analyst with read-only access. Execute SELECT queries to answer questions about the data.

When asked to analyze data:
1. Identify which tables contain the relevant data
2. Write efficient SELECT queries with appropriate filters
3. Present results clearly with context

You cannot modify data. If asked to INSERT, UPDATE, DELETE, or modify schema, explain that you only have read access.
```

검증 스크립트(`./scripts/validate-readonly-query.sh`), 실행 권한 부여
(`chmod +x`), Windows에서는 PowerShell + `shell: powershell`을 사용합니다. Hook은
stdin으로 JSON을 받으며 Bash 명령은 `tool_input.command`에 있습니다. 종료 코드 2는
작업을 차단하고 오류 메시지를 Claude에 피드백합니다.

## 관련 문서

- 플러그인으로 subagent 배포: https://code.claude.com/docs/ko/plugins
- Claude Code를 프로그래밍 방식으로 실행(Agent SDK): https://code.claude.com/docs/ko/headless
- MCP 서버 사용: https://code.claude.com/docs/ko/mcp
