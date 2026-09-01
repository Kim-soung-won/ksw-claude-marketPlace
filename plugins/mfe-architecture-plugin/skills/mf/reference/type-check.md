# Sub-skill: type-check

Module Federation 타입 문제를 세 가지 범주로 진단합니다:
1. 프로듀서 타입 파일 생성 실패 (TYPE-001)
2. 컨슈머가 리모트 타입을 가져오지 못함
3. tsconfig가 리모트 타입을 소비하도록 설정되지 않음

## 1단계: MFContext 수집

`./context.md`의 지침을 읽고 따르며, ARGS를 프로젝트 루트로 전달합니다.

## 2단계: 타입 체크 스크립트 실행

MFContext를 JSON으로 직렬화하여 체크 스크립트에 전달합니다:

```bash
node scripts/type-check.js --context '<MFContext-JSON>'
```

출력의 `results` 배열의 각 항목을 처리하고, `scenario` 필드를 기반으로 조치 계획을 따릅니다:

---

### 시나리오: `TYPE_GENERATION_FAILED` (문제 1 — 프로듀서 타입 파일이 생성되지 않음)

프로듀서가 타입 파일 생성에 실패했습니다 (TYPE-001 에러).

**`enhancedVersion` > `2.0.1`인 경우** (result 필드 `canReadDiagnostics: true`):
1. `.mf/observability/latest.json`을 읽어 전체 에러 정보와 임시 TS 설정 경로를 가져옵니다
2. 임시 TS 설정 경로를 사용하여 `npx tsc --project <tmp-tsconfig>`로 에러를 재현합니다
3. 드러난 TS 에러를 수정합니다. FAQ 참조: https://module-federation.io/guide/troubleshooting/type.md
4. 에러가 복잡한 경우 임시 해결책으로 `"skipLibCheck": true`를 제안합니다

**`enhancedVersion` <= `2.0.1`인 경우** (result 필드 `canReadDiagnostics: false`):
1. 사용자에게 `npx mf dts`를 실행하고 터미널 출력(임시 TS 설정 경로 포함)을 붙여넣도록 요청합니다
2. 또는 임시 TS 설정 경로가 포함된 에러 메시지를 복사하도록 요청합니다
3. 임시 TS 설정 경로를 알게 되면 `npx tsc --project <tmp-tsconfig>`를 실행하여 에러를 재현하고 수정합니다
4. 임시 해결책으로 `"skipLibCheck": true`를 제안합니다

---

### 시나리오: `TYPES_NOT_PULLED` (문제 2 — 컨슈머가 리모트 타입을 가져오지 못함)

`@mf-types` 폴더가 없습니다. 리모트 타입이 다운로드되지 않았습니다.

1. `./module-info.md`를 읽고 리모트 모듈 이름과 함께 따라 타입 파일 URL(`@mf-types.zip`)을 조회합니다
   - **URL이 반환되지 않은 경우**: 프로듀서가 타입 파일 URL을 설정하지 않았거나 타입을 생성하지 않았습니다. `@module-federation/enhanced` 플러그인 설정에서 `dts`를 활성화하도록 안내한 뒤 **문제 1**을 다시 확인합니다
   - **URL을 찾은 경우**: 가져오기를 시도합니다. 인증된
     브라우저 컨텍스트가 필요한 경우 `./divebell.md`를 읽고 `divebell read <url>` 또는
     설치된 가장 작은 Divebell 브라우저 명령을 사용합니다. 원시 CDP나
     다른 브라우저 도구로 전환하지 마세요
     - **URL 접근 불가**: `remoteEntry` URL 가져오기를 시도합니다
       - `remoteEntry` **도달 불가**: 프로듀서 배포가 손상되었거나 URL이 잘못 설정됨; 사용자에게 배포를 확인하도록 요청합니다
       - `remoteEntry` **도달 가능**: 타입 파일 생성이 실패했거나 배포되지 않음; 사용자에게 로컬 프로듀서 경로를 제공하도록 요청하고 **문제 1**로 진행합니다
     - **URL 접근 가능**: 타입이 생성되어 배포됨; 문제는 tsconfig에 있음 — **문제 3**으로 진행합니다

---

### 시나리오: `TSCONFIG_PATHS_MISSING` (문제 3 — tsconfig가 리모트 타입에 맞게 설정되지 않음)

`@mf-types` 폴더는 존재하지만 `tsconfig.json`에 `paths` 매핑이 없어 TypeScript가 타입을 찾지 못합니다.

1. `tsconfig.json`을 열고 `compilerOptions.paths`에 다음을 추가합니다:
   ```json
   {
     "compilerOptions": {
       "paths": {
         "*": ["./@mf-types/*"]
       }
     }
   }
   ```
2. `paths`가 이미 존재하면 기존 매핑을 덮어쓰지 않고 새 항목을 병합합니다
3. 업데이트 후 `npx tsc --noEmit`를 실행하여 타입 에러가 해결되었는지 확인합니다

---

### 시나리오: `ENV_INCOMPLETE` (tsconfig 또는 TypeScript 누락)

**TYPE-001 · warning — `tsconfig.json` 누락**
- 프로젝트 루트에서 `tsconfig.json`을 찾을 수 없음
- 사용자에게 `tsconfig.json`을 생성하고 `paths`에 프로듀서 타입 경로를 설정하도록 안내합니다

**TYPE-001 · warning — `typescript` 의존성 누락**
- `dependencies` / `devDependencies`에 `typescript`가 설치되지 않음
- 사용자에게 설치를 안내합니다: `pnpm add -D typescript`

---

> 이 sub-skill은 설정 및 의존성 수준의 검사를 수행합니다. 유효한 임시 TS 설정 경로의 안내를 받을 때만 `npx tsc`를 실행합니다. 전체 프로젝트에 대해 무작정 `tsc`를 실행하지 않습니다.
