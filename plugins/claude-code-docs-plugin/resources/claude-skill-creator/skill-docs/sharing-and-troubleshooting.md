# skill-docs — Skills 평가 및 반복, Skills 공유, 문제 해결(트리거 안 됨/과다 트리거/설명 잘림), 관련 리소스

> 출처: https://code.claude.com/docs/ko/skills (Claude Code 공식 문서, 2026-07-02 스냅샷)
> 이 파일은 `skill-docs/index.md`에서 분리된 하위 문서다. 전체 목차와
> frontmatter 필드 요약은 index.md를 먼저 확인한다.

---

## Skills 평가 및 반복

skill이 트리거되는 것을 보는 것은 Claude가 이를 찾았다는 뜻이지, 의도한 대로
작동했다는 뜻이 아닙니다. skill이 작동하는지 알기 위해 두 가지를 별도로
측정합니다: Claude가 호출해야 하는 프롬프트에서 호출하는지 여부, 그리고
호출할 때 출력이 예상과 일치하는지 여부입니다.

둘 다에 대한 확인은 기준선 비교입니다. 몇 가지 현실적인 프롬프트를 수집하고,
skill을 사용 가능하게 한 새로운 세션에서 각각을 실행한 다음 비활성화된
상태에서 다시 실행하고, 결과를 비교합니다. 새로운 세션이 중요합니다. skill
작성의 남은 컨텍스트가 작성된 지침의 간격을 숨기기 때문입니다.

### skill-creator로 evals 실행

`skill-creator` 플러그인은 Claude Code 내에서 비교 루프를 자동화합니다.
공식 마켓플레이스에서 설치합니다:

```text
/plugin install skill-creator@claude-plugins-official
```

Claude Code가 플러그인을 마켓플레이스에서 찾을 수 없다고 보고하면,
마켓플레이스가 누락되었거나 오래되었습니다. `/plugin marketplace update
claude-plugins-official`를 실행하여 새로 고치거나, 아직 추가하지 않았다면
`/plugin marketplace add anthropics/claude-plugins-official`를 실행합니다.
그 다음 설치를 다시 시도합니다.

설치 후 `/reload-plugins`를 실행하여 현재 세션에서 플러그인의 skills를 사용
가능하게 합니다. 그 다음 Claude에게 기존 skill을 평가하도록 요청합니다.
예를 들어 `evaluate my summarize-changes skill with skill-creator`. 플러그인은
테스트 케이스를 작성하고 루프를 실행하도록 안내합니다:

- **테스트 케이스**: skill 디렉토리 내의 `evals/evals.json`에 프롬프트, 입력
  파일 및 예상 동작을 저장합니다.
- **격리된 실행**: 각 테스트 케이스당 subagent를 생성하므로 각 실행이 깨끗한
  컨텍스트로 시작되고, 토큰 수와 기간을 기록합니다.
- **채점**: 각 어설션을 출력에 대해 확인하고 `grading.json`에 증거와 함께
  통과 또는 실패를 작성합니다.
- **벤치마크**: skill 있음 대 skill 없음에 대한 통과율, 시간 및 토큰을
  `benchmark.json`에 집계하므로 토큰 및 시간 오버헤드에 대한 통과율 개선을
  비교할 수 있습니다.
- **버전 비교**: skill의 두 버전 간에 블라인드 A/B를 실행하므로 커밋하기 전에
  편집이 개선인지 확인할 수 있습니다.
- **설명 튜닝**: 트리거해야 하고 트리거하지 않아야 하는 프롬프트를 생성하고,
  히트율을 측정하고, skill이 잘못된 요청에서 활성화될 때 설명 편집을
  제안합니다.
- **리뷰 뷰어**: 각 출력을 검사하고 다음 반복이 읽을 정성적 피드백을 기록할
  수 있는 HTML 보고서를 엽니다.

## Skills 공유

Skills는 대상에 따라 다양한 범위에서 배포할 수 있습니다:

- **프로젝트 skills**: `.claude/skills/`를 버전 제어에 커밋합니다.
- **플러그인**: 플러그인에서 `skills/` 디렉토리를 생성합니다.
- **관리**: 관리 설정을 통해 조직 전체에 배포합니다.

### 시각적 출력 생성

Skills는 모든 언어의 스크립트를 번들하고 실행할 수 있으므로 Claude에게 단일
프롬프트로 가능한 것 이상의 기능을 제공합니다. 강력한 패턴 중 하나는 시각적
출력을 생성하는 것입니다: 브라우저에서 열리는 대화형 HTML 파일로 데이터 탐색,
디버깅 또는 보고서 생성에 사용됩니다. 전체 예제(코드베이스 탐색기 skill)는
이 문서 끝의 "부록: 시각적 출력 skill 전체 예제"를 참고한다.

## 문제 해결

### Skill이 트리거되지 않음

Claude가 예상대로 skill을 사용하지 않는 경우:

1. 설명에 사용자가 자연스럽게 말할 키워드가 포함되어 있는지 확인합니다.
2. skill이 `What skills are available?`에 나타나는지 확인합니다.
3. 설명과 더 가깝게 일치하도록 요청을 다시 표현해봅니다.
4. skill이 사용자 호출 가능하면 `/skill-name`으로 직접 호출합니다.

frontmatter YAML이 잘못된 형식이면, Claude Code는 skill 본문을 빈 메타데이터로
로드하므로 `/skill-name`은 여전히 작동하지만 Claude는 일치시킬 `description`이
없습니다. `--debug`로 실행하여 구문 분석 오류를 확인합니다.

### Skill이 너무 자주 트리거됨

Claude가 원하지 않을 때 skill을 사용하는 경우:

1. 설명을 더 구체적으로 만듭니다.
2. 수동 호출만 원하면 `disable-model-invocation: true`를 추가합니다.

### Skill 설명이 잘림

Skill 설명은 Claude가 사용 가능한 항목을 알 수 있도록 컨텍스트에 로드됩니다.
모든 skill 이름은 항상 포함되지만, 많은 skills가 있으면 설명이 단축되어 문자
예산에 맞출 수 있으며, 이는 Claude가 요청과 일치하는 데 필요한 키워드를 제거할
수 있습니다. 예산은 모델의 컨텍스트 윈도우의 1%에서 확장됩니다. 예산이
초과되면, 가장 적게 호출하는 skills의 설명이 먼저 삭제되므로 실제로 사용하는
skills는 전체 텍스트를 유지합니다. `/doctor`를 실행하여 얼마나 많은 skill
설명이 단축되거나 삭제되었는지, 어떤 skills가 영향을 받는지 확인합니다.

v2.1.196부터 `/context`의 Skills 행은 예산이 적용된 후의 목록 크기를
보고하므로 모델이 수신하는 것과 일치합니다. 이전 버전은 모든 설명의 전체
텍스트를 계산했으므로 행이 예산 `/doctor`가 보고하는 값보다 몇 배 더 큰 값을
표시할 수 있습니다.

예산을 높이려면 `skillListingBudgetFraction` 설정(예: `0.02` = 2%)을 설정하거나
`SLASH_COMMAND_TOOL_CHAR_BUDGET` 환경 변수를 고정 문자 수로 설정합니다. 다른
skills를 위해 예산을 확보하려면 `skillOverrides`에서 낮은 우선순위 항목을
`"name-only"`로 설정하여 설명 없이 나열되도록 합니다. 또한 소스에서
`description` 및 `when_to_use` 텍스트를 자를 수 있습니다: 주요 사용 사례를
먼저 배치합니다. 각 항목의 결합된 텍스트는 예산과 관계없이 1,536자로 제한되기
때문입니다. 이 제한은 `skillListingMaxDescChars`로 구성할 수 있습니다.

## 관련 리소스

- 구성 디버깅: skill이 나타나지 않거나 트리거되지 않는 이유 진단
- Skill 출력 품질 평가: agentskills.io의 eval 파일 형식 및 반복 워크플로우
- Skill 작성 모범 사례: Claude 제품 전체에 적용되는 작성 지침
- Subagents: 특화된 에이전트에 작업 위임 (`subagent-creator/subagent-docs/index.md` 참고)
- 플러그인: 다른 확장과 함께 skills 패키징 및 배포
- Hooks: 도구 이벤트 주변 워크플로우 자동화
- 메모리: 지속적인 컨텍스트를 위한 CLAUDE.md 파일 관리
- 명령어: 기본 제공 명령어 및 번들 skills 참조
- 권한: 도구 및 skill 액세스 제어

---


---

## 관련 파일

- [index.md](index.md) — 전체 목차, frontmatter 필드 요약, 라우팅 표
- [storage-and-config.md](storage-and-config.md)
- [configuration-reference.md](configuration-reference.md)
- [advanced-patterns.md](advanced-patterns.md)
- [visualizer-example.md](visualizer-example.md)
