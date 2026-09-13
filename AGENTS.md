# 저장소 개발 규약

이 저장소는 Claude Code와 Codex용 플러그인 마켓플레이스다. 문서와 지시는 한국어로 작성한다.

- 공통 지식은 `skills/`, 상세 규칙과 출력 형식은 `resources/`에 둔다. 필요한 시점에 읽는다.
- Claude 카탈로그는 `.claude-plugin/marketplace.json`, Codex 카탈로그는 `.agents/plugins/marketplace.json`이다.
- 현재 11개 플러그인을 두 카탈로그에 배포한다. 새 플러그인은 실제 스킬 진입점·리소스·필요한 실행 연결을 확인한 뒤 등록한다.
- 같은 플러그인의 두 `plugin.json`은 이름·버전·description을 맞춘다. 기능 추가는 minor 버전과 CHANGELOG를 직접 갱신한다.
- Claude 전용 에이전트는 `agents/*.md`, Codex 등록 템플릿은 `codex/agents/*.json`이다. 공통 규칙을 템플릿에 복제하지 않는다.
- Codex 템플릿은 `scripts/install-codex-agents.py --plugin <이름>` 또는 `--all`로 TOML로 변환한다. 등록 경로와 원본 참조를 검증한다.
- 사용자 파일은 덮어쓰지 않는다. 설치는 기본 미리보기이며 `--write`가 명시되면 등록한다.
- 공통 리소스의 상대 경로는 해당 문서 디렉터리 기준이다. 제품별 도구 이름·모델·권한·가격 설명을 공통 규칙에 넣지 않는다.
- 변경 후 `node scripts/validate-all.js`를 실행한다. Codex 설치 도구를 수정하면 미리보기·재실행·충돌 방지 동작도 검증한다.
- 개발 훅은 `git config core.hooksPath .githooks`로 활성화한다. 훅은 공통 버전을 동기화한다.

Claude Code 전용 규약은 `CLAUDE.md`, 사용자 설치 방법은 `docs/codex.md`를 참고한다.

- `codex/runtime.md`는 호스트 차이만 설명한다. 원본 업무 규칙과 출력 형식은 복제하지 않는다.
- agent-factory의 Codex 수집은 공식 훅 입력을 자체 이벤트로 기록한다. 내부 transcript를 파싱하거나 미측정 비용을 0으로 채우지 않는다.
