# ksw-plugins

Claude Code 플러그인 마켓플레이스. 프론트엔드 개발과 Claude Code 자체를 다루는 작업에서
반복되는 판단을 서브에이전트·스킬로 묶어둔 것이다.

플러그인은 서로 독립이다. 필요한 것만 골라 설치하면 된다.

## 설치

Claude Code 안에서 두 줄이면 끝이다.

```bash
/plugin marketplace add https://github.com/Kim-soung-won/ksw-claude-marketPlace.git
/plugin install frontend-support-plugin@ksw-plugins
```

두 번째 줄의 이름만 바꿔 원하는 플러그인을 추가로 설치한다. 갱신은 `/plugin marketplace update`
후 세션을 다시 시작한다.

> **이 저장소를 클론할 필요는 없다.** 위 두 줄이면 된다.
> 클론은 플러그인 자체를 고치는 사람만 한다 — 아래 "개발" 참고.

## 플러그인

| 플러그인 | 하는 일 | 구성 |
|---|---|---|
| [`frontend-support-plugin`](plugins/frontend-support-plugin/) | FSD 구조 scaffold, vitest 테스트 작성·감사, 컴포넌트 설계 기준 | 에이전트 3 · 스킬 3 |
| [`claude-code-docs-plugin`](plugins/claude-code-docs-plugin/) | 서브에이전트·스킬·hook·MCP 서버를 공식 규격대로 만들고 진단 | 에이전트 6 · 스킬 2 |
| [`domain-knowledge-plugin`](plugins/domain-knowledge-plugin/) | 협업자에게 받은 API 스펙·시나리오를 SKILL.md 트리오로 기록·감사 | 에이전트 2 |
| [`wiki-manager-plugin`](plugins/wiki-manager-plugin/) | Obsidian vault 노트 캡처와 위키링크 연계 | 에이전트 1 · 커맨드 3 |
| [`mfe-architecture-plugin`](plugins/mfe-architecture-plugin/) | Module Federation 설정·경계 설계·런타임 트러블슈팅 | 에이전트 2 · 스킬 2 |
| [`ui-template-manage-plugin`](plugins/ui-template-manage-plugin/) | 공용 컴포넌트 라이브러리의 인터페이스를 SKILL.md 로 문서화 | 에이전트 1 |
| [`planning-plugin`](plugins/planning-plugin/) | 기존 코드베이스 변경 계획 JSON 수립 | 에이전트 1 |
| [`agent-factory-plugin`](plugins/agent-factory-plugin/) | 커밋 단위로 에이전트 사용을 캡처·요약하고 사용 피드백을 남긴다 | 에이전트 1 · 훅 2 · MCP |

각 플러그인의 변경 내역은 해당 디렉터리의 `CHANGELOG.md` 에 있다.

## 전제조건

대부분의 플러그인은 아무 준비 없이 동작한다. 아래 셋만 외부 자원을 쓴다.

| 전제 | 필요한 플러그인 | 없으면 |
|---|---|---|
| Obsidian vault (기본 `~/agent-knowledge-base`, `KB_VAULT_PATH` 로 변경) | `wiki-manager-plugin` | 에이전트가 vault 경로를 되묻는다. 다른 플러그인은 영향 없음 |
| Observer 서버 (`~/.agent-factory/config.json` 의 `apiBase`·`token`, 또는 `OBSERVER_API_BASE`·`OBSERVER_TOKEN`) | `agent-factory-plugin` 의 MCP 조회 도구 | 캡처·distill·요약까지는 그대로 동작한다. **MCP 조회 도구 9종만 오류를 반환한다** |
| `@we/ai-template` 를 쓰는 프로젝트 | `ui-template-manage-plugin` | 문서화할 대상이 없다 |

`agent-factory-plugin` 만 훅을 설치한다. 커밋 시(PostToolUse)와 도구 호출 시(PreToolUse)
동작하며, **작업 레포에는 아무것도 쓰지 않는다** — 산출물은 전부 사용자 레벨
`~/.agent-factory/` 에 둔다(위치는 `AGENT_FACTORY_HOME` 으로 변경 가능). 훅은 어떤 경우에도
커밋을 막지 않는다.

## 개발

클론한 뒤 **반드시 훅을 활성화한다.**

```bash
git config core.hooksPath .githooks
```

이 저장소에는 CI 가 없다. `.githooks/pre-commit` 이 유일한 자동 검증 지점인데, `core.hooksPath`
는 `.git/config` 에 저장되어 클론에 따라오지 않는다 — **설정하지 않으면 검증도 버전 자동
상승도 아무 경고 없이 통째로 건너뛴다.**

검증은 언제든 직접 돌릴 수 있다.

```bash
node scripts/validate-all.js
```

| 단계 | 보는 것 |
|---|---|
| 매니페스트 정합성 | marketplace ↔ plugin.json 의 이름·버전·description |
| 에이전트 정의 | frontmatter 필수 필드, `tools` 명시, 블록 스칼라 형식 |
| 스킬 정의 | `name` 과 디렉터리명 일치, description 최소 길이 |
| 개인 경로 유출 | 배포되는 파일의 `/Users/<name>` 등 절대 경로 (gitignore 된 파일은 제외) |
| CHANGELOG | 플러그인마다 `CHANGELOG.md` 존재, 직접 올린 버전의 항목 존재 |
| 단위 테스트 | `plugins/` 아래 `*.test.mjs` |

ERROR 는 커밋을 막고 WARN 은 출력만 한다. 우회가 필요하면 `SKIP_VALIDATE=1 git commit ...`.

설계 원칙(에이전트를 얇게 유지하는 이유, description 작성 규칙 등)은 [CLAUDE.md](CLAUDE.md) 에 있다.

## 버전과 CHANGELOG

명시 버전이 **사용자 측 갱신을 인식하는 유일한 키**다. 파일만 고치고 버전을 그대로 두면
`/plugin marketplace update` 를 해도 사용자에게 반영되지 않는다.

| 변경 | 버전 | CHANGELOG |
|---|---|---|
| 버그 수정·문서 보완 | pre-commit 훅이 **patch 를 자동으로 +1** | 없으면 WARN. 다음 커밋에 함께 적는다 |
| 기능 추가·동작 변경 | **직접 minor 를 올린다** | 없으면 **ERROR** — 커밋이 막힌다 |
| 호환 깨짐 | **직접 major 를 올린다** | 없으면 **ERROR** |

자동 상승과 강제 기준을 나눈 이유: pre-commit 훅은 검증기보다 먼저 patch 를 올리므로, 방금
생긴 patch 버전에 항목이 있을 수가 없다. 무조건 강제하면 그 커밋이 통과할 방법이 없어진다.
말할 것이 있어서 직접 올린 minor·major 에만 기록을 강제한다.
