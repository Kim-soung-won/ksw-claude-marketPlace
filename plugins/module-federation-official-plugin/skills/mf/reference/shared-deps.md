# Sub-skill: shared-deps

Module Federation 공유 의존성 설정을 검사합니다: shared/externals 충돌, 공유 의존성을 차단하는 antd/arco transformImport, 그리고 빌드 산출물 내 동일 공유 패키지의 다중 버전을 감지합니다.

## 1단계: MFContext 수집

`./context.md`의 지침을 읽고 따르며, ARGS를 프로젝트 루트로 전달합니다.

## 2단계: 공유 설정 체크 스크립트 실행

MFContext를 JSON으로 직렬화하여 체크 스크립트에 전달합니다:

```bash
node scripts/shared-config-check.js --context '<MFContext-JSON>'
```

출력의 `results` 배열의 각 항목을 처리합니다:

**SHARED-EXTERNALS-CONFLICT · warning — 동일 라이브러리가 `shared`와 `externals` 양쪽에 존재**
- `shared`와 `externals`는 설정상 상호 배타적이지 않지만, 동일한 라이브러리가 양쪽에 나타나서는 안 됩니다 — 이는 모듈이 번들에서 제외되는 동시에 공유로 선언되게 하여 런타임 실패로 이어집니다
- 충돌하는 라이브러리 이름을 보여주고 두 설정 중 하나에서 제거하도록 사용자를 안내합니다

**SHARED-TRANSFORM-IMPORT · warning — antd/arco UI 라이브러리가 공유되지만 `transformImport`가 활성화됨**
- `babel-plugin-import`(또는 Modern.js / Rsbuild의 내장 `transformImport`)는 빌드 시점에 import 경로를 다시 작성하여, 공유 의존성이 인식되지 못하게 하고 공유가 조용히 실패하게 만듭니다
- 해결:
  - Modern.js / Rsbuild: `source.transformImport = false`로 설정하여 내장 동작을 비활성화합니다
  - 기타 번들러: Babel 설정에서 `babel-plugin-import`를 제거합니다
- 어떤 UI 라이브러리가 경고를 유발했는지 보여줍니다

**SHARED-MULTI-VERSION · warning — 동일 공유 패키지의 다중 버전 감지됨**
- 빌드 산출물에 공유 패키지의 버전이 두 개 이상 포함되어 있으며, 이는 버전 협상이 실패하여 호스트와 리모트가 각자 자신의 사본을 번들링하고 있음을 의미합니다
- 권장 해결책: 번들러 설정에 `alias`를 추가하여 모든 프로젝트가 동일한 물리적 파일로 해석되도록 합니다
- 감지된 버전들을 보여줍니다

**results가 비어 있는 경우**
- 이 프로젝트에서 공유 의존성 충돌이 감지되지 않았음을 사용자에게 알립니다
- 완전한 그림을 얻으려면 호스트와 모든 리모트에서 동일한 검사를 실행해야 함을 상기시킵니다
