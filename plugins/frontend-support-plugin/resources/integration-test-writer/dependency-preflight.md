# integration-test-writer 의존성 preflight (사전 점검)

통합 테스트는 단위 테스트와 달리 **특정 라이브러리 스택을 전제**한다. 대상 프로젝트에 이
스택이 없으면 테스트를 써봤자 import 에러로 실행조차 되지 않는다. 그래서 테스트 작성에
착수하기 **전에** 아래 절차로 필수 의존성을 점검하고, 없으면 조용히 진행하지 말고 대응한다.

핵심 철학은 test-writer 0단계의 "모호하면 임의로 고르지 말고 되묻는다"와 동일하다 —
**지어내지도, 조용히 우회하지도 않는다.**

---

## 1. 점검 대상 의존성

통합 테스트가 요구하는 것들:

| 대상 | 역할 | 필수/선택 |
|---|---|---|
| `msw` | HTTP 경계 모킹 (이 에이전트의 네트워크 경계 전제) | **필수(핵심)** |
| `@testing-library/react` | RTL 렌더 | **필수** |
| `@testing-library/user-event` | 사용자 상호작용 재현 | **필수** |
| jsdom 환경 | vitest `environment: jsdom` 지원 (vitest에 내장이거나 `jsdom`/`happy-dom` 패키지) | **필수** |
| `@testing-library/jest-dom` | 확장 matcher (`toBeInTheDocument` 등) | 선택 |
| 공용 test-utils 렌더 하니스 | 프로바이더 래핑 렌더 유틸 (없으면 통합 테스트 전제가 깨짐) | **필수(코드 자산)** |

---

## 2. 점검 방법

1. `package.json`의 `dependencies` / `devDependencies`를 Read 또는 grep로 확인해 위
   패키지들이 선언돼 있는지 본다.
2. 필요시 `node_modules`에 실제로 설치돼 있는지도 확인한다(선언만 있고 미설치일 수 있음).
3. jsdom 환경은 `vitest.config.*`/`vite.config.*`의 `test.environment` 설정과, `jsdom`
   또는 `happy-dom` 패키지 설치 여부를 함께 본다.
4. 공용 test-utils 하니스는 프로젝트 관례상 `test/` 또는 `src/shared/test`류 경로에
   렌더 래퍼(프로바이더 조립 유틸)가 있는지 찾는다. (정확한 위치는 스킬/프로젝트 관례 기준)
5. **패키지 매니저 판별은 lockfile로 한다:**
   - `pnpm-lock.yaml` → pnpm
   - `yarn.lock` → yarn
   - `package-lock.json` → npm

---

## 3. 부재 시 대응 (핵심 — 지어내지도, 조용히 우회하지도 않는다)

- **깨진 테스트를 만들지 않는다.** import 에러가 뻔한 상태로 파일을 남기지 않는다.
- 어떤 의존성이 빠졌는지 콕 집고, 판별된 패키지 매니저에 맞는 **정확한 설치 명령**을
  제시한다. 예:
  - pnpm: `pnpm add -D msw @testing-library/react @testing-library/user-event jsdom`
  - yarn: `yarn add -D msw @testing-library/react @testing-library/user-event jsdom`
  - npm: `npm i -D msw @testing-library/react @testing-library/user-event jsdom`
- **설치는 side-effect이므로 이 에이전트가 임의로 실행하지 않는다.** 최종 요약에
  "이 의존성이 없어 진행 불가 — 아래 명령으로 설치 후 재요청" 형태의 **차단 보고**로
  담는다. (AskUserQuestion은 서브에이전트에서 동작하지 않으므로 요약 텍스트로 되묻는다.)
- **MSW 환경 세팅**: MSW는 노드/브라우저에 따라 세팅이 다르다(`setupServer` vs
  `setupWorker`). vitest(node/jsdom) 통합 테스트는 `msw/node`의 `setupServer`를 쓴다는
  점을 안내한다. 세팅 파일(`setupFiles`)에 서버 lifecycle(`beforeAll listen` /
  `afterEach resetHandlers` / `afterAll close`)이 구성돼 있는지도 함께 점검한다.
- **공용 test-utils 하니스가 없으면**: 매 파일에서 Provider를 직접 조립하는 것을 남발하지
  말고, 하니스 부재를 보고하고 **최소 렌더 래퍼 신설이 필요함**을 안내한다. 범위를 넘어
  마음대로 대형 테스트 인프라를 만들지 않는다.

---

## 4. 부분 부재

일부만 있고 일부만 없는 경우도 같은 원칙으로 처리한다 — **빠진 것만 콕 집어** 보고하고,
설치 명령에는 빠진 패키지만 포함한다. 이미 있는 것을 재설치하도록 요구하지 않는다.

---

## 통과 조건

위 필수 항목(`msw`, `@testing-library/react`, `@testing-library/user-event`, jsdom 환경,
공용 test-utils 하니스)이 모두 충족되면 preflight 통과로 보고 다음 단계로 진행한다.
하나라도 빠지면 테스트 파일을 만들지 않고 3항의 차단 보고로 넘어간다.
