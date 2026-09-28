@AGENTS.md

# Claude Code 전용 규약

공통 개발·저술·버전·검증 규칙은 위에서 가져온 `AGENTS.md`를 따른다.
이 문서는 Claude Code 실행에 필요한 연결만 정의한다.

## 경로와 도구

- Claude 전용 정의에서 플러그인 루트를 표현할 때는 `${CLAUDE_PLUGIN_ROOT}`를 사용한다. 적용하는 문서·설정 위치에서 해당 변수가 지원되는지 확인한다. 공통 리소스의 상대 경로 규칙은 `AGENTS.md`를 따른다.
- Claude 에이전트의 `tools:`에는 실제 사용하는 도구만 나열한다. 모델·도구·권한 필드는 Claude 설정으로 취급하며 Codex 설정으로 그대로 옮기지 않는다.
- 하위 에이전트에 질문 도구를 연결할 때는 해당 실행 환경의 지원 여부를 확인한다. 사용할 수 없다면 필요한 질문을 최종 응답에 담아 메인 에이전트에 반환한다.

## Claude 정의 생성·진단

이 저장소에 등록된 전문 에이전트에 다음 작업을 위임한다.

- 새 Claude subagent 정의: `subagent-creator`.
- 기존 Claude subagent 진단: `subagent-evaluator`(스펙), `subagent-cost-auditor`(비용·격리).
- 새 Claude 스킬 정의: `claude-skill-creator`.

규격 근거는 해당 플러그인의 `resources/`에서 필요한 문서를 읽는다.
예: `claude-code-docs-plugin/resources/claude-skill-creator/skill-docs/`.
