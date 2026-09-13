---
name: wiki-knowledge
description: Obsidian vault에 지식을 정식 노트로 기록하거나 고립 노트·Related Notes·위키링크 연결을 점검할 때 사용한다.
---

# wiki-knowledge

이 파일 기준 `../..`가 플러그인 루트다. Codex에서는 먼저
[실행 연결 규칙](../../codex/runtime.md)을 읽는다. Claude Code에서는 기존 네이티브
에이전트를 사용할 수 있다. 아래에서 요청에 맞는 업무 하나를 선택한다.

| 업무 | 원본 절차 |
|---|---|
| Obsidian vault에 지식을 캡처하고 기존 노트의 위키링크를 연결한다. | [wiki-manager](../../agents/wiki-manager.md) |

등록된 해당 에이전트와 위임 도구가 있으면 입력·범위·출력 형식을 전달해 위임한다.
없으면 선택한 원본을 읽고 같은 절차를 현재 에이전트가 수행한다. YAML frontmatter는
업무 설명이며 호스트 설정으로 실행하지 않는다. 결과는 원본의 지정 형식을 따른다.
