# skill-docs — 고급 패턴 — 동적 컨텍스트 주입, Subagent에서 Skills 실행(context: fork), Claude의 Skill 액세스 제한, 설정에서 가시성 재정의

> 출처: https://code.claude.com/docs/ko/skills (Claude Code 공식 문서, 2026-07-02 스냅샷)
> 이 파일은 `skill-docs/index.md`에서 분리된 하위 문서다. 전체 목차와
> frontmatter 필드 요약은 index.md를 먼저 확인한다.

---

## 고급 패턴

### 동적 컨텍스트 주입

`` !`<command>` `` 구문은 skill 콘텐츠가 Claude로 전송되기 전에 shell 명령어를
실행합니다. 명령어 출력이 플레이스홀더를 대체하므로 Claude는 명령어 자체가
아닌 실제 데이터를 받습니다.

이 skill은 GitHub CLI를 사용하여 라이브 PR 데이터를 가져와 pull request를
요약합니다. `` !`gh pr diff` `` 및 기타 명령어가 먼저 실행되고, 출력이
프롬프트에 삽입됩니다:

```yaml
---
name: pr-summary
description: Summarize changes in a pull request
context: fork
agent: Explore
allowed-tools: Bash(gh *)
---

## Pull request context
- PR diff: !`gh pr diff`
- PR comments: !`gh pr view --comments`
- Changed files: !`gh pr diff --name-only`

## Your task
Summarize this pull request...
```

이 skill이 실행될 때:

1. 각 `` !`<command>` ``가 즉시 실행됩니다(Claude가 보기 전에).
2. 출력이 skill 콘텐츠의 플레이스홀더를 대체합니다.
3. Claude는 실제 PR 데이터가 있는 완전히 렌더링된 프롬프트를 받습니다.

이는 전처리이며, Claude가 실행하는 것이 아닙니다. Claude는 최종 결과만 봅니다.

대체는 원본 파일에 대해 한 번 실행됩니다. 명령어 출력은 일반 텍스트로 삽입되며
추가 `` !`<command>` `` 플레이스홀더에 대해 다시 스캔되지 않으므로, 명령어는
나중의 패스에서 확장할 플레이스홀더를 내보낼 수 없습니다.

인라인 형식은 `!`이 줄의 시작 또는 공백 직후에 나타날 때만 인식됩니다. `!`이
`` KEY=!`cmd` ``처럼 다른 문자 뒤에 오면, 플레이스홀더는 리터럴 텍스트로
남겨지고 명령어는 실행되지 않습니다.

다중 라인 명령어의 경우, 인라인 형식 대신 ` ```! `로 열린 펜스 코드 블록을
사용합니다:

````markdown
## Environment
```!
node --version
npm --version
git status --short
```
````

사용자, 프로젝트, 플러그인 또는 추가 디렉토리 소스의 skills 및 사용자 정의
명령어에 대해 이 동작을 비활성화하려면, 설정에서
`"disableSkillShellExecution": true`를 설정합니다. 각 명령어는 실행되는 대신
`[shell command execution disabled by policy]`로 대체됩니다. 번들 및 관리
skills는 영향을 받지 않습니다. 이 설정은 사용자가 재정의할 수 없는 관리
설정에서 가장 유용합니다.

> **팁**: skill에서 더 깊은 추론을 요청하려면 skill 콘텐츠의 어디든
> `ultrathink`를 포함합니다.

### Subagent에서 Skills 실행

skill을 격리 상태에서 실행하려면 frontmatter에 `context: fork`를 추가합니다.
skill 콘텐츠는 subagent를 구동하는 프롬프트가 됩니다. 대화 기록에 액세스할 수
없습니다.

> **경고**: `context: fork`는 명시적 지침이 있는 skills에만 의미가 있습니다.
> skill에 작업 없이 "이 API 규칙을 사용하세요"와 같은 지침이 포함되어 있으면,
> subagent는 지침을 받지만 실행 가능한 프롬프트가 없으므로 의미 있는 출력
> 없이 반환됩니다.

Skills와 subagents는 두 방향으로 함께 작동합니다:

| 접근 방식 | 시스템 프롬프트 | 작업 | 또한 로드 |
|---|---|---|---|
| `context: fork`가 있는 Skill | 에이전트 유형에서 | SKILL.md 콘텐츠 | CLAUDE.md, 에이전트가 Explore 또는 Plan인 경우 제외 |
| `skills` 필드가 있는 Subagent | Subagent의 markdown 본문 | Claude의 위임 메시지 | 미리 로드된 skills + CLAUDE.md |

`context: fork`를 사용하면 skill에 작업을 작성하고 실행할 에이전트 유형을
선택합니다. 기본 제공 Explore 및 Plan 에이전트는 컨텍스트를 작게 유지하기
위해 CLAUDE.md 및 git status를 건너뜁니다. 따라서 `agent: Explore`를 사용하는
forked skill은 SKILL.md 콘텐츠와 에이전트 자체의 시스템 프롬프트만 봅니다.
역방향(skills를 참조 자료로 사용하는 사용자 정의 subagent 정의)은
`subagent-creator/subagent-docs/capabilities.md`의 "Subagent에 skills 미리 로드" 절을
참조하세요.

#### 예제: Explore 에이전트를 사용하는 Research Skill

이 skill은 forked Explore 에이전트에서 연구를 실행합니다. skill 콘텐츠는
작업이 되고, 에이전트는 코드베이스 탐색에 최적화된 읽기 전용 도구를
제공합니다:

```yaml
---
name: deep-research
description: Research a topic thoroughly
context: fork
agent: Explore
---

Research $ARGUMENTS thoroughly:

1. Find relevant files using Glob and Grep
2. Read and analyze the code
3. Summarize findings with specific file references
```

이 skill이 실행될 때:

1. 새로운 격리된 컨텍스트가 생성됩니다.
2. subagent는 skill 콘텐츠를 프롬프트로 받습니다("Research \$ARGUMENTS
   thoroughly...").
3. `agent` 필드는 실행 환경(모델, 도구 및 권한)을 결정합니다.
4. 결과는 요약되어 주 대화로 반환됩니다.

`agent` 필드는 사용할 subagent 구성을 지정합니다. 옵션에는 기본 제공
에이전트(`Explore`, `Plan`, `general-purpose`) 또는 `.claude/agents/`의 모든
사용자 정의 subagent가 포함됩니다. 생략하면 `general-purpose`를 사용합니다.

### Claude의 Skill 액세스 제한

기본적으로 Claude는 `disable-model-invocation: true`가 설정되지 않은 모든
skill을 호출할 수 있습니다. `allowed-tools`를 정의하는 Skills는 skill이
활성화되었을 때 사용자별 승인 없이 Claude에게 이러한 도구에 대한 액세스를
부여합니다. 권한 설정은 여전히 다른 모든 도구에 대한 기본 승인 동작을
관리합니다. `/init`, `/review`, `/security-review`를 포함한 몇 가지 기본 제공
명령어도 Skill 도구를 통해 사용 가능합니다. `/compact`와 같은 다른 기본 제공
명령어는 그렇지 않습니다.

Claude가 호출할 수 있는 skills를 제어하는 세 가지 방법:

**`/permissions`에서 Skill 도구를 거부하여 모든 skills를 비활성화합니다:**

```text
# Add to deny rules:
Skill
```

**권한 규칙을 사용하여 특정 skills를 허용하거나 거부합니다:**

```text
# Allow only specific skills
Skill(commit)
Skill(review-pr *)

# Deny specific skills
Skill(deploy *)
```

권한 구문: 정확한 일치는 `Skill(name)`, 모든 인수를 사용한 접두사 일치는
`Skill(name *)`.

**개별 skills를 숨기기** - frontmatter에 `disable-model-invocation: true`를
추가합니다. 이는 Claude의 컨텍스트에서 skill을 완전히 제거합니다.

> **참고**: `user-invocable` 필드는 메뉴 가시성만 제어하고 Skill 도구 액세스는
> 제어하지 않습니다. 프로그래밍 방식 호출을 차단하려면
> `disable-model-invocation: true`를 사용합니다.

### 설정에서 Skill 가시성 재정의

`skillOverrides` 설정은 skill의 자체 frontmatter 대신 설정에서 skill 가시성을
제어합니다. 공유 프로젝트 리포지토리에 체크인되거나 MCP 서버에서 제공하는
것처럼 SKILL.md를 편집하고 싶지 않은 skills에 사용합니다. `/skills` 메뉴가
이를 작성합니다: skill을 강조하고 `Space`를 눌러 상태를 순환한 다음 `Enter`를
눌러 `.claude/settings.local.json`에 저장합니다.

각 키는 skill 이름이고 각 값은 다음 네 가지 상태 중 하나입니다:

| 값 | Claude에 나열됨 | `/` 메뉴에서 |
|---|---|---|
| `"on"` | 이름 및 설명 | 예 |
| `"name-only"` | 이름만 | 예 |
| `"user-invocable-only"` | 숨김 | 예 |
| `"off"` | 숨김 | 숨김 |

`skillOverrides`에 없는 skill은 `"on"`으로 처리됩니다. 아래 예제는 한 skill을
이름으로 축소하고 다른 skill을 완전히 끕니다:

```json
{
  "skillOverrides": {
    "legacy-context": "name-only",
    "deploy": "off"
  }
}
```

플러그인 skills은 `skillOverrides`의 영향을 받지 않습니다. `/plugin`을 통해
이를 관리합니다.


---

## 관련 파일

- [index.md](index.md) — 전체 목차, frontmatter 필드 요약, 라우팅 표
- [storage-and-config.md](storage-and-config.md)
- [configuration-reference.md](configuration-reference.md)
- [sharing-and-troubleshooting.md](sharing-and-troubleshooting.md)
- [visualizer-example.md](visualizer-example.md)
