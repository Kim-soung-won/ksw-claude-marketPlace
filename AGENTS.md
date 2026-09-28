# 저장소 개발 규약

이 저장소는 Claude Code와 Codex용 플러그인 마켓플레이스다.
문서·주석·에이전트 정의와 지시는 한국어로 작성한다.
주요 산출물은 에이전트·스킬 정의, 리소스 문서, 매니페스트이며 설치·검증·훅 코드도 관리한다.
패키지 매니저 기반 빌드 대신 `scripts/`의 검증기를 사용한다.

## 구조와 공통 원본

```text
.claude-plugin/marketplace.json       # Claude 카탈로그
.agents/plugins/marketplace.json      # Codex 카탈로그
plugins/<plugin-name>/
  .claude-plugin/plugin.json          # Claude 매니페스트
  .codex-plugin/plugin.json           # Codex 매니페스트
  skills/<skill>/                     # 두 제품이 공유하는 스킬
  resources/<agent>/                 # 상세 절차·도메인 규칙·출력 형식
    procedure.md                      # (이전 완료 에이전트) 호스트 중립 업무 절차 원본
  agents/<agent>.md                   # Claude 에이전트 진입점
  codex/agents/<agent>.json           # Codex 등록 템플릿 (procedure.md가 있으면 생성물)
  codex/runtime.md                    # Codex 실행 시 호스트 차이 (미이전 플러그인만)
```

- 배포 목록은 `README.md`와 두 카탈로그를 참고한다. 새 플러그인은 실제 스킬 진입점·리소스·필요한 실행 연결을 확인한 뒤 두 카탈로그와 두 매니페스트에 등록한다.
- 공통 지식은 `skills/`, 상세 규칙과 출력 형식은 `resources/`에 둔다. 필요한 시점에 읽으며 등록 템플릿에 복제하지 않는다.
- 공통 리소스의 상대 경로는 해당 문서 디렉터리 기준이다. 사용자명이나 개인 설치 경로를 하드코딩하지 않는다.
- 제품별 도구 이름·모델·권한·가격 설명은 공통 업무 규칙과 분리한다. `codex/runtime.md`는 호스트 차이만 설명하고 원본 업무 규칙과 출력 형식을 복제하지 않는다.
- 에이전트 업무 절차는 `resources/<agent>/procedure.md`에 호스트 중립으로 쓰고(상대 경로, 호스트 전용 도구명 금지), Claude 에이전트 본문과 공유 스킬은 이 문서를 가리키기만 한다. 이 경우 `codex/agents/<agent>.json`은 `node scripts/generate-codex-agents.js`로 Claude frontmatter에서 생성하며 직접 수정하지 않는다. 설명·권한은 Claude frontmatter 한 곳에서 고친다.

## 저술 원칙

1. **에이전트 정의는 얇게 유지한다.** 절차 전문·도메인 규칙·출력 형식은 `resources/<agent>/`로 분리한다. 에이전트 본문은 언제 어떤 문서를 읽고 어떤 순서로 수행할지 안내한다. 매 호출에서 불필요한 컨텍스트를 읽지 않도록 한다.
2. **큰 리소스는 `index.md`와 하위 파일로 나눈다.** 자주 필요한 요약은 인덱스에 두고, 상세 파일 선택은 인덱스의 라우팅 표로 안내한다. 에이전트 본문에 같은 표를 중복 기재하지 않는다.
3. **`description`에는 호출 조건과 예시를 쓴다.** 역할이 겹치면 자신의 요청·시점·용어를 긍정형으로 구체화한다. 배제할 역할의 이름·키워드를 부정문으로 나열하지 않는다. 다른 역할로의 위임·구분 안내는 본문에 둔다.
4. **도구와 권한은 업무에 필요한 최소 범위로 지정한다.** 실제 실행 호스트에서 지원하는 설정을 사용한다. 하위 에이전트가 직접 질문할 수 없으면 필요한 정보를 메인 에이전트에 반환한다.

역할 구분을 검토할 때는 `domain-skill-manager`와 `component-skill-manager`,
`subagent-evaluator`(스펙)·`subagent-cost-auditor`(비용·격리)·`subagent-creator`(생성·수정),
`fsd-structure-architect`(FSD 공식 7계층)와 팀 자체 4계층 담당의 경계를 참고한다.
각 정의의 description에는 자신의 호출 조건을 적고, 상세 위임 기준은 본문에서 안내한다.

## 버전과 배포

- 각 플러그인은 명시적 SemVer 버전을 사용한다. 플러그인 내용을 변경하면 버전을 올린다.
- 같은 플러그인의 두 `plugin.json`은 이름·버전·description을 맞춘다. 기능 추가는 minor 버전과 CHANGELOG를 직접 갱신한다. major 변경도 자동 patch 상승에 맡기지 않는다.
- `.githooks/pre-commit`은 변경된 기존 플러그인의 Claude 매니페스트 버전이 HEAD와 같으면 patch를 올리고 다시 스테이징한다. 이미 버전을 올렸거나 신규 플러그인이면 자동 상승하지 않는다. Codex 매니페스트 버전은 Claude 버전에 맞춰 동기화한다.
- 새 체크아웃에서는 `git config core.hooksPath .githooks`로 개발 훅을 활성화한다. 이 로컬 Git 설정은 커밋으로 공유되지 않는다.

## Codex 실행 연결

- `scripts/install-codex-agents.py --project <대상 프로젝트> --plugin <이름>` 또는 `--all`로 템플릿을 TOML로 변환한다. 등록 경로와 원본 참조를 검증한다.
- 사용자 파일은 덮어쓰지 않는다. 설치는 기본 미리보기이며 `--write`가 명시되면 등록한다.
- agent-factory의 Codex 수집은 공식 훅 입력을 자체 이벤트로 기록한다. 내부 transcript를 파싱하거나 미측정 비용을 0으로 채우지 않는다.
- 사용자 설치 방법과 지원 범위는 `docs/codex.md`를 참고한다.

## 검증

- 변경 후 `node scripts/validate-all.js`를 실행한다. 커밋하지 않는 작업도 검증 결과를 확인한다.
- pre-commit 훅은 버전 동기화 후 같은 검증기를 자동 실행한다. 오류가 나면 해당 파일·규칙을 고치고 다시 검증한다. `--no-verify`나 `SKIP_VALIDATE`로 우회하지 않는다.
- Codex 설치 도구를 수정하면 미리보기·재실행·충돌 방지 동작도 검증한다.
- 검증기 목록·개별 규칙은 `scripts/README.md`를 참고한다. 검증 시점과 우회 정책은 이 문서를 기준으로 한다.

Claude Code 전용 실행·저술 연결은 `CLAUDE.md`에서 관리한다.
