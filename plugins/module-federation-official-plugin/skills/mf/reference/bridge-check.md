# Sub-skill: bridge-check

Module Federation Bridge 사용을 점검한다: 프로듀서가 `export-app`을 올바르게 내보내는지, 그리고 컨슈머가 권장 Bridge API를 사용하는지 검증한다.

## 1단계: MFContext 수집

`./context.md`의 지침을 읽고 따르며, ARGS를 프로젝트 루트로 전달한다.

## 2단계: bridge 점검 스크립트 실행

MFContext를 JSON으로 직렬화하여 점검 스크립트에 전달한다:

```bash
node scripts/bridge-check.js --context '<MFContext-JSON>'
```

출력의 `results`와 `context.mfConfig`에 있는 각 항목을 처리한다:

**BRIDGE-USAGE · info — export-app 내보내기를 찾을 수 없음**
- `exposes`에서 `export-app` 패턴과 일치하는 키를 찾을 수 없음
- 이 프로젝트가 Bridge 스펙을 따라야 하는 서브앱이라면 사용자에게 다음을 안내한다:
  1. `exposes`에 `"./export-app": "./src/export-app.tsx"`를 추가한다
  2. 내보낸 모듈은 Bridge 스펙을 준수하는 객체(`render` 및 `destroy` 메서드 포함)를 반환해야 한다

**BRIDGE-USAGE · info — 컨슈머 API 권장 사항**
- 컨슈머에게 `createRemoteAppComponent`와 같은 공식 Bridge API 사용을 권장한다
- 리모트 URL을 직접 연결하거나 `loadRemote`를 수동으로 호출하는 것을 피한다

`context.mfRole`이 `host`(exposes 없음)인 경우, 프로듀서 측 점검은 건너뛰고 컨슈머 측 권장 사항만 제공한다.
