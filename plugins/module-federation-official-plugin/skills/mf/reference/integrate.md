# Sub-skill: integrate

Module Federation을 기존 프로젝트에 통합합니다 — 프로바이더(모듈을 노출) 또는 컨슈머(리모트 모듈을 로드) 설정을 추가합니다.

## 1단계: 프로젝트 감지

`./context.md`의 지침을 읽고 따라 MFContext를 수집하며, ARGS를 프로젝트 루트로 전달합니다.

번들러를 감지할 수 없는 경우(`rsbuild.config`, `rspack.config`, `webpack.config`, `modern.config`, `next.config`, `vite.config` 중 어느 것도 찾을 수 없음), 이는 새 프로젝트일 가능성이 높습니다. 사용자에게 다음을 안내합니다:

> 이것은 새 프로젝트로 보입니다. 완전한 Module Federation 프로젝트를 스캐폴딩하려면 다음 명령을 실행하세요:
>
> ```bash
> npm create module-federation@latest
> ```

그런 다음 중단합니다.

MF가 이미 설정되어 있는 경우(MFContext에 기존 `remotes` 또는 `exposes`가 표시됨), 이미 설정된 내용을 사용자에게 알리고 설정을 추가/수정할지 아니면 중단할지 묻습니다.

---

## 2단계: 파라미터 수집

사용자에게 다음 질문을 합니다(하나의 AskUserQuestion 호출로 통합):

1. **역할(Role)** — 이 앱이 어떤 역할을 해야 하나요?
   - `consumer` — 리모트 앱에서 모듈을 로드합니다 (기본값)
   - `provider` — 다른 앱에 모듈을 노출합니다
   - `both` — 모듈을 노출하고 리모트 모듈도 로드합니다

2. **앱 이름(App name)** — 이 앱의 MF 이름은 무엇이어야 하나요?
   - `package.json`의 `name` 필드를 제안합니다(snake_case, 하이픈 없음). MF 이름에는 하이픈이 허용되지 않습니다.

3. **역할별 질문**:
   - **consumer** 또는 **both**인 경우: MF가 즉시 동작하는 것을 보기 위해 공개 데모 프로바이더에 연결하시겠습니까, 아니면 직접 리모트를 설정하시겠습니까?
     - `demo` — 공개 데모 프로바이더 사용 (컨슈머의 기본값)
     - `custom` — 직접 리모트 URL을 지정합니다
   - **provider** 또는 **both**인 경우: 어떤 모듈을 노출하시겠습니까? `key: path` 쌍을 제공하세요. 예: `./Button: ./src/components/Button.tsx`. 확실하지 않으면 기본값으로 `'.' : './src/index'`를 사용합니다.

---

## 3단계: MF 설정 객체 구성

수집한 파라미터를 기반으로 MF 설정을 구성합니다:

### 리모트 엔트리 (consumer / both용)

**데모 프로바이더** (사용자가 `demo`를 선택한 경우 사용):
```ts
remotes: {
  'provider': 'rslib_provider@https://unpkg.com/module-federation-rslib-provider@latest/dist/mf/mf-manifest.json',
},
```

데모 프로바이더는 `'provider'`에서 React 컴포넌트를 노출합니다. 사용자는 자신의 앱에서 이를 import할 수 있습니다:
```tsx
import ProviderApp from 'provider';
```

**커스텀 리모트** (사용자가 `custom`을 선택한 경우 사용):
사용자에게 `name: url` 형식으로 리모트 엔트리를 제공하도록 요청한 뒤, 그대로 사용합니다.

### Exposes (provider / both용)

사용자가 제공한 항목을 사용합니다. 예시:
```ts
exposes: {
  './Button': './src/components/Button.tsx',
},
```

### 공유 의존성

`package.json`을 읽어 어떤 프레임워크가 존재하는지 확인합니다. 그에 따라 싱글턴을 설정합니다:
- `react` + `react-dom`이 있는 경우: 둘 다 `{ singleton: true }`로 추가
- `vue`가 있는 경우: `{ singleton: true }`로 추가
- 둘 다 있는 경우(드묾): 모두 싱글턴으로 추가

---

## 4단계: 파일 생성

감지된 번들러에 맞는 패턴을 적용합니다:

---

### Rsbuild

**감지 기준**: 프로젝트 루트의 `rsbuild.config.ts` / `rsbuild.config.js`.

#### 4a. `module-federation.config.ts` 생성

```ts
import { createModuleFederationConfig } from '@module-federation/rsbuild-plugin';

export default createModuleFederationConfig({
  name: '<app-name>',
  // exposes: { ... },        // provider / both only
  // remotes: { ... },        // consumer / both only
  shareStrategy: 'loaded-first',
  shared: {
    // react + react-dom or vue — from Step 3
  },
});
```

#### 4b. `rsbuild.config.ts` 수정

```diff
+import { pluginModuleFederation } from '@module-federation/rsbuild-plugin';
+import moduleFederationConfig from './module-federation.config';

 export default defineConfig({
   plugins: [
     pluginReact(),
+    pluginModuleFederation(moduleFederationConfig),
   ],
 });
```

#### 4c. 설치

```bash
pnpm add @module-federation/rsbuild-plugin
```

---

### Modern.js

**감지 기준**: 프로젝트 루트의 `modern.config.ts` / `modern.config.js`.

#### 4a. `module-federation.config.ts` 생성

```ts
import { createModuleFederationConfig } from '@module-federation/modern-js-v3';

export default createModuleFederationConfig({
  name: '<app-name>',
  // exposes: { ... },        // provider / both only
  // remotes: { ... },        // consumer / both only
  shared: {
    // react + react-dom or vue — from Step 3
  },
});
```

#### 4b. `modern.config.ts` 수정

```diff
+import { moduleFederationPlugin } from '@module-federation/modern-js-v3';

 export default defineConfig({
   plugins: [
     appTools(),
+    moduleFederationPlugin(),
   ],
 });
```

#### 4c. 컨슈머의 경우: 타입 경로 추가

리모트 타입을 해석하도록 `tsconfig.json`을 수정합니다:

```diff
 {
   "compilerOptions": {
+    "paths": {
+      "*": ["./@mf-types/*"]
+    }
   }
 }
```

#### 4d. 설치

```bash
pnpm add @module-federation/modern-js-v3
```

---

### Rspack

**감지 기준**: 프로젝트 루트의 `rspack.config.ts` / `rspack.config.js`.

#### 4a. `rspack.config.ts` / `rspack.config.js` 수정

```diff
+const { ModuleFederationPlugin } = require('@module-federation/enhanced/rspack');

 module.exports = {
+  experiments: {
+    asyncStartup: true,
+  },
   plugins: [
+    new ModuleFederationPlugin({
+      name: '<app-name>',
+      // exposes: { ... },   // provider / both only
+      // remotes: { ... },   // consumer / both only
+      shared: {
+        // from Step 3
+      },
+    }),
   ],
 };
```

> 참고: `experiments.asyncStartup`는 Rspack > 1.7.4가 필요합니다.

#### 4b. 설치

```bash
pnpm add @module-federation/enhanced
```

---

### Webpack

**감지 기준**: 프로젝트 루트의 `webpack.config.ts` / `webpack.config.js`.

#### 4a. `webpack.config.js` 수정

```diff
+const { ModuleFederationPlugin } = require('@module-federation/enhanced/webpack');

 module.exports = {
+  experiments: {
+    asyncStartup: true,
+  },
   plugins: [
+    new ModuleFederationPlugin({
+      name: '<app-name>',
+      filename: 'remoteEntry.js',
+      // exposes: { ... },   // provider / both only
+      // remotes: { ... },   // consumer / both only
+      shared: {
+        // from Step 3
+      },
+    }),
   ],
 };
```

#### 4b. 설치

```bash
pnpm add @module-federation/enhanced
```

---

### Next.js

**감지 기준**: 프로젝트 루트의 `next.config.ts` / `next.config.mjs` / `next.config.js`.

> **지원 중단 경고**: `@module-federation/nextjs-mf`는 Pages Router만 지원하며(App Router 미지원) 더 이상 활발히 유지 관리되지 않습니다. 새 프로젝트의 경우 대신 Rsbuild 또는 Modern.js 사용을 고려하세요.

#### 4a. `next.config.mjs` 수정

```diff
+import { NextFederationPlugin } from '@module-federation/nextjs-mf';

 const nextConfig = {
   webpack(config, options) {
+    config.plugins.push(
+      new NextFederationPlugin({
+        name: '<app-name>',
+        filename: 'static/chunks/remoteEntry.js',
+        // exposes: { ... },   // provider / both only
+        // remotes: {          // consumer / both only
+        //   remote: `remote@http://localhost:3001/static/${options.isServer ? 'ssr' : 'chunks'}/remoteEntry.js`,
+        // },
+        shared: {},
+        extraOptions: {
+          exposePages: true,
+          enableImageLoaderFix: true,
+          enableUrlLoaderFix: true,
+        },
+      })
+    );
     return config;
   },
 };
```

#### 4b. 로컬 Webpack 활성화

`.env.local`에 추가합니다:
```
NEXT_PRIVATE_LOCAL_WEBPACK=true
```

#### 4c. 설치

```bash
pnpm add @module-federation/nextjs-mf webpack -D
```

---

### Vite

**감지 기준**: 프로젝트 루트의 `vite.config.ts` / `vite.config.js`.

#### 4a. `module-federation.config.ts` 생성

```ts
import { createModuleFederationConfig } from '@module-federation/vite';

export default createModuleFederationConfig({
  name: '<app-name>',
  // exposes: { ... },        // provider / both only
  // remotes: { ... },        // consumer / both only
  shared: {
    // react + react-dom or vue — from Step 3
  },
});
```

#### 4b. `vite.config.ts` 수정

```diff
+import { federation } from '@module-federation/vite';
+import moduleFederationConfig from './module-federation.config';

 export default defineConfig({
   plugins: [
+    federation(moduleFederationConfig),
   ],
 });
```

#### 4c. 설치

```bash
pnpm add @module-federation/vite
```

---

## 5단계: 리모트 컴포넌트 자동 삽입 (consumer / both 전용)

provider 전용 역할의 경우 이 단계를 전부 건너뜁니다.

사용자에게 묻습니다:

> 즉시 동작하는 것을 볼 수 있도록 리모트 컴포넌트를 앱의 엔트리에 자동으로 추가해 드릴까요?

사용자가 **아니오**라고 하면, 참조용 코드 스니펫만 보여주고 6단계로 넘어갑니다.

사용자가 **예**라고 하면:

### 5a. 엔트리 파일 찾기

다음 우선순위 순서로 엔트리 컴포넌트 파일을 검색합니다:

| 번들러 | 후보 (순서대로) |
|---|---|
| Rsbuild | `src/App.tsx`, `src/App.jsx`, `src/App.js` |
| Modern.js | `src/routes/page.tsx`, `src/routes/page.jsx` |
| Webpack / Rspack | `src/App.tsx`, `src/App.jsx`, `src/App.js`, `src/index.tsx`, `src/index.jsx` |
| Next.js | `pages/index.tsx`, `pages/index.jsx`, `pages/index.js` |
| Vite | `src/App.tsx`, `src/App.jsx`, `src/App.js` |

존재하는 첫 번째 파일을 읽습니다. 아무것도 찾지 못하면 사용자에게 수동으로 수정할 파일을 알리고 스니펫을 보여줍니다 — 추측으로 쓰기 작업을 시도하지 마세요.

### 5b. 리모트 이름과 import 경로 결정

4단계에서 생성된 설정의 리모트 이름을 사용합니다:
- 데모 프로바이더인 경우: 리모트 이름은 `provider`, import 경로는 `'provider'`
- 커스텀 리모트인 경우: 사용자가 지정한 첫 번째 리모트 이름을 사용

### 5c. 엔트리 파일 편집

파일 상단(기존 import 뒤)에 import를 추가하고, 기존 JSX return 내부에 컴포넌트를 렌더링합니다.

**React의 경우 (Rsbuild / Rspack / Webpack / Vite)**

마지막 기존 import 줄 뒤에 import를 추가합니다:
```tsx
import ProviderApp from 'provider';
```

기존 JSX return 내부에 `<ProviderApp />`를 삽입합니다. 자연스러운 위치를 찾으세요 — `<div>` 내부, 기존 콘텐츠 뒤. 컴포넌트를 재구성하지 말고, 요소만 추가합니다.

**Modern.js의 경우** (`src/routes/page.tsx`)

동일한 패턴 — import를 추가하고 반환되는 JSX에 `<ProviderApp />`를 렌더링합니다.

**Next.js의 경우** (`pages/index.tsx`)

동일한 패턴 — import를 추가하고 반환되는 JSX에 `<ProviderApp />`를 렌더링합니다.

### 5d. TypeScript 선언 추가 (TypeScript 프로젝트인 경우)

`tsconfig.json`이 존재하는지 확인합니다. 존재하면 `src/remote.d.ts`를 생성합니다(또는 기존 `src/declarations.d.ts` / `src/env.d.ts`가 있으면 거기에 추가):

```ts
declare module '<remote-name>' {
  const Component: React.ComponentType;
  export default Component;
}
```

`<remote-name>`을 실제 리모트 이름(예: `provider`)으로 바꿉니다.

### 프로바이더: 노출된 모듈을 검증하는 방법

개발 서버를 실행한 후 매니페스트가 다음 위치에서 제공될 것임을 사용자에게 알립니다:
- Rsbuild / Rspack / Webpack / Modern.js / Vite: `http://localhost:<port>/mf-manifest.json` (아직 설정되지 않았다면 MF 설정에서 `manifest: true`를 활성화)
- Next.js: `http://localhost:<port>/static/chunks/remoteEntry.js`

다른 앱은 다음을 사용하여 이 앱을 리모트로 참조할 수 있습니다:
```ts
remotes: {
  '<app-name>': '<app-name>@http://localhost:<port>/mf-manifest.json',
},
```

---

## 6단계: 요약

간결한 요약을 출력합니다:
- 어떤 파일이 생성 또는 수정되었는지
- 어떤 패키지가 설치되었는지
- 개발 서버를 시작하는 방법 (`package.json`의 기존 스크립트 사용)
- 다음 단계 (예: 리모트 추가, 공유 의존성 설정, 타입 생성 설정)
