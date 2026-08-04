---
description: >-
  vault에 새 프로젝트를 추가할 때 필수 입력을 먼저 요구한 뒤 척추(Overview + Decisions Log)를
  스캐폴딩하고 Project Map에 등록하는 커맨드. 빈 스텁을 만들지 않는다. 운영 상세(api/scenario)는
  vault가 아니라 repo의 SKILL.md에 두므로 생성하지 않는다.
argument-hint: "[프로젝트 표시명]"
disable-model-invocation: true
---

# /new-project — 새 프로젝트 스캐폴딩 (입력 강제)

vault(`~/agent-knowledge-base`)에 새 프로젝트를 추가한다. 이 커맨드의 핵심은 **필수 입력을
사용자에게 먼저 요구**하고, 빈 스텁을 만들지 않는 것이다. 대화 컨텍스트가 필요한 입력 수집은
현재(메인) 에이전트가 수행한다(subagent는 `AskUserQuestion`을 못 쓴다).

기준 문서: 구조·필수 입력 목록은 `<vault>/00 Meta/00.04 KB Purpose & Project Structure.md`,
프로젝트 매핑은 `<vault>/00 Meta/00.03 Project Map.md`가 단일 진실 공급원이다.

## 1. 필수 입력 수집 (없으면 생성 중단)

먼저 다음을 사용자에게 **요구**한다. 구조화 선택지는 `AskUserQuestion`으로, 자유 서술은
질문으로 받고 **답이 없으면 스캐폴딩으로 넘어가지 않는다**. `$ARGUMENTS`가 있으면 표시명 초안으로 쓴다.

**필수:**
- **프로젝트 표시명** + **repo 이름** (Project Map 등록·slug용; repo가 아직 없으면 "없음" 명시)
- **아키타입** (`AskUserQuestion`): 도메인형 제품 / 이관·현대화 / 소형·유틸
- **Goal** — 달성하려는 것 (한 줄 이상)
- **Background** — 왜 존재하는가 / 어떤 문제를 푸는가
- **정책·제약** — 모든 결정을 읽는 기준선(예: feature-parity). 없으면 "특이사항 없음"이라도 명시

**권장 (물어보되 '미정' 허용):** Team(담당 분담) · Stack · Scope

필수 항목이 비면 그 항목만 다시 물어본 뒤 진행한다. 사용자가 모른다고 하면 임의로 지어내지
말고 "미정"으로 표기하되, 필수 항목(특히 Goal/Background/정책)은 최소 한 줄이라도 받아낸다.

## 2. 프로젝트 번호·폴더 결정

`10 Projects/`에서 기존 `10.NN` 폴더의 최댓값을 확인해 다음 번호를 쓴다:

```bash
ls -d "<vault>/10 Projects/10."* 2>/dev/null
```

폴더명은 `10 Projects/10.NN <표시명>/`(Title Case). slug는 repo(없으면 표시명)를 소문자화하고
영숫자 외를 하이픈으로 치환한 값 → 프로젝트 태그 `#work/project/<slug>`.

## 3. 척추 스캐폴딩 (Overview + Decisions Log만)

`00.04`의 척추 규칙을 따른다. **api/scenario/data-model/timeline/incidents는 만들지 않는다**
(운영 상세는 SKILL.md, 시간축은 /log, 사건은 INC-NNN에서 파생).

1. `10.NN.00 Project Overview.md` — 수집한 값으로 채운다(빈 placeholder 금지). 섹션:
   Goal / Background / **정책·제약** / Team / Stack / Scope / Related Notes. frontmatter:
   `tags: [work/project/<slug>, type/moc, status/seedling]`, `status: active`, 오늘 날짜.
   운영 레퍼런스가 repo SKILL.md에 있으면 "운영 레퍼런스: repo `<repo>`의 SKILL.md" 한 줄을 남긴다.
2. `10.NN.01 Decisions Log.md` — 결정 표(`| Date | 결정 내용 | 근거 | 결정자 |`) + `## Escalated to ADR`.
   정책·제약을 상단 콜아웃 기준선으로 적는다(MHub Decisions Log와 동일한 형식).
3. **아키타입별 안내만** 남긴다(폴더는 미리 만들지 않음): 도메인형이면 "고유 도메인·불변조건이
   생기면 `domain/` 추가", 이관형이면 "재사용 패턴은 `30 Resources`로", 소형이면 "이 둘로 충분".

## 4. Project Map · Tag Index 등록

- `00 Meta/00.03 Project Map.md` 매핑 테이블에 행 추가:
  `| <repo> | <repo> | <pkg?> | 10 Projects/10.NN <표시명> | #work/project/<slug> | [[10.NN.00 Project Overview]] |`
  (repo가 "없음"이면 repo/remote 칸은 비우고 vault 경로·태그·개요만 채운다.)
- `#work/project/<slug>`는 Tag Index의 `#work/project/[name]` 네임스페이스 패턴에 속하므로,
  Tag Index 표에 이 프로젝트 행을 한 줄 추가한다(패턴 자체는 이미 등록됨).

## 5. 보고

생성한 폴더·파일 경로, 등록한 Project Map 행/태그, 아키타입에 따라 생략한 모듈을 보고한다.
git 커밋은 하지 않는다(사용자가 명시적으로 요청할 때만).

## 설계 의도

빈 스텁은 "가짜 구조"이자 오염이다(→ `00.04`의 no-empty-scaffolding). 이 커맨드는 필수 입력을
**강제**해 프로젝트가 항상 목적(경험·결정·배움)에 맞는 최소 실질 골격으로 시작하게 한다.
