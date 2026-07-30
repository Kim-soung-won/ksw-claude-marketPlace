# 플러그인 제공 MCP 서버와 고급 주제

이 저장소는 **플러그인 마켓플레이스**이므로, 여기서 가장 흔한 작업은 특정 플러그인에 MCP 서버를
번들하는 것이다. 그 방법을 먼저 다루고, Tool Search·Claude.ai 커넥터·Claude Code를 MCP 서버로·
MCP resources/prompts·elicitation·도구 승인 주석을 이어서 다룬다.

## 목차
- [플러그인에 MCP 서버 번들](#플러그인에-mcp-서버-번들)
- [Tool Search와 alwaysLoad](#tool-search와-alwaysload)
- [Claude.ai 커넥터](#claudeai-커넥터)
- [Claude Code를 MCP 서버로](#claude-code를-mcp-서버로)
- [MCP resources / prompts](#mcp-resources--prompts)
- [elicitation 요청 응답](#elicitation-요청-응답)
- [도구 승인 주석](#도구-승인-주석)

---

## 플러그인에 MCP 서버 번들

플러그인은 MCP 서버를 번들하며, 활성화되면 세션 시작 시 자동 연결된다. 두 위치 중 하나에 정의한다:

**플러그인 루트 `.mcp.json`**:
```json
{
  "mcpServers": {
    "database-tools": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/db-server",
      "args": ["--config", "${CLAUDE_PLUGIN_ROOT}/config.json"],
      "env": { "DB_URL": "${DB_URL}" }
    }
  }
}
```

**또는 `plugin.json`에 인라인**:
```json
{
  "name": "my-plugin",
  "mcpServers": {
    "plugin-api": {
      "command": "${CLAUDE_PLUGIN_ROOT}/servers/api-server",
      "args": ["--port", "8080"]
    }
  }
}
```

핵심 규칙:
- **경로 자리표시자**: `${CLAUDE_PLUGIN_ROOT}`(설치 디렉터리), `${CLAUDE_PLUGIN_DATA}`(지속 상태
  디렉터리), `${CLAUDE_PROJECT_DIR}`(프로젝트 루트). 치환 적용 위치 — stdio: `command`/`args`/`env`,
  http/sse/ws: `url`/`headers`/`headersHelper`(v2.1.195 이전엔 `headersHelper`가 리터럴로 전달됨).
  이 변수들은 기본값 없이 직접 치환된다(`:-default` 불필요).
- **라이프사이클**: 활성 플러그인 서버는 세션 시작 시 자동 연결. 세션 중 활성/비활성 전환 후에는
  `/reload-plugins`로 연결·해제.
- 여러 전송 유형(stdio/sse/http/ws) 지원(서버에 따라 다름). 사용자 환경변수 접근은 수동 구성 서버와 동일.
- 우선순위: 플러그인 서버는 스코프 서버(local/project/user)보다 낮고 Claude.ai 커넥터보다 높다.
  엔드포인트로 중복 판정.

**도구 이름 규칙**: 플러그인 번들 서버의 도구는 전체 이름이
`mcp__plugin_<plugin-name>_<server-name>__<tool-name>`이며, `A-Z a-z 0-9 _ -` 외 문자는 `_`로 바뀐다.
예: `my-plugin`의 `database-tools` 서버 `query` 도구 → `mcp__plugin_my-plugin_database-tools__query`.
권한 규칙·스킬 `allowed-tools`·서브에이전트 `tools`·hook matcher에서 이 **전체 이름**을 쓴다
(베어 서버 키 `mcp__database-tools__.*`로 쓴 matcher는 플러그인 번들 서버에 매칭되지 않는다).
서버 자체는 `plugin:<plugin-name>:<server-name>`(예: `plugin:my-plugin:database-tools`)으로 등록된다
— 구성된 서버명이 필요한 곳(hook의 `server` 필드 등)에는 이 이름을 쓴다.

`/mcp`에서 플러그인 서버는 표시기와 함께 나타난다. 관리는 `/mcp`가 아니라 플러그인 설치로 한다.

> 이 저장소 규칙: 새/수정 MCP 서버를 어느 플러그인의 `.mcp.json`/`plugin.json`에 둘지 정하고,
> 경로는 반드시 `${CLAUDE_PLUGIN_ROOT}`로 표기한다. 플러그인 내용을 바꾸면 `plugin.json`의
> `version`을 올려야 하지만(pre-commit 훅이 patch를 자동 처리), 이 판단은 에이전트 본문 규칙을 따른다.

## Tool Search와 alwaysLoad

Tool Search는 기본 활성. MCP 도구 정의를 필요할 때까지 연기해 컨텍스트 사용을 낮게 유지한다
(시작 시 도구 이름·서버 지침만 로드). 사용자 관점 동작은 동일. 서버당 도구 상한은 없고 실질 한계는
컨텍스트 예산이다.

`ENABLE_TOOL_SEARCH` 값:

| 값 | 동작 |
|---|---|
| (미설정) | 모든 MCP 도구 연기·필요 시 로드. GCP Agent Platform 또는 비자사 `ANTHROPIC_BASE_URL`이면 preload로 폴백 |
| `true` | 모두 연기. 프록시·GCP에도 베타 헤더 전송(미지원 모델/프록시에서 실패 가능) |
| `auto` | 도구가 컨텍스트 윈도우 10% 이내면 preload, 아니면 연기 |
| `auto:N` | 임계값 N%(0-100), 예 `auto:5` |
| `false` | 모두 preload |

`CLAUDE_CODE_DISABLE_EXPERIMENTAL_BETAS`가 있으면 Tool Search가 꺼지고 `ENABLE_TOOL_SEARCH`로
재정의 불가. `tool_reference` 지원 모델 필요(Sonnet 4.5, Haiku 4.5, Opus 4.5 이상). `ToolSearch`
도구 자체를 끄려면 `permissions.deny`에 `"ToolSearch"`.

**서버를 연기에서 제외** — 매 턴 필요한 소수 도구에만:
```json
{ "mcpServers": { "core-tools": {
  "type": "http", "url": "https://mcp.example.com/mcp", "alwaysLoad": true
}}}
```
`alwaysLoad`는 모든 서버 유형 지원(v2.1.121+). 서버가 도구 `_meta`에
`"anthropic/alwaysLoad": true`를 넣어 개별 도구만 항상 로드할 수도 있다. `alwaysLoad: true`는
서버 연결까지 시작을 차단한다(표준 5초 연결 타임아웃; 다른 서버는 백그라운드 연결 지속).

**서버 작성자용**: Tool Search 활성 시 서버 지침(instructions) 필드가 중요해진다 — 도구 범주,
언제 검색해야 하는지, 주요 기능을 명확히 기술한다. 도구 설명·서버 지침은 각각 2KB에서 잘리므로
간결하게, 중요한 내용을 앞에 둔다.

## Claude.ai 커넥터

claude.ai 계정으로 Claude Code에 로그인했다면 claude.ai에서 추가한 MCP 서버(커넥터)가 자동으로
사용 가능하다. [claude.ai/customize/connectors]에서 추가·인증하고 Claude Code에서 `/mcp`로 확인.
Team/Enterprise는 관리자만 추가.

- 활성 인증 방식이 Claude.ai 구독일 때만 로드된다. `ANTHROPIC_API_KEY`·`ANTHROPIC_AUTH_TOKEN`·
  `apiKeyHelper`·Bedrock/GCP가 활성이면 로드 안 됨(`/status`로 확인 후 해당 변수 해제·`/login`).
- Claude Code에서 같은 URL로 추가한 서버가 커넥터보다 우선하며 `/mcp`가 커넥터를 숨김 표시.
- 일부 Anthropic 호스팅 커넥터(M365·Gmail·Google Calendar)는 로컬 OAuth를 지원하지 않아
  claude.ai의 설정 → 커넥터에서 연결해야 한다(v2.1.162+ 안내).
- 조직은 커넥터 도구에 도구별 제어를 걸 수 있다(v2.1.129+): `ask`(모든 호출 승인, 권한 모드
  무시), `blocked`(Claude에게 안 보임).
- **비활성화**: 모든 스코프에서 `"disableClaudeAiConnectors": true`(모든-소스-true 의미론 — 어느
  소스든 true면 우선), 또는 `ENABLE_CLAUDEAI_MCP_SERVERS=false`. 개별 차단은 `deniedMcpServers`.
  단, Claude Code on the web 세션에는 `disableClaudeAiConnectors`가 적용되지 않는다(원격 프로비저닝).

## Claude Code를 MCP 서버로

Claude Code 자체를 stdio MCP 서버로 노출:
```bash
claude mcp serve
```
Claude Desktop `claude_desktop_config.json`:
```json
{ "mcpServers": { "claude-code": {
  "type": "stdio", "command": "claude", "args": ["mcp", "serve"], "env": {}
}}}
```
`claude`가 PATH에 없으면 `which claude`로 전체 경로를 지정한다(아니면 `spawn claude ENOENT`).
서버는 View·Edit·LS 등 Claude 도구를 노출하며, 개별 도구 호출 사용자 확인은 클라이언트 책임이다.

## MCP resources / prompts

- **resources**: `@server:protocol://resource/path` 형식으로 `@` 멘션 참조(자동 완성에 파일과 함께
  나타남). 예: `@github:issue://123`, `@docs:file://api/authentication`. 여러 개 동시 참조 가능.
  참조 시 자동으로 가져와 첨부된다. Claude Code는 서버가 지원하면 리소스 나열·읽기 도구를 자동 제공.
- **prompts as commands**: `/mcp__servername__promptname`으로 노출. 인수는 뒤에 공백 구분으로 전달
  (예: `/mcp__jira__create_issue "로그인 버그" high`). 서버·프롬프트 이름의 공백은 언더스코어로 정규화.

## elicitation 요청 응답

서버가 작업 중 구조화 입력을 요청(elicitation)하면 Claude Code가 대화상자를 표시하고 응답을
전달한다(사용자 구성 불필요). **양식 모드**(서버 정의 필드 입력)와 **URL 모드**(브라우저 인증/승인
후 CLI 확인)가 있다. 자동 응답은 `Elicitation` hook으로 처리한다.

## 도구 승인 주석

서버 작성자는 `tools/list` 항목의 `_meta`에 주석을 넣어 도구별 동작을 제어한다:
- `"anthropic/requiresUserInteraction": true` (JSON `true`만 유효; v2.1.199+): 모든 호출에서 명시적
  승인 프롬프트를 표시하고 `acceptEdits`/`auto`/`bypassPermissions`에서도 강제, "다시 묻지 않기"
  없음, 허용 규칙도 건너뛰지 못함. `dontAsk`에서는 호출 거부. `--permission-prompt-tool`의 allow는
  `MCP tool requires user interaction; not supported via --permission-prompt-tool`로 거부로 변환되고,
  Agent SDK `canUseTool` 콜백은 수신·승인 가능. 동의·접근 부여처럼 프롬프트 자체가 요점인 도구에 쓴다.
- `"anthropic/maxResultSizeChars": <n>`: 개별 도구 텍스트 결과 임계값 상향(→ `transports-and-management.md`).
- `"anthropic/alwaysLoad": true`: 개별 도구를 Tool Search 연기에서 제외(위 참조).
