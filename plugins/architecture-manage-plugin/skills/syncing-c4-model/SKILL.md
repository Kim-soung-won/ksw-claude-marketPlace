---
name: syncing-c4-model
description: 코드 수정 중 아키텍처에 영향을 주는 변경(새 서비스·워커·API 서버·CLI 명령 그룹 추가/삭제, 외부 API·메시지 브로커·DB 등 외부 의존성 추가/제거, 컨테이너 간 통신 방식이나 호출 경로 변경, DB·프레임워크 등 기술 스택 교체, 라우터·핵심 모듈의 추가·삭제·책임 이동)이 발생하면 해당 프로젝트의 C4 모델 JSON(schemaVersion 2 flat, C4 Modelizer용)을 함께 증분 업데이트해 코드와 아키텍처 다이어그램의 불일치를 방지한다. 사용자가 "C4 모델 갱신", "아키텍처 다이어그램 동기화", "c4.json 업데이트"를 요청할 때도 사용한다.
allowed-tools: Bash(python3 -m json.tool *)
---

# C4 모델 동기화

코드 변경이 아키텍처에 영향을 주면, 코드 수정과 같은 턴에서 프로젝트의 C4
모델 JSON도 함께 업데이트한다. 이 지침은 이번 작업 전체에 상시 적용된다 —
작업 도중 아래 기준에 해당하는 변경을 만들 때마다 JSON 동기화 여부를
판단한다.

## 1. 아키텍처 영향 판단

다음에 해당하면 C4 JSON을 업데이트한다:

- **노드 추가/삭제**: 새 서비스, 컨테이너, 워커, API 서버, CLI 명령 그룹,
  배치/스케줄러 등 모듈의 추가 또는 제거
- **외부 의존성 변경**: 새 외부 API, 메시지 브로커, DB, 캐시, SaaS 연동
  추가 또는 제거
- **통신 변경**: 컨테이너 간 통신 방식(예: REST→WebSocket)·방향 변경,
  새 호출 경로 추가, 기존 연결 제거
- **기술 스택 교체**: DB 엔진 변경, 프레임워크 교체 등 (노드의
  `technology`/`description` 수정)
- **컴포넌트 수준**: 라우터·핵심 모듈의 추가·삭제, 책임(역할)의 다른
  컨테이너/컴포넌트로의 이동

다음은 아키텍처 영향이 **아니므로** JSON을 건드리지 않는다: 함수 내부 구현
변경, 버그 수정, 경계가 불변인 리팩터링, 스타일·테스트·문서 변경.

## 2. 업데이트 절차

1. **대상 JSON 찾기**: 프로젝트 루트와 관례 위치에서 `*-c4.json`,
   `*.c4.json`, `*c4*.json` 패턴을 Glob으로 탐색한다(node_modules 등 의존성
   디렉터리 제외). 후보가 여러 개면 어느 파일인지 사용자에게 확인한다.
   파일이 없으면 사용자에게 경로를 묻거나, `c4-schema-generator`
   subagent로 신규 생성을 제안한다.
2. **변경사항을 스키마 요소에 매핑**: 코드 변경을 노드 추가/삭제,
   `description`·`technology` 수정, `connections` 추가/삭제로 번역한다.
   스키마 필드·technology 카탈로그·position 관례·healthCheck 보존 규칙은
   `${CLAUDE_PLUGIN_ROOT}/resources/c4-model/schema-spec.md`를 Read해서
   따른다 — 그 파일이 스펙의 단일 소스다.
3. **증분 편집(Edit) 우선**: 기존 JSON에서 영향받은 노드·연결만 Edit로
   고친다. 변경이 광범위해(예: 서비스 대부분의 경계가 바뀜) 증분 편집이
   비효율적일 때만 `c4-schema-generator` subagent에 전체 재생성을
   위임한다.
4. **검증** (편집 후 반드시 수행, 실패 시 수정하고 재검증):
   - JSON 유효성: `python3 -m json.tool <파일> > /dev/null`
   - 참조 무결성: 모든 `systemId`/`containerId`/`componentId`/
     `connections[].targetId`가 실존하는 노드 `id`를 가리키는지
   - 새 노드 필수 필드: `id`, `name`, `type`, `technology`, `description`,
     `position`, `connections`(없으면 `[]`) 모두 존재하는지
   - 새 노드 `position`이 같은 레벨 형제 노드와 겹치지 않는지 — 기존
     노드들의 x/y 간격 관례(레이어 간 x 400, 같은 레이어 y 250)를 따라
     빈 자리에 배치한다
5. **보고**: 코드 변경 보고에 C4 JSON에서 무엇을 바꿨는지(추가/삭제한 노드,
   수정한 연결)를 한 줄씩 함께 요약한다.

## 추가 자료

- 스키마 구조·technology 카탈로그·작성 관례:
  `${CLAUDE_PLUGIN_ROOT}/resources/c4-model/schema-spec.md`
- 전체 재생성이 필요할 때: 이 플러그인의 `c4-schema-generator` subagent에 위임
- 편집 전 현재 아키텍처 파악이 필요할 때: 이 플러그인의 `c4-schema-reader`
  subagent에 위임
