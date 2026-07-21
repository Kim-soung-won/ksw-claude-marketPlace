# 정의 파일 검증기

이 저장소는 빌드·패키지 매니저가 없다. 대신 의존성 0의 Node 스크립트가
에이전트·스킬 정의와 매니페스트의 정합성을 검사한다.

`.githooks/pre-commit` 이 커밋마다 자동 실행하므로 **평소에 직접 돌릴 필요는 없다.**
아래는 검증기를 수정하거나, 커밋이 막힌 이유를 확인할 때 참조한다.

## 실행

```bash
node scripts/validate-all.js        # 전체
node scripts/validate-agents.js     # 개별
```

`validate-all.js` 는 앞선 검증기가 실패해도 중단하지 않고 전부 실행한다 —
커밋 한 번에 모든 문제를 보여주기 위함이다.

## 검증기별 규칙

| 검증기 | 검사 내용 |
|--------|-----------|
| `validate-manifests.js` | `marketplace.json` ↔ `plugin.json` 동기화, 이름 3자 일치(marketplace 항목·디렉터리명·매니페스트 `name`), SemVer 형식, 등재되지 않은 플러그인 |
| `validate-agents.js` | frontmatter 필수 필드(`name`·`description`), 파일명 = `name`, `model` 허용값(`haiku`/`sonnet`/`opus`/`inherit`), `description` 리터럴 블록 스칼라 금지, `tools` 미선언 경고 |
| `validate-skills.js` | `SKILL.md` 존재·비어있지 않음, 디렉터리명 = `name`, `description` 규격 |
| `validate-personal-paths.js` | `/Users/<name>`, `C:\Users\<name>` 하드코딩 검출 |

공용 모듈은 `lib/frontmatter.js`(YAML frontmatter 파서)와
`lib/repo.js`(플러그인 순회·리포터)에 있다.

## ERROR 와 WARN

- **ERROR** — 커밋을 막는다. 설치된 환경에서 실제로 깨지는 결함이다.
- **WARN** — 출력만 하고 통과시킨다. 설계 원칙 위반 후보지만 정당한 예외가 있을 수 있다.

우회가 필요하면 `SKIP_VALIDATE=1 git commit ...`. `--no-verify` 는 버전 자동 상승
훅까지 함께 꺼버리므로 쓰지 않는다.

## 규칙의 근거

- **파일명/디렉터리명 = `name`** — 설치 시 이 둘이 어긋나면 호출 이름과 파일 위치가
  달라져 추적이 불가능해진다. `CLAUDE.md` 규약.
- **`description` 에 리터럴 블록 스칼라(`|`, `|-`) 금지** — 개행이 보존돼
  `description` 을 한 줄 스칼라로 소비하는 쪽에서 깨진다. `description` 은 라벨이 아니라
  **위임 조건**이므로(설계 원칙 4) 깨지면 에이전트 호출 자체가 걸리지 않는다.
  여러 줄이 필요하면 폴디드 `>-` 를 쓴다.
- **`tools` 미선언 경고** — 스펙상 유효하며 전체 도구를 상속하지만,
  설계 원칙 5("도구는 최소 집합으로 스코핑한다")의 위반 후보다.
- **개인 절대 경로 금지** — 플러그인은 설치 시 별도 캐시 디렉터리로 복사되므로
  저작 머신의 절대 경로는 전부 깨진다. `${CLAUDE_PLUGIN_ROOT}` 를 쓴다(설계 원칙 2).
  꺾쇠로 감싼 토큰(`<name>` 등)은 문서상의 자리표시자로 보고 통과시킨다.

## 훅 활성화

훅 경로는 git config라 커밋되지 않는다. 새로 clone한 머신에서 한 번 실행한다:

```bash
git config core.hooksPath .githooks
```
