# remote-contract-manager 결과 출력 형식

작업 종류에 맞는 형식 **그대로** 출력한다. 사족을 붙이지 않는다.

---

## A. 계약 문서 생성·갱신

```markdown
## Remote 계약 문서 {생성|갱신}

**대상 Remote**: `{RemoteName}` (`{remote 저장소 경로}`)
**저장 위치**: `{PROJECT_ROOT}/.claude/skills/MFE_{RemoteName}/SKILL.md`
**기준 커밋**: `{짧은 해시}` / 확인 날짜: {YYYY-MM-DD}

### 문서화한 노출 모듈 ({n}개)
| 노출 키 | 종류 | props | 비고 |
|---|---|---|---|
| `Agent/AgentDashboardComp` | 페이지 | 없음 | |

### 갱신 내역 (갱신일 때만)
- 추가: `Agent/NewComp`
- 제거: `Agent/OldComp` (exposes 에서 사라짐)
- 변경: `Agent/XComp` props 에 `mode` 추가

### 확인하지 못한 것
- {소스에서 확정 못 한 항목. 없으면 "없음"}
```

---

## B. 계약 감사(Audit)

문서와 실제 코드가 어긋났는지 검사만 하고 고치지 않을 때 쓴다.

```markdown
## Remote 계약 감사 결과

**대상**: `{RemoteName}` — 문서 `{경로}` ↔ 소스 `{경로}`
**판정**: 일치 | 조치 필요 (🔴 n건 / 🟡 n건 / 🟢 n건)

### 🔴 CRITICAL — 소비측이 지금 깨지는 것
1. **문서에 있으나 exposes 에 없는 모듈**: `Agent/OldComp`
   - 소비 위치: `host/src/pages/mfe/agent-ui/old-page.ui.tsx:12`
   - 조치: 소비부 제거 또는 Remote 재노출

### 🟡 WARNING — 곧 사고가 되는 것
1. **props 시그니처 불일치**: `Agent/XComp` — 문서 `{a}` / 소스 `{a, mode}`

### 🟢 INFO
- 최종 확인 날짜가 {n}일 지남

### 대조표
| 노출 키 | 소스(exposes) | 문서 | 판정 |
|---|---|---|---|
| `Agent/AgentDashboardComp` | ✅ | ✅ | 일치 |
| `Agent/NewComp` | ✅ | ❌ 누락 | 🟡 |
```

---

## 공통 규칙

- 감사 모드는 **파일을 수정하지 않는다.** 사용자가 요청하면 그때 생성·갱신 모드로 넘어간다.
- 모든 항목에 **실제 파일 경로**를 붙인다. 확인 못 한 것은 위반으로 단정하지 않고
  "확인 불가(사유)"로 적는다.
