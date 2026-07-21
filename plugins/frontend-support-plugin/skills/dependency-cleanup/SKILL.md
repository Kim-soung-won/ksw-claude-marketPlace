---
name: dependency-cleanup
description: >-
  package.json에서 미사용 라이브러리·의존성을 안전하게 찾아 제거하는 절차.
  "미사용 패키지 정리", "안 쓰는 라이브러리 제거", "package.json 정리",
  "의존성 정리", "depcheck 돌려줘", "dependencies 슬림화", "번들에서 안 쓰는 거 빼줘"
  같은 요청·문구에 트리거한다. 핵심은 depcheck 같은 자동 도구의 결과를 그대로
  믿지 않고 소스·설정·전이 의존까지 grep으로 교차 검증한 뒤, 후보를 위험도
  4버킷으로 분류해 사용자 승인 아래 안전한 것부터 제거하고 build·lint·tsc로
  검증하는 것이다. Module Federation 전이 의존, ESLint 플러그인, @types,
  동적 import, declare module 스텁 등 정적 분석이 놓치는 오탐 함정을 다룬다.
---

# 미사용 의존성 정리 (package.json)

`package.json`의 미사용 라이브러리를 **안전하게** 제거하기 위한 작업 절차다.

> **핵심 원칙: 자동 도구를 그대로 믿지 않는다.** `depcheck`는 정적 분석만
> 하므로 오탐이 많다. 번들러 플러그인·ESLint 설정·전이 의존·동적 import는
> 놓친다. 모든 후보를 소스와 설정에서 grep으로 교차 검증한 뒤에만 제거한다.
> 제거는 되돌리기 쉽게 **버킷 단위로 승인받아** 진행한다.

> 📎 실제 적용 사례(rsbuild + Module Federation 프로젝트에서 62종 제거,
> MF 전이 의존·ESLint `compat.extends` 오탐·`lint --fix` 부작용)는 같은
> 폴더의 [`examples.md`](./examples.md)에 있다. 판단이 애매할 때 읽는다.

---

## 워크플로 체크리스트

응답에 이 체크리스트를 복사해 진행 상황을 추적한다.

```
의존성 정리 진행:
- [ ] 1. 후보 수집 (depcheck 또는 수동 grep)
- [ ] 2. 후보별 소스 + 설정 파일 교차 검증
- [ ] 3. 오탐 함정 점검
- [ ] 4. 4버킷 분류표 작성 → 사용자에게 제시하고 승인
- [ ] 5. 승인된 안전 버킷부터 제거 (+ dead code 동반 삭제)
- [ ] 6. 검증: install → build → lint → tsc
- [ ] 7. lint --fix 부작용 되돌리기
- [ ] 8. 버킷별 커밋
```

---

## 1. 후보 수집

`npx depcheck`를 실행해 unused/missing 목록을 얻는다. 미설치면
`npm i -D depcheck` 후 실행한다.

네트워크가 막힌 환경이면 depcheck를 건너뛰고, `package.json`의 각 의존성
이름을 소스와 설정 파일에서 직접 grep하는 **수동 방식**으로 대체한다.

---

## 2. 후보별 교차 검증

각 후보를 소스 전체 **그리고** 설정 파일에서 실제 import/require 여부로
확인한다. 설정 파일은 depcheck가 자주 놓치므로 반드시 직접 연다.

- 번들러 config: `rsbuild.config.*` / `vite.config.*` / `webpack.config.*`
- `eslint.config.*` (flat config 포함)
- `tailwind.config.*` / `postcss.config.*`
- `index.html`

**매칭된 라인 내용을 눈으로 확인한다.** 패키지명이 SVG 글리프명·주석 등에
우연히 포함돼 매칭되는 오탐이 있으므로, grep 히트 수가 아니라 실제 라인이
import/사용인지 본다.

---

## 3. 오탐 함정 점검

아래는 depcheck가 unused로 오탐하지만 실제로는 필요하거나, 반대로
살아있어 보이지만 죽은 코드인 대표 함정이다.

| 함정 | 확인 방법 | 판단 |
|------|-----------|------|
| **빌드/설정 전용 의존성** — 번들러 플러그인, `tailwindcss`, `sass`, `postcss`, `autoprefixer`, `@svgr/*` | 번들러·PostCSS·Tailwind config에서 사용 | 코드에 import 없어도 **유지** |
| **ESLint 플러그인** — flat config의 `compat.extends("plugin:react-hooks/recommended")` 등 문자열 로드 | `eslint.config.*`를 직접 열어 문자열 확인 | depcheck 오탐, **유지** |
| **Module Federation** — `@module-federation/enhanced`·`sdk`·`runtime` | 직접 import는 보통 번들러 MF 플러그인 하나뿐. 나머지는 그 플러그인의 전이 의존일 수 있음 → `node_modules/<플러그인>/package.json`의 deps 확인. 선언 버전과 플러그인 요구 버전 불일치(예: 0.8.11 vs 0.11.x)는 옛 설정 잔재 신호 | 전이 의존이면 직접 선언 제거 후보(🟡) |
| **`@types/*`** — 타입 전용이라 import grep에 안 잡힘 | 대응 본체 패키지의 사용 여부 확인 | 본체 쓰면 유지, 본체가 없거나 함께 제거되면 같이 제거 |
| **동적 import / 문자열 require / CSS 부수효과 import** (`import "x/dist/style.css"`) | 문자열 리터럴까지 grep | 사용이면 유지 |
| **`declare module "x"` 스텁** (`*.d.ts`) | 스텁 외에 실제 코드 import이 있는지 확인 | 스텁만 있고 코드 import 없으면 패키지·스텁 모두 죽음 |

---

## 4. 4버킷 분류 → 승인

후보를 위험도에 따라 4버킷으로 나눈다.

- 🟢 **안전 제거**: 소스·설정·전이 어디에도 참조 0으로 확인됨
- 🟡 **빌드 검증 후 제거**: MF·번들러 전이 의존 등 정적 분석이 못 보는 영역
  → `build`로 확인 필요
- 🟠 **린트/dev 검증 후 제거**: ESLint resolver·플러그인, HMR(`react-refresh`),
  `ajv` 등 간접 도구 → `lint` + `dev`로 확인
- 🔴 **반드시 유지**: 위 오탐 함정에 해당하는 depcheck 오탐

분류표를 **먼저 사용자에게 제시하고 승인을 받는다.** 승인 없이 제거하지
않는다. 안전 버킷(🟢)부터 시작하고, 위험 버킷은 각자의 검증을 통과한 뒤에만
제거한다.

---

## 5. 제거 실행

승인된 버킷의 패키지를 `package.json`의 `dependencies`/`devDependencies`에서
제거한다. 키가 많으면 node 스크립트로 처리하되 **존재 확인 후 삭제하고,
누락된 키는 리포트**한다(오타·이미 제거된 키를 조용히 넘기지 않기 위함).

제거 대상 패키지의 **유일한 소비처였던 dead code 모듈도 함께 삭제**한다.
예: 어떤 UI 모듈이 삭제 대상 라이브러리의 유일 소비처라면 그 모듈째 제거한다
— 이렇게 하면 그 모듈이 끌고 오던 `missing` 의존까지 한 번에 해소된다.

---

## 6. 검증 — validate-fix-repeat

다음 순서로 검증한다. 실패하면 해당 후보를 되돌리고(유지로 재분류) 다시
검증한다. 통과할 때까지 반복한다.

1. `npm install` — 제거 반영 및 lockfile 갱신
2. `npm run build` — **빌드 통과 = 실사용 없음의 최종 증명.** 🟡 버킷(MF·번들러
   전이 의존)은 여기서 확정된다
3. `npm run lint` — 🟠 버킷(ESLint 플러그인·resolver) 확인
4. `tsc --noEmit` — 타입 참조(`@types` 등) 확인

---

## 7. lint --fix 부작용 되돌리기 (중요 함정)

> 프로젝트의 lint 스크립트에 `--fix`가 걸려 있으면 `npm run lint` 실행만으로
> **이번 작업과 무관한 파일들이 자동 포맷 수정**된다. 이 변경은 작업 범위
> 밖이므로 커밋 전에 `git restore`로 되돌려 커밋을 깨끗이 유지한다.

또한 lint에 **남은 error가 이번에 건드린 파일 것인지, 원래부터 있던 것인지
반드시 구분**한다. 기존 error를 이번 작업에서 고치려 들어 범위를 넓히지
않는다.

---

## 8. 버킷별 커밋

검증을 통과한 버킷만 **버킷 단위로 나눠 커밋**한다. 위험 버킷(🟡/🟠)은 각자의
검증을 통과한 뒤 별도 커밋으로 분리해, 문제가 생겨도 버킷 단위로 되돌릴 수
있게 한다.

---

## 진행 톤

- 검증 없는 일괄 삭제를 하지 않는다. 항상 **4버킷 분류표 → 승인 → 안전 버킷
  우선 제거**의 대화형 흐름으로 진행한다.
- 되돌리기 쉽도록 버킷별 커밋을 유지한다.
- depcheck 결과를 근거로 인용하되, 최종 판단은 grep 교차 검증과 build 통과에
  둔다.
</content>
