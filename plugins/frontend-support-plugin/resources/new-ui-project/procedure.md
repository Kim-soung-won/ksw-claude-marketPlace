# 새 UI 프로젝트 시작 절차

React + React Query 기반 UI 프로젝트(또는 Module Federation remote 모듈)를 새로 만들 때,
이 플러그인 스킬들의 규칙을 **단계마다 필요한 것만** 읽고 그 단계의 공통 기반을 깔아 둔다.

> 왜 단계별인가: 스킬을 처음에 한꺼번에 읽으면 컨텍스트를 크게 차지하고, 정작 그 규칙이
> 필요한 순간(테스트 작성·mutation 추가)에는 흐려진다. 스킬은 평소 키워드로 필요할 때 불려
> 온다. 이 절차가 막는 빈틈은 **프로젝트 생성 시점에 한 번 깔아야 하는 공통 기반**이 빠지는
> 것이다 — 빠지면 나중에 프로젝트마다 같은 래퍼가 복제되고 규칙이 갈라진다.

---

## 0. 시작 전 확인

- 대상 경로, 패키지 매니저, 번들러(rsbuild·vite 등), Module Federation 여부, 사내 공용 UI
  라이브러리(`@we/ai-template` 등) 사용 여부를 확인한다. 정해지지 않은 것은 추측하지 않고 묻는다.
- 이미 파일이 있는 경로면 덮어쓰지 않는다. 기존 구조를 먼저 읽고, 이 절차는 빠진 기반을 채우는
  용도로만 쓴다.

## 1. 구조 — 레이어와 공용 계층

| 읽을 것 | 깔아 둘 것 |
|---|---|
| [FSD 구조 절차](../fsd-structure-architect/procedure.md) (팀 규칙 원본 [fsd-reference](../fsd-structure-architect/fsd-reference.md)) | 레이어 폴더, 슬라이스별 public API 배럴(`index.ts` — 비워 두지 않는다) |
| [component-design-patterns](../../skills/component-design-patterns/SKILL.md) | 데이터 패칭을 컴포넌트와 함께 두는 규칙, `entities/base` 같은 공용 계층 자리 |

- 공용 상수(높이·크기 등)는 **서로 import하는 컴포넌트 고리 밖**의 상수 파일에 둔다. HOC 설정처럼
  모듈 최상단에서 읽는 값이 순환 import 안에 있으면 초기화 전 접근(TDZ) 오류가 난다.

## 2. 데이터 상태 — 로딩·오류·빈 상태

| 읽을 것 | 깔아 둘 것 |
|---|---|
| [suspense-boundary-patterns](../../skills/suspense-boundary-patterns/SKILL.md) (규칙 6~9: 폴백 UI·오류 계층) | 앱·노출 모듈 최상위 `ErrorBoundary`(로딩 문구가 아닌 오류 화면), 쿼리 영역 바운더리 사용 규칙 |

- 공용 UI 라이브러리가 쿼리 오류 바운더리(`QueryErrorBoundary` 등)를 제공하면 **그것을 쓰고
  프로젝트에 복제하지 않는다.** 없을 때만 `QueryErrorResetBoundary` + `ErrorBoundary`로 공용 계층에
  하나 만든다(`queryKey` 받는 refetch 방식 금지 — 스킬 규칙 9).
- 오류 문구는 서버 메시지 우선(응답 본문 `message` → `error`), `error.message` 미표시.

## 3. mutation — 토스트와 쿼리 갱신

| 읽을 것 | 깔아 둘 것 |
|---|---|
| [mutation-feedback-patterns](../../skills/mutation-feedback-patterns/SKILL.md) | 공용 계층에 mutation 래퍼 **하나**(성공·실패·loading 토스트, invalidate 기본값과 끄기 옵션, 호출자 콜백 항상 실행) |

- `mutationKey: [namespace, action]` 규칙과 i18n 문구 키를 이때 정한다.

## 4. 로깅

| 읽을 것 | 깔아 둘 것 |
|---|---|
| [console-logging-policy](../../skills/console-logging-policy/SKILL.md) | 오류 축약 유틸(`toLogSafe` 등), 번들러의 console 제거 설정 확인 |

## 5. 테스트 기반

| 읽을 것 | 깔아 둘 것 |
|---|---|
| [test-authoring](../../skills/test-authoring/SKILL.md) | 루트 `test/`가 `src/`를 미러링하는 배치, node 기본 + RTL 파일만 jsdom |
| [msw-mocking](../../skills/msw-mocking/SKILL.md) · [integration-test-authoring](../../skills/integration-test-authoring/SKILL.md) | MSW 서버 설정(`onUnhandledRequest: "error"`), 공용 렌더 하니스(QueryClient·Toast·i18n·라우터를 한 곳에서 조립) |

- `test/setup.ts`에 jsdom이 구현하지 않는 브라우저 API 스텁을 미리 둔다. 최소
  `ResizeObserver`(공용 UI 라이브러리 폼·말줄임 컴포넌트가 마운트 시 바로 생성한다 — 없으면
  `ReferenceError`로 렌더가 깨진다). 측정이 필요한 테스트는 파일에서 덮어쓴다.

```ts
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
```

- 도메인 기능을 테스트 명세로 개발할 계획이면 [domain-ui-tdd](../../skills/domain-ui-tdd/SKILL.md)
  의 하네스 구성을 이 단계에서 함께 잡는다.

## 6. 의존성 정리

- 스캐폴드 템플릿에서 따라온 미사용 패키지를 [dependency-cleanup](../../skills/dependency-cleanup/SKILL.md)
  절차로 확인한다. Module Federation `shared` singleton 패키지는 버전을 함부로 바꾸지 않는다.

## 7. 프로젝트 안내 남기기

마지막으로 대상 프로젝트의 에이전트 안내 문서(Claude Code는 `CLAUDE.md`, Codex는 `AGENTS.md`)에
아래 표를 남긴다. 이후 세션도 같은 규칙을 따르게 하기 위함이다. 플러그인 설치 경로는 버전마다
바뀌므로 **경로가 아니라 스킬 이름**으로 적는다.

```markdown
## 작업별로 따르는 스킬 (frontend-support-plugin)

| 작업 | 스킬 |
|---|---|
| 폴더·레이어·슬라이스 구조 | FSD 구조 절차 (frontend-workflows) |
| 컴포넌트 분리·데이터 패칭 위치 | component-design-patterns |
| Suspense 경계·로딩·스켈레톤·오류 화면 | suspense-boundary-patterns |
| mutation 토스트·쿼리 갱신·loading 토스트 | mutation-feedback-patterns |
| console 로그 레벨·오류 축약 | console-logging-policy |
| 단위 테스트 / 통합 테스트 / MSW | test-authoring / integration-test-authoring / msw-mocking |
| 미사용 의존성 정리 | dependency-cleanup |

공통 기반 위치: <앱 최상위 오류 경계 경로> · <쿼리 바운더리> · <mutation 래퍼> · <test/setup.ts> · <공용 렌더 하니스>
```

## 결과 보고

- 단계별로 깔아 둔 파일 경로, 공용 UI 라이브러리를 써서 **만들지 않은** 것, 정하지 못해 질문으로
  남긴 것, 남긴 안내 문서 경로를 보고한다.
