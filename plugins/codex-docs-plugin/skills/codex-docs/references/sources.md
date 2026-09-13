# 공식 문서 진입점

2026-09-10에 아래 패키징·스킬·서브에이전트 문서를 확인했다. 이 파일은 규격 사본이
아니라 탐색 경로다. 실행 시 해당 기능의 페이지를 다시 확인한다. URL이 이동하면
공식 문서의 탐색 메뉴나 도메인 제한 검색으로 후속 페이지를 찾는다.

| 요청 | 진입점과 찾을 내용 |
|---|---|
| 플러그인·카탈로그·설치 | https://developers.openai.com/plugins/build/plugins — 매니페스트, marketplace, 배포와 갱신 |
| 스킬 작성·탐색 | https://learn.chatgpt.com/docs/build-skills — SKILL.md, 로컬 탐색 위치, 플러그인 배포 |
| 커스텀 에이전트 | https://learn.chatgpt.com/docs/agent-configuration/subagents — TOML 필드, 등록 범위, 격리 설정 |
| 훅 이벤트·입출력 | https://learn.chatgpt.com/docs/hooks — 지원 이벤트, 도구 매칭, 반환 규격 |

설정 우선순위·AGENTS.md·MCP·인증은 위 공식 문서의 Configuration 탐색에서 해당 페이지를
찾거나 `Codex config.toml precedence`, `Codex AGENTS.md`, `Codex MCP configuration`으로
공식 도메인을 검색한다. API 키가 필요한 API 호출과 Codex 로그인·MCP 인증을 혼동하지 않는다.
모델·가격 질문은 요청한 모델과 제품의 공식 페이지를 별도로 확인하며 고정 가격표를 번들하지 않는다.
