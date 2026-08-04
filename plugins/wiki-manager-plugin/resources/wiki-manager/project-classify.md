# 프로젝트 자동 분류 절차 (공유)

`/log`·`/ingest`가 **세션이 열린 repo로 프로젝트를 결정론적으로 분류**하기 위한 공통 절차.
"어디서 커맨드를 쳤느냐"가 곧 분류이므로 수동 태깅이 필요 없다. 미등록 repo는 Project Map에
**자동 추가**한 뒤 그 분류를 즉시 사용한다.

vault 경로는 `~/agent-knowledge-base`(없으면 `$KB_VAULT_PATH`, 그래도 없으면 사용자에게
질문)를 기준으로 한다. Project Map은 `<vault>/00 Meta/00.03 Project Map.md`.

## 1. 세션 컨텍스트 감지

현재 작업 디렉터리에서 실행한다:

```bash
ROOT=$(git rev-parse --show-toplevel 2>/dev/null)
REPO=$(basename "$ROOT" 2>/dev/null)
BRANCH=$(git branch --show-current 2>/dev/null)
COMMIT=$(git rev-parse --short HEAD 2>/dev/null)
REMOTE=$(git remote get-url origin 2>/dev/null)
PKG=$(node -p "require('./package.json').name" 2>/dev/null || true)
```

git 저장소가 아니면 `REPO`가 빈 값 → **개인/일반**으로 분류하고(태그·개요 링크 없음) 절차를 끝낸다.

## 2. Project Map 조회

`00 Meta/00.03 Project Map.md`의 매핑 테이블을 Read/grep해서 매칭한다.
매칭 우선순위: `repo`(git 루트 basename) → `remote`(origin URL 부분일치) → `pkg`(package.json name).
하나라도 맞으면 그 행의 **프로젝트 태그**, **개요 노트 위키링크**, **vault 프로젝트 경로**를 얻는다.

## 3-a. 매칭 성공

그 행의 값으로 분류가 확정된다. 호출한 커맨드는 이 값(프로젝트 태그 + 개요 노트 위키링크 +
provenance `repo/branch/commit`)을 자기 산출물에 반영한다.

## 3-b. 매칭 실패 → Project Map에 자동 추가

git repo인데 표에 없으면, **사용자에게 되묻지 않고 새 행을 자동 append**한다(사용자가 이 자동화를
선택함, 2026-08-04). 절차:

1. **슬러그 생성**: `SLUG`는 `REPO`를 소문자화하고 영숫자 외 문자를 하이픈으로 치환한 값
   (예: `MHub_Space.Client` → `mhub-space-client`). 프로젝트 태그는 `#work/project/<SLUG>`.
   - `#work/project/*`는 Tag Index에 문서화된 **네임스페이스 패턴**이므로, 이 아래 개별 태그는
     Tag Index에 매번 새로 등록하지 않아도 된다(패턴이 이미 등록됨). Tag Index 표 자체는 건드리지 않는다.
2. **행 append**: `00 Meta/00.03 Project Map.md`의 매핑 테이블 마지막에 아래 행을 추가한다.
   미확정 필드는 `TODO`로 남긴다(임의로 프로젝트 폴더를 만들지 않는다):

   ```
   | <REPO> | <REMOTE의 repo 부분> | <PKG> | TODO(vault 경로) | #work/project/<SLUG> | TODO(개요 노트) |
   ```

   - `개요 노트`가 `TODO`인 동안에는 로그/노트에 개요 위키링크를 걸지 않는다(깨진 링크 방지).
     프로젝트 태그와 provenance만 부착한다.
3. **자동 추가 표시**: 추가한 행의 `vault 프로젝트`/`개요 노트`가 `TODO`라는 사실이 곧 "자동 추가됨,
   정제 필요" 표시다. 나중에 정식 프로젝트로 승격할 때 사람이 개요 노트를 만들고 `TODO`를 채운다.
4. **보고에 명시**: 커맨드는 "Project Map에 `<REPO>` 행을 자동 추가했습니다(태그
   `#work/project/<SLUG>`). vault 경로·개요 노트는 TODO이니 정식 프로젝트로 만들 때 채워주세요."를
   사용자에게 알린다.

## 트레이드오프 메모

자동 추가는 friction을 없애는 대신, 실험용·일회성 repo도 표에 쌓일 수 있다. `TODO` 마커가
남은 행은 미정제 항목이므로, 주기적으로 Project Map을 훑어 안 쓰는 행을 정리(gardening)한다.
정식 프로젝트가 된 행은 `TODO`를 실제 경로·개요 노트로 채우면 개요 위키링크까지 자동으로 붙는다.
