---
name: console-logging-policy
description: >-
  `console.error`·`console.warn`·`console.log`를 추가·수정하거나 `catch` 블록의
  로그 레벨을 정할 때 읽는다. 어느 메서드가 프로덕션 번들에 남는지, 에러 객체를
  어떻게 축약해야 인증 토큰·응답 본문이 새지 않는지, error/warn/log를 가르는
  판정 기준이 무엇인지 규정한다. `toLogSafe`·`logValidationFailure`를 쓰거나
  `rsbuild.config.ts`의 `performance.removeConsole`을 건드릴 때도 읽는다.
metadata:
  type: convention-skill
  confidence:
    inferred:
      - topic: "제거 설정의 minify 의존"
        note: "rsbuild의 removeConsole은 minify가 켜진 빌드에서만 동작한다. 현재 프로덕션 빌드는 minify가 켜져 있어 dist 번들에서 제거를 실제 확인했으나, minify를 끄는 빌드를 도입하면 규약 전체가 무효화된다."
      - topic: "다른 원격 모듈 적용 범위"
        note: "we-agent-module·we-model-module·we-mfe-documentai에만 적용. we-rag-module·we-workflow-module 등은 미적용 상태."
---

## 한 줄 정의

**로그 메서드 선택이 곧 프로덕션 노출 범위 선언이다.** 빌드가 `log`/`info`/`table`을
제거하고 `warn`/`error`를 남기므로, 메서드를 고르는 행위가 "이 로그를 프로덕션에
남길 것인가"를 결정한다.

> 규약의 단일 출처는 `rsbuild.config.ts`의 `performance` 주석이다. 제거 목록과
> 판정 기준이 물리적으로 붙어 있어야 한쪽만 바뀌는 드리프트를 막는다.
> 규약의 근거·사용자 스토리·테스트 판정은 원본 스펙
> `we-agent-module/docs/spec/console-logging-policy.md` 참고.

`console`을 전면 금지하지 않는다. 전면 금지는 진단 경로를 끊고, 운영 장애 문의가
들어와도 어느 API가 어떤 코드로 깨졌는지 알 방법이 없어진다.

---

## 판정표

| 메서드               | 프로덕션 | 쓰는 경우                                                      |
| -------------------- | -------- | -------------------------------------------------------------- |
| `error`              | 남는다   | 폴백으로 복구되지 않는 실패. 사용자에게 이미 노출된 실패.      |
| `warn`               | 남는다   | 폴백으로 부분 복구되는 실패. 일부 항목·이벤트가 드롭되는 경우. |
| `log`/`info`/`table` | 제거된다 | 기본값 폴백, 포맷 오류, 디버그, 값 덤프.                       |

## 판정 순서

`catch` 블록에서 메서드를 고를 때는 취향이 아니라 **관측 가능한 신호**로 판정한다.
위에서부터 순서대로 묻는다.

1. 대체값을 반환하거나 다른 경로로 재시도해 **완전히 복구**되는가 → `log`
2. 사용자의 잘못된 조작을 거부하는 **검증 로직**인가 → 실패가 아님 → `log`
3. 목록 중 일부만 실패하고 **나머지는 살아남는가** → `warn`
4. 상태가 빈 값으로 초기화되어 **화면이 비는가** → `error`
5. 사용자에게 **이미 토스트·에러 UI로 노출된** 실패인가 → `error`

## 에러를 실을 때는 반드시 `toLogSafe`

`error`/`warn`에 에러 객체를 그대로 넘기면 브라우저 콘솔에 **응답 본문 전체,
요청 헤더(Authorization 토큰), 요청 바디**가 찍힌다. 사용자 기기에서 열람
가능하고 콘솔 수집 확장이 붙어 있으면 외부로도 나간다.

```ts
import { toLogSafe } from "@/shared/lib/handle-error";

console.error("파일 업로드 중 오류:", toLogSafe(error));
```

`src/shared/lib/handle-error/to-log-safe.ts`. 입력은 `unknown`, 반환은 항상
`string`, 어떤 입력에도 던지지 않는다.

```
axios 에러  → "ERR_BAD_REQUEST 404 POST /v1/documents"   // code status method url
Error       → "TypeError: cannot read property 'x' of undefined"   // name: message
그 외       → String(error)
```

세 분기 모두 응답 본문·요청 헤더·요청 바디를 포함하지 않는다. axios 에러를 먼저
분기하는 이유는 이 코드베이스 에러 대부분이 axios 에러이고, 민감한 필드
(`response.data`, `config.headers`, `config.data`)를 들고 있는 것도 그것뿐이기
때문이다.

## 값이 필요하면 두 줄로 분리한다

프로덕션 신호와 디버그 값을 한 호출에 겸하지 않는다.

```ts
console.warn("[SSE Processor] Failed to parse metadata:", toLogSafe(error));
console.log("[SSE Processor] Original content:", content);
```

앞줄은 프로덕션에 남는 신호(값 없음), 뒷줄은 프로덕션에서 제거되는 값(디버그용).

## 응답 스키마 검증 실패

`logValidationFailure(endpoint, issues)` — `src/shared/lib/axios/`.
엔드포인트와 실패한 필드 경로만 `error`로 남긴다.

```
[API Validation Error] /files/42 — data.items.0.status, data.total
```

**환경 가드로 감싸지 않는다.** 계약 위반은 서버 배포 직후 프론트가 깨지는 대표
원인이고, 사용자에게는 실패가 노출되는데 콘솔이 무음이면 원인 특정이 불가능하다.

**받은 데이터·이슈 상세를 이 함수에 넣지 말 것.** 호출부
(`AxiosContracts.responseContract`, `MonitorService`의 두 메서드)가 검증 직전에
`console.log("response ----->", ...)`와 `console.log("validation---->", ...)`로
이미 찍고 있고, 후자에 `error.issues`가 들어 있다. 중복 출력이 된다.

## 금지 사항

**제거 불가 메서드는 쓰지 않는다.** rsbuild의 `ConsoleType`은
`log`/`info`/`warn`/`error`/`table`/`group`뿐이다. `console.debug`·`dir`·
`groupCollapsed`·`groupEnd`는 제거 목록에 넣을 수 없어 프로덕션에 그대로 남는다.
`group`은 짝인 `groupEnd`를 제거할 수 없어 목록에서 뺐다 → **`group` 계열 전체 금지.**

**환경 가드(`import.meta.env.DEV`)로 감싸지 않는다.** `console.log` 제거와 목적이
겹쳐 "가드가 있으면 안전, 없으면 위험"이라는 잘못된 신호를 준다. 제거 불가
메서드를 아예 안 쓰기로 했으므로 가드가 보호할 대상이 없다.

> 단, 보장 지점은 다르다 — 가드는 런타임 보장(minify 무관), 제거 설정은 빌드타임
> 제거(minify 필요). minify를 끈 프로덕션 빌드를 도입하면 이 결정을 재검토해야 한다.

## 이 저장소의 판정 예시

| 위치                                         | 판정           | 근거                                    |
| -------------------------------------------- | -------------- | --------------------------------------- |
| `base-toast.mutation.ts` 뮤테이션 실패       | `error`        | 실패 토스트가 사용자에게 노출됨         |
| `upload-original-storage.ui.tsx` 업로드 실패 | `error`        | 진행률 `-1`(실패)로 화면에 노출됨       |
| `folder-list-ui.tsx` portal root 없음        | `error`        | 다이얼로그 미렌더. 페이로드 없는 리터럴 |
| `promisePool.ts` 워커 작업 실패              | `warn`         | 일부만 실패, 나머지는 완료              |
| `original-storage.service.ts` SSE 파싱 실패  | `warn` + `log` | 이벤트만 드롭. 원본 페이로드는 `log`로  |
| `layout.ts` localStorage 파싱 실패           | `log`          | `isLayoutDark` 기본값으로 복구          |
| `language-event.ts` / `theme-event.ts`       | `log`          | `"ko"` / `"light"` 기본값으로 복구      |

## 검증

자동 검사는 없다. 정규식 grep으로 "`error`/`warn`에 raw 에러 객체를 싣는 곳 0건"을
확인한다. 이 grep이 사실상의 불변식 명세이고, 자동화하기로 하면 그대로 린트 규칙의
출발점이 된다.

```bash
grep -rn "console\.\(error\|warn\)" src/ | grep -v "assets/"
```

번들에서 직접 확인하려면 빌드 후 dist를 본다. 제거 대상 문구는 사라지고 신호는
남아야 한다.

```bash
grep -rl "\[API Validation Error\]" dist/static/js/   # 남아야 함
grep -rl "\[SSE Raw\]" dist/static/js/                # 없어야 함
```

## 유지보수

이 파일은 `we-agent-module`·`we-model-module`에도 같은 내용으로 존재해야 한다.
`toLogSafe` 구현체, 검증 실패 로깅의 메시지 포맷, 빌드 설정 주석을 세 모듈에서
동일하게 유지한다. 규약을 바꿀 때는 세 모듈을 **같은 작업에서 함께** 고쳐야 한다.
두 모듈은 이미 한 번 갈린 이력이 있고 자동 검사가 없으므로 드리프트는 재발할 수 있다.

드리프트가 다시 발생하면 린트 규칙(`error`/`warn`의 인자에 `toLogSafe(...)`가 아닌
식별자가 오는 것을 금지)을 도입한다. 판단 기준은 "사람이 grep으로 확인하는 일이
두 번 이상 반복되는가"다.
