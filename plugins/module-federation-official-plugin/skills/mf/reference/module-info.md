# Sub-skill: module-info

리모트 Module Federation 모듈의 메타데이터와 매니페스트 정보를 가져옵니다 — publicPath, remoteEntry, 타입 파일 URL, 그리고 해당 모듈의 mf-manifest.json에서 얻은 remotes/exposes/shared.

두 가지 모드:
1. **컨슈머 모드** — 컨슈머 프로젝트 내부; 리모트 이름만 전달; 엔트리 URL은 mfConfig.remotes에서 해석됨
2. **독립 실행(Standalone) 모드** — 컨슈머 프로젝트 외부; 리모트 이름과 그 remoteEntry URL을 직접 전달

## 1단계: ARGS 파싱

- 첫 번째 토큰 → `<module-name>`
- 두 번째 토큰이 URL처럼 보이면(`http`로 시작) → `<remoteEntry-url>` (독립 실행 모드); 나머지 토큰 → `[project-root]`
- 그렇지 않으면 → `[project-root]` (컨슈머 모드)

## 2a단계 — 컨슈머 모드 (URL 미제공)

`./context.md`의 지침을 읽고 따라 MFContext를 수집하되, `[project-root]`를 프로젝트 루트로 전달합니다.

그런 다음 실행합니다:

```bash
node scripts/module-info.js --context '<MFContext-JSON>' --module '<module-name>'
```

## 2b단계 — 독립 실행 모드 (URL 제공됨)

빈 컨텍스트와 명시적 URL로 실행합니다:

```bash
node scripts/module-info.js --context '{}' --module '<module-name>' --url '<remoteEntry-url>'
```

## 3단계: 결과 표시

| 필드 | 설명 |
|---|---|
| `publicPath` | 리모트의 베이스 URL |
| `remoteEntry` | `remoteEntry.js`의 전체 URL |
| `typesZip` | `@mf-types.zip`의 URL |
| `typesApi` | `@mf-types.api`의 URL (존재할 때만 표시) |
| `hasSsr` | SSR 빌드 산출물이 감지되었는지 여부 |
| `exposes` | 이 리모트가 노출하는 모듈 |
| `remotes` | 이 모듈이 의존하는 리모트 |
| `shared` | 이 모듈이 선언한 공유 의존성 |

`result.error`가 설정되어 있으면 그대로 노출하고 중단합니다.

## 4단계 (조건부)

사용자가 명시적으로 타입 선언을 보기를 요청하면(예: "show me the types", "what types does it export"), `result.typesZip` 또는 `result.typesApi`를 가져와 관련 타입 정의를 표시합니다.
