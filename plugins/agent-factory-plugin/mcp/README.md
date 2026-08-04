# observer MCP (플러그인 번들)

`agent-factory-plugin` 에 번들된 **읽기 전용** stdio MCP 서버. 커밋 단위 에이전트 사용
집계를 Observer 서버 REST(`/api/agent-factory/*`)를 감싸 Claude Code 에서 질의하게 한다.
원본: `personal-coding-agent-monitor/mcp`.

## 도구 (9개, 전부 읽기 전용)

집계 로직은 Observer 웹앱이 소유하고, 각 도구는 대응 REST 엔드포인트(`/api/agent-factory/…`)의
결과를 그대로 반환한다.

| 도구 | 소스 REST | 인자 | 용도 |
|---|---|---|---|
| `list_agent_usage` | `/stats/agents` | — | 에이전트별 commits·spawns·input/output/cache 토큰·toolCalls·errors (outputTokens 내림차순) |
| `list_plugin_usage` | `/stats/plugins` | — | 플러그인 축 집계(소속 에이전트 계량치 합)·고유 에이전트 수 |
| `list_skill_usage` | `/stats/skills` | — | 스킬별 호출 빈도(invocations)·등장 커밋 수·errors |
| `feedback_breakdown` | `/stats/feedback` | — | 5축(DELEGATION_FIT·REWORK_LOOP·TOOL_SCOPING·COST·REPO_NORMS)×판정(GOOD·CONCERN·INSUFFICIENT_EVIDENCE) 분포 |
| `signal_summary` | `/stats/signals` | — | polarity(POSITIVE/NEGATIVE)×verdict(CONFIRMED/FALSE_POSITIVE) 건수 — 정정 루프·오탐율 |
| `token_trend` | `/stats/tokens/daily` | — | 일자별 토큰(input/output/cache)·커밋 수 — 비용 추세 |
| `search_records` | `/records` | `projectId`·`userId`·`agent`·`status`·`from`·`to`·`page`·`pageSize` (모두 선택) | 커밋 기록을 필터로 조회(요약 필드만, rawMarkdown 제외) |
| `get_record` | `/records/:id` | `id` (필수, cuid) | 한 커밋의 전체 상세 + `rawMarkdown` — 인용 근거화 |
| `get_meta` | `/meta` | — | `search_records` 필터에 쓸 projects·users 목록(id 포함) |

> "수준 좋다/나쁘다"의 판정 기준(5축 rubric)은 이 서버가 아니라 `agent-usage-review` 스킬이
> 쥔다. 서버는 근거 데이터만 내고, 해석·판정은 스킬 규칙을 따른다 — 재배포 없이 기준 튜닝을 위함.

## 등록

`plugin.json` 의 `mcpServers.observer` 가 `node ${CLAUDE_PLUGIN_ROOT}/mcp/dist/index.mjs`
를 실행한다. 플러그인이 활성화되면 세션 시작 시 자동 연결된다.

- 도구 전체 이름: `mcp__plugin_agent-factory-plugin_observer__<tool>` (예: `…__list_agent_usage`).
- 서버 등록명: `plugin:agent-factory-plugin:observer`.

## 실행 조건 — 번들은 "실행"만 자립, "동작"은 아니다

`dist/index.mjs` 는 의존성을 인라인한 단일 파일이라 node_modules·tsx 없이 `node` 만으로
뜬다. 그러나 도구가 값을 내려면 **Observer API 서버가 도달 가능**하고 접속 설정이 있어야 한다.
설정은 push 훅과 **같은** 파일을 공유한다:

- `~/.agent-factory/config.json` 의 `{ "apiBase": "...", "token": "..." }`
- 또는 환경변수 `OBSERVER_API_BASE` / `OBSERVER_TOKEN` (파일보다 우선. 하위호환으로
  `AGENT_FACTORY_*` 도 인식).

설정이 없으면 도구 호출이 `isError` 로 이유를 반환한다(서버 자체는 정상 연결됨).

## 재빌드

`src/` 를 고치면 번들을 다시 만든다. esbuild 가 의존성을 인라인하므로 원본 저장소의
node_modules 를 참조해 빌드한다:

```bash
cd plugins/agent-factory-plugin/mcp
ln -sfn <원본>/personal-coding-agent-monitor/mcp/node_modules node_modules
npx esbuild src/index.ts --bundle --platform=node --format=esm --target=node18 --outfile=dist/index.mjs
rm -f node_modules   # 심링크 제거 — 번들은 자립형
```

> 플러그인 내용을 바꿨으므로 `plugin.json` 의 `version` 을 올린다(pre-commit 훅이 patch 자동).
