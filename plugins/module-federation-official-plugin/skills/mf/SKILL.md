---
name: mf
description: "Module Federation(모듈 페더레이션/MFE) 공식 올인원 skill. 설정(config·exposes·plugin), 공유 의존성(shared·singleton·requiredVersion), 타입(dts·@mf-types·tsc), 런타임 에러 코드(RUNTIME-xxx·remoteEntry 로딩 실패), 모듈 정보(manifest·remoteEntry URL·publicPath), 빌드·HMR 성능, 기존 프로젝트에 MF 통합·scaffold를 다룬다. 트리거 예: \"모듈 페더레이션 설정\", \"shared/singleton 점검\", \"dts 타입 에러\", \"RUNTIME-008 remoteEntry 로딩 실패\", \"MF 통합해줘\", \"mf-manifest 경로\", \"HMR 느려\". 서브커맨드: config/shared-deps/type-check/runtime-error/module-info/integrate/perf/context/docs."
argument-hint: <sub-command | natural-language-query> [args...]
allowed-tools: Read Glob Bash(node *) Bash(npx tsc*) Bash(npx mf dts*) Bash(curl *) WebFetch Write Edit AskUserQuestion
---

# MF — Module Federation 올인원 Skill

## 1단계: 서브 스킬 식별

`$ARGUMENTS`를 파싱해 `reference/` 디렉터리(이 파일과 같은 디렉터리)의 참조 파일로 매핑합니다:

| Sub-command (대소문자 무시) | Aliases | 참조 파일 |
|---|---|---|
| `docs` | `doc`, `help`, `?` | `reference/docs.md` |
| `context` | `ctx`, `info`, `status` | `reference/context.md` |
| `module-info` | `module`, `remote`, `manifest` | `reference/module-info.md` |
| `integrate` | `init`, `setup`, `add` | `reference/integrate.md` |
| `type-check` | `types`, `ts`, `dts` | `reference/type-check.md` |
| `shared-deps` | `shared`, `deps`, `singleton` | `reference/shared-deps.md` |
| `perf` | `performance`, `hmr`, `speed` | `reference/perf.md` |
| `config-check` | `config`, `plugin`, `exposes` | `reference/config-check.md` |
| `bridge-check` | `bridge`, `sub-app` | `reference/bridge-check.md` |
| `runtime-error` | `runtime-code`, `runtime-008`, `runtime-001`, `remote-entry` | `reference/runtime-error.md` |
| `observability` | `obs`, `observe`, `trace`, `traceId`, `report`, `observability`, `debug-loading`, `telemetry`, `runtime-007`, `moduleInfo`, `snapshot` | `reference/observability.md` |

**명시적 sub-command이 발견되지 않으면**, 전체 입력에서 의도를 감지합니다:

입력에 관측(observability) 리포트, `traceId`, 콘솔 `read:` 명령,
`.mf/observability` 파일 경로가 포함되어 있거나, Module Federation 로딩 데이터를
관측·디버그·트레이스·검사·업로드하는 방법을 묻거나, `obs`를 관측(observability)의
약어로 사용하는 경우, 동일한 입력에 `RUNTIME-xxx` 코드가 함께 포함되어 있더라도
`reference/observability.md`를 선택합니다.

| 입력의 신호 | 참조 파일 |
|---|---|
| MF 개념, API, 설정 옵션에 대한 질문 | `reference/docs.md` |
| "integrate", "add MF", "setup", "scaffold", "new project" | `reference/integrate.md` |
| "type error", "TS error", "@mf-types", "dts", "typescript" | `reference/type-check.md` |
| "shared", "singleton", "duplicate", "antd", "transformImport" | `reference/shared-deps.md` |
| "slow", "HMR", "performance", "build speed", "ts-go" | `reference/perf.md` |
| "plugin", "asyncStartup", "exposes key", "config" | `reference/config-check.md` |
| "bridge", "sub-app", "export-app", "createRemoteAppComponent" | `reference/bridge-check.md` |
| "RUNTIME-001", "RUNTIME-008", "runtime error code", "remote entry load failed", "ScriptNetworkError", "ScriptExecutionError", "container missing", "window[remoteEntryKey]" | `reference/runtime-error.md` |
| "obs", "mf obs", "Observability report generated", "console.error", "traceId", "read:", "diagnosis", "ownerHint", "summary.phases", ".mf/observability", "build-report.json", "latest.json", "RUNTIME-007", "moduleInfo", "remote snapshot", "global snapshot", "snapshot match", "observability", "observe MF", "debug MF loading", "trace loading", "loading report", "open page and inspect MF", "visit URL and observe MF", "MF 로딩 상황 봐줘", "telemetry", "onReport", "onEvent", "production report", "upload observability" | `reference/observability.md` |
| "manifest", "remoteEntry URL", "module info", "publicPath" | `reference/module-info.md` |
| "context", "what is configured", "MF role", "bundler" | `reference/context.md` |

그래도 모호하면 위의 sub-command 테이블을 사용자에게 보여주고 선택하도록 요청합니다.

## 2단계: 참조 파일 로드 및 실행

`reference/` 디렉터리(이 SKILL.md와 같은 디렉터리)에서 매칭된 파일을 읽습니다.

해당 파일의 모든 지침을 실행하되, 나머지 인자(sub-command 토큰 이후의 모든 것, 또는 의도로 감지된 경우 전체 `$ARGUMENTS`)를 `ARGS`로 전달합니다.

선택된 워크플로가 실제 브라우저 페이지를 열거나, 검사하거나, 조작해야 하는
경우 먼저 `reference/divebell.md`를 읽고 모든 브라우저 작업에 Divebell을
사용합니다. Divebell과 함께 raw CDP, 별도로 실행한 디버그 Chrome, Playwright,
Puppeteer, 임시 브라우저 스크립트를 사용하지 마십시오.
