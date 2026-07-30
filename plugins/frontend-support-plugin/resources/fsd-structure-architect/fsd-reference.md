# FSD (Feature-Sliced Design) 참조 — 우리 팀 하우스 스타일

정통 FSD(https://feature-sliced.design)를 기반으로 하되, **이 문서는 우리 팀의 실제 관례를
표준으로 삼는다.** 정통 FSD와 어긋나는 지점(세그먼트 폴더 대신 파일 접미사, shared/api 가
데이터 계약 계층, 메뉴그룹 중첩)이 있으며, 그럴 때는 **이 문서(하우스 스타일)를 따른다.**

이 문서는 `fsd-structure-architect` 에이전트가 구조를 **생성**하거나 **검토**할 때
기준으로 삼는 규칙 원본이다. 추측하지 말고 항상 이 규칙에 근거해 판단한다. 실행형 목록
도메인 생성은 `list-domain-scaffolder` 에이전트가 이 규칙을 코드 골격으로 구현한다.

---

## 1. 계층 구조: Layers → (그룹) → Slices → 파일

우리 하우스 스타일은 **4계층**(`shared/api → entities → features → pages`)을 쓰고,
정통 FSD 의 `app`·`widgets`·`processes` 는 쓰지 않는다. 슬라이스 내부는 **세그먼트 폴더
(`ui/`·`model/`·`api/`)로 나누지 않고, 평면 폴더에 점(.) 접미사 파일**로 목적을 표시한다.

```
src/
├── shared/api/<group>/<domain>/   # 데이터 계약 계층 (DTO 스키마·service). 도메인별로 둔다.
│   ├── <domain>-dto.contracts.ts  #   zod 스키마 (서버 응답 snake_case)
│   ├── <domain>-dto.types.ts      #   z.infer 타입 namespace
│   ├── <domain>.service.ts        #   BaseService 확장 요청 함수
│   └── index.ts                   #   Public API 배럴
├── entities/<group>/<domain>/     # 도메인 모델·데이터 접근
│   ├── <domain>-entity.contracts.ts / -entity.types.ts   # DTO→Entity(camel) 스키마·타입
│   ├── <domain>.libs.ts           #   DTO→Entity 변환·라벨 매핑
│   ├── <domain>.filter.ts         #   목록 필터 store
│   ├── <domain>.queries.ts        #   react-query queryOptions
│   ├── <domain>.mutations.ts      #   (CUD 있을 때)
│   └── index.ts
├── features/<group>/<domain>/     # 재사용 가능한 use case UI
│   ├── <domain>-list.ui.tsx  또는  table-<domain>/ · detail-<domain>/  (기능 조각별 폴더)
│   └── index.ts
└── pages/<group>/<domain>/        # 라우트 단위
    ├── <domain>-page.ui.tsx / -page-list.ui.tsx
    ├── <domain>-page.model.ts     #   PageLoader + filterStore 싱글턴
    ├── <domain>-page.route.tsx    #   lazy + withSuspense + loader
    └── index.ts                   # (+ pages/<group>/index.ts 그룹 배럴)
```

- **Layer(계층)**: 최상위. 우리는 `shared/api`(데이터 계약)·`entities`·`features`·`pages` 4개.
- **그룹(group)**: 사이드바 **메뉴 그룹 = 폴더**. 네 계층 모두 동일한 `<group>/<domain>/` 경로로
  중첩한다(한 계층만 평면으로 두지 않는다). 그룹이 없는 단순 도메인은 `<domain>/` 직속.
- **Slice(슬라이스)**: `<group>/<domain>` 단위. 이름은 `menu-items.ts`·`path-keys.ts` 컨벤션에 맞춘다.
- **세그먼트는 폴더가 아니라 파일 접미사로 표현한다**(§3). `ui/`·`model/`·`api/` 하위폴더를 만들지 않는다.

---

## 2. Layers (위 → 아래, 우리 하우스 스타일 4계층)

| 순서 | Layer | 책임 | 그룹/도메인 중첩 |
|------|-------|------|-----------|
| 1 | `pages` | 라우트에 대응하는 페이지. `-page.ui`·`-page.model`·`-page.route` | `<group>/<domain>/` |
| 2 | `features` | 재사용 가능한 use case UI (목록 테이블·상세 다이얼로그 등) | `<group>/<domain>/` |
| 3 | `entities` | 도메인 모델·데이터 접근 (entity 스키마·queries·filter·libs) | `<group>/<domain>/` |
| 4 | `shared/api` | **데이터 계약 계층** — 도메인별 DTO 스키마·service. + `shared/ui`·`shared/lib`(도메인 무관 공용) | `api/<group>/<domain>/` |

- **의존 방향**: `pages → features → entities → shared`. 역방향·같은 계층 슬라이스 교차 금지(§4).
- **`shared/api` 가 데이터 계약을 담는다**(정통 FSD 와 다른 지점). 서버 응답 DTO 스키마와 `BaseService`
  확장 service 를 `shared/api/<group>/<domain>/` 에 도메인별로 둔다. `shared/api/base/*`(BaseService·
  BaseResponse 등)·`shared/ui/*` 는 **공용 인프라라 수정하지 않는다**(도메인 아님).
- **정통 FSD 의 `app`·`widgets`·`processes` 는 쓰지 않는다.** 진입점(App.tsx·main.tsx·라우팅)은
  `src/` 직속 또는 `app/`(있으면)에 두되 슬라이스로 만들지 않는다.
- 데이터 흐름: `shared/api`(DTO snake) → `entities`(Entity camel 변환·queries) → `features`(테이블 UI)
  → `pages`(라우트 조립). 각 계층은 아래 계층의 `index.ts` 배럴만 경유해 참조한다.

---

## 3. 슬라이스 내부 = 파일 접미사 규약 (세그먼트 폴더 아님)

**우리는 슬라이스 안을 `ui/`·`model/`·`api/` 세그먼트 폴더로 나누지 않는다.** 대신 평면 폴더에
아래 **점(.) 접미사 파일**로 목적을 표시한다. 정통 FSD 의 세그먼트 개념을 파일명으로 흡수한 것이다.

| 계층 | 표준 파일 | 목적 |
|------|-----------|------|
| `shared/api/<g>/<d>/` | `<d>-dto.contracts.ts` | 서버 응답 zod 스키마(snake_case) |
| | `<d>-dto.types.ts` | `z.infer` 타입 namespace (`export type {}` 로 배럴 — §5 함정) |
| | `<d>.service.ts` | `BaseService` 확장 요청 함수 |
| `entities/<g>/<d>/` | `<d>-entity.contracts.ts` / `-entity.types.ts` | Entity(camelCase) 스키마·타입 |
| | `<d>.libs.ts` | DTO→Entity 변환·코드 라벨 매핑 |
| | `<d>.filter.ts` | 목록 필터 store (base.filter 확장) |
| | `<d>.queries.ts` / `<d>.mutations.ts` | react-query queryOptions / CUD |
| `features/<g>/<d>/` | `<d>-list.ui.tsx` 또는 `table-<d>/`·`detail-<d>/` | 목록 테이블·상세 등 기능 UI |
| `pages/<g>/<d>/` | `<d>-page.ui.tsx` / `-page-list.ui.tsx` | 페이지 조립 |
| | `<d>-page.model.ts` | PageLoader(prefetch) + filterStore 싱글턴 |
| | `<d>-page.route.tsx` | lazy + withSuspense + loader + pathKeys |

- **UI 컴포넌트 파일 안에 컴포넌트 function 하나**(§6). sub 컴포넌트는 그 컴포넌트 폴더 밑
  `components/` 코로케이션(§6 — 이 `components/` 는 세그먼트가 아니라 컴포넌트 종속 폴더라 허용).
- **금지: 타입 기반 분류.** 슬라이스 바로 아래에 `components/`·`hooks/`·`types/` 폴더를 만들지 않는다
  ("무엇으로 만들었나"가 아니라 "무엇을 위한 것인가"로 파일 접미사가 표현). 또한 `ui/`·`model/`·
  `api/` **세그먼트 폴더도 만들지 않는다** — 우리 관례는 평면 + 접미사다.
- `shared/ui`·`shared/lib` 는 도메인 무관 공용이라 위 접미사 규약 대상이 아니다(컴포넌트/유틸 직접 배치).

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

- 각 슬라이스(`<group>/<domain>/`)는 `index.ts`로 공개 API를 노출한다. `pages/<group>/` 그룹에는
  그룹 배럴 `pages/<group>/index.ts`도 두어 route를 re-export한다.
- 외부에서는 반드시 슬라이스의 `index.ts`를 경유해 import 한다. 내부 파일 직접 참조 금지.
  - ✅ `import { CodeManagementList } from '@/features/security/code-management'`
  - ❌ `import { CodeManagementList } from '@/features/security/code-management/table-code-management/...'`
- **함정 — namespace 이중 래핑**: `shared/api` 배럴에서 DTO 타입 namespace는 `export type { <d>DtoTypes }`
  로 내보낸다. `export * as <d>DtoTypes` 로 감싸면 소비 시 `DtoTypes.DtoTypes.X` 이중 래핑돼
  `has no exported member` 에러. const 스키마 객체는 `export { <d>DtoSchemas }`.
- **함정 — 응답 top-level strip**: 공용 `BaseResponseDtoSchema` 는 top-level 에 `message/data/result/code`
  만 둔다 → 그 외 top-level 키(예: `totalCount`)는 zod 가 strip 한다. 페이징 total 등은 반드시
  `data` 스키마 **안에** 정의한다.

---

## 6. 슬라이스 내부 컴포넌트 파일 구성 (SRP)

FSD 의 계층/슬라이스 규칙과 **함께 적용**하는, 컴포넌트 파일 단위 규칙이다. 슬라이스
(주로 `features`·`pages` 의 UI) 안에서 컴포넌트를 어떻게 파일로 쪼갤지 정한다.

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

### 슬라이스 내부 예시 (`features/security/code-management`)

세그먼트 폴더(`ui/`) 없이, 기능 조각별 폴더 + 접미사 파일. sub 컴포넌트만 `components/` 코로케이션.

```
features/security/code-management/
├── table-code-management/
│   ├── table-code-management.tsx     # 컴포넌트 function 하나만
│   ├── table-code-management.types.ts
│   ├── index.ts                      # export { TableCodeManagement }
│   └── components/                   # 이 컴포넌트 전용 sub 컴포넌트(코로케이션)
│       └── code-status-cell/
│           ├── code-status-cell.tsx
│           └── index.ts
├── detail-code/
│   ├── detail-code.ui.tsx
│   └── dialog/
│       └── detail-code-dialog.ui.tsx
└── index.ts                          # 슬라이스 Public API
```

> 데이터·필터·쿼리는 세그먼트 폴더가 아니라 `entities/<group>/<domain>/` 의 접미사 파일
> (`*.queries.ts`·`*.filter.ts`·`*-entity.types.ts`)에 있다(§3). feature 는 그 entity 배럴을 소비한다.

---

## 7. 검토 시 위반 등급 기준

| 등급 | 아이콘 | 기준 |
|------|--------|------|
| CRITICAL | 🔴 | 의존성 역방향 import, 같은 계층 슬라이스 간 교차 import, 표준 외 계층 이름, 데이터 계약을 `shared/api` 밖에 둠, 공용 인프라(`shared/api/base/*`·`shared/ui/*`) 수정 |
| WARNING | 🟡 | Public API(index.ts) 미비로 내부 파일 직접 import, **`ui/`·`model/`·`api/` 세그먼트 폴더 사용**(우리는 접미사 파일), 타입 기반 폴더(components/hooks/types 슬라이스 직속), namespace 이중 래핑 배럴(§5), **한 `.tsx`에 컴포넌트 function 2개 이상(SRP 위반)** |
| INFO | 🟢 | 파일 접미사 비표준(§3), 그룹 배럴 누락, 빈 슬라이스, **sub 컴포넌트가 하위 폴더로 분리되지 않음**, 개선 권장 사항 |

> ⚠️ 주의: §3에서 금지하는 슬라이스 직속 `components/`(기술 분류 폴더)와, §6에서 **컴포넌트
> 내부에 두는 sub 컴포넌트 폴더** `components/`는 다른 것이다. 후자는 특정 컴포넌트 폴더 안에
> 종속된 코로케이션이라 위반이 아니다.
