---
name: wiki-new-project
description: Obsidian vault에 새 프로젝트를 등록하고 필수 목표·배경·정책을 반영한 Overview와 Decisions Log를 만드는 요청에 사용한다.
---

# wiki-new-project

Codex에서는 먼저 [실행 연결 규칙](../../codex/runtime.md)을 읽는다.
[원본 커맨드 절차](../../commands/new-project.md)를 읽고 본문의 작업을 수행한다.
원본 YAML은 Claude 커맨드 설정이며 Codex 설정으로 적용하지 않는다.
`$ARGUMENTS`는 현재 요청에서 사용자가 제공한 주제·프로젝트명으로 해석한다.
`/log`, `/ingest`, `/new-project`는 각각 `wiki-log`, `wiki-ingest`, `wiki-new-project`
스킬을 뜻한다. Claude Code에서는 기존 slash command를 그대로 사용할 수 있다.

대화 내용 추출과 필수 입력 확인은 현재 메인 에이전트가 맡는다. 이미 받은 답은 재질문하지
않고, 필수 정보가 누락되면 그 항목을 물은 뒤 생성한다. 위임이 필요하면 추출한 실질
내용과 대상 vault를 전달한다. 등록된 wiki-manager가 없으면 같은 절차를 직접 수행한다.
사용자가 지정한 vault 또는 `KB_VAULT_PATH`를 기본 홈 경로보다 우선한다.
기존 노트를 덮어쓰거나 요청하지 않은 git 커밋을 수행하지 않는다.
