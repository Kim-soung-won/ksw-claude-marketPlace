# Sub-skill: context

`ARGS`(비어 있으면 현재 작업 디렉터리로 기본 설정)로부터 현재 프로젝트의 Module Federation 컨텍스트(MFContext)를 수집한 뒤, 집계된 요약을 출력합니다.

## 1. 기본 정보

`{projectRoot}/package.json`을 읽고 다음을 추출합니다:
- `name`: 프로젝트 이름
- `dependencies` + `devDependencies`를 병합해 전체 의존성 맵을 구성

패키지 매니저를 감지합니다(다음 순서로 파일 확인):
- `pnpm-lock.yaml` → pnpm
- `yarn.lock` → yarn
- `package-lock.json` → npm

## 2. 번들러 & MF 설정

다음 우선순위 순서로 설정 파일을 찾습니다(`.ts` / `.mts`가 `.js` / `.mjs` / `.cjs`보다 우선):

| 우선순위 | 파일명 |
|---|---|
| 1 | `module-federation.config.{ts,mts,js,mjs,cjs}` |
| 2 | `rsbuild.config.{ts,mts,js,mjs,cjs}` |
| 3 | `rspack.config.{ts,mts,js,mjs,cjs}` |
| 4 | `modern.config.{ts,mts,js,mjs,cjs}` |
| 5 | `next.config.{ts,mts,js,mjs,cjs}` |
| 6 | `webpack.config.{ts,js}` |
| 7 | `vite.config.{ts,mts,js,mjs,cjs}` |

가장 먼저 매칭된 파일을 읽고 `remotes`, `exposes`, `shared` 필드를 추출합니다.

설정 파일명으로 번들러 이름을 판별합니다(`rspack` / `rsbuild` / `webpack` / `vite` / `next`). 우선순위 1(`module-federation.config.*`)이 매칭되면, 프로젝트 루트에서 우선순위 2~7의 번들러 설정 파일을 스캔해 `bundler.name`과 `bundler.configFile`(MF 설정 경로가 아니라 번들러 설정 경로)을 설정합니다. 번들러 설정을 찾지 못하면 `bundler.name`을 `unknown`으로, `bundler.configFile`을 `module-federation.config.*` 경로로 설정합니다.

## 3. MF 역할 판별

| 조건 | 역할 |
|---|---|
| `remotes`와 `exposes` 모두 있음 | `host+remote` |
| `remotes`만 있음 | `host` |
| `exposes`만 있음 | `remote` |
| 둘 다 없음 | `unknown` |

## 4. 최근 에러 이벤트 (선택)

`.mf/observability/latest.json`이 존재하는지 확인하고, 있으면 내용을 읽습니다.

## 5. 빌드 산출물 (선택)

`dist/mf-manifest.json`과 `dist/mf-stats.json`이 존재하는지 확인하고, 있으면 읽습니다.

---

위 정보를 집계해 다음 구조로 MFContext 요약을 출력합니다:

```
project:
  name, packageManager, mfRole

bundler:
  name, configFile

mfConfig:
  remotes, exposes, shared

dependencies:
  (list installed packages related to MF and their versions)

latestErrorEvent: (if present)
buildArtifacts:   (if present)
```
