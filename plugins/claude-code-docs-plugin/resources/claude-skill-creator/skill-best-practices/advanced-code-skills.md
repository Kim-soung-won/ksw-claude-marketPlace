# skill-best-practices — 고급: 실행 가능한 코드가 있는 Skill(오류 처리, 유틸리티 스크립트, 시각적 분석, 계획-검증-실행 패턴, 패키지 종속성, 런타임 환경, MCP 도구 참조), 기술 참고 사항

> 출처: https://platform.claude.com/docs/ko/agents-and-tools/agent-skills/best-practices
> (Claude Developer Platform 공식 문서, 2026-07-02 스냅샷)
> 이 파일은 `skill-best-practices/index.md`에서 분리된 하위 문서다.
> 전체 목차와 공유 전 체크리스트는 index.md를 먼저 확인한다.

---

## 고급: 실행 가능한 코드가 있는 Skill

Skill이 마크다운 지침만 사용한다면 이 절은 건너뛰고 아래 "효과적인 Skill을
위한 체크리스트"로 이동해도 된다.

### 해결하되, 떠넘기지 마세요

Skill용 스크립트를 작성할 때 오류 조건을 Claude에게 떠넘기지 말고 직접
처리한다.

```python
def process_file(path):
    """Process a file, creating it if it doesn't exist."""
    try:
        with open(path) as f:
            return f.read()
    except FileNotFoundError:
        # 실패하는 대신 기본 콘텐츠로 파일 생성
        print(f"File {path} not found, creating default")
        with open(path, "w") as f:
            f.write("")
        return ""
    except PermissionError:
        # 실패하는 대신 대안 제공
        print(f"Cannot access {path}, using default")
        return ""
```

나쁜 예: `return open(path).read()`처럼 실패를 그대로 Claude에게 떠넘기는
코드.

구성 매개변수도 "부두 상수"(Ousterhout의 법칙)를 피하기 위해 정당화되고
문서화되어야 한다:

```python
# HTTP 요청은 일반적으로 30초 이내에 완료됩니다
# 더 긴 타임아웃은 느린 연결을 고려한 것입니다
REQUEST_TIMEOUT = 30

# 세 번의 재시도는 안정성과 속도 간의 균형을 맞춥니다
MAX_RETRIES = 3
```

`TIMEOUT = 47  # Why 47?`처럼 근거 없는 매직 넘버는 피한다.

### 유틸리티 스크립트 제공하기

Claude가 스크립트를 작성할 수 있더라도 미리 만들어진 스크립트는 생성된
코드보다 더 안정적이고, 토큰을 절약하며, 사용 전반에 걸쳐 일관성을
보장한다.

지침에서 Claude가 다음 중 무엇을 해야 하는지 명확히 한다:

- **스크립트 실행** (가장 일반적): "필드를 추출하려면 `analyze_form.py`를
  실행하라"
- **참조로 읽기** (복잡한 로직의 경우): "필드 추출 알고리즘은
  `analyze_form.py`를 참조하라"

대부분의 유틸리티 스크립트는 실행이 더 안정적이고 효율적이므로 선호된다.

### 시각적 분석 사용하기

입력을 이미지로 렌더링할 수 있는 경우 Claude가 분석하도록 한다(예: PDF를
이미지로 변환한 뒤 각 페이지 이미지로 양식 필드 위치·유형을 시각적으로
식별). Claude의 비전 기능은 레이아웃과 구조를 이해하는 데 도움이 된다.

### 검증 가능한 중간 출력 생성하기

Claude가 복잡하고 개방형인 작업을 수행할 때 실수를 할 수 있다. **"계획 →
검증 → 실행" 패턴**은 Claude가 먼저 구조화된 형식(예: `changes.json`)으로
계획을 만든 다음, 실행하기 전에 스크립트로 해당 계획을 검증하도록 하여
오류를 조기에 포착한다.

이 패턴이 작동하는 이유: 오류를 조기에 포착하고, 스크립트로 기계 검증
가능하며, 원본을 건드리지 않고 계획을 반복할 수 있고, 오류 메시지가 특정
문제를 가리켜 디버깅이 명확하다. **사용 시기**: 일괄 작업, 파괴적 변경,
복잡한 검증 규칙, 고위험 작업. 검증 스크립트는 "Field 'signature_date' not
found. Available fields: customer_name, order_total,
signature_date_signed"처럼 구체적인 오류 메시지를 내도록 만든다.

### 패키지 종속성

Skill은 플랫폼별 제한이 있는 코드 실행 환경에서 실행된다: claude.ai는
npm/PyPI 패키지 설치와 GitHub 저장소 가져오기를 지원하지만, Claude API
환경은 네트워크 액세스와 런타임 패키지 설치가 없다. SKILL.md에 필요한
패키지를 나열하고 대상 실행 환경에서 사용 가능한지 확인한다.

### 런타임 환경이 작성에 미치는 영향

- **파일 경로가 중요하다**: Claude는 파일 시스템처럼 Skill 디렉터리를
  탐색한다. 슬래시(`reference/guide.md`)를 사용한다
- **파일 이름을 설명적으로 짓는다**: `doc2.md`가 아니라
  `form_validation_rules.md`
- **발견을 위해 구성한다**: 도메인·기능별 디렉터리(`reference/finance.md`,
  `reference/sales.md`)로 구조화한다. `docs/file1.md`, `docs/file2.md` 같은
  구성은 피한다
- **포괄적인 리소스를 번들로 묶는다**: 완전한 API 문서·광범위한 예시·대규모
  데이터셋을 포함해도 된다. 접근할 때까지 컨텍스트 페널티가 없다
- **결정적 작업에는 스크립트를 선호한다**: Claude에게 검증 코드를
  생성하도록 요청하는 대신 `validate_form.py`를 미리 작성해 둔다
- **실행 의도를 명확히 한다**: "실행하라" vs "참조로 읽어라"를 구분해서
  지시한다
- **파일 접근 패턴을 테스트한다**: 실제 요청으로 테스트해 Claude가 디렉터리
  구조를 실제로 탐색할 수 있는지 확인한다

사용자가 수익에 대해 질문하면 Claude는 SKILL.md를 읽고, `reference/finance.md`에
대한 참조를 확인한 다음, 그 파일만 읽는다. `sales.md`·`product.md`는 필요할
때까지 컨텍스트 토큰을 전혀 소비하지 않는다 — 이 파일 시스템 기반 모델이
점진적 공개를 가능하게 한다.

### MCP 도구 참조

Skill이 MCP 도구를 사용하는 경우 "tool not found" 오류를 방지하기 위해
항상 정규화된 도구 이름(`ServerName:tool_name`)을 사용한다. 예:
"Use the BigQuery:bigquery_schema tool to retrieve table schemas." 서버
접두사가 없으면 여러 MCP 서버가 연결된 환경에서 Claude가 도구를 찾지
못할 수 있다.

### 도구가 설치되어 있다고 가정하지 마세요

"Use the pdf library to process the file"처럼 패키지가 이미 있다고
가정하지 않는다. "Install required package: `pip install pypdf`. Then use
it: ..."처럼 설치 방법을 명시한다.

## 기술 참고 사항

- **YAML frontmatter 요구 사항**: 위 "YAML frontmatter 필수 필드" 절 참고.
- **토큰 예산**: 최적의 성능을 위해 SKILL.md 본문을 500줄 미만으로
  유지한다. 초과하면 점진적 공개 패턴으로 별도 파일로 분할한다.


---

## 관련 파일

- [index.md](index.md) — 전체 목차, 공유 전 체크리스트, 라우팅 표
- [core-writing.md](core-writing.md)
- [workflows-and-content.md](workflows-and-content.md)
- [evaluation-and-antipatterns.md](evaluation-and-antipatterns.md)
