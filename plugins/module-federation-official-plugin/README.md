# module-federation-official-plugin

Module Federation 오픈소스가 공식 지원하는 **올인원 `mf` 스킬을 한글화해 번들**한 플러그인이다.
이 플러그인은 **업스트림 지식 계층**이다 — 팀 하우스 규칙(`mfe-architecture-plugin`)과
의도적으로 **분리**해, 업스트림이 갱신되면 이 플러그인만 독립적으로 재동기화한다.

## 왜 별도 플러그인인가

`mf` 스킬은 "공식 지식을 한글화만 한 것"이라 재동기화 가능해야 한다. 하우스 규칙과 한
플러그인에 섞으면 (1) 업스트림 재동기화가 하우스 규칙을 건드리게 되고, (2) 공식 스킬의
넓은 트리거가 하우스 툴의 호출을 삼킨다. 그래서 경계를 플러그인 단위로 그었다.

- 팀 자체 규약(설정 하우스 스타일·경계 설계·런타임 진단·계약 문서) → `mfe-architecture-plugin`
- 공식 MF 지식(개념·API·서브커맨드 참조) → 이 플러그인

## 구성

```
skills/mf/
  SKILL.md              ← 서브커맨드 라우터
  reference/*.md        ← 서브커맨드별 절차(지연 로드)
  scripts/*.js          ← config·shared·type·module-info 검사 스크립트
```

`mf <sub-command | 자연어>` 로 호출한다. 서브커맨드:
`config` · `shared-deps` · `type-check` · `runtime-error` · `module-info` ·
`integrate` · `perf` · `context` · `docs`
(그 밖에 `observability` · `bridge` 서브커맨드도 원본에 포함되어 있으나 자동 트리거에서는
빠져 있고 명시적으로 호출할 때만 동작한다 — 아래 "업스트림 대비 로컬 변경" 참고).

## 업스트림 대비 로컬 변경 (재동기화 시 참고)

`reference/` · `scripts/` 원본 내용은 **미수정**이다(재동기화성 보존). 아래 두 가지만
Claude Code 패키징 레이어(`SKILL.md` frontmatter)에서 조정했다:

1. **description을 코어 서브커맨드로 축소** — 원본은 "MF에 관해 무엇이든"이라 하우스 툴의
   트리거를 삼켰다. 팀이 실제로 쓰는 config·shared·type·runtime·module-info·integrate 중심으로
   좁혀 자동 트리거 충돌을 없앴다. `observability`·`bridge`는 자동 트리거에서 빠졌을 뿐,
   라우팅 표에는 남아 있어 `mf obs` 처럼 명시적으로 부르면 그대로 동작한다.
2. **`allowed-tools`에서 `Bash(divebell *)`·`Bash(npm install --global @divebell/cli)` 제거** —
   팀이 divebell 브라우저 디버그를 쓰지 않아 전역 설치 권한을 스킬에서 뺐다.

업스트림을 다시 가져올 때 `reference/`·`scripts/`는 통째로 교체해도 되고, 위 두 조정만
`SKILL.md` frontmatter에 다시 적용하면 된다.
