# Docs Bucket

GitHub 저장소를 HTML·Markdown·첨부 파일 보관함으로 사용하는 스킬과 CLI다.
Claude Code·Codex에서 같은 스킬을 사용한다. 별도 MCP 서버나 npm 패키지는 필요하지 않다.

## 준비

Node 22 이상, Git, GitHub CLI가 필요하다. `gh auth login --hostname github.com --git-protocol https --web`으로 로그인한다.
업로드에는 본인 Git 작성자 이름·이메일 설정이 필요하다. 저장소에는 사용할 브랜치와 초기 커밋이 있어야 한다.

플러그인 루트에서 한 번 실행한다. 아래 owner/repository는 본인의 저장소로 바꾼다.

```sh
node scripts/bucket.mjs configure --repo owner/repository --branch main
node scripts/bucket.mjs status
```

개인 설정은 `${XDG_CONFIG_HOME:-~/.config}/docs-bucket/config.json`에 저장한다.
`DOCS_BUCKET_CONFIG` 또는 `--config`로 변경할 수 있다. 설정에는 repo와 branch만 저장하며 토큰은 gh가 관리한다.
플러그인 업데이트로 개인 설정이 바뀌지 않는다.

## 사용

- “이 문서를 문서 버킷에 올려줘.”
- “버킷에서 지난 보고서 찾아서 가져와줘.”
- “저장된 HTML을 이 파일로 갱신해줘.”

직접 실행할 수도 있다.

```sh
node scripts/bucket.mjs list 보고서
node scripts/bucket.mjs put ./report.md docs/report.md
node scripts/bucket.mjs put ./report html/report
node scripts/bucket.mjs get docs/report.md ./report.md
```

폴더 업로드는 기존 폴더에 병합한다. 파일 삭제·동기화 삭제는 수행하지 않는다.
HTML·이미지·CSS를 한 폴더로 묶으면 상대 경로와 한 커밋으로 전송된다.
기존 원격 내용을 바꿀 때는 `status`의 commit을 확인하고 `--replace --expected-head <커밋>`을 사용한다.
로컬 파일 교체는 `get ... --replace`다. 요청마다 최신 임시 체크아웃을 만들고 완료 후 정리하므로
공유 작업 폴더 잠금이 필요하지 않다. 동시 푸시는 일반 Git 규칙에 따라 거부되며 자동 병합·강제 푸시는 하지 않는다.
푸시 성공 여부가 불명확하면 커밋 반영 여부를 조회한 뒤 재시도한다.

결과는 JSON으로 반환한다. 별도 공개 링크나 웹 호스팅을 만들지 않는다.
비공개 저장소 링크는 권한이 있는 사용자에게만 공유할 수 있다.
스크립트는 일반 파일·폴더만 지원하며 심볼릭 링크, `.git`, `.env`, 개인 키 파일은 거부한다.
빈 폴더는 전송하지 않는다. GitHub 일반 Git 파일 크기 제한이 적용되며 Git LFS는 지원하지 않는다.

## 검증

```sh
node --test plugins/docs-bucket-plugin/scripts/bucket.test.mjs
node scripts/validate-all.js
```

위 검증 명령은 마켓플레이스 저장소 루트에서 실행한다.
