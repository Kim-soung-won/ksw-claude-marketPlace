# 의존성 정리 — 실제 적용 사례

`SKILL.md`의 워크플로를 실제 프로젝트에 적용한 사례. 절차만으로 판단이 서지
않을 때(특히 Module Federation·ESLint 오탐·`lint --fix` 부작용) 읽는다.

## 대상 프로젝트

- Minton React 관리자 템플릿 기반, **rsbuild + Module Federation** 구성
- 오랜 기능 추가로 `package.json`에 미사용 후보가 다수 누적된 상태
- 결과: 검증을 거쳐 **미사용 62종** 제거

## 진행 요약

### 1~2. 후보 수집 + 교차 검증

`npx depcheck`로 unused/missing 목록을 뽑은 뒤, 각 후보를 소스 전체와
`rsbuild.config.ts` · `eslint.config.js` · `tailwind.config.js` ·
`postcss.config.js` · `index.html`에서 grep으로 재확인했다. depcheck가
"unused"로 보고했지만 실제로는 설정에서 쓰이는 항목이 상당수였다.

### 3. 오탐 함정별 실제 사례

**Module Federation 전이 의존.**
`package.json`에는 `@module-federation/enhanced`·`sdk`·`runtime`이 직접
선언돼 있었지만, 코드가 직접 import하는 것은 rsbuild의 MF 플러그인 하나뿐이었다.
나머지는 그 플러그인의 전이 의존이었다. 게다가 **선언 버전(예: `0.8.11`)이
플러그인이 실제 요구하는 버전(`0.11.x`)과 어긋나** 옛 설정의 잔재임이
드러났다. → `node_modules/<MF 플러그인>/package.json`의 deps를 확인해
직접 선언을 제거하고 플러그인의 전이 의존에 위임(🟡 빌드 검증 후 제거).

**ESLint `compat.extends` 오탐.**
flat config에서 `compat.extends("plugin:react-hooks/recommended")`,
`"plugin:prettier/recommended")` 형태로 **문자열 로드**되는 플러그인들을
depcheck가 unused로 오탐했다. eslint config를 직접 열어 문자열에 패키지명이
있음을 확인하고 유지했다(🔴 반드시 유지 / 실사용은 🟠 lint로 재확인).

**`declare module` 스텁 vs 실제 import.**
어떤 패키지는 `*.d.ts`에 `declare module "x"` 스텁만 있고 코드에서의 import가
전혀 없었다. 스텁은 실제 사용이 아니므로 패키지와 스텁 파일을 함께 제거했다.

**dead code 모듈 동반 삭제.**
삭제 대상 라이브러리의 유일한 소비처였던 UI 모듈 하나를 모듈째 제거했다.
이 덕분에 그 모듈이 참조하던 `missing dependencies`까지 한 번에 해소됐다.

### 4. 버킷 분류 후 승인

62종을 🟢/🟡/🟠/🔴로 나눠 표로 제시하고 승인을 받은 뒤 🟢부터 제거했다.

### 6~7. 검증과 `lint --fix` 부작용

`npm install → npm run build → npm run lint → tsc --noEmit` 순으로 검증했다.
빌드가 통과하면서 🟡(MF 전이 의존) 후보들이 실사용 없음으로 최종 확인됐다.

문제는 lint였다. 이 프로젝트의 lint 스크립트에 `--fix`가 걸려 있어
`npm run lint` 실행만으로 **이번 작업과 무관한 파일 다수가 자동 포맷 수정**됐다.
이 변경은 작업 범위 밖이므로 커밋 전 `git restore`로 되돌려 커밋을 깨끗이
유지했다. 또한 lint에 남은 error가 이번에 건드린 파일 것이 아니라 기존부터
있던 것임을 구분해 범위를 넓히지 않았다.

### 8. 커밋

검증을 통과한 버킷만 버킷 단위로 커밋했다. 위험 버킷(MF 전이 의존)은 별도
빌드 검증 후 별도 커밋으로 분리해 되돌리기 쉽게 남겼다.

## 이 사례가 주는 교훈

- depcheck 단독 판단은 위험하다 — 62종 중 상당수가 오탐 함정에 걸렸다.
- Module Federation은 "직접 선언 ≠ 실사용"의 대표 사례다. 전이 의존과 버전
  불일치를 함께 본다.
- `lint --fix`는 정리 작업의 커밋을 오염시킨다. 검증에는 쓰되, 부작용은
  반드시 되돌린다.
</content>
</invoke>
