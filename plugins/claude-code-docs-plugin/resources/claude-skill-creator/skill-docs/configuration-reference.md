# skill-docs — Skills 구성 — 콘텐츠 유형, frontmatter 필드 전체 표, 명령어 이름 해석, 문자열 치환, 지원 파일 추가, 호출 제어, 콘텐츠 라이프사이클, 도구 사전 승인, 인수 전달

> 출처: https://code.claude.com/docs/ko/skills (Claude Code 공식 문서, 2026-07-02 스냅샷)
> 이 파일은 `skill-docs/index.md`에서 분리된 하위 문서다. 전체 목차와
> frontmatter 필드 요약은 index.md를 먼저 확인한다.

---

## Skills 구성

Skills는 `SKILL.md` 상단의 YAML frontmatter와 그 뒤의 markdown 콘텐츠를 통해
구성됩니다.

### Skill 콘텐츠 유형

Skill 파일은 모든 지침을 포함할 수 있지만, 호출 방식을 생각하면 포함할 내용을
안내하는 데 도움이 됩니다:

**참조 콘텐츠**는 Claude가 현재 작업에 적용하는 지식을 추가합니다. 규칙, 패턴,
스타일 가이드, 도메인 지식. 이 콘텐츠는 인라인으로 실행되므로 Claude가 대화
컨텍스트와 함께 사용할 수 있습니다.

```yaml
---
name: api-conventions
description: API design patterns for this codebase
---

When writing API endpoints:
- Use RESTful naming conventions
- Return consistent error formats
- Include request validation
```

**작업 콘텐츠**는 배포, 커밋 또는 코드 생성과 같은 특정 작업에 대한 단계별
지침을 제공합니다. 이는 Claude가 자동으로 실행하도록 하기보다는
`/skill-name`으로 직접 호출하려는 작업입니다. `disable-model-invocation:
true`를 추가하여 Claude가 자동으로 트리거하는 것을 방지합니다.

```yaml
---
name: deploy
description: Deploy the application to production
context: fork
disable-model-invocation: true
---

Deploy the application:
1. Run the test suite
2. Build the application
3. Push to the deployment target
```

`SKILL.md`는 모든 것을 포함할 수 있지만, skill을 호출하는 방식(사용자, Claude
또는 둘 다)과 실행 위치(인라인 또는 subagent)를 생각하면 포함할 내용을 안내하는
데 도움이 됩니다. 복잡한 skills의 경우, 지원 파일을 추가하여 주요 skill을
집중적으로 유지할 수도 있습니다.

본문 자체는 간결하게 유지합니다. Skill이 로드되면, 그 콘텐츠는 턴 전체에 걸쳐
컨텍스트에 유지되므로, 모든 줄이 반복되는 토큰 비용입니다. 어떻게 또는 왜인지
설명하기보다는 무엇을 할지 명시하고, CLAUDE.md 콘텐츠에 적용할 동일한 간결성
테스트를 적용합니다.

### Frontmatter 참조

markdown 콘텐츠 외에도, `SKILL.md` 파일 상단의 `---` 마커 사이의 YAML
frontmatter 필드를 사용하여 skill 동작을 구성할 수 있습니다:

```yaml
---
name: my-skill
description: What this skill does
disable-model-invocation: true
allowed-tools: Read Grep
---

Your skill instructions here...
```

모든 필드는 선택적입니다. Claude가 skill을 언제 사용할지 알 수 있도록
`description`만 권장됩니다.

| 필드 | 필수 | 설명 |
|---|---|---|
| `name` | 아니오 | skill 목록에 표시되는 표시 이름입니다. 디렉토리 이름으로 기본값이 설정됩니다. |
| `description` | 권장 | skill이 무엇을 하는지, 언제 사용할지. Claude는 이를 사용하여 skill을 자동으로 적용할 시기를 결정합니다. 생략하면 markdown 콘텐츠의 첫 번째 단락을 사용합니다. 주요 사용 사례를 앞에 배치합니다: 결합된 `description` 및 `when_to_use` 텍스트는 컨텍스트 사용을 줄이기 위해 skill 목록에서 1,536자로 잘립니다. |
| `when_to_use` | 아니오 | Claude가 skill을 호출해야 할 때에 대한 추가 컨텍스트(예: 트리거 구문 또는 예제 요청). skill 목록에서 `description`에 추가되며 1,536자 제한에 포함됩니다. |
| `argument-hint` | 아니오 | 예상 인수를 나타내기 위해 자동 완성 중에 표시되는 힌트. 예: `[issue-number]` 또는 `[filename] [format]`. |
| `arguments` | 아니오 | skill 콘텐츠에서 `$name` 치환을 위한 명명된 위치 인수. 공백으로 구분된 문자열 또는 YAML 목록을 허용합니다. 이름은 순서대로 인수 위치에 매핑됩니다. |
| `disable-model-invocation` | 아니오 | Claude가 이 skill을 자동으로 로드하는 것을 방지하려면 `true`로 설정합니다. `/name`으로 수동으로 트리거하려는 워크플로우에 사용합니다. 또한 skill이 subagents에 미리 로드되는 것을 방지합니다. v2.1.196부터는 예약된 작업이 skill을 프롬프트로 하여 실행될 때 skill이 실행되는 것도 방지합니다. 기본값: `false`. |
| `user-invocable` | 아니오 | `/` 메뉴에서 숨기려면 `false`로 설정합니다. 사용자가 직접 호출하지 않아야 하는 배경 지식에 사용합니다. 기본값: `true`. |
| `allowed-tools` | 아니오 | 이 skill이 활성화되었을 때 Claude가 권한을 요청하지 않고 사용할 수 있는 도구. 공백 또는 쉼표로 구분된 문자열 또는 YAML 목록을 허용합니다. |
| `disallowed-tools` | 아니오 | 이 skill이 활성화되었을 때 Claude의 사용 가능한 도구 풀에서 제거되는 도구. `AskUserQuestion`과 같이 배경 루프에 대해 특정 도구를 호출하지 않아야 하는 자율 skills에 사용합니다. 공백 또는 쉼표로 구분된 문자열 또는 YAML 목록을 허용합니다. 다음 메시지를 보낼 때 제한이 해제됩니다. |
| `model` | 아니오 | 이 skill이 활성화되었을 때 사용할 모델. 재정의는 현재 턴의 나머지 부분에 적용되며 설정에 저장되지 않습니다. 다음 프롬프트에서 세션 모델이 재개됩니다. `/model`과 동일한 값을 허용하거나 활성 모델을 유지하려면 `inherit`을 허용합니다. 조직의 `availableModels` 허용 목록에서 제외된 값은 사용되지 않으며 세션은 현재 모델을 유지합니다. |
| `effort` | 아니오 | 노력 수준 - 이 skill이 활성화되었을 때. 세션 노력 수준을 재정의합니다. 기본값: 세션에서 상속. 옵션: `low`, `medium`, `high`, `xhigh`, `max`; 사용 가능한 수준은 모델에 따라 다릅니다. |
| `context` | 아니오 | forked subagent 컨텍스트에서 실행하려면 `fork`로 설정합니다. |
| `agent` | 아니오 | `context: fork`가 설정되었을 때 사용할 subagent 유형. |
| `hooks` | 아니오 | 이 skill의 라이프사이클에 범위가 지정된 hooks. |
| `paths` | 아니오 | 이 skill이 활성화되는 시기를 제한하는 Glob 패턴. 쉼표로 구분된 문자열 또는 YAML 목록을 허용합니다. 설정하면 Claude는 패턴과 일치하는 파일로 작업할 때만 자동으로 skill을 로드합니다. |
| `shell` | 아니오 | 이 skill의 `` !`command` `` 및 ` ```! ` 블록에 사용할 shell. `bash`(기본값) 또는 `powershell`을 허용합니다. `powershell`을 설정하면 Windows에서 PowerShell을 통해 인라인 shell 명령어를 실행합니다. `CLAUDE_CODE_USE_POWERSHELL_TOOL=1`이 필요합니다. |

#### Skill이 명령어 이름을 얻는 방법

skill을 호출하기 위해 입력하는 명령어는 skill 파일이 있는 위치에서 나옵니다.
frontmatter `name` 필드는 skill 목록에 표시되는 표시 레이블을 설정하며, plugin
루트 `SKILL.md`를 제외하고는 `/` 뒤에 입력하는 내용을 변경하지 않습니다.

아래 표는 각 레이아웃에 대해 명령어 이름이 어디에서 나오는지 보여줍니다:

| Skill 위치 | 명령어 이름 소스 | 예제 |
|---|---|---|
| `~/.claude/skills/` 또는 `.claude/skills/` 아래의 Skill 디렉토리 | 디렉토리 이름 | `.claude/skills/deploy-staging/SKILL.md` → `/deploy-staging` |
| 중첩된 `.claude/skills/` 디렉토리, 다른 skill과 이름이 충돌할 때 | 작업 디렉토리를 기준으로 한 하위 디렉토리 경로, 그 다음 skill 디렉토리 이름 | `apps/web/.claude/skills/deploy/SKILL.md` → `/apps/web:deploy` |
| `.claude/commands/` 아래의 파일 | 확장자 없는 파일 이름 | `.claude/commands/deploy.md` → `/deploy` |
| Plugin `skills/` 하위 디렉토리 | 디렉토리 이름, plugin으로 네임스페이스됨 | `my-plugin/skills/review/SKILL.md` → `/my-plugin:review` |
| Plugin 루트 `SKILL.md` | Frontmatter `name`, plugin 디렉토리 이름을 폴백으로 사용 | `my-plugin/SKILL.md`에서 `name: review` → `/my-plugin:review` |

plugin 루트 경우는 `name`이 명령어 이름을 설정하는 유일한 경우입니다. skill
디렉토리가 없기 때문입니다. frontmatter에서 `name`이 설정되지 않으면 plugin의
디렉토리 이름이 대신 사용됩니다.

#### 사용 가능한 문자열 치환

Skills는 skill 콘텐츠의 동적 값에 대한 문자열 치환을 지원합니다:

| 변수 | 설명 |
|---|---|
| `$ARGUMENTS` | skill을 호출할 때 전달된 모든 인수. `$ARGUMENTS`가 콘텐츠에 없으면 인수가 `ARGUMENTS: <value>`로 추가됩니다. |
| `$ARGUMENTS[N]` | 0 기반 인덱스로 특정 인수에 액세스합니다(예: `$ARGUMENTS[0]`은 첫 번째 인수). |
| `$N` | `$ARGUMENTS[N]`의 약자(예: `$0`은 첫 번째 인수, `$1`은 두 번째 인수). |
| `$name` | `arguments` frontmatter 목록에서 선언된 명명된 인수. 이름은 순서대로 위치에 매핑되므로, `arguments: [issue, branch]`를 사용하면 플레이스홀더 `$issue`는 첫 번째 인수로 확장되고 `$branch`는 두 번째 인수로 확장됩니다. |
| `${CLAUDE_SESSION_ID}` | 현재 세션 ID. 로깅, 세션별 파일 생성 또는 skill 출력을 세션과 연관시키는 데 유용합니다. |
| `${CLAUDE_EFFORT}` | 현재 노력 수준: `low`, `medium`, `high`, `xhigh`, 또는 `max`. Ultracode는 별개의 수준이 아니며 `xhigh`로 보고됩니다. |
| `${CLAUDE_SKILL_DIR}` | skill의 `SKILL.md` 파일을 포함하는 디렉토리. plugin skills의 경우, 이는 plugin 루트가 아닌 plugin 내의 skill 하위 디렉토리입니다. bash 주입 명령어에서 현재 작업 디렉토리와 관계없이 skill과 함께 번들된 스크립트 또는 파일을 참조하는 데 사용합니다. |
| `${CLAUDE_PROJECT_DIR}` | 프로젝트 루트 디렉토리. hooks와 MCP 서버가 `CLAUDE_PROJECT_DIR`로 받는 것과 동일한 경로입니다. 프로젝트 로컬 스크립트 또는 파일을 참조하는 데 사용하여 skill이 설치된 위치와 관계없이 사용합니다. |

`${CLAUDE_PROJECT_DIR}` 치환은 Claude Code v2.1.196 이상이 필요합니다. skill
본문과 `allowed-tools` frontmatter 모두에 적용되므로,
`Bash(${CLAUDE_PROJECT_DIR}/scripts/lint.sh *)` 같은 권한 규칙은 skill 본문이
사용하는 것과 동일한 경로로 확인됩니다.

인덱싱된 인수는 shell 스타일 인용을 사용하므로 다중 단어 값을 따옴표로 감싸서
단일 인수로 전달합니다. 예를 들어, `/my-skill "hello world" second`는 `$0`을
`hello world`로, `$1`을 `second`로 확장합니다. `$ARGUMENTS` 플레이스홀더는 항상
입력한 전체 인수 문자열로 확장됩니다.

리터럴 `$`를 숫자, `ARGUMENTS` 또는 선언된 인수 이름 앞에 포함하려면(예: 산문에서
`$1.00`), 백슬래시로 이스케이프합니다: `\$1.00`. 다른 `$` 앞의 백슬래시는
변경되지 않습니다. 토큰 바로 앞의 단일 백슬래시만 이스케이프합니다. `\\$1`과
같은 이중 백슬래시는 두 백슬래시를 제자리에 두고, `$1`은 여전히 인수 값으로
확장됩니다.

**치환을 사용한 예제:**

```yaml
---
name: session-logger
description: Log activity for this session
---

Log the following to logs/${CLAUDE_SESSION_ID}.log:

$ARGUMENTS
```

### 지원 파일 추가

Skills는 디렉토리에 여러 파일을 포함할 수 있습니다. 이는 `SKILL.md`를 필수
항목에 집중하게 하면서 Claude가 필요할 때만 상세한 참조 자료에 액세스할 수
있게 합니다. 큰 참조 문서, API 사양 또는 예제 컬렉션은 skill이 실행될 때마다
컨텍스트에 로드될 필요가 없습니다.

```text
my-skill/
├── SKILL.md (required - overview and navigation)
├── reference.md (detailed API docs - loaded when needed)
├── examples.md (usage examples - loaded when needed)
└── scripts/
    └── helper.py (utility script - executed, not loaded)
```

`SKILL.md`에서 지원 파일을 참조하여 Claude가 각 파일의 내용과 로드 시기를 알 수
있도록 합니다:

```markdown
## Additional resources

- For complete API details, see [reference.md](reference.md)
- For usage examples, see [examples.md](examples.md)
```

> **팁**: `SKILL.md`를 500줄 이하로 유지합니다. 상세한 참조 자료를 별도 파일로
> 이동합니다.

### Skill을 호출하는 사람 제어

기본적으로 사용자와 Claude 모두 모든 skill을 호출할 수 있습니다.
`/skill-name`을 입력하여 직접 호출할 수 있고, Claude는 대화와 관련이 있을 때
자동으로 로드할 수 있습니다. 두 frontmatter 필드를 사용하여 이를 제한할 수
있습니다:

- **`disable-model-invocation: true`**: 사용자만 skill을 호출할 수 있습니다.
  부작용이 있거나 타이밍을 제어하려는 워크플로우(예: `/commit`, `/deploy` 또는
  `/send-slack-message`)에 사용합니다. Claude가 코드가 준비된 것처럼 보인다고
  해서 배포하기로 결정하지 않기를 원합니다.
- **`user-invocable: false`**: Claude만 skill을 호출할 수 있습니다. 명령어로
  실행할 수 없는 배경 지식에 사용합니다. `legacy-system-context` skill은
  오래된 시스템이 어떻게 작동하는지 설명합니다. Claude는 관련이 있을 때 이를
  알아야 하지만, `/legacy-system-context`는 사용자가 취할 의미 있는 작업이
  아닙니다.

이 예제는 사용자만 트리거할 수 있는 배포 skill을 생성합니다.
`disable-model-invocation: true` 필드는 Claude가 자동으로 실행하는 것을
방지합니다:

```yaml
---
name: deploy
description: Deploy the application to production
disable-model-invocation: true
---

Deploy $ARGUMENTS to production:

1. Run the test suite
2. Build the application
3. Push to the deployment target
4. Verify the deployment succeeded
```

두 필드가 호출 및 컨텍스트 로딩에 미치는 영향은 다음과 같습니다:

| Frontmatter | 사용자가 호출 가능 | Claude가 호출 가능 | 컨텍스트에 로드되는 시기 |
|---|---|---|---|
| (기본값) | 예 | 예 | 설명은 항상 컨텍스트에 있고, 호출될 때 전체 skill이 로드됨 |
| `disable-model-invocation: true` | 예 | 아니오 | 설명은 컨텍스트에 없고, 사용자가 호출할 때 전체 skill이 로드됨 |
| `user-invocable: false` | 아니오 | 예 | 설명은 항상 컨텍스트에 있고, 호출될 때 전체 skill이 로드됨 |

> **참고**: 일반 세션에서 skill 설명은 Claude가 사용 가능한 항목을 알 수 있도록
> 컨텍스트에 로드되지만, 전체 skill 콘텐츠는 호출될 때만 로드됩니다. 미리
> 로드된 skills가 있는 Subagents는 다르게 작동합니다: 전체 skill 콘텐츠는
> 시작 시 주입됩니다.

### Skill 콘텐츠 라이프사이클

사용자 또는 Claude가 skill을 호출하면, 렌더링된 `SKILL.md` 콘텐츠는 대화에 단일
메시지로 들어가고 세션의 나머지 부분 동안 그대로 유지됩니다. Claude Code는
나중의 턴에서 skill 파일을 다시 읽지 않으므로, 작업 전체에 적용되어야 하는
지침을 일회성 단계가 아닌 상시 지침으로 작성합니다.

자동 압축은 토큰 예산 내에서 호출된 skills를 전달합니다. 대화가 요약되어
컨텍스트를 확보하면, Claude Code는 요약 후 각 skill의 가장 최근 호출을 다시
첨부하여 처음 5,000토큰을 유지합니다. 다시 첨부된 skills는 25,000토큰의 결합
예산을 공유합니다. Claude Code는 가장 최근에 호출된 skill부터 시작하여 이
예산을 채우므로, 한 세션에서 많은 skills를 호출한 경우 압축 후 이전 skills가
완전히 삭제될 수 있습니다.

skill이 첫 번째 응답 후 동작에 영향을 미치지 않는 것처럼 보이면, 콘텐츠는
일반적으로 여전히 존재하며 모델이 다른 도구나 접근 방식을 선택하고 있습니다.
skill의 `description` 및 지침을 강화하여 모델이 계속 선호하도록 하거나,
hooks를 사용하여 동작을 결정론적으로 적용합니다. skill이 크거나 그 후에 다른
여러 skills를 호출한 경우, 압축 후 전체 콘텐츠를 복원하려면 다시 호출합니다.

### Skill에 대한 도구 사전 승인

`allowed-tools` 필드는 skill이 활성화되었을 때 나열된 도구에 대한 권한을
부여하므로 Claude는 승인을 요청하지 않고 사용할 수 있습니다. 사용 가능한 도구를
제한하지 않습니다: 모든 도구는 호출 가능하게 유지되며, 권한 설정은 나열되지 않은
도구에 대한 도구를 계속 관리합니다.

프로젝트의 `.claude/skills/` 디렉토리에 체크인된 skills의 경우, `allowed-tools`는
해당 폴더에 대한 작업 공간 신뢰 대화를 수락한 후 적용되며, `.claude/settings.json`의
권한 규칙과 동일합니다. 프로젝트 skills를 신뢰하기 전에 검토하세요. skill은
자신에게 광범위한 도구 액세스 권한을 부여할 수 있습니다.

이 skill은 skill을 호출할 때마다 Claude가 승인을 요청하지 않고 git 명령어를
실행할 수 있게 합니다:

```yaml
---
name: commit
description: Stage and commit the current changes
disable-model-invocation: true
allowed-tools: Bash(git add *) Bash(git commit *) Bash(git status *)
---
```

skill이 활성화되었을 때 Claude의 사용 가능한 풀에서 도구를 제거하려면, skill의
frontmatter에서 `disallowed-tools`에 나열합니다. 다음 메시지를 보낼 때 제한이
해제됩니다. 모든 skills 및 프롬프트에서 도구를 차단하려면, 권한 설정에 거부
규칙을 추가합니다.

### Skills에 인수 전달

사용자와 Claude 모두 skill을 호출할 때 인수를 전달할 수 있습니다. 인수는
`$ARGUMENTS` 플레이스홀더를 통해 사용 가능합니다.

이 skill은 GitHub 이슈를 번호로 수정합니다. `$ARGUMENTS` 플레이스홀더는 skill
이름 뒤에 오는 모든 것으로 대체됩니다:

```yaml
---
name: fix-issue
description: Fix a GitHub issue
disable-model-invocation: true
---

Fix GitHub issue $ARGUMENTS following our coding standards.

1. Read the issue description
2. Understand the requirements
3. Implement the fix
4. Write tests
5. Create a commit
```

`/fix-issue 123`을 실행하면 Claude는 "Fix GitHub issue 123 following our
coding standards..."를 받습니다.

인수를 사용하여 skill을 호출하지만 skill에 `$ARGUMENTS`가 포함되지 않으면,
Claude Code는 `ARGUMENTS: <your input>`을 skill 콘텐츠의 끝에 추가하므로
Claude는 여전히 입력한 내용을 봅니다.

위치별로 개별 인수에 액세스하려면 `$ARGUMENTS[N]` 또는 더 짧은 `$N`을
사용합니다:

```yaml
---
name: migrate-component
description: Migrate a component from one framework to another
---

Migrate the $ARGUMENTS[0] component from $ARGUMENTS[1] to $ARGUMENTS[2].
Preserve all existing behavior and tests.
```

`/migrate-component SearchBar React Vue`를 실행하면 `$ARGUMENTS[0]`을
`SearchBar`로, `$ARGUMENTS[1]`을 `React`로, `$ARGUMENTS[2]`를 `Vue`로
대체합니다. `$N` 약자를 사용하는 동일한 skill:

```yaml
---
name: migrate-component
description: Migrate a component from one framework to another
---

Migrate the $0 component from $1 to $2.
Preserve all existing behavior and tests.
```


---

## 관련 파일

- [index.md](index.md) — 전체 목차, frontmatter 필드 요약, 라우팅 표
- [storage-and-config.md](storage-and-config.md)
- [advanced-patterns.md](advanced-patterns.md)
- [sharing-and-troubleshooting.md](sharing-and-troubleshooting.md)
- [visualizer-example.md](visualizer-example.md)
