# remote-contract-manager — Remote 계약 SKILL.md 포맷 규칙

> 이 파일은 `agents/remote-contract-manager.md` 에서 분리된 정적 참고 자료다.
> SKILL.md 작성 단계에 들어갔을 때만 Read 로 읽는다. 결과 리포트 형식은 같은 디렉터리의
> `result-output-format.md` 를 본다.

문서화 대상은 **한 Remote 가 `exposes` 로 공개한 모듈 전체**다. 목표는 Host(소비) 쪽
개발자가 Remote 저장소를 열지 않고도 "무엇을 `loadRemote` 할 수 있고, 어떤 props 를 주며,
그 화면이 무엇을 전제하는가"를 판단하게 하는 것이다.

**한 Remote = 한 SKILL.md** 다. 노출 모듈마다 파일을 쪼개지 않는다 — 계약은 모듈 단위로
소비되지만 전제(Provider·공유 의존성·전역 상태)는 Remote 단위로 공통이라, 쪼개면 같은
전제가 N 번 복제돼 어긋난다.

---

## 저장 경로

```
{소비 프로젝트 루트}/.claude/skills/{name}/SKILL.md
```

기본 저장처는 **Host(소비) 프로젝트**다. Remote 저장소에도 두고 싶다는 요청이 있으면
양쪽에 같은 내용을 두되, 원본은 Host 쪽임을 body 상단에 한 줄로 밝힌다.
어느 프로젝트에 저장할지 불명확하면 사용자에게 묻는다.

---

## Frontmatter

```yaml
---
name: MFE_{RemoteName}
description: >-
  {트리거 + 무엇을 노출하는 Remote 인가 + 핵심 전제}
---
```

- `name` 은 `MFE_` + Remote 의 `VITE_MODULE_NAME` 값 그대로다(예: `MFE_Agent`, `MFE_Infra`).
  **폴더명 = frontmatter `name` = 모듈 이름** 세 가지가 일치해야 한다. 모듈 이름은
  `loadRemote("Agent/...")` 의 접두사와 같은 값이므로 임의로 바꾸지 않는다.
- `description` 에는 다음을 순서대로 담는다.
  1. **트리거** — "`Agent` Remote 의 화면을 Host 에서 불러오거나 이 모듈의 노출 컴포넌트를
     추가·변경할 때 읽는다" + 실제 검색어가 될 토큰들: 모듈 이름, 노출 키
     (`Agent/McpManageComp` 등), 대표 화면 이름(한국어 메뉴명 포함).
  2. **무엇을 노출하는가** — 도메인 한 줄 요약과 노출 모듈 개수.
  3. **핵심 전제** — 어기면 런타임에 깨지는 것(필요한 shared singleton, Host 가 채워야 하는
     전역 상태, Suspense/에러 폴백 필요 여부).
- 리터럴 블록 스칼라(`|`)를 쓰지 않는다. 여러 줄은 폴디드 `>-` 로 쓴다.

---

## 바디 섹션 구조

````markdown
# {RemoteName} Remote 계약

> 원본 소스: `{remote 저장소 경로}` / 노출 진입점: `src/export/`
> 최종 확인: {YYYY-MM-DD}, 기준 커밋 {짧은 해시 또는 "확인 불가"}

## 개요
{이 Remote 가 담당하는 도메인 범위 2~3문장. 어떤 메뉴그룹을 책임지는지.}

| 항목 | 값 |
|---|---|
| 모듈 이름(`VITE_MODULE_NAME`) | `Agent` |
| dev 포트 | `4178` |
| Host env 변수 | `VITE_AGENT_MFE_BASE_URL` |
| entry | `${VITE_AGENT_MFE_BASE_URL}/mf-manifest.json` |

## 노출 모듈 목록

| 노출 키 | 소스 파일 | 종류 | 화면/역할 |
|---|---|---|---|
| `Agent/AgentDashboardComp` | `src/export/agent-dashboard-comp.tsx` | 페이지 | 에이전트 대시보드 |
| `Agent/AgentStateChart` | `src/export/agent-state-chart.tsx` | 위젯 | 대시보드 카드용 상태 차트 |

> **종류**는 폴백 정책을 가른다 — 페이지는 전체 화면 에러 폴백, 위젯은 카드 크기 폴백.

## 모듈별 계약

### `Agent/AgentDashboardComp`
- **props**: 없음 (`() => JSX.Element`) — 또는 아래 형태로 표를 둔다.

  | prop | 타입 | 필수 | 설명 |
  |---|---|---|---|
  | `projectId` | `string` | ✅ | 조회 대상 프로젝트 |

- **default export 여부**: `export default` (loadRemote 결과의 `.default` 로 접근)
- **내부 라우팅**: 없음 / 자체 `MemoryRouter` 사용 / Host 라우터 Context 사용
- **호출하는 백엔드**: `VITE_APM_BASE_URL` 프록시 경유 (`/api/apm/...`)
- **전제**: {이 모듈만의 추가 전제. 없으면 "공통 전제 외 없음"}

## 공통 전제 (Remote 단위)

1. **Provider 래핑** — 모든 노출 모듈은 모듈 자체 Provider 로 감싸져 있다. Host 는 별도
   Provider 를 씌우지 않는다.
2. **shared singleton 요구** — `react`, `react-dom`, `react-router`, `zustand`,
   `@tanstack/react-query`, `react-hook-form` … {실제 설정에서 확인한 목록}
3. **Host 가 채워야 하는 전역 상태** — 인증/메뉴 권한 전역 스토어, 테마·언어 CustomEvent.
   {비어 있을 때 어떤 화면이 어떻게 보이는지 함께 적는다.}
4. **소비 방법** — `lazy(() => loadRemote("Agent/XxxComp", { from: "runtime" }))` + `Suspense`.

## 변경 시 파급

{이 Remote 의 노출 키를 바꾸면 Host 의 어떤 파일이 깨지는지 실제 경로로 적는다.}

## 확인하지 못한 것

- {소스에서 확정하지 못한 항목을 명시한다. 추측으로 채우지 않는다.}
````

---

## 작성 규칙

1. **소스에서 확인한 것만 쓴다.** props 는 노출 파일과 그 파일이 렌더하는 페이지 컴포넌트의
   타입 정의에서 읽는다. 확인 못 한 항목은 `## 확인하지 못한 것` 에 남긴다.
2. **노출 키는 `rsbuild.config.ts` 의 `exposes` 를 유일한 출처로 삼는다.** `src/export/` 에
   파일이 있어도 `exposes` 에 없으면 계약이 아니다(반대도 마찬가지 — 있으면 🔴 로 보고).
3. **버전·날짜를 박아둔다.** 계약 문서는 낡는 순간 위험해지므로 상단에 최종 확인 날짜와
   기준 커밋을 남긴다.
4. **화면 스크린샷·장문 설명을 넣지 않는다.** 소비 판단에 필요한 계약(키·props·전제·파급)만
   담는다.
5. 기존 파일이 있으면 **전면 재작성이 아니라 갱신**한다. 사람이 손으로 덧붙인 주석
   (`<!-- note: ... -->`)은 보존한다.
