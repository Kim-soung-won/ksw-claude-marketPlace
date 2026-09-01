# Sub-skill: docs

관련 문서 페이지만 가져와 Module Federation 질문에 답합니다 — 전체 문서를 가져오지 않습니다.

module-federation.io에서 문서를 가져오려면 인터넷 접속이 필요합니다.

## 1단계: 문서 인덱스 가져오기

```
https://module-federation.io/llms.txt
```

인덱스는 다음 형식입니다:

```
## Section Name
- [Page Title](/path/to/page.md): brief description of the page content
```

## 2단계: 관련 페이지 식별

인덱스의 페이지 설명을 읽고 사용자 질문과 가장 관련 있는 1~3개 페이지를 선택합니다. 설명을 읽기 전에 아래의 빠른 토픽 맵으로 후보를 좁힙니다.

**빠른 토픽 맵:**

| 사용자 질문 주제 | 확인할 섹션 |
|---|---|
| What is MF / 개념 / 용어집 / 시작하기 | `Guide` → `start/` |
| CLI, CSS 격리, 타입 힌트, 데이터 페칭, prefetch | `Guide` → `basic/` |
| 런타임 API, `loadRemote`, MF 인스턴스, 런타임 훅 | `Guide` → `runtime/` |
| Webpack / Rspack / Rsbuild / Vite / Metro 빌드 플러그인 설정 | `Guide` → `build-plugins/` |
| Next.js / Modern.js / Angular / React 통합 | `Guide` → `framework/` 또는 `Practice` → `frameworks/` |
| React Bridge / Vue Bridge / 크로스 프레임워크 렌더링 | `Practice` → `bridge/` |
| `name`, `filename`, `exposes`, `remotes`, `shared`, `dts`, `manifest`, `shareStrategy` | `Configuration` |
| 런타임 플러그인, 재시도 플러그인, 커스텀 플러그인 | `Plugins` |
| 성능, 트리 셰이킹, 공유 스코프 | `Guide` → `performance/` 또는 `Guide` → `advanced/` |
| 디버그 모드, Chrome DevTool, 전역 변수 | `Guide` → `debug/` |
| 에러 메시지, 빌드 에러, 타입 에러 | `Guide` → `troubleshooting/` |
| 모노레포, Nx | `Practice` → `monorepos/` |
| 배포, Zephyr | `Guide` → `deployment/` |

## 3단계: 특정 페이지 가져오기

인덱스의 경로에서 `.md` 확장자를 제거한 뒤 베이스 URL을 앞에 붙여 URL을 구성합니다:

```
https://module-federation.io{path_without_md_extension}
```

**예시:**
- `/guide/start/index.md` → `https://module-federation.io/guide/start/index`
- `/configure/shared.md` → `https://module-federation.io/configure/shared`
- `/guide/runtime/runtime-api.md` → `https://module-federation.io/guide/runtime/runtime-api`

페이지를 가져와 내용을 읽습니다.

## 4단계: 질문에 답하기

가져온 내용을 바탕으로 답합니다. 답이 여러 페이지에 걸쳐 있으면(예: config + runtime) 둘 다 가져옵니다. 질문당 3개를 초과해 로드하지 마십시오.

## 중요 참고 사항

- 항상 인덱스를 먼저 가져오십시오 — 기억에 의존해 페이지 경로를 추측하지 마십시오
- 인덱스 설명만으로 올바른 페이지를 식별하기 부족하면 가장 가능성 높은 후보를 가져와 내용을 확인하십시오
- 이 문서는 MF 2.0 (`@module-federation/enhanced`)을 다룹니다 — 이는 구형 Webpack 5 내장 Module Federation과 다릅니다
- Next.js 지원은 deprecated되었습니다; 사용자가 이에 대해 물으면 알려주십시오
