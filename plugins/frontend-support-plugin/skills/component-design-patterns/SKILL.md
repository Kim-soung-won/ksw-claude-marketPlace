---
name: component-design-patterns
description: >-
  React 컴포넌트를 설계·리팩터링·리뷰할 때, .tsx 파일을 Write 할 때 먼저 읽는 문서. 컴포넌트를 어떻게 쪼갤지,
  로직을 어디에 둘지, props를 어떻게 설계할지 결정해야 하는 작업에 트리거한다.
  "컴포넌트 어떻게 나눌까", "이 컴포넌트 리팩터링", "로직 분리", "재사용 가능하게",
  "props 설계", "custom hook으로 빼줘", "컴포넌트 분리", "파일 나누기", "데이터 패칭",
  "useQuery", "useSuspenseQuery", "로딩/에러 처리", "Suspense" 키워드에 반응한다. 최우선 원칙은
  "한 .tsx 파일 = 한 컴포넌트 function"(단일 책임, sub 컴포넌트는 하위 폴더의 별도
  파일로 분리)과 "데이터 패칭은 컴포넌트와 함께 둔다"(useQuery는 컴포넌트 내부에서
  isPending/isError 개별 처리, pages 직속 목록·대시보드 기초 컴포넌트는 useSuspenseQuery)이며,
  그 위에 Container/Presentational 분리, Custom Hooks 로직 분리 패턴을 다룬다.
  각 패턴의 적용 기준·안티패턴·판별 규칙을 담는다.
---

# 컴포넌트 설계 패턴 (React)

React 컴포넌트를 만들거나 리팩터링할 때, "어떻게 쪼개고 로직을 어디에 둘지"를
일관되게 결정하기 위한 참조 문서다. 두 가지 패턴을 다룬다.

| 패턴                       | 해결하는 문제                                    | 한 줄 요약                                 |
| -------------------------- | ------------------------------------------------ | ------------------------------------------ |
| Container / Presentational | 데이터·로직이 UI와 뒤엉켜 테스트·재사용이 어려움 | "어떻게 보이나"와 "어떻게 동작하나"를 분리 |
| Custom Hooks 로직 분리     | 여러 컴포넌트가 같은 상태·부수효과 로직을 중복   | 재사용 로직을 `useXxx` 훅으로 캡슐화       |

> 이 두 패턴은 배타적이지 않다. 실무에서는 대개 **Custom Hook(로직) + Presentational
> (표현)** 조합이 기본이다.
>
> 📎 각 원칙·패턴의 **상세 코드 예시**는 같은 폴더의 [`examples.md`](./examples.md)에 있다.
> 규칙만으로 판단이 서지 않을 때 해당 섹션을 Read로 읽는다.

---

## 최우선 원칙: 한 .tsx 파일 = 한 컴포넌트 (단일 책임)

> **이 문서에서 가장 중요한 규칙이다. 아래 패턴들을 적용하기 전에 항상 이 원칙을 먼저 지킨다.**

객체지향에서 **하나의 class를 하나의 파일**로 다루듯, React에서도 **하나의 `.tsx`
파일은 정확히 하나의 컴포넌트 function만 소유**한다. 파일은 곧 컴포넌트의 단위이며,
단일 책임 원칙(SRP)을 파일 경계로 강제한다.

### 규칙

1. **하나의 `.tsx` 파일 = export 되는 컴포넌트 function 하나.** 한 파일에 두 개 이상의
   컴포넌트 function을 정의하지 않는다.
2. **그 컴포넌트 안에서 쓰이는 하위(sub) 컴포넌트는 각각 별도의 `.tsx` 파일로 분리**하고,
   해당 컴포넌트의 **하위 폴더** 안에 둔다.
3. 파일명 = 컴포넌트 성격을 드러내는 이름(kebab-case), 그 안의 function은 PascalCase.
4. 컴포넌트가 아닌 것(타입, 훅, 유틸, 상수)은 컴포넌트 function과 같은 파일에 뒤섞지
   말고 목적에 맞는 파일로 분리한다 (`*.types.ts`, `use-*.ts`, `*.utils.ts`).

### 폴더 구조 (부모 컴포넌트가 sub 컴포넌트를 가질 때)

```
user-card/
├── user-card.tsx            # 부모 — 컴포넌트 function 하나만 소유
├── user-card.types.ts       # 이 컴포넌트 관련 타입
├── index.ts                 # Public API (배럴): export { UserCard } from './user-card';
└── components/              # 이 컴포넌트 전용 하위 컴포넌트들
    ├── user-card-avatar/
    │   ├── user-card-avatar.tsx   # sub 컴포넌트 하나 = 파일 하나
    │   └── index.ts
    └── user-card-actions/
        ├── user-card-actions.tsx
        └── index.ts
```

- 부모는 하위 컴포넌트를 `import { UserCardAvatar } from './components/user-card-avatar'`
  처럼 폴더의 Public API를 경유해 조합한다.
- 하위 컴포넌트가 **오직 그 부모에서만** 쓰이면 부모의 `components/` 아래에 둔다(코로케이션).
  여러 곳에서 재사용되면 상위 공용 위치(FSD라면 `shared`/`entities` 등)로 승격한다.

> 코드 예시(❌한 파일 다중 컴포넌트 → ✅파일별 분리): [`examples.md`](./examples.md) §"한 .tsx = 한 컴포넌트 (SRP)"

### 판별 규칙 (리뷰·리팩터링 시)

- 한 `.tsx` 안에서 `function`/화살표 컴포넌트가 **2개 이상 정의**되면 위반 → sub 컴포넌트를
  하위 폴더의 별도 `.tsx`로 분리한다.
- JSX가 길어져 한 return 안에서 논리적 구획(헤더/본문/액션 등)이 보이면, 그 구획을
  이름 있는 sub 컴포넌트 파일로 떼어낸다.
- 단, **재사용도 없고 그 자체로 의미 단위도 아닌 5줄짜리 마크업**을 억지로 파일로 쪼개
  파일 수만 늘리지 않는다. "하나의 책임/의미 단위"가 분리 기준이다.

---

## 공통 원칙: 로직과 표현을 분리한다

두 패턴 모두 "**렌더링(what it looks like)**"과 "**동작(how it works)**"을 다른
곳에 두려는 시도다. 컴포넌트를 만들기 전에 이 질문을 먼저 던진다.

1. 이 컴포넌트는 **데이터를 가져오거나(서버/스토어) 상태를 관리하는가**? → 로직
2. 이 컴포넌트는 **props를 받아 화면만 그리는가**? → 표현
3. 이 로직/UI를 **다른 곳에서도 쓸 가능성이 있는가**? → 있으면 분리, 없으면 미루기 (YAGNI)

과하게 쪼개는 것도 안티패턴이다. **재사용·테스트·복잡도** 중 실제 필요가 생겼을 때
분리하고, 한 번만 쓰는 단순 컴포넌트를 미리 여러 겹으로 나누지 않는다.

---

## 핵심 원칙: 데이터 패칭은 컴포넌트와 함께 둔다

> **이 프로젝트에서 데이터 패칭 컴포넌트의 기본 규칙이다. 아래 규칙이 Container/
> Presentational의 "패칭을 컨테이너로 분리"보다 우선한다.**

`useQuery`/`useMutation` 같은 **패칭 로직은 그 데이터를 표출하는 컴포넌트와 같은
파일**에 둔다. 데이터를 별도 container 파일로 떼어내 순수 view에 props로만 내려주는
강제 분리를 하지 않는다. 즉, **한 파일 안에서 패칭 + 컴포넌트 return**이 함께 일어난다.

### 규칙

1. **패칭 + 렌더링 = 한 파일.** 데이터를 표출하는 컴포넌트가 자기 데이터를 직접 패칭한다.
2. **일반 컴포넌트는 `useQuery`** 를 쓰고 **`isPending`·`isError` 분기를 컴포넌트 내부에서
   개별 구현**한다 (자체 로딩/에러 UI 책임).
3. **`pages`에서 직접 쓰는 "한 장 페이지의 기초"가 되는 컴포넌트** — 특정 도메인의
   **목록 조회 데이터 표출**이나 **대시보드** — 는 **`useSuspenseQuery`** 를 써서
   분기 없는 간결하고 구조적인 컴포넌트로 만든다. 로딩/에러는 상위 `Suspense` +
   `ErrorBoundary` 경계(페이지)에 위임한다.
4. `useMutation`도 그 액션을 실행하는 컴포넌트와 같은 파일에 둔다.

### 선택 기준

| 상황 | 훅 | 로딩/에러 처리 |
|------|-----|---------------|
| 일반 데이터 표출 컴포넌트 (페이지 일부, 위젯 내부 등) | `useQuery` | 컴포넌트 내부에서 `isPending`/`isError` 개별 분기 |
| `pages` 직속 "한 장 페이지의 기초" — 도메인 목록 조회, 대시보드 | `useSuspenseQuery` | 페이지의 `Suspense` + `ErrorBoundary` 경계에 위임 |

> 코드 예시(useQuery 자체 분기 / useSuspenseQuery + 페이지 경계 / mutation): [`examples.md`](./examples.md) §"데이터 패칭 콜로케이션"

### 안티패턴
- 패칭을 별도 container 파일로 떼어내 순수 view에 props로만 내려주려는 **강제 분리**
  (이 프로젝트의 기본은 콜로케이션이다).
- `useSuspenseQuery`를 상위 `Suspense`/`ErrorBoundary` 경계 없이 사용 → 폴백이 없어 깨진다.
- 페이지 기초가 아닌 일반 리스트·폼 컴포넌트에 `useSuspenseQuery`를 남용 → 페이지 전체가
  한꺼번에 대기하게 되어 부분 로딩 UX를 잃는다. 이럴 땐 `useQuery` + 자체 분기.
- 재사용 로직(캐시 키, 파라미터 조립 등)은 여전히 `entities`의 `queries`/`mutations`로
  분리하고, 컴포넌트는 그 인스턴스를 호출만 한다 (패칭 "정의"와 "사용"은 다른 층).

---

## 1. Container / Presentational

### 설계 의도

컴포넌트를 두 종류로 나눈다.

- **Presentational (표현)**: props만 받아 화면을 그린다. 서버 호출·스토어 접근·라우팅
  없음. 부수효과가 없어 테스트·Storybook·재사용이 쉽다.
- **Container (컨테이너)**: 데이터 로딩·상태·이벤트 핸들러를 준비해 Presentational에
  props로 내려준다. 화면 마크업은 최소화한다.

### 적용 기준

- 같은 UI를 다른 데이터 소스로 재사용해야 할 때
- Presentational을 Storybook/스냅샷으로 단독 테스트하고 싶을 때
- 한 컴포넌트 안에 `useQuery` + 복잡한 JSX가 섞여 읽기 어려워질 때

> 코드 예시(view/container 분리): [`examples.md`](./examples.md) §"Container / Presentational"

### 안티패턴 (하지 말 것)

- Presentational 안에서 `useQuery`/`fetch`/`useStore` 호출 → 표현 컴포넌트가 오염됨.
- Container가 거대한 JSX를 직접 렌더링 → 분리 의미가 사라짐. 마크업은 View로.
- props가 20개 넘게 폭발 → 관련 props를 객체로 묶거나, 애초에 분리가 과한지 재검토.

> **참고**: Hooks 등장 이후 이 패턴의 상당 부분은 **Custom Hook + 한 컴포넌트**로
> 대체 가능하다(아래 2번). "별도 파일 두 개"가 목적이 아니라 "표현과 로직의 경계"가
> 목적임을 기억한다.
>
> ⚠️ **패칭에는 이 분리를 적용하지 않는다.** 위 "핵심 원칙: 데이터 패칭은 컴포넌트와
> 함께 둔다"가 우선한다. `useQuery`/`useSuspenseQuery`를 container로 떼어 순수 view에
> props로 내리지 말고, 데이터를 표출하는 컴포넌트가 직접 패칭한다. Presentational
> 분리는 **패칭이 없는 순수 UI**가 실제로 여러 곳에서 재사용되거나 단독 테스트가
> 필요할 때만 쓴다.

---

## 2. Custom Hooks 로직 분리

### 설계 의도

상태·부수효과·계산 로직을 `useXxx` 훅으로 빼내, UI 컴포넌트는 "훅을 호출해 값과
핸들러를 받아 그리기"만 하게 한다. Container/Presentational의 "로직" 부분을
파일 분리 대신 **훅으로** 캡슐화하는, 현대 React의 기본 분리 수단이다.

### 적용 기준

- 둘 이상의 컴포넌트가 같은 상태·부수효과 로직을 중복할 때
- 컴포넌트 본문에 `useEffect`/`useState`가 얽혀 렌더링 JSX가 안 보일 때
- 로직만 단위 테스트하고 싶을 때 (`renderHook`)

### 규칙

- 훅 이름은 **`use`** 로 시작한다 (React 규칙 — 조건부·반복문 안에서 호출 금지).
- 훅은 **값과 동작(핸들러)** 을 반환한다. JSX를 반환하지 않는다 (JSX가 필요하면
  그건 훅이 아니라 컴포넌트다).
- 반환은 **객체**로 한다(이름으로 구조분해 → 선택적 사용·확장 용이). 순서가 본질인
  경우(예: `useToggle`)에만 튜플.

> 코드 예시(로직 훅 + 렌더링 컴포넌트): [`examples.md`](./examples.md) §"Custom Hooks 로직 분리"

### 안티패턴

- 한 번만 쓰는 로직을 훅으로 빼서 파일만 늘리기 (재사용·테스트 필요가 없으면 그대로 둔다).
- 훅이 JSX를 반환 → 그건 컴포넌트다. 훅은 데이터·함수만.
- 한 훅이 서버 호출 + 폼 상태 + 라우팅 + 애니메이션까지 다 함 → 책임별로 쪼갠다
  (`useUserQuery`, `useUserForm` …).
- 훅을 조건문/반복문/이벤트 핸들러 안에서 호출 → Rules of Hooks 위반.

---

## 패턴 선택 가이드

```
로직/UI를 나눠야 하나?
├─ 로직만 재사용·테스트하고 싶다 ............... Custom Hook (2)
├─ 같은 UI를 여러 데이터로 재사용, UI 단독 테스트 ... Container/Presentational (1)
└─ 한 번만 쓰는 단순 컴포넌트 .................. 나누지 않는다 (YAGNI)
```

기본 조합: **Custom Hook(로직) + 단순 컴포넌트(표현)**. 재사용 요구가 커지면
표현을 Presentational로 뗀다.

---

## 리뷰 체크리스트

- [ ] **한 `.tsx` 파일이 컴포넌트 function을 하나만 소유하는가** (최우선)
- [ ] sub 컴포넌트가 하위 폴더의 별도 `.tsx` 파일로 분리되고 Public API로 조합되는가
- [ ] 타입·훅·유틸이 컴포넌트 파일에 뒤섞이지 않고 목적별 파일로 분리됐는가
- [ ] 데이터 패칭(useQuery/useMutation)이 표출 컴포넌트와 같은 파일에 있는가 (강제 container 분리 아님)
- [ ] 일반 컴포넌트는 useQuery + isPending/isError 자체 분기를 갖는가
- [ ] pages 직속 목록·대시보드 기초 컴포넌트는 useSuspenseQuery + 상위 Suspense/ErrorBoundary 경계를 쓰는가
- [ ] Presentational 컴포넌트(패칭 없는 순수 UI)에 서버 호출·스토어·라우팅이 섞이지 않았는가
- [ ] 로직 분리가 "실제 재사용·테스트·복잡도" 때문인가, 습관적 과분리는 아닌가
- [ ] Custom Hook이 JSX가 아니라 값·핸들러를 반환하는가
- [ ] Hook이 `use`로 시작하고 최상위에서만 호출되는가 (Rules of Hooks)
- [ ] props가 과도하게 많지 않은가 (3개 이상 관련 값은 객체로 묶기)
