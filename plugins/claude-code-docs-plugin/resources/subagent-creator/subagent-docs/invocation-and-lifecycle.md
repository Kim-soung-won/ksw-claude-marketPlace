# subagent-docs — 호출 방식과 생명주기 — 위임, 병렬/체인 패턴, 중첩 생성, 컨텍스트 관리, fork

> 출처: https://code.claude.com/docs/ko/sub-agents (Claude Code 공식 문서, 2026-07-02 스냅샷)
> 이 파일은 `subagent-docs/index.md`에서 분리된 하위 문서다. 전체 목차와
> 자주 쓰는 필드 요약은 index.md를 먼저 확인한다.

---

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

---

## 관련 파일

- [index.md](index.md) — 전체 목차, 내장 subagent 요약, frontmatter 필드 이름 목록, 라우팅 표
- [scope-and-fields.md](scope-and-fields.md)
- [capabilities.md](capabilities.md)
- [examples.md](examples.md)
