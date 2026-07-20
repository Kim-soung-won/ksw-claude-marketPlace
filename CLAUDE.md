# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 이 저장소의 정체

Claude Code **플러그인 마켓플레이스**다. 빌드·린트·테스트 툴체인이 없고(패키지 매니저 없음),
산출물은 전부 마크다운 에이전트 정의·SKILL.md·리소스 문서와 JSON 매니페스트다. "코드를
실행"하는 것이 아니라 **에이전트/스킬 정의를 저술·수정**하는 것이 이 저장소의 작업이다.

문서·주석·에이전트 정의는 모두 **한국어**로 작성한다.

## 구조

```
.claude-plugin/marketplace.json      ← 마켓플레이스 매니페스트 (plugins[] 목록)
plugins/<plugin-name>/
  .claude-plugin/plugin.json         ← 플러그인 매니페스트 (name/description/version/author)
  agents/<agent>.md                  ← 에이전트 정의 (thin — 라우팅·워크플로만)
  resources/<agent>/*.md             ← 에이전트가 on-demand로 Read하는 절차·규칙·출력형식
  skills/<skill>/SKILL.md            ← (일부 플러그인) 스킬 정의 + examples.md
```

현재 5개 플러그인: `wiki-manager-plugin`, `claude-code-docs-plugin`,
`project-sub-plugin`, `ui-template-manage-plugin`, `frontend-support-plugin`.

새 플러그인을 추가하면 **반드시 두 곳을 동기화**한다: 루트 `marketplace.json`의 `plugins[]`
항목과 해당 플러그인의 `.claude-plugin/plugin.json`.

## 버전 관리 — 명시 버전(explicit version)이 표준

이 저장소는 **명시 버전 방식을 표준으로 채택한다.** 각 `plugin.json`은 `version`을
명시하며, 이 값이 사용자 측 캐시 갱신의 **키**다. 즉 파일만 고치고 커밋을 푸시해도
`version`을 올리지 않으면 사용자가 `/plugin update`를 해도 갱신되지 않는다("already
at the latest version"). 따라서 **플러그인 내용을 바꾸면 그 플러그인의 `version`을
반드시 올린다**(SemVer).

이를 강제하는 **pre-commit 훅**이 `.githooks/pre-commit`에 있다: 어떤 플러그인의
파일이 스테이징됐는데 그 플러그인 `plugin.json`의 `version`이 HEAD와 같으면(=안 올렸으면)
patch 버전을 자동으로 +1 하고 다시 스테이징한다. 이미 올렸거나 신규 플러그인이면
건드리지 않는다.

> **새로 clone한 머신에서 한 번** 활성화해야 한다(훅 경로는 git config라 커밋되지 않음):
> ```bash
> git config core.hooksPath .githooks
> ```
> minor/major 상승이 필요한 변경(새 skill·agent 추가 등 기능 추가는 통상 minor)은
> 훅의 자동 patch에 맡기지 말고 커밋 전에 직접 올린다.

## 핵심 설계 원칙 — 이 저장소 전체를 관통하는 규칙

이 마켓플레이스의 모든 에이전트는 하나의 비용 모델 위에서 설계됐다. 정의를 만들거나
고칠 때 이 원칙을 어기지 않는지 항상 확인한다.

1. **에이전트 정의(agent .md)는 얇게 유지한다.** 절차 전문·도메인 규칙 원본·출력 형식은
   본문에 인라인하지 않고 `resources/<agent>/` 하위 파일로 분리한다. 에이전트 본문은
   "언제 무엇을 Read해서 그대로 따르라"는 **라우팅 로직**만 담는다. 이유: 서브에이전트는
   매 spawn마다 컨텍스트를 새로 쌓고 그 재구축이 `cache write`(input 단가 1.25배)로
   청구된다 — 매번 필요하지 않은 절차까지 올리면 그대로 비용이 된다.

2. **리소스 경로는 `${CLAUDE_PLUGIN_ROOT}`로 표현한다.** `~`나 사용자명을 하드코딩하지
   않는다. 플러그인은 설치 시 별도 캐시 디렉터리로 복사되며, 이 변수만 실제 설치 경로로
   자동 치환된다(agent/skill 본문, hook·MCP·LSP 설정 어디서든 유효).

3. **큰 리소스는 `index.md` + 하위 파일로 분리한다.** 자주 필요한 요약(필드 표 등)은
   index.md에 인라인하고, 상세는 하위 파일로 두어 "어떤 파일을 읽을지" 라우팅 표로
   안내한다. 라우팅 표를 에이전트 본문과 리소스 양쪽에 중복 기재하지 않는다(어긋남 방지) —
   에이전트는 "index.md의 라우팅 표를 따르라"고만 지시한다.

4. **에이전트 `description`은 라벨이 아니라 위임 조건이다.** "무엇을 하는가"가 아니라
   "어떤 요청·트리거 문구에 호출되는가"와 예시를 담는다. 역할이 겹치는 형제 에이전트가
   있으면 description 안에서 **경계를 명시**한다(예: "…와는 대상이 다르다").
   실제 짝: `domain-skill-manager`↔`component-skill-manager`,
   `subagent-evaluator`(스펙 준수 정적 검사)↔`subagent-cost-auditor`(격리 값어치·실사용 감사)↔`subagent-creator`(생성·수정),
   `fsd-structure-architect`(FSD 공식 7계층)↔팀 자체 4계층 담당.

5. **도구는 최소 집합으로 스코핑한다.** 전체 상속 대신 실제 쓰는 것만 `tools:`에 나열한다.
   `AskUserQuestion` 등 UI 상태 의존 도구는 서브에이전트에서 동작하지 않으므로 넣지 않고,
   확인이 필요하면 최종 응답 텍스트에 질문으로 담는다.

## 새 에이전트/스킬을 만들 때

이 저장소 자체가 그 작업을 위한 도구를 담고 있다 — 맨손으로 쓰지 말고 위임한다:

- 새 **subagent** 정의 → `subagent-creator` 에이전트. 공식 스펙 규격을 따른다.
- 기존 subagent 정의 진단 → `subagent-evaluator`(스펙), `subagent-cost-auditor`(비용·격리).
- 새 **SKILL.md** → `claude-skill-creator` 에이전트.

각 에이전트의 규격 근거 문서는 해당 플러그인의 `resources/` 아래에 번들되어 있다
(예: `claude-code-docs-plugin/resources/claude-skill-creator/skill-docs/`).

## 검증

빌드가 없으므로 변경 후 자체 확인은 최소 두 가지다:
- **JSON 유효성**: `marketplace.json`과 모든 `plugin.json`이 파싱되는지 확인한다.
- **frontmatter 정합성**: 에이전트/스킬 파일의 YAML frontmatter(`name`, `description`,
  `tools`, `model` 등)가 유효하고, 폴더명 = frontmatter `name`이 일치하는지 확인한다.
