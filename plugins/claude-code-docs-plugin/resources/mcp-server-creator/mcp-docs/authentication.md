# 원격 MCP 서버 인증

OAuth 2.0, CLI 로그인, 고정 콜백 포트, 사전 등록 클라이언트 자격증명, 메타데이터 검색 재정의,
범위 제한, 동적 헤더(`headersHelper`)와 정적 `headers`를 다룬다.

## 목차
- [OAuth 개요](#oauth-개요)
- [명령줄 로그인](#명령줄-로그인)
- [고정 콜백 포트](#고정-콜백-포트)
- [사전 등록 OAuth 자격증명](#사전-등록-oauth-자격증명)
- [메타데이터 검색 재정의](#메타데이터-검색-재정의)
- [OAuth 범위 제한](#oauth-범위-제한)
- [동적 헤더 headersHelper](#동적-헤더-headershelper)
- [정적 headers](#정적-headers)

---

## OAuth 개요

많은 클라우드 서버가 인증을 요구한다. Claude Code는 OAuth 2.0을 지원한다.

- 서버가 `401`/`403`으로 응답하면 인증 필요로 표시하고 `/mcp`에서 플래그한다.
- 이미 로그인한 OAuth 서버가 `401`을 반환하면 토큰을 새로 고쳐 재연결 후 요청을 한 번 재시도,
  그마저 실패해야 `/mcp`에서 플래그한다(v2.1.206 이전엔 일시 오류로도 세션 내내 플래그).
- v2.1.195+: 서버가 저장된 refresh 토큰을 거부하면 즉시 `/mcp` 재인증 알림을 표시.
- v2.1.193+: 시작 시 인증 필요한 서버가 있으면 시작 알림 표시.
- 비대화형(`claude -p`)에서는 OAuth 흐름을 실행할 수 없다. v2.1.196+는 Tool Search 활성 시
  Claude에게 "해당 서버 도구는 인증 전까지 사용 불가"를 알려 서버명을 지목할 수 있게 한다.
- `headers.Authorization`을 구성했는데 서버가 거부하면 OAuth로 폴백하지 않고 연결 실패로
  보고한다 — 토큰 유효성을 확인하거나 헤더를 제거하고 OAuth를 쓴다.

기본 흐름:
```bash
claude mcp add --transport http sentry https://mcp.sentry.dev/mcp
```
```text
/mcp     # 브라우저 로그인 단계 진행
```
팁: 토큰은 안전 저장·자동 갱신. `/mcp`의 "Clear authentication"으로 취소. OAuth는 HTTP에서 동작.
브라우저가 안 열리면 URL을 수동으로 열고, 리디렉션이 연결 오류로 실패하면 주소창의 전체 콜백
URL을 복사해 URL 프롬프트에 붙여넣는다.

## 명령줄 로그인

v2.1.186+:
```bash
claude mcp login sentry
claude mcp logout sentry          # 저장된 자격증명 삭제
claude mcp login sentry --no-browser   # 로컬 브라우저 있어도 URL 프롬프트 강제
```
v2.1.191+는 로컬 브라우저 불가(SSH·헤드리스 Linux)를 감지해 URL을 출력한다. 로컬에서 URL을 열고
전체 리디렉션 URL을 프롬프트에 붙여넣는다(대화형 터미널 필요 — `ssh -t`).

## 고정 콜백 포트

일부 서버는 사전 등록된 리디렉션 URI(`http://localhost:PORT/callback`)를 요구한다. 기본은 무작위
포트. `--callback-port`로 고정(동적 클라이언트 등록 단독 또는 `--client-id`와 함께).
```bash
claude mcp add --transport http --callback-port 8080 my-server https://mcp.example.com/mcp
```

## 사전 등록 OAuth 자격증명

동적 클라이언트 등록을 지원하지 않는 서버("Incompatible auth server: does not support dynamic
client registration")는 개발자 포털에서 OAuth 앱을 등록해 client id/secret을 받는다. Claude Code는
CIMD(client id metadata document)도 지원·자동 검색한다.

```bash
# claude mcp add — --client-secret은 마스킹 입력으로 시크릿을 요청
claude mcp add --transport http \
  --client-id your-client-id --client-secret --callback-port 8080 \
  my-server https://mcp.example.com/mcp

# add-json — oauth 객체 포함, 시크릿은 별도 플래그
claude mcp add-json my-server \
  '{"type":"http","url":"https://mcp.example.com/mcp","oauth":{"clientId":"your-client-id","callbackPort":8080}}' \
  --client-secret

# 콜백 포트만 고정(동적 등록)
claude mcp add-json my-server \
  '{"type":"http","url":"https://mcp.example.com/mcp","oauth":{"callbackPort":8080}}'

# CI/환경변수로 시크릿 주입(프롬프트 생략)
MCP_CLIENT_SECRET=your-secret claude mcp add --transport http \
  --client-id your-client-id --client-secret --callback-port 8080 \
  my-server https://mcp.example.com/mcp
```
등록한 리디렉션 URI와 같은 포트를 `--callback-port`에 쓴다. 이후 `/mcp`로 인증. 시크릿은 구성이
아니라 키체인(macOS)/자격증명 파일에 저장. 공개 클라이언트면 `--client-secret` 없이 `--client-id`만.
이 플래그들은 HTTP/SSE 전용(stdio 무관). 확인: `claude mcp get <name>`.

## 메타데이터 검색 재정의

특정 인증 서버 메타데이터 URL을 가리켜 기본 검색 체인을 우회한다(표준 엔드포인트 오류·내부 프록시).
기본 검색: `/.well-known/oauth-protected-resource`(RFC 9728) → `/.well-known/oauth-authorization-server`(RFC 8414).
```json
{ "mcpServers": { "my-server": {
  "type": "http", "url": "https://mcp.example.com/mcp",
  "oauth": { "authServerMetadataUrl": "https://auth.example.com/.well-known/openid-configuration" }
}}}
```
URL은 `https://`. 메타데이터의 `scopes_supported`가 업스트림이 광고한 범위를 재정의.

## OAuth 범위 제한

`oauth.scopes`(RFC 6749 §3.3의 공백 구분 문자열)로 요청 범위를 고정한다. 보안팀이 승인한 부분
집합으로 제한하는 지원 방법.
```json
{ "mcpServers": { "slack": {
  "type": "http", "url": "https://mcp.slack.com/mcp",
  "oauth": { "scopes": "channels:read chat:write search:read" }
}}}
```
`oauth.scopes`는 `authServerMetadataUrl`과 `/.well-known` 검색 범위 모두보다 우선. 미설정 시 서버가
범위를 결정한다. v2.1.196+: 미설정이면 `WWW-Authenticate`/보호된 리소스 메타데이터가 제공하는
범위를 요청하고 둘 다 없으면 `scope`를 안 보낸다(전체 `scopes_supported` 카탈로그를 자동 요청하지
않음 — 관리자 전용/템플릿 범위로 인한 `invalid_scope` 방지). `scopes_supported`에 `offline_access`가
있으면 새 로그인 없이 갱신 가능하도록 고정 범위에 추가. 도구 호출이 403 `insufficient_scope`이면
같은 고정 범위로 재인증하므로 필요 시 `oauth.scopes`를 확대한다.

## 동적 헤더 headersHelper

OAuth가 아닌 인증(Kerberos·단기 토큰·내부 SSO)은 `headersHelper`로 연결 시점에 헤더를 생성한다.
```json
{ "mcpServers": { "internal-api": {
  "type": "http", "url": "https://mcp.internal.example.com",
  "headersHelper": "/opt/bin/get-mcp-auth-headers.sh"
}}}
```
인라인도 가능:
```json
{ "mcpServers": { "internal-api": {
  "type": "http", "url": "https://mcp.internal.example.com",
  "headersHelper": "echo '{\"Authorization\": \"Bearer '\"$(get-token)\"'\"}'"
}}}
```
요구사항: JSON 객체(문자열 키-값)를 stdout에 출력, 10초 타임아웃, 현재 작업 디렉터리에서 셸 실행
(절대 경로나 `PATH` 명령 사용). 동적 헤더는 동명 정적 `headers`를 재정의. 연결마다(시작·재연결)
새로 실행 — 캐싱 없음(토큰 재사용은 스크립트 책임). v2.1.193+: 도구 호출이 `401`/`403`이면 헬퍼를
재실행·재연결 후 한 번 재시도, 그마저 실패해야 플래그.

헬퍼 실행 시 환경변수: `CLAUDE_CODE_MCP_SERVER_NAME`, `CLAUDE_CODE_MCP_SERVER_URL`,
`CLAUDE_PLUGIN_ROOT`(플러그인 제공 서버일 때만). 플러그인 제공 서버는 작업 디렉터리가 플러그인
루트로 설정되어 상대 경로가 플러그인 디렉터리 기준으로 해석된다(v2.1.195+). 플러그인 제공
`headersHelper`는 셸 실행이라 `${user_config.*}`를 참조할 수 없다(오류 보고) — `${user_config.KEY}`는
셸 파싱되지 않는 `headers`에 넣거나 헬퍼가 환경/구성 파일에서 읽게 한다(v2.1.207 이전엔 치환됨).

> 보안: `headersHelper`는 임의 셸 명령을 실행한다. project/local 스코프에서는 워크스페이스 신뢰
> 대화상자 수락 후에만 실행된다.

## 정적 headers

`.mcp.json`의 `headers`에 정적 토큰을 둘 수 있다(환경변수 확장 가능):
```json
"headers": { "Authorization": "Bearer ${API_KEY}" }
```
서버가 이 헤더를 거부하면 OAuth 폴백 없이 연결 실패로 보고된다.
