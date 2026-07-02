# skill-docs — 번들 skills, 시작하기(첫 skill 생성), Skills가 있는 위치(저장 범위·라이브 변경 감지·자동 검색·추가 디렉토리)

> 출처: https://code.claude.com/docs/ko/skills (Claude Code 공식 문서, 2026-07-02 스냅샷)
> 이 파일은 `skill-docs/index.md`에서 분리된 하위 문서다. 전체 목차와
> frontmatter 필드 요약은 index.md를 먼저 확인한다.

---

## 번들 skills

Claude Code에는 모든 세션에서 사용 가능한 번들 skills 세트가 포함되어 있으며,
`disableBundledSkills` 설정으로 비활성화하지 않는 한 `/code-review`, `/batch`,
`/debug`, `/loop`, `/claude-api`를 포함합니다. 고정 로직을 직접 실행하는 대부분의
기본 제공 명령어와 달리, 번들 skills는 프롬프트 기반입니다: Claude에 상세한
지시사항을 제공하고 도구를 사용하여 작업을 조율하도록 합니다. 다른 skill과
동일한 방식으로 호출합니다: `/` 다음에 skill 이름을 입력합니다.

번들 skills는 명령어 참조(`https://code.claude.com/docs/ko/commands`)에
나열되어 있으며, 목적 열에 **Skill**로 표시됩니다.

### 앱 실행 및 확인

세 가지 번들 skills는 함께 작동하여 앱을 시작하고 테스트만이 아닌 실행 중인
앱에 대해 변경 사항을 확인합니다:

| Skill | 목적 |
|---|---|
| `/run` | 앱을 시작하고 변경 사항이 작동하는지 확인하기 위해 앱을 실행합니다 |
| `/verify` | 앱을 빌드하고 실행하여 코드 변경이 의도한 대로 작동하는지 확인하며, 테스트나 타입 체크로 돌아가지 않습니다 |
| `/run-skill-generator` | `/run`과 `/verify`에 프로젝트를 빌드하고 시작하는 방법을 가르칩니다 |

세 가지 skills 모두 Claude Code v2.1.145 이상이 필요합니다.

`/run`과 `/verify`는 설정 없이 작동합니다. 프로젝트 유형(CLI, 서버, TUI, 브라우저
기반)과 README, `package.json` 또는 `Makefile`의 내용으로부터 시작을 추론합니다.
이 추론은 표준 시작 이상의 것이 필요한 프로젝트(데이터베이스, env 파일, 그래픽
세션, 다단계 빌드)에 대해서는 신뢰할 수 없게 됩니다.

`/run-skill-generator`는 대신 레시피를 기록합니다. 깨끗한 환경에서 앱을
실행하고, 작동한 것(설치 명령어, env 변수, 시작 스크립트)을 캡처하고,
프로젝트별 skill로 `.claude/skills/run-<name>/`에 커밋합니다. 그 후 `/run`,
`/verify` 및 리포지토리의 다른 모든 에이전트는 레시피를 다시 발견하는 대신
기록된 레시피를 따릅니다. 프로젝트당 한 번 `/run-skill-generator`를 실행하고,
빌드 또는 시작 프로세스가 변경되면 다시 실행합니다.

## 시작하기

### 첫 번째 skill 생성

이 예제는 git 저장소의 커밋되지 않은 변경 사항을 요약하고 위험한 항목을 표시하는
skill을 생성합니다. 라이브 diff를 Claude가 읽기 전에 프롬프트로 가져오므로,
응답은 Claude가 열린 파일에서 추측할 수 있는 것이 아니라 실제 작업 트리에
기반합니다. Claude는 변경 사항에 대해 물어볼 때 자동으로 skill을 로드하거나
`/summarize-changes`로 직접 호출할 수 있습니다.

1. **skill 디렉토리 생성**

   개인 skills 폴더에 skill을 위한 디렉토리를 생성합니다. 개인 skills는 모든
   프로젝트에서 사용 가능합니다.

   ```bash
   mkdir -p ~/.claude/skills/summarize-changes
   ```

2. **SKILL.md 작성**

   모든 skill에는 두 부분이 있는 `SKILL.md` 파일이 필요합니다: Claude에게 skill을
   언제 사용할지 알려주는 YAML frontmatter (`---` 마커 사이)와 skill이 실행될 때
   Claude가 따르는 지침이 있는 markdown 콘텐츠입니다. 디렉토리 이름이 입력하는
   명령어가 되고, `description`은 Claude가 자동으로 skill을 로드할 시기를
   결정하는 데 도움이 됩니다.

   이를 `~/.claude/skills/summarize-changes/SKILL.md`에 저장합니다:

   ```yaml
   ---
   description: Summarizes uncommitted changes and flags anything risky. Use when the user asks what changed, wants a commit message, or asks to review their diff.
   ---

   ## Current changes

   !`git diff HEAD`

   ## Instructions

   Summarize the changes above in two or three bullet points, then list any risks you notice such as missing error handling, hardcoded values, or tests that need updating. If the diff is empty, say there are no uncommitted changes.
   ```

   `` !`git diff HEAD` `` 줄은 동적 컨텍스트 주입(아래 "동적 컨텍스트 주입" 절
   참고)을 사용합니다: Claude Code는 명령어를 실행하고 Claude가 skill 콘텐츠를
   보기 전에 줄을 출력으로 바꾸므로, 지침은 현재 diff가 이미 인라인된 상태로
   도착합니다.

3. **skill 테스트**

   git 프로젝트를 열고, 파일을 약간 편집한 후, `claude`를 실행하여 Claude Code를
   시작합니다. 두 가지 방법으로 skill을 테스트할 수 있습니다.

   **Claude가 자동으로 호출하도록 하기** - 설명과 일치하는 항목을 물어봅니다:

   ```text
   What did I change?
   ```

   **또는 skill 이름으로 직접 호출하기**:

   ```text
   /summarize-changes
   ```

   어느 쪽이든 Claude는 편집의 짧은 요약과 위험 목록으로 응답해야 합니다.

### Skills가 있는 위치

skill을 저장하는 위치에 따라 누가 사용할 수 있는지가 결정됩니다:

| 위치 | 경로 | 적용 대상 |
|---|---|---|
| Enterprise | 관리 설정 참조 | 조직의 모든 사용자 |
| Personal | `~/.claude/skills/<skill-name>/SKILL.md` | 모든 프로젝트 |
| Project | `.claude/skills/<skill-name>/SKILL.md` | 이 프로젝트만 |
| Plugin | `<plugin>/skills/<skill-name>/SKILL.md` | 플러그인이 활성화된 위치 |

skills가 여러 수준에서 같은 이름을 공유할 때, enterprise가 personal을
재정의하고, personal이 project를 재정의합니다. 예를 들어, 프로젝트의
`.claude/skills/`에 있는 `code-review` skill은 번들된 `/code-review`를
대체합니다. Plugin skills는 `plugin-name:skill-name` 네임스페이스를 사용하므로
다른 수준과 충돌할 수 없습니다. `.claude/commands/`에 파일이 있으면 동일한
방식으로 작동하지만, skill과 명령어가 같은 이름을 공유하면 skill이 우선합니다.

Skills는 또한 작업 디렉토리 아래의 중첩된 `.claude/skills/` 디렉토리에서
로드됩니다. Claude가 하위 디렉토리의 파일을 읽거나 편집할 때, 해당 하위
디렉토리의 `.claude/skills/`에 있는 skills가 사용 가능해집니다. 이를 통해
monorepo 패키지가 자신의 skills를 제공할 수 있으며, 세션이 저장소 루트에서
시작되었더라도 해당 패키지에서 작업할 때 적용됩니다.

중첩된 skill이 다른 skill과 같은 이름을 공유하면, 둘 다 사용 가능합니다. 예를
들어, 프로젝트 루트에 `deploy` skill이 있고 `apps/web/.claude/skills/`에 다른
skill이 있는 경우:

- 중첩된 skill은 디렉토리 한정 이름 `apps/web:deploy` 아래에 나타납니다.
- 해당 설명은 어느 디렉토리에 적용되는지 나타냅니다.
- Claude는 작업 중인 파일과 일치하는 변형을 선택합니다.

`/deploy`를 입력하면 프로젝트 루트 skill이 실행됩니다. 중첩된 변형을 명시적으로
실행하려면 한정된 이름 `/apps/web:deploy`를 입력합니다.

`<skill-name>` 항목이 enterprise, personal 또는 project 위치에 있을 수 있으며,
디스크의 다른 곳에 있는 디렉토리로의 symlink일 수 있습니다. Claude Code는
symlink를 따라가고 대상 디렉토리에서 `SKILL.md`를 읽으며, 같은 대상에 둘 이상의
위치에서 도달할 수 있으면 Claude Code는 skill을 한 번만 로드합니다. Plugin
skills는 symlinks를 다르게 처리합니다(플러그인 참조 문서의 "마켓플레이스 내에서
symlinks를 사용하여 파일 공유" 참고).

> **참고**: `.claude-plugin/plugin.json`을 skill 폴더에 추가하면
> `<name>@skills-dir`이라는 플러그인으로 로드되므로, agents, hooks 및 MCP
> 서버를 번들로 제공할 수 있습니다. 프로젝트의 `.claude/skills/`에서는 먼저
> 작업 공간 신뢰 대화를 수락해야 합니다.

#### 라이브 변경 감지

Claude Code는 skill 디렉토리의 파일 변경을 감시합니다. `~/.claude/skills/`,
프로젝트 `.claude/skills/`, 또는 `--add-dir` 디렉토리 내의 `.claude/skills/`
아래에서 skill을 추가, 편집 또는 제거하면 Claude Code를 다시 시작하지 않고도
현재 세션 내에서 적용됩니다. 세션이 시작되었을 때 존재하지 않았던 최상위 skills
디렉토리를 생성하려면 Claude Code를 다시 시작해야 새 디렉토리를 감시할 수
있습니다.

> **참고**: 라이브 변경 감지는 `SKILL.md` 텍스트만 포함합니다. skill 폴더가
> 플러그인이기도 한 경우, `hooks/`, `.mcp.json`, `agents/` 및
> `output-styles/`의 변경 사항은 `/reload-plugins`를 실행해야 적용됩니다.

#### 상위 및 중첩된 디렉토리에서 자동 검색

프로젝트 skills는 시작 디렉토리의 `.claude/skills/`와 저장소 루트까지의 모든
상위 디렉토리에서 로드되므로, 하위 디렉토리에서 Claude를 시작해도 루트에서
정의된 skills를 선택합니다. 시작 디렉토리 아래의 하위 디렉토리에 있는 파일로
작업할 때, Claude Code는 필요에 따라 중첩된 `.claude/skills/` 디렉토리에서
skills를 검색합니다. 예를 들어, `packages/frontend/`의 파일을 편집하는 경우,
Claude Code는 `packages/frontend/.claude/skills/`에서도 skills를 찾습니다.
이는 패키지가 자신의 skills를 가진 monorepo 설정을 지원합니다.

각 skill은 `SKILL.md`를 진입점으로 하는 디렉토리입니다:

```text
my-skill/
├── SKILL.md           # 주요 지침 (필수)
├── template.md        # Claude가 채울 템플릿
├── examples/
│   └── sample.md      # 예상 형식을 보여주는 예제 출력
└── scripts/
    └── validate.sh    # Claude가 실행할 수 있는 스크립트
```

`SKILL.md`는 주요 지침을 포함하며 필수입니다. 다른 파일은 선택적이며 더 강력한
skills를 구축할 수 있습니다: Claude가 채울 템플릿, 예상 형식을 보여주는 예제
출력, Claude가 실행할 수 있는 스크립트 또는 상세한 참조 문서. `SKILL.md`에서
이러한 파일을 참조하여 Claude가 각 파일의 내용과 로드 시기를 알 수 있도록
합니다. 자세한 내용은 아래 "지원 파일 추가"를 참조하세요.

> **참고**: `.claude/commands/`의 파일은 계속 작동하며 동일한 frontmatter를
> 지원합니다. Skills는 지원 파일과 같은 추가 기능을 지원하므로 권장됩니다.

#### 추가 디렉토리의 Skills

`--add-dir` 플래그와 `/add-dir` 명령어는 파일 액세스를 부여하지만 구성 검색은
하지 않습니다. 그러나 skills는 예외입니다: 추가된 디렉토리 내의
`.claude/skills/`는 자동으로 로드됩니다. 이 예외는 `--add-dir`과 `/add-dir`에만
적용됩니다. `settings.json`의 `permissions.additionalDirectories` 설정은 파일
액세스만 부여하며 skills를 로드하지 않습니다.

다른 `.claude/` 구성(예: subagents, 명령어 및 출력 스타일)은 추가 디렉토리에서
로드되지 않습니다.

> **참고**: `--add-dir` 디렉토리의 CLAUDE.md 파일은 기본적으로 로드되지
> 않습니다. 로드하려면 `CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD=1`을
> 설정하세요.


---

## 관련 파일

- [index.md](index.md) — 전체 목차, frontmatter 필드 요약, 라우팅 표
- [configuration-reference.md](configuration-reference.md)
- [advanced-patterns.md](advanced-patterns.md)
- [sharing-and-troubleshooting.md](sharing-and-troubleshooting.md)
- [visualizer-example.md](visualizer-example.md)
