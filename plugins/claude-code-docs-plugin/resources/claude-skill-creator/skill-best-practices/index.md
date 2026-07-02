# skill-best-practices — 목차 및 공유 전 체크리스트

> 출처: https://platform.claude.com/docs/ko/agents-and-tools/agent-skills/best-practices
> (Claude Developer Platform 공식 문서, 2026-07-02 스냅샷)
>
> 이 문서는 Claude 제품 전체(Claude Code, Claude API의 Agent Skills 등)에
> 적용되는 **작성 스타일** 가이드다. Claude Code 고유의 frontmatter 필드·
> 저장 위치·호출 방식 스펙은 `skill-docs/`(출처: code.claude.com)를 참고한다.
> 두 문서 세트는 서로 다른 관심사를 다루므로 상충하지 않는다: 이 문서는
> "어떻게 잘 쓸 것인가", `skill-docs/`는 "Claude Code에서 어떤 필드가
> 지원되는가".
>
> 원래 단일 파일 `skill-best-practices.md`(613줄)였으나, 매 호출마다 전체를
> Read하면 narrow한 수정 작업에도 불필요한 토큰이 들어 이 4개 하위 파일로
> 분리했다. **이 index.md는 항상 먼저 읽는다.** 공유 전 체크리스트는 짧아
> 여기 인라인으로 두었다.

Claude가 발견하고 성공적으로 사용할 수 있는 효과적인 Skill을 작성하는 방법.
좋은 Skill은 간결하고, 잘 구조화되어 있으며, 실제 사용을 통해 테스트된다.

## 어떤 파일을 읽을지

| 작업 | 읽어야 할 파일 |
|---|---|
| 새 skill을 처음부터 만든다 | index.md(이 파일) → [core-writing.md](core-writing.md) → 다단계 작업이면 [workflows-and-content.md](workflows-and-content.md) → 스크립트를 번들하면 [advanced-code-skills.md](advanced-code-skills.md) |
| `description`이나 skill 이름만 다듬는다 | [core-writing.md](core-writing.md)만 |
| 500줄에 근접해 지원 파일로 분리해야 하는지 판단 | [core-writing.md](core-writing.md)의 "점진적 공개 패턴" 절만 |
| 다단계 절차에 체크리스트나 검증 루프를 추가한다 | [workflows-and-content.md](workflows-and-content.md)만 |
| 시간에 민감한 정보·용어 일관성·출력 템플릿을 점검한다 | [workflows-and-content.md](workflows-and-content.md)만 |
| skill이 실제로 잘 작동하는지 평가·반복 개선하려 한다 | [evaluation-and-antipatterns.md](evaluation-and-antipatterns.md)만 |
| 번들 스크립트(Python 등)를 포함한 skill을 작성한다 | [advanced-code-skills.md](advanced-code-skills.md)만 |
| 완성된 초안을 저장하기 전 최종 점검 | 아래 "공유 전 체크리스트"만 |

narrow한 단일 항목 점검이면 표에서 지목한 파일만 Read한다. 새로 만드는
작업처럼 여러 관심사가 겹치면 표에 나열된 파일을 모두 읽는다.

## 하위 파일 목록

| 파일 | 내용 |
|---|---|
| [core-writing.md](core-writing.md) | 핵심 원칙(간결함 — "Claude는 이미 똑똑하다", 자유도 높음/중간/낮음 보정, 모델별 테스트), Skill 구조(YAML 필수 필드 제약, 명명 규칙 — 동명사형, 효과적인 description 작성 — 3인칭·무엇을/언제, 점진적 공개 패턴 1/2/3, 참조 1단계 깊이, 100줄 이상 참조 파일 목차) |
| [workflows-and-content.md](workflows-and-content.md) | 워크플로 및 피드백 루프(체크리스트 패턴, validate-fix-repeat), 콘텐츠 가이드라인(시간에 민감한 정보 회피, 용어 일관성), 일반적인 패턴(템플릿·예시·조건부 워크플로) |
| [evaluation-and-antipatterns.md](evaluation-and-antipatterns.md) | 평가 및 반복(평가 주도 개발, evals JSON 구조, Claude A/B 반복 개발 루프, Claude의 탐색 방식 관찰), 피해야 할 안티패턴(Windows 경로, 과도한 옵션 나열) |
| [advanced-code-skills.md](advanced-code-skills.md) | 고급: 실행 가능한 코드가 있는 Skill(오류를 Claude에 떠넘기지 않기, 부두 상수 금지, 유틸리티 스크립트 제공, 시각적 분석, 계획→검증→실행 패턴, 패키지 종속성, 런타임 환경, MCP 도구 정규화 이름, 도구 설치 가정 금지), 기술 참고 사항 |

## 공유 전 체크리스트

Skill을 저장/공유하기 전에 다음을 확인한다 — `claude-skill-creator` 에이전트는
파일을 저장하기 직전에 이 목록을 항상 점검한다.

**핵심 품질**

- [ ] description이 구체적이고 핵심 용어를 포함함
- [ ] description이 Skill이 무엇을 하는지와 언제 사용하는지를 모두 포함함
- [ ] SKILL.md 본문이 500줄 미만임
- [ ] 추가 세부 정보가 별도의 파일에 있음 (필요한 경우)
- [ ] 시간에 민감한 정보가 없음 (또는 "이전 패턴" 섹션에 있음)
- [ ] 전체적으로 일관된 용어 사용
- [ ] 예시가 추상적이지 않고 구체적임
- [ ] 파일 참조가 한 단계 깊이임
- [ ] 점진적 공개가 적절하게 사용됨
- [ ] 워크플로에 명확한 단계가 있음

**코드 및 스크립트**

- [ ] 스크립트가 Claude에게 떠넘기지 않고 문제를 해결함
- [ ] 오류 처리가 명시적이고 도움이 됨
- [ ] "부두 상수"가 없음 (모든 값이 정당화됨)
- [ ] 필요한 패키지가 지침에 나열되고 사용 가능한 것으로 확인됨
- [ ] 스크립트에 명확한 문서가 있음
- [ ] Windows 스타일 경로가 없음 (모두 슬래시)
- [ ] 중요한 작업에 대한 검증/확인 단계
- [ ] 품질이 중요한 작업에 피드백 루프 포함

**테스트**

- [ ] 최소 세 개의 평가 생성됨
- [ ] Haiku, Sonnet, Opus로 테스트됨(사용 대상 모델 기준)
- [ ] 실제 사용 시나리오로 테스트됨
- [ ] 팀 피드백 통합됨 (해당하는 경우)

## 관련 문서

- Agent Skills 시작하기: `https://platform.claude.com/docs/ko/agents-and-tools/agent-skills/quickstart`
- Skill 개요: `https://platform.claude.com/docs/ko/agents-and-tools/agent-skills/overview`
- Claude Code에서 Skill 사용하기: `https://code.claude.com/docs/en/skills` (이 플러그인의 `skill-docs/`가 이 문서의 스냅샷)
- API로 Skill 사용하기: `https://platform.claude.com/docs/ko/build-with-claude/skills-guide`
