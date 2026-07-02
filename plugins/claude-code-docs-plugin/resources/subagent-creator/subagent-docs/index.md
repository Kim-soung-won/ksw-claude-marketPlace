# subagent-docs — 목차 및 빠른 참조

> 출처: https://code.claude.com/docs/ko/sub-agents (Claude Code 공식 문서, 2026-07-02 스냅샷)
> 전체 문서 인덱스: https://code.claude.com/docs/llms.txt
>
> 이 문서 세트는 원래 단일 파일 `subagent-docs.md`(842줄)였으나, 매 호출마다
> 전체를 Read하면 narrow한 수정 작업에도 불필요한 토큰이 들어 이 4개 하위
> 파일로 분리했다. **이 index.md는 항상 먼저 읽는다.** 자주 필요한 내용(내장
> subagent 요약, frontmatter 필드 이름 목록)은 여기 인라인으로 있어 하위
> 파일을 열지 않아도 되는 경우가 많다. 그 외 상세 내용이 필요하면 아래
> "어떤 파일을 읽을지" 표를 기준으로 해당 파일만 연다.

## Subagent란

Subagent는 특정 유형의 작업을 처리하는 특화된 AI 어시스턴트다. 부작업이
검색 결과, 로그 또는 다시 참조하지 않을 파일 콘텐츠로 주 대화를 넘칠 때
하나를 사용한다: subagent는 자신의 컨텍스트에서 해당 작업을 수행하고 요약만
반환한다. 동일한 지침으로 동일한 종류의 워커를 계속 생성할 때 사용자 정의
subagent를 정의한다.

각 subagent는 자체 컨텍스트 윈도우에서 실행되며 사용자 정의 시스템 프롬프트,
특정 도구 액세스 및 독립적인 권한을 가진다. Claude가 subagent의 설명과
일치하는 작업을 만나면 해당 subagent에 위임하고, subagent는 독립적으로
작동하여 결과를 반환한다.

> Subagent는 단일 세션 내에서 작동한다. 많은 독립적인 세션을 병렬로 실행하고
> 한 곳에서 모니터링하려면 background agents를 참조한다. 서로 통신하는
> 세션의 경우 agent teams를 참조한다.

Claude는 각 subagent의 설명을 사용하여 작업을 위임할 시기를 결정한다.
Subagent를 만들 때 Claude가 언제 사용할지 알 수 있도록 명확한 설명을
작성한다.

## 내장 subagent 요약

Claude Code에는 Claude가 적절할 때 자동으로 사용하는 내장 subagent가
포함된다. 각각은 추가 도구 제한이 있는 부모 대화의 권한을 상속한다.
Explore와 Plan은 연구를 빠르고 저렴하게 유지하기 위해 CLAUDE.md 파일과
부모 세션의 git 상태를 건너뛴다.

| 에이전트 | 모델 | 도구 | 목적 |
|---|---|---|---|
| Explore | Haiku | 읽기 전용 | 파일 검색, 코드 검색, 코드베이스 탐색 (quick/medium/very thorough 지정 가능) |
| Plan | 주 대화에서 상속 | 읽기 전용 | plan mode 중 계획을 위한 코드베이스 연구 |
| general-purpose | 주 대화에서 상속 | 모든 도구 | 탐색+수정이 모두 필요한 복잡한 다단계 작업 |
| statusline-setup | Sonnet | — | `/statusline` 실행 시 |
| claude-code-guide | Haiku | — | Claude Code 기능 질문 시 |

내장 subagent는 항상 대화형 세션에 등록된다. 특정 유형을 차단하려면
`permissions.deny`에 `Agent(agent-name)` 형식으로 추가하거나(전체 차단은
`Agent` 도구 자체를 거부), 비대화형 모드에서는
`CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS=1`을 설정한다. 상세 설명은
[scope-and-fields.md](scope-and-fields.md)를 참고한다.

## 지원되는 frontmatter 필드 (이름 목록)

`name`과 `description`만 필수다. 그 외:

`tools`, `disallowedTools`, `model`, `permissionMode`, `maxTurns`, `skills`,
`mcpServers`, `hooks`, `memory`, `background`, `effort`, `isolation`,
`color`, `initialPrompt`

각 필드의 상세 설명(허용 값, 기본값, 제약)과 예시는
[scope-and-fields.md](scope-and-fields.md)의 "지원되는 frontmatter 필드"
절 표를 참고한다. `tools`/`disallowedTools`/`mcpServers`/`permissionMode`/
`skills`/`memory`/`hooks`처럼 필드 값을 실제로 구성하는 방법(문법, 예시,
플러그인에서의 제약)은 [capabilities.md](capabilities.md)에 있다.

`AskUserQuestion`, `EnterPlanMode`, `ExitPlanMode`(permissionMode가 `plan`인
경우 제외), `ScheduleWakeup`, `WaitForMcpServers`는 `tools`에 나열되어도
주 대화의 UI/세션 상태에 의존하므로 subagent에서 사용할 수 없다.

## 어떤 파일을 읽을지

| 작업 | 읽어야 할 파일 |
|---|---|
| 새 subagent를 처음부터 만든다 | index.md(이 파일) → [scope-and-fields.md](scope-and-fields.md) → [capabilities.md](capabilities.md) (도구/권한 구성 시) → 필요하면 [examples.md](examples.md)(비슷한 기존 예제 참고용) |
| `name`/`description`/`model`/저장 위치(scope)만 조정 | [scope-and-fields.md](scope-and-fields.md)만 |
| `tools`/`disallowedTools`/`permissionMode`/`mcpServers`/`skills`/`memory`/`hooks` 등 기능 관련 필드를 조정 | [capabilities.md](capabilities.md)만 |
| 호출 방식(자동 위임/@-mention/`--agent`), foreground·background, 병렬/체인 패턴, 중첩 subagent, 컨텍스트 관리, fork를 다룬다 | [invocation-and-lifecycle.md](invocation-and-lifecycle.md)만 |
| 참고할 완성된 예제 subagent 본문이 필요하다 | [examples.md](examples.md)만 |
| subagent 정의를 종합적으로 진단/리뷰한다 (`subagent-evaluator`) | index.md + 4개 하위 파일 전부 — 스펙 전체를 대조해야 하므로 부분 읽기로 대체하지 않는다 |

narrow한 단일 필드 수정처럼 표에서 한 파일만 필요하다고 판단되면 그 파일만
Read한다. 여러 관심사가 겹치는 요청이거나 처음부터 새로 만드는 작업이면
표에 나열된 파일을 모두 읽는다 — 이 경우 총 분량은 예전 단일 파일과 비슷하지만,
좁은 작업에서 불필요한 절(hook 문법, 컨텍스트 관리, fork 등)까지 매번 읽는
낭비를 없애는 것이 이 분리의 목적이다.

## 하위 파일 목록

| 파일 | 내용 |
|---|---|
| [scope-and-fields.md](scope-and-fields.md) | 내장 subagent 상세, 빠른 시작(`/agents` 명령), 저장 범위(project/user/CLI/managed/plugin)와 우선순위, subagent 파일 작성 예시, frontmatter 필드 전체 표, 모델 선택과 해석 순서 |
| [capabilities.md](capabilities.md) | 도구 허용/거부(`tools`/`disallowedTools`, MCP 패턴), 생성 가능한 subagent 제한, MCP 서버 범위 지정, 권한 모드, skills 미리 로드, 지속적 메모리, hook(frontmatter 및 프로젝트 수준), 특정 subagent 비활성화 |
| [invocation-and-lifecycle.md](invocation-and-lifecycle.md) | 자동 위임, 명시적 호출(자연어/@-mention/세션 전체), foreground/background, 일반적인 패턴(대량 작업 격리·병렬 연구·체인), 주 대화 vs subagent 선택 기준, 중첩된 subagent 생성, 컨텍스트 관리(시작 시 로드·재개·자동 압축), 현재 대화 포크(fork) |
| [examples.md](examples.md) | 모범 사례 요약, 완성된 예제 4종(읽기 전용 코드 검토자, 수정 가능한 디버거, 도메인 특화 데이터 과학자, hook 기반 DB 쿼리 검증자), 관련 문서 링크 |
