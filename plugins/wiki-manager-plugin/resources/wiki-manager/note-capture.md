# 노트 캡처 절차

작업 중 알게 된 새로운 정보를 vault(`~/agent-knowledge-base`) 컨벤션에 맞는
노트로 정리해 `_inbox/`에 저장하는 절차. 이 절차가 끝나면 이어서 같은 디렉터리의
`wikilink-linker.md`를 Read하고, 그 문서의 "소규모" 처리 경로를 그대로 적용해 방금 만든
노트를 관련 노트와 연결한다.

---

## 노트 타입 판단

대부분의 캡처 요청은 **기술 학습**이지만, 내용 성격에 따라 다른 템플릿을 써야 정확하다.
아래 순서로 판단한다.

| 내용 성격 | 템플릿 | 파일명 규칙 |
|-----------|--------|-------------|
| 라이브러리/개념/트러블슈팅 학습 (기본값) | `_templates/TPL Tech Learning.md` | `Title Case.md` |
| "왜 A 대신 B를 택했는가" 같은 아키텍처 의사결정 | `_templates/TPL ADR.md` | `ADR-NNN Decision Title.md` |
| 장애 원인과 조치 | `_templates/TPL Incident.md` | `INC-NNN YYYY-MM-DD Desc.md` |
| 미팅에서 얻은 정보 | `_templates/TPL Meeting Note.md` | `MTG YYYY-MM-DD Topic.md` |

ADR/Incident는 기존 파일들의 번호(NNN)를 확인해 다음 번호를 사용한다:

```bash
find ~/agent-knowledge-base -iname "ADR-*.md" | sort
find ~/agent-knowledge-base -iname "INC-*.md" | sort
```

애매하면 기본값인 Tech Learning으로 진행하되, 사용자에게 "ADR/Incident로 남기는 게 더 맞을 수도
있는데 그대로 진행할까요?"처럼 한 줄로 확인한다.

---

## 처리 절차

1. **핵심 정보 재구성**: 대화 맥락(방금 해결한 에러, 방금 이해한 개념, 방금 내린 결정)에서 "무엇을,
   왜, 어떻게" 알게 됐는지를 정리한다. 사용자의 요청이 짧아도("이거 기록해줘") 직전 대화에서 실제
   내용을 채워 넣는다 — 빈 템플릿만 만들지 않는다.

2. **템플릿 읽기**: 해당 템플릿 파일을 Read로 직접 읽어 그 구조를 그대로 따른다. 템플릿 내용을 이
   문서에 복사해두지 않는 이유는, 템플릿이 나중에 바뀌어도 이 절차가 항상 최신 구조를 따르게
   하기 위해서다.
   - 템플릿의 Templater 문법(`<% tp.date.now(...) %>`, `<% tp.file.cursor(N) %>`)은 Obsidian
     플러그인 전용이므로, 실제 파일을 만들 때는 그 자리에 실제 값(오늘 날짜 등)을 채우고 커서
     마커는 제거한다.
   - 섹션 중 채울 내용이 없는 항목(예: 코드 예시가 없는 개념 노트의 "Code Examples")은 섹션 자체를
     생략한다. 빈 표/빈 헤더를 그대로 남기지 않는다.

3. **Frontmatter 작성**:
   - `date-created`, `date-modified`는 오늘 날짜.
   - `tags`는 `00 Meta/00.02 Tag Index.md`를 먼저 확인해 기존 태그를 재사용한다. `#status/`
     태그 1개는 필수이며 신규 캡처는 보통 `#status/seedling`. 태그는 최대 7개.
   - 정말 새로운 태그가 필요하면 임의로 만들지 말고, 어떤 태그를 새로 추가할지 사용자에게 한 줄로
     확인한 뒤 Tag Index에도 함께 등록한다 (Tag Index 정비 자체를 이 절차가 마음대로 재구성하지는
     않는다).
   - `area`(Tech Learning 템플릿의 경우)는 관련된 `20 Areas/` 하위 노트가 있으면 링크한다.

4. **파일명·저장 위치**: vault `CLAUDE.md`의 파일 명명 규칙을 따르고, 항상 `_inbox/`에 저장한다.
   `_inbox/`에서 적절한 최종 폴더(`20 Areas/`, `30 Resources/` 등)로 옮기는 "정리" 작업은 vault
   룰상 48시간 내 사람이 검토 후 수행하는 별도 단계이므로 이 절차는 건드리지 않는다.

5. **위키링크 연계**: 저장이 끝나면 새 노트는 위키링크가 0개인 상태다. 곧바로 같은 디렉터리의
   `wikilink-linker.md`를 Read하고, 그 문서의 "소규모" 처리 경로(신규 노트 1개 직접 처리)를
   적용해 관련 노트와 연결한다.

6. **보고**: 저장된 파일의 전체 경로와 핵심 요약, 새로 건 위키링크 목록을 사용자에게 알린다.

7. **커밋은 하지 않는다**: vault의 git 커밋 컨벤션은 `feat(learning): ...` 형태지만, 커밋 실행은
   사용자가 명시적으로 요청했을 때만 한다. 이 절차는 파일 생성까지만 담당한다.

---

## 검증

- frontmatter 태그가 7개를 넘지 않는지, `#status/` 태그가 정확히 1개 있는지 확인한다.
- 파일명이 명명 규칙(`Title Case.md` / `ADR-NNN ...` / `INC-NNN ...` / `MTG ...`)과 일치하는지
  확인한다.
- Tag Index에 없는 새 태그를 만들었다면, Tag Index에도 반영했는지(또는 반영이 필요하다고
  사용자에게 알렸는지) 확인한다.

---

## 예시

**입력**: "방금 React Query의 staleTime이랑 cacheTime 차이 때문에 두 시간 삽질했는데, 이거 vault에
정리해서 저장해줘"

**출력**: `_inbox/React Query StaleTime Vs CacheTime.md` 생성 — Tech Learning 템플릿 구조로
Summary(두 옵션의 차이), 디버깅 노트 표(겪었던 증상 → 원인 → 해결), `#tech/react/query` 태그
포함. 저장 직후 `wikilink-linker.md`의 소규모 처리 경로를 적용해
`20 Areas/20.02 Frontend Engineering/` 하위의 관련 React 노트와 연결.

**입력**: "OCR UI 프로젝트에서 왜 REST 대신 WebSocket으로 갔는지 방금 팀이랑 얘기한 거 기록해줘"

**출력**: 기존 ADR 파일들의 최댓값 번호를 확인해 `_inbox/ADR-004 OCR UI WebSocket 채택.md`
생성 — ADR 템플릿 구조 사용, `#work/decision`, `#work/project/ocr-ui` 태그 포함.

---

## 범위 밖 (이 절차가 다루지 않는 것)

- `_inbox/`의 노트를 최종 폴더로 이동시키는 "정리" 단계 (vault 룰상 사람이 48h 내 검토 후 수행)
- 이미 vault에 있는 고립 노트를 연결하는 작업 → `wikilink-linker.md`의 역할
- `00 Meta/00.02 Tag Index.md` 태그 체계 자체의 재설계
- git 커밋 실행 (사용자가 명시적으로 요청할 때만)
