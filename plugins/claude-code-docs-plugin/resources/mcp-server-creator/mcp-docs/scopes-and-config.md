# 스코프·우선순위·환경변수 확장·조직 관리

서버를 어느 스코프에 둘지, 중복 시 우선순위, `.mcp.json` 환경변수 확장, 조직 차원의 managed
구성을 다룬다. 빠른 표는 `index.md`에 있다.

## 스코프 상세

세 스코프는 서버가 로드되는 프로젝트 범위와 팀 공유 여부를 정한다.

- **local (기본값)**: 추가한 프로젝트에서만, 사용자 비공개. `~/.claude.json`의 해당 프로젝트
  경로 아래 저장. 개인 개발 서버·실험·버전 관리에 넣기 싫은 자격증명용.
  > "MCP 로컬 스코프"는 일반 로컬 설정과 다르다. 전자는 `~/.claude.json`(홈), 후자는
  > `.claude/settings.local.json`(프로젝트).

  ```bash
  claude mcp add --transport http stripe https://mcp.stripe.com            # 기본 local
  claude mcp add --transport http stripe --scope local https://mcp.stripe.com
  ```

  결과(`~/.claude.json`):
  ```json
  { "projects": { "/path/to/your/project": { "mcpServers": {
    "stripe": { "type": "http", "url": "https://mcp.stripe.com" } } } } }
  ```

- **project**: 프로젝트 루트 `.mcp.json`에 저장 → 버전 관리로 팀 공유. 추가 시 파일을 자동
  생성·갱신. **보안상 사용 전 승인**을 요청한다(승인 초기화: `claude mcp reset-project-choices`).

  ```bash
  claude mcp add --transport http paypal --scope project https://mcp.paypal.com/mcp
  ```
  ```json
  { "mcpServers": { "shared-server": { "command": "/path/to/server", "args": [], "env": {} } } }
  ```

- **user**: `~/.claude.json`, 모든 프로젝트에서 사용, 사용자 비공개. 개인 유틸·개발 도구용.

  ```bash
  claude mcp add --transport http hubspot --scope user https://mcp.hubspot.com/anthropic
  ```

## 우선순위

동일 서버가 여러 곳에 정의되면 **최고 우선순위 소스의 전체 항목**으로 한 번 연결한다(필드
병합 없음).

1. local → 2. project → 3. user → 4. 플러그인 제공 서버 → 5. Claude.ai 커넥터

세 스코프는 **이름**으로 중복 판정, 플러그인·커넥터는 **엔드포인트**(같은 URL/command)로 판정.

## `.mcp.json` 환경변수 확장

팀이 구성을 공유하면서 머신별 경로·API 키를 유연하게 두도록 지원한다.

- 구문: `${VAR}`, `${VAR:-default}`
- 확장 위치: `command`, `args`, `env`, `url`, `headers`
- 미설정 + 기본값 없음 → 값에 리터럴 `${VAR}` 텍스트를 남기고 누락 경고를 보고한다(구성은
  여전히 로드됨). 변수를 설정하거나 `:-default`를 추가한다.

```json
{
  "mcpServers": {
    "api-server": {
      "type": "http",
      "url": "${API_BASE_URL:-https://api.example.com}/mcp",
      "headers": { "Authorization": "Bearer ${API_KEY}" }
    }
  }
}
```

## 조직 관리(managed) 구성

중앙 집중 제어가 필요한 조직은 `managed-mcp.json`으로 고정 서버 세트를 배포하고,
`allowedMcpServers`/`deniedMcpServers`로 사용자가 연결 가능한 서버를 제한할 수 있다. 세부는
공식 "관리되는 MCP 구성" 문서를 따른다. 개별 Claude.ai 커넥터를 이름·URL 패턴으로 차단하려면
`deniedMcpServers`에 추가한다(예: `serverName` `"claude.ai Slack"`).
