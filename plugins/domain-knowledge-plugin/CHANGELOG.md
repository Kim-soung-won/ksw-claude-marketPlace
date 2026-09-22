# Changelog — domain-knowledge-plugin

## [1.3.0] - 2026-09-22

- 도메인 리뷰에 테스트 존재·명세 연결 검사와 현황 표 추가. 기존 기능의 누락, 선작성 예정, 비활성 골격, 확인 불가를 구분하며 실행 통과와 분리해 보고.

- 신규·기존 도메인의 문서·Swagger·코드 대조와 논리 계약 준비를 위한 `domain-contracts` 스킬 추가.
- 실행 스키마 참조, 기존 계약 재사용, 미구현과 명세 불일치를 구분하는 검토 지원.
- 프론트엔드 TDD 하네스로 근거·계약·검증 결과를 전달하는 절차 추가.

## [1.2.2] - 2026-09-14

CHANGELOG 정합성 정리(1.2.1 항목 기록 커밋에서 pre-commit 훅이 자동 상승한 분). 플러그인 동작 변경 없음.

## [1.2.1] - 2026-09-14

- 서브에이전트 `domain-skill-manager`·`domain-skill-reviewer` 모델을 `opus`로 상향(토큰 여유 반영).

## [1.2.0] - 2026-09-10

- Codex 카탈로그와 공통 스킬 배포 지원.
- Codex 실행 규약·에이전트 등록 또는 스킬 호출 경로 정리.

형식: [Keep a Changelog](https://keepachangelog.com/ko/1.1.0/) · 버전: [SemVer](https://semver.org/lang/ko/)

이 플러그인의 `version` 은 사용자 측 `/plugin marketplace update` 가 갱신을 인식하는 유일한
키다. patch 는 커밋 시 pre-commit 훅이 자동으로 올리고, minor·major 는 직접 올린다 — 판단
기준과 기록 방법은 루트 [README](../../README.md#버전과-changelog) 참고.

## [1.1.2] - 2026-08-06

CHANGELOG 도입 기준선이다. 이 버전까지의 변경 내역은 `git log -- plugins/domain-knowledge-plugin/` 에 있다.
아래는 1.1.2 시점에 이 플러그인이 제공하는 것이다.

### 에이전트
- `domain-skill-manager` — 협업자·기획자에게 받은 도메인 지식(API 스펙·시나리오·도메인
  규칙)을 SKILL.md 트리오로 기록한다.
- `domain-skill-reviewer` — 기록된 도메인 스킬이 코드 현실과 어긋난 지점을 전수 진단한다.
  파일을 고치지 않고 우선순위 리포트만 낸다.
