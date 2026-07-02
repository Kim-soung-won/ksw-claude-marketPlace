# skill-docs — 목차 및 빠른 참조

> 출처: https://code.claude.com/docs/ko/skills (Claude Code 공식 문서, 2026-07-02 스냅샷)
> 전체 문서 인덱스: https://code.claude.com/docs/llms.txt
>
> 이 문서 세트는 원래 단일 파일 `skill-docs.md`(1,109줄)였으나, 매 호출마다
> 전체를 Read하면 narrow한 수정 작업에도 불필요한 토큰이 들어 이 5개 하위
> 파일로 분리했다. **이 index.md는 항상 먼저 읽는다.** 가장 자주 필요한
> frontmatter 필드 표는 여기 인라인으로 있어 하위 파일을 열지 않아도 되는
> 경우가 많다. 그 외 상세 내용이 필요하면 아래 "어떤 파일을 읽을지" 표를
> 기준으로 해당 파일만 연다.

## Skill이란

Skills는 Claude가 할 수 있는 작업을 확장한다. `SKILL.md` 파일을 지침과 함께
생성하면 Claude가 이를 자신의 도구 모음에 추가한다. Claude는 관련이 있을 때
skills를 사용하거나 `/skill-name`으로 직접 호출할 수 있다.

같은 지침, 체크리스트 또는 다단계 절차를 계속 채팅에 붙여넣거나, CLAUDE.md의
섹션이 사실이 아닌 절차로 성장했을 때 skill을 생성한다. CLAUDE.md 콘텐츠와
달리, skill의 본문은 사용할 때만 로드되므로 긴 참조 자료는 필요할 때까지
거의 비용이 들지 않는다.

Claude Code skills는 Agent Skills(`https://agentskills.io`) 개방형 표준을
따르며, 이는 여러 AI 도구에서 작동한다. Claude Code는 호출 제어, subagent
실행, 동적 컨텍스트 주입과 같은 추가 기능으로 표준을 확장한다.

## Frontmatter 필드 (이름·필수 여부·설명 전체 표)

`SKILL.md` 파일 상단의 `---` 마커 사이의 YAML frontmatter로 skill 동작을
구성한다. 모든 필드는 선택적이다. Claude가 skill을 언제 사용할지 알 수
있도록 `description`만 권장된다.

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

필드별 문법·예시(`arguments`/`$name` 치환, `allowed-tools`/`disallowed-tools`
문법, `context: fork`+`agent` 조합, `paths` glob 등)는
[configuration-reference.md](configuration-reference.md)를 참고한다.

## 저장 위치 요약

| 위치 | 경로 | 적용 대상 |
|---|---|---|
| Enterprise | 관리 설정 참조 | 조직의 모든 사용자 |
| Personal | `~/.claude/skills/<skill-name>/SKILL.md` | 모든 프로젝트 |
| Project | `.claude/skills/<skill-name>/SKILL.md` | 이 프로젝트만 |
| Plugin | `<plugin>/skills/<skill-name>/SKILL.md` | 플러그인이 활성화된 위치 |

우선순위: enterprise > personal > project. Plugin skills는
`plugin-name:skill-name` 네임스페이스를 쓰므로 다른 수준과 충돌하지 않는다.
저장 위치별 상세 규칙(라이브 변경 감지, 중첩 디렉토리 자동 검색, symlink
처리 등)은 [storage-and-config.md](storage-and-config.md)를 참고한다.

## 어떤 파일을 읽을지

| 작업 | 읽어야 할 파일 |
|---|---|
| 새 skill을 처음부터 만든다 | index.md(이 파일) → [storage-and-config.md](storage-and-config.md) → [configuration-reference.md](configuration-reference.md) |
| frontmatter 필드 하나만 추가/수정 (예: `disable-model-invocation`, `allowed-tools`) | 위 필드 표로 충분하면 index.md만. 문법·예시가 더 필요하면 [configuration-reference.md](configuration-reference.md)만 |
| 저장 위치(personal/project/plugin), 중첩 디렉토리 충돌, 라이브 변경 감지를 판단 | [storage-and-config.md](storage-and-config.md)만 |
| `context: fork`로 subagent 격리 실행을 구성하거나, 동적 컨텍스트 주입(`` !`cmd` ``)을 쓰거나, Skill 도구 접근을 제한 | [advanced-patterns.md](advanced-patterns.md)만 |
| skill이 트리거되지 않거나 과도하게 트리거되는 문제를 진단 | [sharing-and-troubleshooting.md](sharing-and-troubleshooting.md)의 "문제 해결" 절만 |
| evals로 skill을 검증하거나 공유 범위를 정한다 | [sharing-and-troubleshooting.md](sharing-and-troubleshooting.md)만 |
| 번들 스크립트가 있는 skill의 완성된 예시가 필요하다 | [visualizer-example.md](visualizer-example.md)만 (가장 크고 가장 드물게 필요하므로 별도 분리됨) |

narrow한 단일 필드 수정처럼 표에서 한 파일만 필요하다고 판단되면 그 파일만
Read한다. 여러 관심사가 겹치는 요청이거나 처음부터 새로 만드는 작업이면
표에 나열된 파일을 모두 읽는다.

## 하위 파일 목록

| 파일 | 내용 |
|---|---|
| [storage-and-config.md](storage-and-config.md) | 번들 skills(`/run`·`/verify`·`/run-skill-generator`), 첫 skill 생성 튜토리얼, 저장 위치별 상세 규칙, 라이브 변경 감지, 상위/중첩 디렉토리 자동 검색, `--add-dir` 추가 디렉토리 |
| [configuration-reference.md](configuration-reference.md) | Skill 콘텐츠 유형(참조형 vs 작업형), frontmatter 필드 상세 문법과 예시, 명령어 이름이 정해지는 규칙, 문자열 치환(`$ARGUMENTS`/`$name`/`${CLAUDE_SKILL_DIR}` 등), 지원 파일 추가, 호출 제어(`disable-model-invocation`/`user-invocable`), 콘텐츠 라이프사이클(압축 시 동작), 도구 사전 승인, 인수 전달 |
| [advanced-patterns.md](advanced-patterns.md) | 동적 컨텍스트 주입(`` !`cmd` ``), `context: fork`로 subagent에서 skill 실행, Claude의 Skill 액세스를 권한 규칙으로 제한, `skillOverrides` 설정으로 가시성 재정의 |
| [sharing-and-troubleshooting.md](sharing-and-troubleshooting.md) | evals 기반 평가·반복, skill 공유 범위(프로젝트/플러그인/관리), 문제 해결(트리거 안 됨/과다 트리거/설명 잘림), 관련 리소스 링크 |
| [visualizer-example.md](visualizer-example.md) | 부록 — 시각적 출력 skill 전체 예제(codebase-visualizer SKILL.md + 번들 Python 스크립트 전문) |
