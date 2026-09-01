# Sub-skill: perf

Module Federation 로컬 개발 성능 설정을 점검한다: 느린 HMR과 느린 빌드 속도를 완화하기 위해 권장 성능 최적화 옵션이 활성화되어 있는지 감지한다.

## 1단계: MFContext 수집

`./context.md`의 지침을 읽고 따르며, ARGS를 프로젝트 루트로 전달한다.

## 2단계: 성능 점검 스크립트 실행

MFContext를 JSON으로 직렬화하여 점검 스크립트에 전달한다:

```bash
node scripts/performance-check.js --context '<MFContext-JSON>'
```

출력의 `results`와 `context.bundler.name`에 있는 각 항목에 대해 권장 사항을 제공한다:

**PERF · info — `dev.disableAssetsAnalyze`** (모든 프로젝트에 적용)
- 로컬 개발 중 번들 크기 분석을 비활성화하면 HMR 속도가 크게 향상된다
- Rsbuild 설정에 추가한다:
  ```js
  dev: { disableAssetsAnalyze: true }
  ```

**PERF · info — Rspack `splitChunks` 최적화** (`bundler.name`이 `rspack` 또는 `rsbuild`일 때만 표시)
- `splitChunks.chunks`를 `"async"`로 설정하면 초기 번들 크기가 줄어들고 첫 화면 로딩 속도가 빨라진다
- 빌드 설정에 추가한다:
  ```js
  output: { splitChunks: { chunks: 'async' } }
  ```

**PERF · info — TypeScript DTS 최적화** (`typescript` 의존성이 감지될 때만 표시)
- 타입 생성(DTS)이 주요 병목이라면 다음 옵션들을 고려할 수 있다:
  1. DTS 임시 비활성화: `@module-federation/enhanced` 설정에서 `dts: false`로 설정
  2. `ts-go`로 전환하여 타입 생성 속도를 크게 향상

## 3단계: ts-go 마이그레이션 (대화형)

DTS 권장 사항을 제시한 후 사용자에게 묻는다:

> "`ts-go`로 전환을 자동으로 시도하고 호환성을 검증해 드릴까요?"

사용자가 확인하면 다음 단계를 순서대로 실행한다:

1. **백업** — 현재 생성된 타입 출력 디렉터리(예: `@mf-types/`)를 `@mf-types.bak.<timestamp>/`처럼 타임스탬프가 붙은 백업 경로로 복사한다

2. **설정** — Module Federation 설정에서 `dts.generateTypes.compilerInstance = "tsgo"`로 설정한다

3. **설치** — MFContext의 프로젝트 패키지 매니저를 사용해 필요한 패키지를 설치한다:
   ```bash
   pnpm add @typescript/native-preview --save-dev
   ```

4. **재생성** — 다음을 실행한다:
   ```bash
   npx mf dts
   ```

5. **검증** — 새로 생성된 타입 출력을 백업과 비교(diff)한다:
   - 출력이 **동일한** 경우: `ts-go`가 호환되며 전환이 안전함을 사용자에게 알리고, 백업 제거를 제안한다
   - 출력이 **다른** 경우: 설정 변경을 되돌리고 백업을 복원하며, 무엇이 다른지(예: 누락된 선언, 변경된 시그니처) 명확히 설명하여 사용자가 그 차이를 수용할지 결정할 수 있도록 한다

Webpack 프로젝트에는 관련 없는 제안을 피하기 위해 Rspack 전용 항목을 표시하지 않는다.
