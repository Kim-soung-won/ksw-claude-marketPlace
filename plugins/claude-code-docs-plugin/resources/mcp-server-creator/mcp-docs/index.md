# MCP 서버 구성 문서 — 목차 및 빠른 참조

이 세트는 Claude Code 공식 문서 "MCP를 통해 Claude Code를 도구에 연결하기"를
`mcp-server-creator` 에이전트가 근거로 삼도록 5개 파일로 나눈 것이다. 이 index.md에는
거의 매번 필요한 요약(전송 방식·스코프·`.mcp.json` 스키마·환경변수 확장)이 인라인으로
들어있고, 나머지 4개 하위 파일 중 무엇을 더 읽을지 결정하는 **라우팅 표**가 아래에 있다.

문서에 없는 필드·전송·동작을 추측해서 만들어내지 않는다. 버전별 동작 차이 주석
(`vX.Y.Z 이전에는 …`)은 사용자가 구버전을 쓸 수 있으므로 임의로 지우지 않는다.

---

## 라우팅 표 — 이번 작업에 어떤 하위 파일을 더 읽을지

| 이번 요청 | 추가로 읽을 파일 |
|---|---|
| 서버를 새로 추가/구성 (transport·`claude mcp add`·`add-json`·Desktop import·타임아웃·출력 제한) | `transports-and-management.md` |
| 스코프 선택(local/project/user)·우선순위·`.mcp.json` 환경변수 확장·조직 관리(managed) | `scopes-and-config.md` |
| 인증이 필요한 원격 서버(OAuth, `/mcp` login, 콜백 포트, 사전 등록 클라이언트, 범위 제한, `headersHelper`·정적 `headers`) | `authentication.md` |
| **이 저장소(플러그인 마켓플레이스)에서 플러그인에 MCP 서버를 번들**, 또는 Tool Search/`alwaysLoad`·Claude.ai 커넥터·Claude Code를 MCP 서버로·MCP resources/prompts·elicitation·승인 주석 | `plugin-servers.md` |

가장 흔한 경우: 이 저장소 안에서 "플러그인에 MCP 서버 붙여줘"라면 `plugin-servers.md`를
먼저 읽고, 전송·환경변수 세부는 `transports-and-management.md`·`scopes-and-config.md`로 보강한다.

---

## MCP가 무엇이고 언제 붙이는가

MCP(Model Context Protocol)는 Claude Code를 외부 도구·데이터 소스에 연결하는 오픈 표준이다.
다른 도구(이슈 추적기·모니터링 대시보드·DB 등)에서 데이터를 채팅으로 복사해 오는 상황이면
서버를 붙일 때다 — 연결되면 Claude가 그 시스템을 직접 읽고 조작한다.

> 경고: 외부 콘텐츠를 가져오는 서버는 프롬프트 주입 위험에 노출될 수 있다. 신뢰할 수 있는
> 서버만 연결한다.

---

## 전송 방식(transport) 빠른 표

| 전송 | 언제 | `claude mcp add` 구문 | JSON `type` |
|---|---|---|---|
| **http** (권장, 원격) | 클라우드 서비스 대부분 | `claude mcp add --transport http <name> <url>` | `"http"` (별칭 `"streamable-http"`) |
| **sse** (deprecated) | 레거시 원격 | `claude mcp add --transport sse <name> <url>` | `"sse"` |
| **stdio** (로컬) | 로컬 프로세스·커스텀 스크립트 | `claude mcp add [opts] <name> -- <command> [args...]` | `"stdio"` |
| **ws** (WebSocket) | 서버가 예고 없이 이벤트를 push | `claude mcp add-json <name> '{"type":"ws",...}'` (플래그 미지원) | `"ws"` |

핵심 규칙:
- **stdio는 `--`로 서버 명령을 구분**한다. `--` 앞은 Claude 옵션(`--transport`·`--env`·`--scope`),
  뒤는 서버 실행 명령·인수. `--env`는 여러 `KEY=value`를 받되, 서버 이름이 `--env` 바로 뒤에
  오면 거부되므로 `--env`와 서버 이름 사이에 다른 옵션을 하나 둔다.
- **`url`은 있고 `type`이 없는 JSON 항목은 구성 오류**다(Claude Code가 stdio로 읽어 건너뜀).
  원격 서버에는 `type`을 반드시 넣는다.
- 헤더 인증: `--header "Authorization: Bearer <token>"` (단축 `-H`). `--transport`는 `-t`.

전송별 세부·모든 `claude mcp` 명령·타임아웃·출력 제한은 → `transports-and-management.md`.

---

## 스코프 빠른 표

| 스코프 | 로드 위치 | 팀 공유 | 저장 위치 |
|---|---|---|---|
| **local** (기본값) | 현재 프로젝트만 | 아니오 | `~/.claude.json`(프로젝트 경로 아래) |
| **project** | 현재 프로젝트만 | 예(버전 관리) | 프로젝트 루트 `.mcp.json` |
| **user** | 모든 프로젝트 | 아니오 | `~/.claude.json` |

`-s`/`--scope`로 지정(예: `--scope project`). 우선순위(높→낮): local → project → user →
플러그인 제공 → Claude.ai 커넥터. 이름/엔드포인트로 중복 판정, 필드 병합 없이 최고 우선순위
소스의 전체 항목을 쓴다. 상세·조직 managed 구성은 → `scopes-and-config.md`.

---

## `.mcp.json` 스키마 요약 (project 스코프)

```json
{
  "mcpServers": {
    "<name>": {
      "type": "http",                         // http | sse | stdio | ws (stdio는 생략 가능하나 명시 권장)
      "url": "https://mcp.example.com/mcp",    // 원격(http/sse/ws)
      "headers": { "Authorization": "Bearer ${API_KEY}" },
      "command": "/path/to/server",            // stdio
      "args": ["--flag", "value"],             // stdio
      "env": { "KEY": "value" },               // stdio
      "timeout": 600000,                        // 도구 호출당 하드 제한(ms). 1000 미만 무시
      "alwaysLoad": true                        // Tool Search 연기에서 제외
    }
  }
}
```

**환경변수 확장**(`command`/`args`/`env`/`url`/`headers`에서):
- `${VAR}` — `VAR` 값으로 치환
- `${VAR:-default}` — 없으면 `default`
- 미설정 + 기본값 없음 → 리터럴 `${VAR}`가 남고 경고. `:-default`나 실제 값으로 채운다.

세부 규칙은 → `scopes-and-config.md`.

---

## 서버 이름·예약어

- `claude mcp add`로 추가하는 이름은 **문자·숫자·하이픈·언더스코어만** 허용.
- 예약된 이름(구성 시 건너뜀/거부): `workspace`, `claude-in-chrome`, `computer-use`,
  `Claude Preview`, `Claude Browser`.
- `url`이 빈 원격 서버 항목은 `not configured`로 표시되고 연결을 시도하지 않는다(플레이스홀더 허용).
