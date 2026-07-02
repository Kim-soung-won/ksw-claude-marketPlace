# skill-best-practices — 평가 및 반복(평가 주도 개발, Claude A/B 반복 개발, 탐색 방식 관찰), 피해야 할 안티패턴(Windows 경로, 과도한 옵션)

> 출처: https://platform.claude.com/docs/ko/agents-and-tools/agent-skills/best-practices
> (Claude Developer Platform 공식 문서, 2026-07-02 스냅샷)
> 이 파일은 `skill-best-practices/index.md`에서 분리된 하위 문서다.
> 전체 목차와 공유 전 체크리스트는 index.md를 먼저 확인한다.

---

## 평가 및 반복

### 평가를 먼저 구축하기

**광범위한 문서를 작성하기 전에 평가를 만든다.** 이렇게 하면 Skill이
상상한 문제가 아닌 실제 문제를 해결하도록 보장한다.

**평가 주도 개발**:

1. **격차 식별**: Skill 없이 대표적인 작업에서 Claude를 실행하고 구체적인
   실패·누락 컨텍스트를 문서화한다
2. **평가 생성**: 이러한 격차를 테스트하는 세 가지 이상의 시나리오를
   구축한다
3. **기준선 설정**: Skill 없이 Claude의 성능을 측정한다
4. **최소한의 지침 작성**: 격차를 해결하고 평가를 통과하기에 충분한
   콘텐츠만 작성한다
5. **반복**: 평가를 실행하고, 기준선과 비교하고, 개선한다

평가 예시 구조:

```json
{
  "skills": ["pdf-processing"],
  "query": "Extract all text from this PDF file and save it to output.txt",
  "files": ["test-files/document.pdf"],
  "expected_behavior": [
    "Successfully reads the PDF file using an appropriate PDF processing library or command-line tool",
    "Extracts text content from all pages in the document without missing any pages",
    "Saves the extracted text to a file named output.txt in a clear, readable format"
  ]
}
```

> **참고**: 이는 데이터 기반 평가의 예시 구조다. 내장 실행기가 없다면 직접
> 평가 루프(subagent로 각 시나리오 실행 → 기대 동작과 대조)를 구성한다.
> Claude Code 환경에서는 `skill-creator` 플러그인의 evals 기능
> (`skill-docs/sharing-and-troubleshooting.md`의 "skill-creator로 evals 실행"
> 절)을 사용할 수 있다.

### Claude와 함께 반복적으로 Skill 개발하기

가장 효과적인 개발 프로세스는 두 개의 Claude 인스턴스를 활용한다: 하나
("Claude A")는 지침을 설계·개선하고, 다른 하나("Claude B")는 그 Skill을
실제 작업에서 사용한다.

**새 Skill 만들기**:

1. Skill 없이 일반 프롬프팅으로 작업을 완료하며, 반복적으로 제공하게 되는
   컨텍스트·선호 사항·절차적 지식이 무엇인지 주목한다
2. 유사한 향후 작업에 유용할 재사용 가능한 패턴을 식별한다
3. "방금 사용한 이 패턴을 캡처하는 Skill을 만들어 달라"고 요청한다
4. 불필요한 설명이 들어갔으면 제거를 요청한다("Claude는 이미 그것을 알고
   있다")
5. 정보 아키텍처(참조 파일 분리 등)를 개선하도록 요청한다
6. 유사한 작업에서 새 Claude 인스턴스와 함께 Skill을 테스트하고, 올바른
   정보를 찾는지·규칙을 올바르게 적용하는지 관찰한다
7. 관찰한 구체적 실패를 가지고 다시 개선을 요청한다("Q4 날짜 필터링을
   잊었다. 관련 섹션을 추가해야 할까?")

**기존 Skill 반복하기**: 동일한 관찰(observe) → 개선(improve) → 테스트(test)
주기를 실제 워크플로에서 계속한다. 규칙이 지켜지지 않으면 재구성하거나,
"always" 대신 "MUST" 같은 더 강한 언어를 쓰거나, 워크플로 섹션을 재배치하는
것을 고려한다.

**팀 피드백 수집하기**: Skill이 예상대로 활성화되는지, 지침이 명확한지,
무엇이 누락되었는지 팀원에게 질문하고 피드백을 통합한다.

### Claude가 Skill을 탐색하는 방식 관찰하기

- **예상치 못한 탐색 경로**: Claude가 예상 못한 순서로 파일을 읽으면 구조가
  직관적이지 않다는 신호일 수 있다
- **놓친 연결**: 중요한 참조를 따르지 못하면 링크를 더 명시적으로 만든다
- **특정 섹션에 대한 과도한 의존**: 같은 파일을 반복적으로 읽으면 그
  콘텐츠가 주 SKILL.md에 있어야 하는지 고려한다
- **무시된 콘텐츠**: 번들 파일에 전혀 접근하지 않으면 불필요하거나 주
  지침에서 제대로 신호되지 않은 것이다

`name`과 `description`은 Claude가 현재 작업에 대한 응답으로 Skill을
트리거할지 결정할 때 사용하는 가장 중요한 신호이므로 특히 신경 쓴다.

## 피해야 할 안티패턴

### Windows 스타일 경로 피하기

Windows에서도 파일 경로에는 항상 슬래시를 사용한다: `scripts/helper.py`
(좋음) vs `scripts\helper.py`(피해야 함). Unix 스타일 경로는 모든
플랫폼에서 작동하지만 Windows 스타일 경로는 Unix 시스템에서 오류를
발생시킨다.

### 너무 많은 옵션 제공 피하기

필요하지 않은 한 여러 접근 방식을 나열하지 않는다. "pypdf, pdfplumber,
PyMuPDF, pdf2image 중 아무거나 쓰라"처럼 선택지를 나열하는 대신, 기본값을
제시하고 예외 상황에 대한 대안만 짧게 덧붙인다: "텍스트 추출에는
pdfplumber를 쓰라. OCR이 필요한 스캔 PDF에는 pdf2image + pytesseract를
대신 쓰라."


---

## 관련 파일

- [index.md](index.md) — 전체 목차, 공유 전 체크리스트, 라우팅 표
- [core-writing.md](core-writing.md)
- [workflows-and-content.md](workflows-and-content.md)
- [advanced-code-skills.md](advanced-code-skills.md)
