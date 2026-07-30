# 전송(transport) 세부와 서버 관리

전송 방식별 추가 방법, 모든 `claude mcp` 관리 명령, JSON/Claude Desktop 임포트, 타임아웃과
출력 제한, 동적 갱신·재연결을 다룬다. 빠른 표는 `index.md`에 있다.

## 목차
- [원격 HTTP 서버](#원격-http-서버-권장)
- [원격 SSE 서버(deprecated)](#원격-sse-서버-deprecated)
- [로컬 stdio 서버](#로컬-stdio-서버)
- [원격 WebSocket 서버](#원격-websocket-서버)
- [JSON으로 추가](#json으로-추가)
- [Claude Desktop에서 임포트](#claude-desktop에서-임포트)
- [서버 관리 명령](#서버-관리-명령)
- [타임아웃](#타임아웃)
- [출력 제한과 경고](#출력-제한과-경고)
- [동적 갱신·자동 재연결](#동적-갱신자동-재연결)
- [루트 결합자 입력 스키마](#루트-결합자-입력-스키마)

---

## 원격 HTTP 서버 (권장)

원격 연결의 권장 방식. 클라우드 서비스가 가장 널리 지원.

```bash
claude mcp add --transport http <name> <url>
# 예
claude mcp add --transport http notion https://mcp.notion.com/mcp
claude mcp add --transport http secure-api https://api.example.com/mcp \
  --header "Authorization: Bearer your-token"
```

JSON에서 `type`은 `http`의 별칭으로 `streamable-http`도 허용한다(MCP 사양 명칭). `url`은
있고 `type`이 없으면 구성 오류로 건너뛰며 `MCP server "<name>" has a "url" but no "type"; add
"type": "http" (or "sse" / "ws")`를 보고한다(v2.1.202 이전에는 `command: expected string,
received undefined`로 보고).

## 원격 SSE 서버 (deprecated)

SSE 전송은 더 이상 사용되지 않는다. 가능하면 HTTP를 쓴다.

```bash
claude mcp add --transport sse <name> <url>
claude mcp add --transport sse private-api https://api.company.com/sse \
  --header "X-API-Key: your-key-here"
```

## 로컬 stdio 서버

컴퓨터에서 로컬 프로세스로 실행. 시스템 직접 접근·커스텀 스크립트에 적합.

```bash
claude mcp add [options] <name> -- <command> [args...]
claude mcp add --env AIRTABLE_API_KEY=YOUR_KEY --transport stdio airtable \
  -- npx -y airtable-mcp-server
```

- **`--` 로 서버 명령 구분**: `--` 뒤의 모든 것이 서버에 그대로 전달된다. 없으면 서버 플래그
  (`--port` 등)를 Claude 옵션으로 잘못 파싱한다.
- `--env`는 여러 `KEY=value`를 받되 서버 이름을 `--env` 바로 뒤에 두지 않는다(다른 옵션을 사이에 하나).
- Claude Code는 stdio 서버 환경에 `CLAUDE_PROJECT_DIR`(프로젝트 루트)을 설정한다. 서버는
  `process.env.CLAUDE_PROJECT_DIR`(Node)/`os.environ["CLAUDE_PROJECT_DIR"]`(Python)로 읽는다.
  이 값은 세션 중 작업 디렉터리를 추가·제거해도 변하지 않는다. 파일 접근을 허용 디렉터리
  집합으로 제한하려면 MCP `roots/list`를 구현한다(Claude Code가 시작 디렉터리 + `--add-dir`
  추가 디렉터리로 응답하고, 변경 시 `notifications/roots/list_changed`를 보냄; v2.1.203 이전엔
  시작 디렉터리만 반환).
- `.mcp.json`의 `command`/`args`에서 `${CLAUDE_PROJECT_DIR}`를 참조하려면 기본값이 필요하다:
  `${CLAUDE_PROJECT_DIR:-.}`. (플러그인 제공 구성은 직접 치환되어 기본값 불필요.)

## 원격 WebSocket 서버

지속적 양방향 연결. 서버가 예고 없이 이벤트를 push하는 원격 서버에 적합. 요청에만 응답하면
HTTP를 쓴다. **OAuth와 `--transport` 플래그를 지원하지 않으므로** `add-json`/`.mcp.json`으로만 구성.

```bash
claude mcp add-json events-server \
  '{"type":"ws","url":"wss://mcp.example.com/socket","headers":{"Authorization":"Bearer YOUR_TOKEN"}}'
```

`type:"ws"`는 http와 동일하게 `url`·`headers`·`headersHelper`·`timeout`·`alwaysLoad`를 받는다.
인증은 헤더 전용(정적 `headers` 또는 `headersHelper`).

## JSON으로 추가

```bash
claude mcp add-json <name> '<json>'
# HTTP
claude mcp add-json weather-api '{"type":"http","url":"https://api.weather.com/mcp","headers":{"Authorization":"Bearer token"}}'
# stdio
claude mcp add-json local-weather '{"type":"stdio","command":"/path/to/weather-cli","args":["--api-key","abc123"],"env":{"CACHE_DIR":"/tmp"}}'
```

셸 이스케이프에 주의하고, JSON은 MCP 서버 구성 스키마를 준수해야 한다. `--scope user`로 사용자
구성에 넣을 수 있다.

## Claude Desktop에서 임포트

```bash
claude mcp add-from-claude-desktop
```

- macOS·WSL에서만 동작. 대화형 대화상자로 임포트할 서버 선택.
- 이름은 문자·숫자·하이픈·언더스코어만 허용 — 공백 등 다른 문자를 포함한 이름은 건너뛰고
  보고한다(v2.1.205 이전엔 첫 잘못된 이름에서 임포트 중단). 동명 서버가 있으면 `_1` 등 접미.

## 서버 관리 명령

```bash
claude mcp list             # 구성된 모든 서버
claude mcp get <name>       # 특정 서버 세부
claude mcp remove <name>    # 제거
/mcp                        # (세션 내) 상태 확인·인증·도구 개수
```

- `.mcp.json` 프로젝트 서버 중 승인 대기는 `⏸ 승인 대기 중`, 거부는 `✗ 거부됨`으로 표시.
- v2.1.196+: `claude mcp list`/`get`은 워크스페이스를 신뢰(대화형 `claude` 실행 + 신뢰 대화상자
  수락)하기 전에는 체크인되지 않은 설정만 읽는다. 복제된 저장소의 커밋된
  `enableAllProjectMcpServers`/`enabledMcpjsonServers`는 신뢰 안 된 폴더에서 무시된다.
- 항상 적용되는 승인 소스: 사용자 `~/.claude/settings.json`, managed 설정, `--settings`.
  추적 안 되는 `.claude/settings.local.json` 승인은 폴더 신뢰 후에만(단, 구성 홈이면 예외).
- 모든 설정의 `disabledMcpjsonServers`는 서버를 거부한다.
- 백그라운드 연결 중인 서버의 도구가 필요하면 연결될 때까지 대기(Tool Search 활성 시
  `ToolSearch` 내에서, 아니면 `WaitForMcpServers` 도구로).

## 타임아웃

- **`MCP_TIMEOUT`**(ms): 서버 시작 타임아웃(예: `MCP_TIMEOUT=10000 claude`).
- **서버당 `timeout`**(`.mcp.json`의 ms): 도구 호출당 하드 월클록 제한(진행 알림이 연장하지 않음).
  1000 미만은 무시되어 `MCP_TOOL_TIMEOUT`(미설정 시 약 28시간 기본)으로 넘어간다. HTTP/SSE/
  claude.ai 커넥터는 첫 응답 바이트까지의 요청당 타이머(기본 60초)도 있고, `timeout`/
  `MCP_TOOL_TIMEOUT`을 60초 이상으로 두면 그만큼 올라간다. stdio·ws는 요청당 타이머 없음.
- **유휴 타임아웃**: 응답·진행 알림 없이 유휴 윈도우가 지나면 중단. 기본 HTTP/SSE/ws/커넥터 5분,
  stdio 30분(v2.1.203 이전 stdio는 제외). `CLAUDE_CODE_MCP_TOOL_IDLE_TIMEOUT`(ms)로 변경, `0`으로 비활성화.

## 출력 제한과 경고

- MCP 도구 출력이 **10,000 토큰 초과 시 경고**(임계값 고정).
- 기본 최대 **25,000 토큰**. `MAX_MCP_OUTPUT_TOKENS`로 조정(예: `export MAX_MCP_OUTPUT_TOKENS=50000`).
- 서버 작성자는 도구의 `tools/list` 항목 `_meta["anthropic/maxResultSizeChars"]`로 개별 도구의
  텍스트 임계값을 올릴 수 있다(최대 500,000자 상한). 이 값은 `MAX_MCP_OUTPUT_TOKENS`와 독립.
  이미지 데이터를 반환하는 도구는 여전히 토큰 제한을 받는다. 임계값 초과 텍스트는 디스크에
  저장되고 대화에는 파일 참조로 대체된다.

## 동적 갱신·자동 재연결

- MCP `list_changed` 알림 지원 — 재연결 없이 도구·프롬프트·리소스를 동적 갱신.
- HTTP/SSE 재연결: 지수 백오프, 최대 5회(1초 시작, 매번 2배). 실패 시 `/mcp`에서 수동 재시도.
  stdio는 자동 재연결 안 함. 시작 시 초기 연결도 같은 백오프, 일시 오류(5xx·거부·타임아웃)는
  최대 3회 재시도(인증·not found는 재시도 안 함). 연결 실패는 Claude에 전달되어 응답에서 보고된다.

## 루트 결합자 입력 스키마

일부 서버는 도구 입력 스키마 최상위에 `anyOf`/`oneOf`/`allOf`를 둔다. Claude API는 루트 결합자를
허용하지 않는다. v2.1.195+는 스키마를 단일 객체로 평탄화하고 설명 앞에 매개변수 그룹 안내를
붙여 도구를 사용 가능하게 유지한다(서버 측 조합 검증은 계속 필요). 재작성이 불가능한 배포에서는
그 도구 하나만 건너뛰고 로그에 이유를 남긴다(v2.1.195 이전엔 해당 도구를 모두 건너뜀).
