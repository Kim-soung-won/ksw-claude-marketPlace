# skill-best-practices — 핵심 원칙(간결함·자유도·모델별 테스트) + Skill 구조(YAML 필수 필드·명명 규칙·description 작성·점진적 공개 패턴)

> 출처: https://platform.claude.com/docs/ko/agents-and-tools/agent-skills/best-practices
> (Claude Developer Platform 공식 문서, 2026-07-02 스냅샷)
> 이 파일은 `skill-best-practices/index.md`에서 분리된 하위 문서다.
> 전체 목차와 공유 전 체크리스트는 index.md를 먼저 확인한다.

---

## 핵심 원칙

### 간결함이 핵심입니다

컨텍스트 윈도우는 공공재다. Skill은 Claude가 알아야 하는 다른 모든 것(시스템
프롬프트, 대화 기록, 다른 Skill의 메타데이터, 실제 요청)과 컨텍스트 윈도우를
공유한다.

Skill의 모든 토큰이 즉각적인 비용을 발생시키는 것은 아니다. 시작 시에는 모든
Skill의 메타데이터(name 및 description)만 미리 로드된다. Claude는 Skill이
관련성을 갖게 될 때만 SKILL.md를 읽고, 필요할 때만 추가 파일을 읽는다. 그러나
SKILL.md에서 간결함을 유지하는 것은 여전히 중요하다 — Claude가 이를 로드하면
모든 토큰이 대화 기록 및 기타 컨텍스트와 경쟁하기 때문이다.

**기본 가정: Claude는 이미 매우 똑똑하다.** Claude가 아직 가지고 있지 않은
컨텍스트만 추가한다. 각 정보에 대해 다음과 같이 질문한다:

- "Claude가 정말 이 설명이 필요한가?"
- "Claude가 이것을 알고 있다고 가정할 수 있는가?"
- "이 단락이 토큰 비용을 정당화하는가?"

**좋은 예: 간결함** (약 50 토큰):

````markdown
## Extract PDF text

Use pdfplumber for text extraction:

```python
import pdfplumber

with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```
````

**나쁜 예: 너무 장황함** (약 150 토큰) — PDF가 무엇인지, 라이브러리 설치
방법부터 설명하는 배경 지식 나열. 간결한 버전은 Claude가 PDF가 무엇인지,
라이브러리가 어떻게 작동하는지 이미 알고 있다고 가정한다.

### 적절한 자유도 설정

구체성의 수준을 작업의 취약성과 가변성에 맞춘다.

| 자유도 | 형태 | 사용 시점 | 예시 |
|---|---|---|---|
| 높음 | 텍스트 기반 지침 | 여러 접근 방식이 유효하거나, 결정이 컨텍스트에 따라 달라지거나, 휴리스틱이 접근 방식을 안내하는 경우 | "코드 구조를 분석하고, 버그 가능성을 확인하고, 가독성 개선을 제안하라" |
| 중간 | 의사 코드 또는 매개변수가 있는 스크립트 | 선호되는 패턴이 존재하지만 일부 변형이 허용되는 경우 | `generate_report(data, format="markdown", include_charts=True)` 같은 템플릿 함수 |
| 낮음 | 특정 스크립트, 매개변수 거의 없음 | 작업이 취약하고 오류가 발생하기 쉽거나, 일관성이 중요하거나, 특정 순서를 따라야 하는 경우 | "정확히 이 스크립트를 실행하라: `python scripts/migrate.py --verify --backup`. 명령을 수정하거나 플래그를 추가하지 마라" |

**비유**: Claude를 경로를 탐색하는 로봇이라고 생각한다. 양쪽에 절벽이 있는
좁은 다리(안전한 길이 하나뿐)에서는 구체적인 가드레일과 정확한 지침(낮은
자유도)을 준다 — 예: 정확한 순서로 실행되어야 하는 DB 마이그레이션. 위험
요소가 없는 넓은 들판(많은 경로가 성공으로 이어짐)에서는 일반적인 방향만
제시하고 Claude가 최선의 경로를 찾도록 신뢰한다(높은 자유도) — 예: 컨텍스트에
따라 최선의 접근 방식이 결정되는 코드 리뷰.

### 사용하려는 모든 모델로 테스트하기

Skill은 모델에 대한 추가 기능으로 작동하므로 효과는 기본 모델에 따라
달라진다. Haiku(빠르고 경제적)에서는 충분한 지침을 제공하는지, Sonnet(균형
잡힘)에서는 명확하고 효율적인지, Opus(강력한 추론)에서는 과도한 설명을
피하는지 각각 확인한다. Opus에서 완벽하게 작동하는 것이 Haiku에서는 더 많은
세부 정보가 필요할 수 있다.

## Skill 구조

### YAML frontmatter 필수 필드

- `name`: 최대 64자, 소문자·숫자·하이픈만 포함, XML 태그 불가, "anthropic"·
  "claude" 같은 예약어 불가
- `description`: 비어 있지 않아야 함, 최대 1024자, XML 태그 불가, Skill이
  무엇을 하는지와 언제 사용하는지를 설명해야 함

> Claude Code에서 실제로 지원되는 전체 frontmatter 필드 목록(예:
> `disable-model-invocation`, `context: fork`, `allowed-tools` 등)은
> `skill-docs/index.md`의 필드 표(문법·예시가 더 필요하면
> `skill-docs/configuration-reference.md`)를 따른다. 이 문서의 `name`/
> `description` 제약(64자·1024자·예약어 등)은 그 위에 추가로 지켜야 할
> 작성 규칙이다.

### 명명 규칙

Skill을 참조하고 논의하기 쉽도록 일관된 명명 패턴을 사용한다. **동명사
형태**(동사 + -ing)를 우선 고려한다 — Skill이 제공하는 활동이나 기능을
명확하게 설명한다.

- **좋은 예 (동명사 형태)**: `processing-pdfs`, `analyzing-spreadsheets`,
  `managing-databases`, `testing-code`, `writing-documentation`
- **허용 가능한 대안**: 명사구(`pdf-processing`, `spreadsheet-analysis`),
  동작 지향(`process-pdfs`, `analyze-spreadsheets`)
- **피해야 할 것**: 모호한 이름(`helper`, `utils`, `tools`), 지나치게 일반적인
  이름(`documents`, `data`, `files`), 예약어(`anthropic-helper`,
  `claude-tools`), 같은 저장소 안에서 일관성 없는 패턴

### 효과적인 description 작성

`description`은 Skill 발견을 가능하게 하며, **무엇을 하는지와 언제
사용하는지를 모두** 포함해야 한다. Claude는 이를 사용해 잠재적으로 100개
이상의 사용 가능한 Skill 중에서 올바른 Skill을 선택한다.

> **항상 3인칭으로 작성한다.** description은 시스템 프롬프트에 주입되며,
> 일관되지 않은 시점은 발견 문제를 일으킬 수 있다.
> - 좋음: "Processes Excel files and generates reports"
> - 피해야 함: "I can help you process Excel files"
> - 피해야 함: "You can use this to process Excel files"

**구체적으로 작성하고 핵심 용어를 포함한다.**

효과적인 예시:

```yaml
description: Extract text and tables from PDF files, fill forms, merge documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
```

```yaml
description: Analyze Excel spreadsheets, create pivot tables, generate charts. Use when analyzing Excel files, spreadsheets, tabular data, or .xlsx files.
```

```yaml
description: Generate descriptive commit messages by analyzing git diffs. Use when the user asks for help writing commit messages or reviewing staged changes.
```

모호한 description은 피한다: `"Helps with documents"`, `"Processes data"`,
`"Does stuff with files"`.

**부정 경계문을 넣지 않는다(1순위 안티패턴 — 아이러니 과정 이론 / '분홍 코끼리 효과').**
"이 Skill은 X에는 쓰지 않는다", "Y와는 다르다"처럼 배제 대상을 부정문으로 명시하면,
description은 Skill 발견(트리거)에 쓰이는 텍스트이므로 그 배제 대상의 키워드가 오히려
이 Skill과 연관되어 **잘못된 트리거**를 부른다. 겹치는 다른 Skill과의 구분은 이 Skill이
실제로 트리거돼야 하는 파일 유형·작업·키워드를 **긍정형으로 더 구체화**해서 해결하고,
배제 대상의 이름·키워드는 description에 쓰지 않는다.

### 점진적 공개 패턴

SKILL.md는 온보딩 가이드의 목차처럼, 필요에 따라 Claude를 상세 자료로
안내하는 개요 역할을 한다.

**실용적인 지침**:

- 최적의 성능을 위해 SKILL.md 본문을 500줄 미만으로 유지한다
- 이 제한에 근접하면 콘텐츠를 별도의 파일로 분할한다

전체 Skill 디렉터리 구조 예시:

```text
pdf/
├── SKILL.md              # Main instructions (loaded when triggered)
├── FORMS.md              # Form-filling guide (loaded as needed)
├── reference.md          # API reference (loaded as needed)
├── examples.md           # Usage examples (loaded as needed)
└── scripts/
    ├── analyze_form.py   # Utility script (executed, not loaded)
    ├── fill_form.py      # Form filling script
    └── validate.py       # Validation script
```

#### 패턴 1: 참조가 있는 상위 수준 가이드

````markdown
---
name: pdf-processing
description: Extracts text and tables from PDF files, fills forms, and merges documents. Use when working with PDF files or when the user mentions PDFs, forms, or document extraction.
---

# PDF Processing

## Quick start

Extract text with pdfplumber:
```python
import pdfplumber
with pdfplumber.open("file.pdf") as pdf:
    text = pdf.pages[0].extract_text()
```

## Advanced features

**Form filling**: See [FORMS.md](FORMS.md) for complete guide
**API reference**: See [REFERENCE.md](REFERENCE.md) for all methods
**Examples**: See [EXAMPLES.md](EXAMPLES.md) for common patterns
````

Claude는 필요할 때만 FORMS.md, REFERENCE.md 또는 EXAMPLES.md를 로드한다.

#### 패턴 2: 도메인별 구성

여러 도메인이 있는 Skill의 경우, 관련 없는 컨텍스트를 로드하지 않도록
도메인별로 콘텐츠를 구성한다. 사용자가 영업 지표에 대해 질문할 때 Claude는
재무나 마케팅 데이터가 아닌 영업 관련 스키마만 읽으면 된다.

```text
bigquery-skill/
├── SKILL.md (overview and navigation)
└── reference/
    ├── finance.md (revenue, billing metrics)
    ├── sales.md (opportunities, pipeline)
    ├── product.md (API usage, features)
    └── marketing.md (campaigns, attribution)
```

SKILL.md에서는 각 도메인 파일을 나열하고, `grep`으로 특정 지표를 빠르게
검색하는 명령을 함께 제시한다(예: `grep -i "revenue" reference/finance.md`).

#### 패턴 3: 조건부 세부 정보

기본 콘텐츠를 표시하고 고급 콘텐츠로 링크한다. 예: "간단한 편집은 XML을
직접 수정하라. **추적 변경이 필요하면**: [REDLINING.md](REDLINING.md) 참고."
Claude는 사용자가 해당 기능이 필요할 때만 링크된 파일을 읽는다.

### 깊게 중첩된 참조 피하기

Claude는 다른 참조 파일에서 참조된 파일을 부분적으로(`head -100` 등) 미리볼
수 있으며, 이로 인해 불완전한 정보가 발생할 수 있다. **참조는 SKILL.md에서
한 단계 깊이로 유지한다** — 모든 참조 파일은 SKILL.md에서 직접 링크되어야
Claude가 필요할 때 전체 파일을 읽는다.

- 나쁜 예: SKILL.md → advanced.md → details.md (두 단계 이상 중첩)
- 좋은 예: SKILL.md에서 advanced.md, reference.md, examples.md로 각각 직접
  링크(한 단계)

### 긴 참조 파일은 목차로 구조화하기

100줄보다 긴 참조 파일의 경우 상단에 목차를 포함한다. Claude가 부분 읽기로
미리볼 때도 사용 가능한 정보의 전체 범위를 볼 수 있게 하기 위함이다.

```markdown
# API Reference

## Contents
- Authentication and setup
- Core methods (create, read, update, delete)
- Advanced features (batch operations, webhooks)
- Error handling patterns
- Code examples

## Authentication and setup
...
```


---

## 관련 파일

- [index.md](index.md) — 전체 목차, 공유 전 체크리스트, 라우팅 표
- [workflows-and-content.md](workflows-and-content.md)
- [evaluation-and-antipatterns.md](evaluation-and-antipatterns.md)
- [advanced-code-skills.md](advanced-code-skills.md)
