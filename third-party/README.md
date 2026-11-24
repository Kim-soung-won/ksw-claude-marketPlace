# 외부 스킬

다른 개발자·오픈소스가 공개한 스킬을 이 마켓플레이스에서 설치할 수 있게 감싼 플러그인을 둔다. 직접 만든 플러그인은 `plugins/`에 있다.

## 목록

| 플러그인 | 용도 | 스킬 | 원본 · 라이선스 |
| --- | --- | --- | --- |
| [requirements-definition-plugin](requirements-definition-plugin/) | 구현 전 요구 정의: 인터뷰로 의도 확정, 코드 전 명세 작성 | interview-me, spec-driven-development | [addyosmani/agent-skills](https://github.com/addyosmani/agent-skills) · MIT |

## 규칙

- **원본은 수정하지 않는다.** 스킬 파일은 원본 그대로 두고 `SOURCE.md`에 원본 저장소·커밋·라이선스·파일별 SHA-256을 기록한다. 고쳐 쓰려면 `plugins/`의 내 플러그인으로 다시 작성하고 출처를 밝힌다.
- **재배포가 허용된 라이선스만 복사한다.** 이 저장소는 공개다. 라이선스가 없거나 재배포를 허용하지 않으면 복사하지 않고 원본 링크만 남긴다. `LICENSE` 사본을 플러그인에 함께 둔다.
- **용도별로 작게 묶는다.** 플러그인은 함께 쓰는 스킬의 묶음이다. 원본 저장소가 아니라 쓰임새로 나누고 실제로 쓸 스킬만 가져온다. 설치하면 묶인 모든 스킬의 description이 컨텍스트에 실리기 때문이다. 원본 전체가 필요하면 원본 마켓플레이스를 직접 추가한다.
- **이름은 용도로 짓는다.** 플러그인 이름은 `<용도>-plugin`이다. 외부 원본이라는 사실은 description 앞의 `[외부]`와 `third-party/` 위치로 구분하고, 원본 저장소는 description 끝과 `SOURCE.md`에 밝힌다. 저장소 저술 규칙(한국어 작성 등)은 원본 파일에 적용하지 않는다.
- **버전은 직접 올린다.** pre-commit 훅의 patch 자동 상승은 `plugins/`만 대상이다. 스킬을 추가·갱신하면 두 `plugin.json` 버전을 함께 올리고 CHANGELOG에 원본 커밋을 적는다.

현재 `SOURCE.md`와 검증기는 플러그인당 원본 저장소 하나를 전제로 한다. 같은 용도에 다른 출처의 스킬을 더하게 되면 출처별 구간과 LICENSE를 나누도록 양식과 `validate-third-party.js`를 먼저 확장한다.

## 추가·갱신 절차

1. 원본 저장소의 라이선스와 고정할 커밋을 확인한다.
2. 커밋을 고정해 파일을 받는다. 예: `gh api "repos/<소유자>/<저장소>/contents/skills/<스킬>/SKILL.md?ref=<커밋>" --jq .content | base64 -D`
3. `skills/<스킬>/`에 원본 경로 구조대로 둔다. 스킬 안의 상대 링크가 가리키는 파일도 함께 가져온다.
4. `shasum -a 256`으로 해시를 구해 `SOURCE.md`의 커밋·가져온 날짜·파일 표를 갱신한다.
5. 새 플러그인이면 두 카탈로그(`.claude-plugin/marketplace.json`, `.agents/plugins/marketplace.json`)에 `./third-party/<이름>` 경로로 등록하고 이 목록에 추가한다.
6. `node scripts/validate-all.js`로 검증한다. `validate-third-party.js`가 출처 기록과 해시를 확인한다.

## 설치

직접 만든 플러그인과 같은 마켓플레이스에서 설치한다. 예: Claude Code에서 `/plugin install requirements-definition-plugin@ksw-plugins`. 특정 프로젝트에서만 쓰면 프로젝트 범위로 설치한다.
