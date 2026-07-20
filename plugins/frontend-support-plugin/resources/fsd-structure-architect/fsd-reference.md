# FSD (Feature-Sliced Design) 참조

출처: https://feature-sliced.design/docs/get-started/overview

이 문서는 `fsd-structure-architect` 에이전트가 구조를 **생성**하거나 **검토**할 때
기준으로 삼는 규칙 원본이다. 추측하지 말고 항상 이 규칙에 근거해 판단한다.

---

## 1. 3단계 계층 구조: Layers → Slices → Segments

```
src/
├── app/          # Layer
├── pages/        # Layer
│   └── home/     #   └ Slice
│       ├── ui/   #       └ Segment
│       ├── model/
│       └── index.ts   # Public API (배럴)
└── shared/
    ├── ui/       # (shared/app 계층은 Slice 없이 Segment 직속)
    └── lib/
```

- **Layer(계층)**: 최상위 디렉토리. 이름·개수가 표준으로 고정됨.
- **Slice(슬라이스)**: 계층 내부를 비즈니스 도메인 단위로 분할 (`user`, `product`, `home`...). 이름은 프로젝트가 자유롭게 정함.
- **Segment(세그먼트)**: 슬라이스 내부를 기술적 목적 단위로 분할 (`ui`, `api`, `model`, `lib`, `config`).

---

## 2. Layers (위 → 아래, 총 7개 / 실사용 6개)

| 순서 | Layer | 책임 | Slice 有無 |
|------|-------|------|-----------|
| 1 | `app` | 앱을 구동시키는 모든 것 — 라우팅, 진입점, 전역 스타일, Provider, 전역 설정 | Slice 없음 (Segment 직속) |
| 2 | `processes` | **(deprecated)** 여러 페이지에 걸친 복잡한 시나리오. 신규 프로젝트에서는 사용하지 않음 | Slice 有 |
| 3 | `pages` | 라우트에 대응하는 전체 페이지 또는 중첩 라우팅의 큰 조각 | Slice 有 |
| 4 | `widgets` | 독립적으로 완결된 큰 기능·UI 블록 (하나의 use case 전체를 전달) | Slice 有 |
| 5 | `features` | 비즈니스 가치를 전달하는, 재사용 가능한 제품 기능 구현 | Slice 有 |
| 6 | `entities` | 프로젝트가 다루는 비즈니스 엔티티 (`user`, `product` 등) | Slice 有 |
| 7 | `shared` | 프로젝트/비즈니스 특성과 무관하게 재사용되는 기능 (UI 키트, 유틸, API 클라이언트) | Slice 없음 (Segment 직속) |

- **표준 이름 고정**: 위 7개 이외의 계층 이름은 FSD 위반이다.
- **`app`·`shared`는 슬라이스가 없다** — 세그먼트가 계층 바로 아래에 온다.
- **`processes`는 deprecated** — 신규 구조 생성 시 만들지 않는다. 기존 코드에 있으면 INFO로 안내한다.
- 모든 계층을 다 만들 필요는 없다. 프로젝트 규모에 맞게 필요한 계층만 둔다 (단, `shared`와 `app`은 거의 항상 존재).

---

## 3. Segments (슬라이스 내부 기술 분할)

| Segment | 책임 |
|---------|------|
| `ui` | UI 컴포넌트, 스타일, 포매터 등 화면 표현 |
| `api` | 백엔드 통신, 요청 함수, 데이터 타입 |
| `model` | 데이터 스키마, 상태(store), 비즈니스 로직 |
| `lib` | 해당 슬라이스 내부에서 재사용되는 보조 코드 |
| `config` | 설정 값, 피처 플래그 |

- 세그먼트 이름은 위 표준이 권장되나, `shared`에서는 목적에 맞게 추가 세그먼트를 둘 수 있다.
- 세그먼트는 "무엇으로 만들었나(타입)"가 아니라 "무엇을 위한 것인가(목적)"로 나눈다. `components/`, `hooks/`, `types/` 같은 타입 기반 세그먼트는 FSD 안티패턴.

---

## 4. 핵심 의존성 규칙 (가장 중요)

> **한 계층의 모듈은 자기보다 "엄격히 아래" 계층의 모듈만 import 할 수 있다.**

- 위 계층 번호 기준: 작은 번호(위)가 큰 번호(아래)를 import 가능. 역방향 금지.
  - 예: `pages`(3) → `features`(5) ✅ / `entities`(6) → `features`(5) ❌
- **같은 계층의 다른 슬라이스끼리 서로 import 금지** (slice는 서로 독립).
  - 예: `features/auth` → `features/cart` ❌
- 예외: `app`과 `shared`는 슬라이스가 없으므로 이 "같은 계층 슬라이스 격리" 규칙의 대상이 아니다.

---

## 5. Public API (index.ts 배럴)

- 각 슬라이스(및 shared의 각 세그먼트)는 `index.ts`로 공개 API를 노출한다.
- 외부에서는 반드시 슬라이스의 `index.ts`를 경유해 import 한다. 내부 파일 직접 참조 금지.
  - ✅ `import { LoginForm } from '@/features/auth'`
  - ❌ `import { LoginForm } from '@/features/auth/ui/LoginForm'`

---

## 6. 세그먼트 내부 컴포넌트 파일 구성 (SRP)

FSD의 계층/슬라이스/세그먼트 규칙과 **함께 적용**하는, 이 프로젝트의 컴포넌트 파일
단위 규칙이다. 세그먼트(주로 `ui`) 안에서 컴포넌트를 어떻게 파일로 쪼갤지 정한다.

> 원본·상세 예시는 `component-design-patterns` 스킬에 있다:
> `${CLAUDE_PLUGIN_ROOT}/skills/component-design-patterns/SKILL.md`
> — 구조를 생성·검토하며 컴포넌트 파일을 다룰 때 이 스킬을 Read로 함께 읽는다.

### 규칙
1. **한 `.tsx` 파일 = 컴포넌트 function 하나** (객체지향의 "한 class = 한 파일"과 동일).
2. 그 컴포넌트에서만 쓰는 **sub 컴포넌트는 하위 `components/` 폴더의 별도 `.tsx`로 분리**하고
   각 폴더에 `index.ts`(Public API)를 둔다.
3. 타입·훅·유틸은 컴포넌트 파일에 섞지 않고 `*.types.ts` / `use-*.ts` / `*.utils.ts`로 분리.
4. sub 컴포넌트가 여러 슬라이스에서 재사용되면 하위 폴더에 두지 말고 아래 계층
   (`shared`/`entities` 등)으로 승격한다 (§4 의존성 규칙과 일관).
5. **데이터 패칭은 컴포넌트와 함께 둔다** (상세: 연계 스킬). `useQuery`/`useMutation`을
   별도 container로 떼지 않고 표출 컴포넌트가 직접 패칭한다. 일반 컴포넌트는 `useQuery` +
   `isPending`/`isError` 자체 분기, `pages` 직속 "한 장 페이지의 기초"(도메인 목록 조회·
   대시보드)는 `useSuspenseQuery` + 페이지의 `Suspense`/`ErrorBoundary` 경계를 쓴다.

### 세그먼트 내부 예시 (`entities/user/ui/user-card`)

```
entities/user/
├── ui/
│   └── user-card/
│       ├── user-card.tsx            # 컴포넌트 function 하나만
│       ├── user-card.types.ts
│       ├── index.ts                 # export { UserCard }
│       └── components/              # 이 컴포넌트 전용 sub 컴포넌트
│           ├── user-card-avatar/
│           │   ├── user-card-avatar.tsx
│           │   └── index.ts
│           └── user-card-actions/
│               ├── user-card-actions.tsx
│               └── index.ts
├── model/
├── api/
└── index.ts                         # 슬라이스 Public API
```

---

## 7. 검토 시 위반 등급 기준

| 등급 | 아이콘 | 기준 |
|------|--------|------|
| CRITICAL | 🔴 | 의존성 역방향 import, 같은 계층 슬라이스 간 교차 import, 표준 외 계층 이름 |
| WARNING | 🟡 | Public API(index.ts) 미비로 내부 파일 직접 import, 타입 기반 세그먼트(components/hooks/types), deprecated `processes` 신규 사용, **한 `.tsx`에 컴포넌트 function 2개 이상(SRP 위반)** |
| INFO | 🟢 | 세그먼트 네이밍 비표준, 빈 슬라이스, **sub 컴포넌트가 하위 폴더로 분리되지 않음**, 개선 권장 사항 |

> ⚠️ 주의: §5의 세그먼트 표준에서 금지하는 타입 기반 세그먼트 `components/`(슬라이스
> 바로 아래의 기술 분류용)와, §6에서 **컴포넌트 내부에 두는 sub 컴포넌트 폴더**
> `components/`는 다른 것이다. 후자는 특정 컴포넌트 폴더 안에 종속된 코로케이션이므로
> 세그먼트 위반이 아니다.
