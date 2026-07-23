---
name: claude-code-jsonl
description: >-
  Claude Code JSONL 파일의 위치·구조·파싱 규칙·이벤트 분류를 알아야 할 때 읽는다.
  JSONL 파싱기 작성, 이벤트 kind 분류, usage 기반 비용 계산, 슬래시 커맨드 추출,
  MCP tool_use 파싱, 플러그인 네임스페이스 분리, Resource 집계 로직 구현 시 기준 문서가 된다.
  Observer 대시보드, 세션 분석 도구, 개인 모니터링 시스템 등 JSONL을 소비하는
  모든 도구에서 타입·파싱 규칙을 참조할 때 호출한다.
metadata:
  type: domain-skill
  confidence:
    unconfirmed:
      - topic: "JSONL 보존 TTL 정책"
        note: "실측으로 32일치 파일이 존재함을 확인했으나, 공식 TTL 정책은 미공개. 정확한 만료 기준 미확인."
      - topic: "서브에이전트 JSONL 경로 패턴"
        note: "'{sessionId}/subagents/agent-{id}.jsonl' 패턴 관찰됨. agent-{id}의 id 포맷 및 중첩 에이전트 구조 미확인."
      - topic: "Workflow script 필드 스키마"
        note: "Workflow tool_use input의 script 필드 구조를 단일 사례에서 관찰. 전체 스키마 미확인."
    inferred:
      - topic: "tool_use name 기반 kind 분류"
        note: "claude-code-extensions.md 문서 및 실제 JSONL 파싱 결과에서 일치 확인."
      - topic: "비용 단가 (Sonnet 4.5 기준)"
        note: "Anthropic 공식 가격표 기준. 모델별 단가 상이함. 캐시 토큰 단가는 Anthropic 가격 페이지에서 확인 필요."
---

## 한 줄 정의

`~/.claude/projects/**/*.jsonl` 파일로 기록되는 Claude Code 세션 이벤트 스트림.
각 라인이 독립적인 JSON 이벤트이며, 세션 히스토리·비용·도구 사용 내역을 담는다.

---

## 파일 시스템 구조

### JSONL 파일 위치

```
~/.claude/projects/{encoded-path}/{session-uuid}.jsonl
~/.claude/projects/{encoded-path}/{session-uuid}/subagents/agent-{id}.jsonl
```

- 세션당 파일 1개. 파일명 = session UUID.
- 서브에이전트는 세션 디렉토리 하위 `subagents/` 에 별도 파일로 저장. ⚠️ unconfirmed: agent-{id} 포맷 및 중첩 구조 미확인.
- 보존 기간: 실측 32일치 존재. 공식 TTL 미공개. ⚠️ unconfirmed: 정확한 만료 정책 미확인.

### 경로 인코딩 규칙

Claude Code는 파일시스템 경로의 `/`와 `_`를 모두 `-`로 인코딩하여 폴더명을 생성한다.

```
/Users/<name>/Desktop/my_project
→ -Users-<name>-Desktop-my-project
```

원래 경로 복원 시 파일시스템 탐색(`resolveSegments()` 패턴) 필수.
단순 문자열 치환으로는 `_`와 `/`의 구분이 불가능하다.

---

## JSONL 라인 구조

각 라인은 독립적인 JSON 객체이다.

**파싱 원칙**: 라인 단위 방어적 파싱 필수. 특정 라인 파싱 실패 시 skip하고 다음 라인 처리. 프로세스 중단 없음.

### 최상위 공통 필드

| 필드 | 타입 | 설명 |
|------|------|------|
| `type` | `"assistant"` \| `"user"` \| `"system"` | 이벤트 발화 주체 |
| `uuid` | `string` | 이벤트 고유 ID |
| `timestamp` | `string` | ISO 8601 형식 |
| `sessionId` | `string` | 세션 UUID |
| `message` | `object` | 이벤트 페이로드 |

---

## assistant 이벤트

### 구조

```json
{
  "type": "assistant",
  "uuid": "...",
  "timestamp": "2026-06-16T...",
  "message": {
    "content": [
      {
        "type": "tool_use",
        "id": "toolu_xxx",
        "name": "Skill",
        "input": { "skill": "ocr-job_api" }
      },
      {
        "type": "text",
        "text": "..."
      }
    ],
    "usage": {
      "input_tokens": 1234,
      "output_tokens": 567,
      "cache_creation_input_tokens": 890,
      "cache_read_input_tokens": 1100
    }
  }
}
```

### message.content 항목 타입

| `type` 값 | 설명 |
|-----------|------|
| `"tool_use"` | 도구 호출. `name`, `id`, `input` 포함 |
| `"text"` | Claude 텍스트 응답 |
| `"thinking"` | extended thinking 내용 |

### usage 필드

비용 계산에 사용되는 토큰 계수.

| 필드 | 설명 |
|------|------|
| `input_tokens` | 일반 입력 토큰 |
| `output_tokens` | 출력 토큰 |
| `cache_creation_input_tokens` | 캐시 생성 토큰 |
| `cache_read_input_tokens` | 캐시 읽기 토큰 |

---

## user 이벤트

### 일반 메시지

```json
{
  "type": "user",
  "message": {
    "content": "사용자 입력 텍스트"
  }
}
```

### 슬래시 커맨드

`message.content`가 문자열이며 XML 태그를 포함한다.

```
<command-message>skill-name</command-message>
<command-name>/skill-name</command-name>
<command-args>사용자가 입력한 인자 텍스트</command-args>
```

| 태그 | 설명 |
|------|------|
| `<command-message>` | 스킬 이름. `<command-name>`과 중복 정보. |
| `<command-name>` | `/` 포함 슬래시 커맨드 전체 경로 |
| `<command-args>` | 슬래시 커맨드 뒤에 입력한 인자 텍스트. 인자가 없으면 태그 자체가 존재하지 않음. |

슬래시 커맨드로 호출된 Skill은 `kind: "skill"`로 분류하되, 내장 CLI 커맨드 필터링 후 집계.

---

## tool_use name별 input 구조

### Skill — Claude 자동 호출

```json
{
  "type": "tool_use",
  "name": "Skill",
  "input": {
    "skill": "ocr-job_api"
  }
}
```

항상 `skill` 필드만 존재. `args` 필드 없음.

### Skill — 슬래시 커맨드 경유 (파서 가공 후)

```json
{
  "skill": "we-ai-testcode-rtl:ax-rtl-component-testing",
  "args": "pipeline 테스트 코드 추가해줘",
  "_source": "slash-command"
}
```

`_source: "slash-command"` 로 자동 호출과 구분. `args`는 `<command-args>` 태그에서 추출.

### Agent

```json
{
  "type": "tool_use",
  "name": "Agent",
  "input": {
    "description": "Branch ship-readiness audit",
    "prompt": "Audit what's left...",
    "subagent_type": "Explore"
  }
}
```

`subagent_type` 없으면 general agent.

### Workflow

```json
{
  "type": "tool_use",
  "name": "Workflow",
  "input": {
    "name": "find-flaky-tests",
    "description": "Find flaky tests and propose fixes",
    "script": "export const meta = {...}..."
  }
}
```

⚠️ unconfirmed: `script` 필드 전체 스키마 단일 사례에서 관찰됨. 전체 구조 미확인.

### Artifact

```json
{
  "type": "tool_use",
  "name": "Artifact",
  "input": {
    "file_path": "/path/to/file.html",
    "label": "Branch audit",
    "favicon": "📊",
    "description": "One-sentence subtitle"
  }
}
```

### MCP

`tool_use`의 `name` 필드가 `mcp__{serverName}__{toolName}` 형태.

```
mcp__claude_ai_Linear__authenticate
mcp__ide__getDiagnostics
```

파싱 규칙:
- 구분자: `__` (언더스코어 2개)
- 분리 결과: `["mcp", serverName, toolName]`
- `serverName`의 `_`를 공백 또는 `-`로 치환하면 가독성 향상

---

## 플러그인 네임스페이스 분리

Skill 이름이 `plugin:resource` 형태인 경우 마켓플레이스 플러그인에 속한다.

| 스킬명 예시 | plugin | resource |
|------------|--------|----------|
| `we-ai-template:FormInput_FormInput` | `we-ai-template` | `FormInput_FormInput` |
| `ocr-job_api` | (없음 — standalone) | `ocr-job_api` |

분리 규칙: `indexOf(':')` 기반 1회 분리. `colonIdx <= 0` 이면 standalone. 콜론이 2개 이상이면 첫 번째만 기준, 나머지는 resource에 포함.

구현: `patterns.ts` → `parseSkillName()`

---

## Resource 집계 kind 분류표

| JSONL 패턴 | kind | 비고 |
|-----------|------|------|
| `tool_use name="Skill"` | `skill` | Claude 자동 호출 |
| user 이벤트 `<command-name>/name</command-name>` | `skill` | 사용자 슬래시 직접 호출 |
| `tool_use name="Agent"` | `agent` | Subagent 생성 |
| `tool_use name="Workflow"` | `workflow` | Workflow 오케스트레이션 |
| `tool_use name="Artifact"` | `artifact` | 웹 아티팩트 게시 |
| `tool_use name="mcp__*__*"` | `mcp` | MCP 서버 도구 호출 |
| 나머지 (Bash, Read, Edit, Write 등) | `other` | 내장 파일·셸 도구 |

---

## 내장 CLI 커맨드 (집계 제외 목록)

슬래시 커맨드로 호출해도 Resource 집계에서 제외하는 Claude Code 내장 명령:

```
clear, compact, help, config, status, login, logout,
doctor, mcp, resume, plugin, reload-plugins, rate-limit-options
```

판별 방법: `<command-name>` 태그에서 `/` 제거 후 위 목록과 대조.

---

## 비용 계산

### 단가 (Sonnet 4.5 기준)

⚠️ inferred: 아래 단가는 Anthropic 공식 가격표 기준. 모델별 단가 상이. 최신 가격은 Anthropic 가격 페이지에서 확인 필요.

| 토큰 종류 | 단가 (USD / 1M tokens) |
|-----------|----------------------|
| `input_tokens` | $3.00 |
| `output_tokens` | $15.00 |
| `cache_creation_input_tokens` | $3.75 |
| `cache_read_input_tokens` | $0.30 |

계산식 구현: `patterns.ts` → `calculateCost()`

---

## 핵심 제약사항

- **방어적 파싱 필수**: 라인 단위 파싱 실패 시 skip. 프로세스 중단 금지.
- **경로 복원 시 문자열 치환 불가**: `/`와 `_` 모두 `-`로 인코딩되므로 파일시스템 탐색으로만 복원 가능.
- **이벤트 버퍼**: 서버 메모리와 클라이언트 상태 모두 최대 500개 권장 (Observer 프로젝트 기준).
- **히스토리 + 실시간 하이브리드**: 세션 선택 시 REST로 히스토리 선 로드 후 WebSocket으로 신규 이벤트 append.
- **비용 단가 하드코딩 금지**: 모델별 단가가 다르므로 단가 테이블을 설정으로 분리 권장.

---

## 구현 패턴

### 타입 정의

```typescript
type EventType = "assistant" | "user" | "system";
type ContentType = "tool_use" | "text" | "thinking";
type ResourceKind = "skill" | "agent" | "workflow" | "artifact" | "mcp" | "other";

interface JsonlEvent {
  type: EventType;
  uuid: string;
  timestamp: string;
  sessionId: string;
  message: AssistantMessage | UserMessage;
}

interface AssistantMessage {
  content: ContentItem[];
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
}

interface ContentItem {
  type: ContentType;
  id?: string;        // tool_use only
  name?: string;      // tool_use only
  input?: unknown;    // tool_use only
  text?: string;      // text / thinking only
}

interface UserMessage {
  content: string | ContentItem[];
}
```

### 경로 복원 패턴 (resolveSegments)

`/`와 `_` 모두 `-`로 인코딩되므로 파일시스템 탐색으로만 원래 경로를 복원할 수 있다.

```typescript
import { readdirSync } from "fs";
import { join } from "path";

/**
 * 인코딩된 경로 세그먼트를 실제 파일시스템 경로로 복원한다.
 * 단순 문자열 치환 불가 — '-'가 '/'인지 '_'인지 구분할 수 없기 때문.
 */
function resolveSegments(
  encodedPath: string,
  fsRoot: string = "/"
): string | null {
  // 선행 '-'를 '/'로 치환해 세그먼트 배열 추출
  const segments = encodedPath.replace(/^-/, "").split("-");
  let current = fsRoot;

  for (const seg of segments) {
    const entries = readdirSync(current, { withFileTypes: true });
    // 실제 파일시스템 항목과 인코딩 결과 비교
    const match = entries.find(
      (e) => e.name.replace(/[/_]/g, "-") === seg
    );
    if (!match) { return null; }
    current = join(current, match.name);
  }
  return current;
}
```

### 방어적 JSONL 파서 패턴

```typescript
import { createReadStream } from "fs";
import { createInterface } from "readline";

async function* parseJsonlFile(
  filePath: string
): AsyncGenerator<JsonlEvent> {
  const rl = createInterface({
    input: createReadStream(filePath),
    crlfDelay: Infinity,
  });

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) { continue; }
    try {
      const parsed = JSON.parse(trimmed) as JsonlEvent;
      yield parsed;
    } catch {
      // 라인 파싱 실패 시 skip — 프로세스 중단 없음
      continue;
    }
  }
}
```

### Resource kind 분류 패턴

```typescript
const BUILTIN_COMMANDS = new Set([
  "clear", "compact", "help", "config", "status",
  "login", "logout", "doctor", "mcp", "resume",
  "plugin", "reload-plugins", "rate-limit-options",
]);

function classifyEvent(event: JsonlEvent): ResourceKind | null {
  // 슬래시 커맨드: user 이벤트의 content 문자열에서 태그 추출
  if (event.type === "user" && typeof event.message.content === "string") {
    const nameMatch = event.message.content.match(
      /<command-name>\/([^<]+)<\/command-name>/
    );
    if (nameMatch) {
      const commandName = nameMatch[1].trim();
      if (BUILTIN_COMMANDS.has(commandName)) { return null; } // 집계 제외
      return "skill";
    }
    return null;
  }

  // assistant tool_use
  if (event.type === "assistant") {
    const msg = event.message as AssistantMessage;
    for (const item of msg.content ?? []) {
      if (item.type !== "tool_use" || !item.name) { continue; }
      if (item.name === "Skill") { return "skill"; }
      if (item.name === "Agent") { return "agent"; }
      if (item.name === "Workflow") { return "workflow"; }
      if (item.name === "Artifact") { return "artifact"; }
      if (item.name.startsWith("mcp__")) { return "mcp"; }
      return "other";
    }
  }

  return null;
}
```

### 플러그인 네임스페이스 분리 패턴

```typescript
interface SkillRef {
  plugin: string | null;
  resource: string;
}

function parseSkillName(name: string): SkillRef {
  const colonIdx = name.indexOf(":");
  if (colonIdx <= 0) {
    return { plugin: null, resource: name };
  }
  return {
    plugin: name.slice(0, colonIdx),
    resource: name.slice(colonIdx + 1), // 콜론 이후 전체
  };
}
```

### MCP tool_use 파싱 패턴

```typescript
interface McpToolRef {
  serverName: string;
  toolName: string;
  displayName: string; // serverName의 '_'를 ' '로 치환
}

function parseMcpName(toolUseName: string): McpToolRef | null {
  // 형태: mcp__{serverName}__{toolName}
  const parts = toolUseName.split("__");
  if (parts.length < 3 || parts[0] !== "mcp") { return null; }
  const serverName = parts[1];
  const toolName = parts.slice(2).join("__");
  return {
    serverName,
    toolName,
    displayName: serverName.replace(/_/g, " "),
  };
}
```
