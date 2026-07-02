# subagent-docs — 내장 subagent, 범위·구성·frontmatter 필드, 모델 선택

> 출처: https://code.claude.com/docs/ko/sub-agents (Claude Code 공식 문서, 2026-07-02 스냅샷)
> 이 파일은 `subagent-docs/index.md`에서 분리된 하위 문서다. 전체 목차와
> 자주 쓰는 필드 요약은 index.md를 먼저 확인한다.

---

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

---

## 관련 파일

- [index.md](index.md) — 전체 목차, 내장 subagent 요약, frontmatter 필드 이름 목록, 라우팅 표
- [capabilities.md](capabilities.md)
- [invocation-and-lifecycle.md](invocation-and-lifecycle.md)
- [examples.md](examples.md)
