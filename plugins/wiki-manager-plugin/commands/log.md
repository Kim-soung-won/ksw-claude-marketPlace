---
description: >-
  현재 Claude 대화의 핵심을 구조화 요약해 오늘의 Daily Note에 append하는 캡처층 커맨드.
  세션이 열린 repo로 프로젝트를 자동 분류(태그·개요 링크·provenance)하되 정식 노트화·
  위키링크 연계는 하지 않는다(그건 /ingest). 지식베이스의 recall 우선 캡처 레이어.
argument-hint: "[주제 힌트(선택)]"
disable-model-invocation: true
---

# /log — 대화 캡처(캡처층)

이 커맨드는 **지금 진행 중인 대화**를 오늘의 Daily Note에 구조화 요약으로 append한다.
개인 기억 보철의 "넓은 캡처 레이어"에 해당하며, 큐레이션된 위키(`20 Areas/`)를
오염시키지 않도록 정식 노트화·위키링크·Tag Index 정비는 **하지 않는다**. 대화 컨텍스트를
가진 현재(메인) 에이전트가 직접 수행한다 — subagent에 위임하지 않는다(subagent는 대화
기록을 보지 못한다).

## vault 경로 확인

기본 vault는 `~/agent-knowledge-base`로 가정한다. 없으면 `echo $KB_VAULT_PATH`로
오버라이드를 확인하고, 그래도 못 찾으면 사용자에게 실제 경로를 묻는다.

## 프로젝트 자동 분류 (세션이 어느 repo에서 열렸는지로 결정)

저장 위치는 항상 Daily Note 타임라인이지만, **분류는 세션의 작업 디렉터리로 결정론적으로**
붙인다. "어디서 `/log`를 쳤느냐"가 곧 프로젝트 분류이므로 매번 수동 태깅할 필요가 없다.

이 분류 절차(감지 → Project Map 조회 → 매칭 성공/미스 시 자동 추가)는 `/ingest`와 공유하므로
`${CLAUDE_PLUGIN_ROOT}/resources/wiki-manager/project-classify.md`를 Read해서 그대로 수행하고,
그 결과(프로젝트 태그 · 개요 노트 위키링크 · provenance `repo/branch/commit` · 또는 개인/일반)를
아래 캡처 블록의 분류 메타 라인에 반영한다. 미등록 repo는 그 절차에 따라 Project Map에 자동
추가되며, 개요 노트가 아직 `TODO`인 경우 위키링크는 생략하고 프로젝트 태그·provenance만 붙인다.

## 절차

1. **대상 파일 경로 결정**: 오늘 날짜로 `<vault>/50 Daily Notes/YYYY/MM/YYYY-MM-DD.md`.
   (예: 2026-08-04 → `50 Daily Notes/2026/08/2026-08-04.md`.) 날짜는 `date +%F` 등으로 확인한다.

2. **Daily Note 준비**:
   - 파일이 없으면 상위 폴더를 `mkdir -p`로 만들고, `<vault>/_templates/TPL Daily Note.md`를
     Read해 Templater 마커(`<% tp.date.now(...) %>`)를 실제 값(오늘 날짜, 요일, 주차)으로
     채워 생성한다. 커서 마커(`<% tp.file.cursor(N) %>`)는 제거한다.
   - 이미 있으면 그대로 두고 append만 한다.

3. **캡처 범위**: 인자(`$ARGUMENTS`)가 있으면 그 주제로 대화를 좁혀 요약하고, 없으면
   직전 대화(마지막 `/log` 이후 구간, 판단 어려우면 현재 세션의 최근 흐름)를 대상으로 한다.

4. **캡처 블록 작성 — 구조화 요약 + 핵심 산출물 + 분류**: Daily Note에 `## Session Log`
   섹션이 없으면 `## Links & References` 아래에 새로 만들고, 있으면 그 아래에 아래 형식의
   타임스탬프 블록을 **append**한다(기존 내용 덮어쓰기 금지):

   ```
   ### HH:MM — <대화 주제 한 줄>
   > 🗂 <프로젝트명> · repo `<REPO>` · `<BRANCH>`@`<COMMIT>` · <개요 노트 위키링크> <프로젝트 태그>
   - **요지**: 2~4줄 요약 (무엇을 다뤘고 무엇을 알게/결정했는지)
   - **핵심 결정·사실**: 재사용 가치 있는 결론·규칙·수치 (bullet 몇 개)
   - **산출물**: 생성/수정한 파일 경로, 실행한 명령, 코드 스니펫, 참조 링크 (있는 것만)
   - **후속**: 나중에 /ingest로 결정화할 만한 항목이나 미해결 질문 (있으면)
   ```

   - **분류 메타 라인(`> 🗂 …`)**: 위 "프로젝트 자동 분류"(project-classify)의 결과를 담는다.
     - 매칭/등록됨: `> 🗂 OCR UI · repo \`rag-mfe-documentai\` · \`feature/schema\`@\`a1b2c3\` · [[10.01.00 Project Overview]] #work/project/ocr-ui` 형태. 프로젝트 태그는 인라인으로
       두어야 Obsidian 태그 검색에 잡히고, 개요 노트 위키링크는 그 노트의 백링크에 이 Daily
       Note가 뜨게 해 프로젝트별 회수를 가능하게 한다.
     - 자동 추가됨(개요 노트 TODO): `> 🗂 <REPO> · repo \`<REPO>\` · \`<BRANCH>\`@\`<COMMIT>\` #work/project/<SLUG>` — 프로젝트 태그·provenance는 붙이되 개요 위키링크는 아직 생략(TODO라 대상 없음).
     - git repo 아님: `> 🗂 (개인/일반)` 한 줄만.
   - 시각(`HH:MM`)은 `date +%H:%M`로 채운다.
   - "산출물"은 원문 충실도를 위해 파일 경로·명령·링크를 축약하지 말고 그대로 남긴다.
   - 대화가 여러 주제였으면 주제별로 블록을 나눠도 된다. 한 세션에서 여러 프로젝트를 오갔다면
     블록마다 분류 메타 라인을 각각 맞게 붙인다.

5. **하지 않는 것**: 위키링크 삽입, Tag Index 수정, `_inbox/`·`20 Areas/` 노트 생성,
   git 커밋. 이것들이 필요하면 `/ingest`를 쓰도록 안내한다.

6. **보고**: 저장한 Daily Note 경로, 감지·부착한 **분류**(프로젝트명 + provenance), 방금 추가한
   블록의 요지 1~2줄을 보고한다. 미등록 repo라 Project Map에 자동 추가한 경우, project-classify
   절차대로 "`<REPO>` 행을 자동 추가함(태그 `#work/project/<SLUG>`, vault 경로·개요 노트 TODO)"을
   알린다. 그리고 "이 로그를 나중에 자꾸 다시 참조하게 되면 `/ingest`로 정식 노트화하세요" 한 줄을 붙인다.

## 설계 의도

`/log`는 "capture(넓게·싸게, recall 우선)"이고 `/ingest`는 "crystallize(선별·정제,
precision 우선)"이다. 두 층을 물리적으로 분리(캡처=Daily Notes 타임라인, 결정화=위키
노트)해 캡처가 큐레이션된 위키를 오염시키지 않게 한다. 승격은 사용 패턴이 끌어당긴다 —
자주 다시 보는 로그를 `/ingest`로 올린다.
