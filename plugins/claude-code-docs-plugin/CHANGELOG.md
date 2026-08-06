# Changelog — claude-code-docs-plugin

형식: [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) · 버전: [SemVer](https://semver.org/lang/ko/)

이 플러그인의 `version` 은 사용자 측 `/plugin marketplace update` 가 갱신을 인식하는 유일한
키다. patch 는 커밋 시 pre-commit 훅이 자동으로 올리고, minor·major 는 직접 올린다 — 판단
기준과 기록 방법은 루트 [README](../../README.md#버전과-changelog) 참고.

## [0.3.2] - 2026-08-06

CHANGELOG 도입 기준선이다. 이 버전까지의 변경 내역은 `git log -- plugins/claude-code-docs-plugin/` 에 있다.
아래는 0.3.2 시점에 이 플러그인이 제공하는 것이다.

### 에이전트
- `claude-skill-creator` — SKILL.md 를 공식 규격에 맞게 생성·검토
- `subagent-creator` — 서브에이전트 정의 생성·수정
- `subagent-evaluator` — 기존 정의의 스펙 준수 진단(리포트만)
- `subagent-cost-auditor` — 정의의 컨텍스트 비용·위임 입도 감사(유지/스킬 전환/삭제 판정)
- `hook-manager` — hook 설정 작성·수정·스코프 판단
- `mcp-server-creator` — MCP 서버 연결·구성

### 스킬
- `claude-code-hooks` — hook 이벤트·matcher·종료코드·구조화 출력 기준 문서
- `claude-code-jsonl` — 세션 JSONL 위치·구조·파싱 규칙·이벤트 분류
