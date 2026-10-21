# Codex 설치·지원 범위

이 저장소의 12개 플러그인은 Claude Code와 Codex 카탈로그에 함께 등록되어 있다.
Codex에서는 플러그인 설치로 스킬을 사용하고, 격리된 작업이 필요하면 커스텀 에이전트를
추가 등록한다. 카탈로그에 등록되었다는 사실과 실제 앱에서의 호출 검증은 구분한다.

## 지원 구성

| 플러그인 | Codex 스킬 | 에이전트 |
|---|---|---:|
| frontend-support-plugin | 기존 설계·테스트 규약 5개 + frontend-workflows | 3 |
| domain-knowledge-plugin | domain-knowledge | 2 |
| ui-template-manage-plugin | component-documentation | 1 |
| planning-plugin | change-planning | 1 |
| wiki-manager-plugin | wiki-knowledge, wiki-log, wiki-ingest, wiki-new-project | 1 |
| mfe-architecture-plugin | mfe-boundary-design, mfe-runtime-troubleshooting, mfe-workflows | 2 |
| module-federation-official-plugin | mf | 0 |
| architecture-manage-plugin | c4-modeling, syncing-c4-model, c4-briefing | 1 |
| claude-code-docs-plugin | claude-code-hooks, claude-code-jsonl, claude-maintenance | 6 |
| agent-factory-plugin | session-feedback + Observer MCP + 공식 훅 수집 | 1 |
| codex-docs-plugin | codex-docs | 0 |
| docs-bucket-plugin | docs-bucket | 0 |

`claude-code-docs-plugin`은 Codex에서 **Claude Code용 정의**를 관리한다. Codex 자체의
규격은 `codex-docs-plugin`을 사용한다. 두 제품의 모델·설정 필드를 서로 치환하지 않는다.

## 카탈로그 등록·설치

변경이 포함된 로컬 체크아웃의 루트에서:

```bash
codex plugin marketplace add .
```

지원되는 Codex 앱의 `personal` 마켓플레이스에서 원하는 플러그인을 설치한다.
이름은 생성 도구 기본값이며 Claude 카탈로그 이름은 `ksw-plugins`다.
같은 이름의 다른 카탈로그가 이미 있으면 기존 등록을 덮어쓰지 말고 등록 경로를 확인한다.
저장소 카탈로그는 `.agents/plugins/marketplace.json`이고 source는 저장소 루트 기준이다.
원격에 아직 푸시하지 않은 변경은 원격 URL 등록으로 받을 수 없다.
IDE 확장 자체는 플러그인 설치를 지원하지 않는다.

## 에이전트 선택 등록

Python 3가 필요하다. 실제로 작업할 프로젝트를 지정한다. 아래는 모두 **미리보기**다.

```bash
python3 scripts/install-codex-agents.py --project /path/to/project
python3 scripts/install-codex-agents.py --project /path/to/project --plugin planning-plugin
python3 scripts/install-codex-agents.py --project /path/to/project --plugin domain-knowledge-plugin --plugin mfe-architecture-plugin
python3 scripts/install-codex-agents.py --project /path/to/project --all
```

확인 후 같은 명령에 `--write`를 붙이면 대상 `.codex/agents/`에 TOML을 등록한다.
옵션을 생략하면 기존 동작대로 frontend 에이전트 3개, `--all`은 총 18개를 등록한다.
스킬 전용 플러그인은 에이전트 파일을 만들지 않는다. 기존 파일과 내용이 다르면 어느
파일도 쓰기 전에 중단한다. 동일 내용으로 재실행할 수 있다.

원본 체크아웃의 절대 경로가 등록 파일에 들어가므로 체크아웃을 유지하고 개인 경로가
포함된 생성 TOML은 커밋하지 않는다. 팀원은 각자 등록 명령을 실행한다.
기존 버전의 등록 파일이 있으면 내용을 비교·보관한 뒤 해당 파일을 정리하고 재등록한다.
모델은 세션 설정을 상속한다. 감사·계획·브리핑은 읽기 전용이며 작성 역할은 workspace-write다.
프로젝트를 신뢰하고 새 세션에서 에이전트를 호출한다.

스킬 진입점은 에이전트 미등록 시 원본 업무 절차를 직접 실행할 수 있다.
읽기 전용 에이전트에서 검증에 파일 쓰기가 필요한 경우 실행 미검증을 보고한다.

## 사용 예

- `domain-knowledge 스킬로 이 주문 API 명세를 프로젝트 스킬로 기록해줘.`
- `change-planner를 사용해 이 변경의 계획 JSON을 만들어줘.`
- `wiki-log로 지금 대화를 Daily Note에 기록해줘.`
- `wiki-new-project로 vault에 새 프로젝트를 등록해줘.`
- `remote-contract-manager로 이 Remote의 exposes 계약을 정리해줘.`
- `c4-modeling으로 모델을 만들고 번들 검증기로 확인해줘.`
- `mf config로 Module Federation 설정을 점검해줘.`
- `codex-docs 스킬로 이 Codex 플러그인 설정을 검토해줘.`

Codex용 새 도메인·컴포넌트·Remote 계약 스킬은 기본 `.agents/skills/`에 기록한다.
기존 `.claude/skills/`는 탐색하되 자동 이동하지 않는다. 사용자 지정 위치는 유지한다.
C4는 플러그인에 번들된 `schema/validate.mjs`를 사용하며 프로젝트에 별도 복사하지 않는다.
wiki는 `KB_VAULT_PATH`를 기본 홈 경로보다 우선하며 vault 쓰기 권한이 필요하다.
MF 브라우저 관측에는 업스트림의 Divebell 의존성이 있으며 설치가 없으면 그 단계는 미실행이다.

## agent-factory의 Codex 수집

Node와 로컬 실행 환경이 필요하다. 설치만으로 훅이 신뢰되지는 않는다. 지원 클라이언트에서
현재 훅 정의를 검토·신뢰해야 실행된다. 플러그인 훅의 `PLUGIN_ROOT`로 런타임을 구분한다.

- `UserPromptSubmit`: 사용자 입력을 기록한다.
- `PostToolUse`: 도구 입력의 요약과 결과를 기록한다. Bash 결과의 성공 상태를 확인하고
  실제 커밋·중복·최신성 가드를 통과하면 큐에 델타를 적재한다.
- `Stop`: 최종 응답을 기록한다. 서버 전송 훅이 아니다.
- 기존 Claude PreToolUse 자동 허용은 Codex에서 수행하지 않는다.

이벤트는 `~/.agent-factory/codex/events/`에 저장한다(`AGENT_FACTORY_HOME`으로 변경 가능).
기존 큐·digest·로컬 요약 파이프라인을 재사용한다. 내부 transcript 형식에는 의존하지 않는다.
훅을 신뢰하기 전 기록, 중간 assistant 응답, 내부 추론, 서브에이전트 귀속, 토큰·비용은
수집하지 않는다. digest의 `cost_tokens`·`hygiene_delta`는 `null`이고 `measurement_limits`를
함께 제공한다. 텍스트는 이벤트당 16000자로 제한한다. 커밋 뒤 Stop 응답은 다음 커밋 델타에
포함되므로 마지막 미캡처 이벤트는 로컬에 남는다. 성공 상태를 해석하지 못한 커밋은 건너뛴다.

`session-feedback`로 현재 프로젝트 큐를 요약한다. 전체 큐 처리는 명시적으로 요청한다.
서버 전송·전송 성공분 삭제는 별도 요청이 있을 때만 실행한다. Observer 조회에는 기존
config.json의 apiBase·token 또는 OBSERVER_API_BASE·OBSERVER_TOKEN이 필요하다.
원격 Observer 인증·서버 수용 여부는 로컬 검증과 별도로 확인해야 한다.

## 검증·갱신

```bash
node scripts/validate-all.js
```

카탈로그·양쪽 매니페스트, 스킬 링크, 에이전트 전체 등록과 충돌 방지, Codex 훅 → 큐 →
digest 흐름을 검사한다. 모든 플러그인은 두 매니페스트의 버전을 함께 올리고 CHANGELOG를
기록한다. pre-commit 자동 patch 상승도 양쪽 버전에 반영된다.

앱에서 카탈로그 갱신·플러그인 재설치 후 새 세션으로 확인한다. 등록 TOML은 위 절차로
별도 갱신한다. 제거도 플러그인 제거와 등록 TOML 제거를 구분한다.
실제 지원 앱에서의 자동 스킬 선택·에이전트 위임·훅 신뢰·Observer 연결은 별도 사용 시험이 필요하다.

공식 근거:
- https://developers.openai.com/plugins/build/plugins
- https://learn.chatgpt.com/docs/build-skills
- https://learn.chatgpt.com/docs/agent-configuration/subagents
- https://learn.chatgpt.com/docs/hooks
