# mfe-config-architect 결과 출력 형식

모드에 따라 아래 형식 **그대로** 출력한다. 사족·서론을 붙이지 않는다.

---

## A. Scaffold(생성) 모드

```markdown
## MFE 설정 생성 완료

**대상**: <Host 또는 Remote 이름> (`<경로>`)
**모듈 이름**: `VITE_MODULE_NAME=<Name>` / **포트**: `<port>`

### 생성·수정한 파일
| 파일 | 내용 |
|---|---|
| `rsbuild.config.ts` | pluginModuleFederation(name/exposes/shared) |
| `.env`, `.env.development` | VITE_MODULE_NAME, VITE_REMOTE_* , VITE_<X>_MFE_BASE_URL |
| `src/export/<x>-comp.tsx` | 노출 래퍼 (+ Provider) |
| `src/app/bootstrap.tsx` | remotes 배열 항목 추가 |

### shared 정책
| 패키지 | singleton | 비고 |
|---|---|---|
| react / react-dom | true | |
| ... | | |

### 남은 수동 작업
1. <Host 메뉴·pathKeys 등록 등 사용자가 결정해야 할 항목>

### 검증 방법
```bash
# Remote 단독
npm run dev            # → http://localhost:<port>/mf-manifest.json 200 확인
# Host
npm run dev            # → 해당 메뉴 진입, 콘솔 경고 없음 확인
```
```

---

## B. Review(검토) 모드

```markdown
## MFE 설정 검토 결과

**대상**: <검사한 모듈 목록> (Host 1 + Remote N)
**판정**: PASS | 조치 필요 (🔴 n건 / 🟡 n건 / 🟢 n건)

### 🔴 CRITICAL
1. **<한 줄 요약>**
   - 위치: `<파일>:<라인>`
   - 근거 규칙: mf-config-reference.md §<번호>
   - 증상: <런타임에 어떻게 깨지는지>
   - 수정: <구체적 변경>

### 🟡 WARNING
(동일 형식)

### 🟢 INFO
(동일 형식, 한 줄로 축약 가능)

### shared 정책 교차 대조표
| 패키지 | Host | <Remote A> | <Remote B> | 판정 |
|---|---|---|---|---|
| react | singleton ✅ | singleton ✅ | 누락 ❌ | 🔴 |

### 권장 조치 순서
1. ...
```

---

## 공통 규칙

- 검토 모드는 **파일을 수정하지 않는다.** 수정은 사용자가 요청했을 때만, 등급 순으로 진행한다.
- 모든 지적에 **근거 규칙(§번호)과 실제 파일·라인**을 붙인다. 확인하지 못한 것은
  "확인 불가(사유)"로 적고 위반으로 단정하지 않는다.
- Remote 를 실제로 띄워보지 못했으면 "정적 검사 범위"임을 판정 아래 한 줄로 명시한다.
