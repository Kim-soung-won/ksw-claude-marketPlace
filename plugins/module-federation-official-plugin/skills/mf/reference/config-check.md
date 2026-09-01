# Sub-skill: config-check

Module Federation 빌드 설정을 점검한다: 번들러에 맞는 올바른 MF 플러그인, async entry 설정, exposes 키 형식, exposes 경로 존재 여부를 검증한다.

## 1단계: MFContext 수집

`./context.md`의 지침을 읽고 따르며, ARGS를 프로젝트 루트로 전달한다.

## 2단계: 설정 점검 스크립트 실행

MFContext를 JSON으로 직렬화하여 점검 스크립트에 전달한다:

```bash
node scripts/config-exposes-check.js --context '<MFContext-JSON>'
```

출력의 `results` 배열에 있는 각 항목을 처리한다:

**CONFIG-PLUGIN · warning — 잘못되었거나 누락된 MF 플러그인**
- 감지된 번들러와 설치된 패키지를 기준으로 권장 플러그인은 다음과 같다:
  - Webpack 전용: `@module-federation/enhanced` 또는 `@module-federation/enhanced/webpack`
  - Vite 전용: `@module-federation/vite` (MF 옵션은 `createModuleFederationConfig`를 통해 루트의 `module-federation.config.*`에 둘 수 있음)
  - Rspack 전용: `@module-federation/enhanced/rspack` (권장) 또는 `@module-federation/rspack`
  - Rsbuild: `@module-federation/rsbuild-plugin` (권장), 또는 Rspack 플러그인
  - Modern.js: `@modern-js/app-tools` ≥ 3.0.0에는 `@module-federation/modern-js-v3`, 그 외에는 `@module-federation/modern-js`; 하위 번들러에 따라 Rspack/Webpack 플러그인으로 폴백
  - Next.js: `@module-federation/nextjs-mf`
- 감지된 번들러, 설치된 MF 관련 패키지, 권장 플러그인을 표시한다

**CONFIG-ASYNC-ENTRY · warning — async entry가 설정되지 않음 (RUNTIME-006에 매핑)**
- 번들러 설정에 `experiments.asyncStartup = true`가 설정되어 있지 않음
- 이 설정은 대부분의 번들러 구성에서 런타임 초기화 오류를 피하기 위해 필요하다
- 예외: `@module-federation/modern-js-v3` 또는 `@module-federation/modern-js`를 사용할 때는 필요하지 않다
- 참고: Rspack은 이 옵션을 지원하려면 1.7.4보다 높은 버전이 필요하다
- 참조: https://module-federation.io/blog/hoisted-runtime.md
- 확인 방법: MFContext에서 `bundler.configFile`을 읽고 `experiments.asyncStartup`을 찾는다

**CONFIG-EXPOSES-KEY · warning — 키가 `./`로 시작하지 않음**
- MF 스펙은 exposes 키가 `./`로 시작하도록 요구한다 (예: `"Button"`이 아니라 `"./Button"`)
- 해당 키 이름을 사용자에게 알리고 형식을 올바르게 수정하도록 안내한다

**CONFIG-EXPOSES-PATH · warning — 경로가 존재하지 않음**
- exposes 값이 참조하는 파일이 프로젝트에 존재하지 않는다. 해당 키와 잘못된 경로를 표시한다.
- 점검은 파일 확장자를 정확히 일치시켜야 한다 (예: `.tsx` ≠ `.ts`)
- 흔한 원인:
  1. 파일 경로 오타
  2. 잘못된 파일 확장자
  3. 잘못된 상대 경로 기준 (프로젝트 루트를 기준으로 해야 함)

**results가 비어 있을 때**
- 플러그인 선택, async entry 설정, exposes가 모든 점검을 통과했음을 사용자에게 알린다
