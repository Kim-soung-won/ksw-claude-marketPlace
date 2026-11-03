# Mermaid 작성 규칙

FLOW.md의 다이어그램은 GitHub·GitLab·IDE 미리보기에서 그대로 렌더링되어야 한다.
근거는 Mermaid 공식 flowchart 문서(`https://mermaid.js.org/syntax/flowchart.html`)와
sequenceDiagram 문서(`https://mermaid.js.org/syntax/sequenceDiagram.html`)다.

## 목차

1. 규모와 추상화 수준
2. 노드 모양 규약
3. 색 규약(classDef)
4. 문법 함정
5. sequenceDiagram 규칙
6. 렌더링 검증

## 1. 규모와 추상화 수준

- 다이어그램 하나에 노드 **약 15개 이하**. 넘으면 폴더 흐름과 스크립트별 순서도로 나누거나,
  한 스크립트를 "준비 / 적용 / 검증" 단계별 다이어그램으로 나눈다.
- **한 줄 = 한 노드로 그리지 않는다.** 노드 하나는 의미 있는 단계 하나다
  (예: "values.yaml 백업", "helm 재배포"). `echo`·변수 대입·로그 출력은 그리지 않는다.
- 같은 다이어그램 안의 노드는 같은 추상화 수준을 유지한다. "모듈 6개 재배포"와
  "`chmod +x` 실행"을 나란히 두지 않는다.
- 반대로 **종료 지점은 사소해 보여도 모두 그린다.** `exit 0`·`exit 1`·처리되지 않은 예외·
  `set -e`에 의한 암묵 종료는 흐름 이해의 핵심이다. 같은 의미의 오류 종료가 여럿이면
  노드 하나로 합치고 라벨에 조건을 나열해도 된다.
- 반복문 본문은 `subgraph`로 감싸고 제목에 반복 대상을 쓴다.
  예: `subgraph LOOP["모듈마다 반복: model·auth·document·infra·agent·layout"]`.
  반복 안에서 `continue`로 다음 반복으로 가는 경로는 subgraph 안의 "다음 반복" 노드로 표현한다.
- 방향은 `flowchart TD`를 기본으로 한다. `graph` 대신 `flowchart` 키워드를 쓴다.

## 2. 노드 모양 규약

| 의미 | 모양 | 예 |
|---|---|---|
| 시작·종료 | 스타디움 `([...])` | `ok(["exit 0"])` |
| 처리 단계 | 사각형 `[...]` | `bak["values.yaml 백업"]` |
| 분기 조건 | 마름모 `{...}` | `has{"KEY 이미 있음?"}` |
| 하위 스크립트 호출 | 서브루틴 `[[...]]` | `s1[["updataLayoutChart.sh"]]` |
| 외부 리소스(파일·클러스터·API) | 원통 `[(...)]` | `k8s[("helm 릴리스")]` |

- 분기 간선에는 반드시 조건 라벨을 단다: `-->|"예"|`, `-->|"exit ≠ 0"|`.
- 단계를 **건너뛰는** 경로는 점선 `-.->`으로 그려 정상 경로와 구분한다.
- 종료 노드 라벨에는 종료 코드와 결과 상태를 함께 쓴다(예: `"exit 1<br/>values.yaml은 이미 수정됨"`).
  색만으로 의미를 전달하지 않는다(다크 모드·흑백 출력 대비).

## 3. 색 규약(classDef)

순서도 끝에 아래 정의 중 **사용한 클래스의 줄만** 그대로 붙인다. 색 값은 바꾸지 않는다.

```text
classDef ok fill:#d4edda,stroke:#28a745,color:#155724
classDef fail fill:#f8d7da,stroke:#dc3545,color:#721c24
classDef skip fill:#fff3cd,stroke:#d39e00,color:#856404
classDef restore fill:#e2d9f3,stroke:#6f42c1,color:#3d2370
classDef danger fill:#fff,stroke:#dc3545,stroke-width:3px,color:#721c24,font-weight:bold
classDef guarded stroke:#d39e00,stroke-width:3px,stroke-dasharray:6 3
```

| 클래스 | 붙이는 노드 |
|---|---|
| `ok` | 정상 종료 |
| `fail` | 오류 종료(명시 `exit` ≠ 0, 처리되지 않은 예외, `set -e` 암묵 종료) |
| `skip` | 이후 단계를 건너뛰는 종료·분기(성공 코드로 끝나지만 일부 작업을 하지 않는 경우 포함) |
| `restore` | 백업 복원·정리(cleanup) 등 실패 복원 경로의 처리 노드 |
| `danger` | 주의할 명령 중 완화 장치가 **없음·부분**인 처리 노드. 빨간 굵은 테두리·굵은 글씨 |
| `guarded` | 주의할 명령 중 완화 장치가 **있는** 처리 노드. 주황 점선 굵은 테두리 |

### 위험 노드 표기

- 판정 기준(분류·등급·완화 장치)은 `risky-commands.md`를 따르고, FLOW.md "⚠️ 주의할 명령" 표의 행과 노드가 일치해야 한다.
- 위험 노드 라벨은 `⚠️`로 시작하고 명령을 괄호로 붙인다: `rm1["⚠️ 기존 tar 삭제 (rm -f)"]`.
- 완화 장치가 있으면 라벨에 장치를 짧게 적는다: `"⚠️ configmap 백업 후 덮어쓰기 (cp)"`. 색과 라벨 둘 다로 구분한다.
- `danger`·`guarded`는 처리 노드에만 붙인다. 종료 노드(`ok`·`fail`·`skip`)와 복원 노드(`restore`)에는 붙이지 않는다.

지정은 클래스마다 `class e1,e2 fail`처럼 한 줄로 모은다. 노드마다 `:::fail`을 붙여도 되지만 한 다이어그램 안에서는
한 방식만 쓴다.

## 4. 문법 함정

- **라벨은 큰따옴표로 감싼다**: `A["helm install ./Chart -n $NS"]`. 괄호·대괄호·중괄호·`|`·`:`·
  `;`·`#`·`<`·`>`·`/`가 섞인 라벨은 따옴표 없이는 파싱이 깨진다. 기본적으로 모든 라벨을 감싼다.
- **라벨 안 큰따옴표는 `#quot;`**로 쓴다: `A["grep -q #quot;cluster_name#quot;"]`.
  그 밖의 문자도 `#59;`(세미콜론)처럼 엔티티 코드로 쓸 수 있다.
- **노드 ID에 소문자 `end`를 쓰지 않는다.** flowchart 문법을 끊는다. `done`·`finish`·`End`를 쓴다.
  라벨 안의 "end"는 따옴표로 감싸면 문제없다.
- 간선 바로 뒤 노드 ID가 `o`·`x`로 시작하면(`A---oB`) 원·X 화살촉으로 해석된다.
  ID를 `ok`, `xfer`처럼 시작하는 경우 간선과 ID 사이에 공백을 둔다(`A --- ok`).
- 줄바꿈은 `<br/>`만 쓴다. 라벨 안 실제 개행·`\n`은 쓰지 않는다.
- 간선 라벨도 큰따옴표로 감싼다: `-->|"exit 0 (건너뜀)"|`.
- 주석은 `%%`로 시작하는 별도 줄에 쓴다.
- 노드 ID는 영문·숫자·밑줄만 쓰고 짧게 짓는다(`chk`, `bak`, `e1`). 한글은 라벨에만 쓴다.

## 5. sequenceDiagram 규칙

외부 시스템과의 요청·응답 순서가 중요할 때 쓴다(선택 기준은 형식 문서 참고).

- `participant` 별칭을 선언한다: `participant H as helm`.
- 반복은 `loop`, 분기는 `alt`/`else`, 조건부 실행은 `opt`, 실패 무시는 `opt` 라벨에
  "실패 무시"를 적는다. 이 블록을 닫는 `end`는 sequenceDiagram의 정상 키워드다.
- 메시지 안 `;`·`#`은 `#59;`·`#35;`로 쓴다.
- 참여자는 7개 이하로 유지한다.

## 6. 렌더링 검증

FLOW.md를 저장한 뒤 다음 순서로 확인한다.

1. mermaid-cli를 쓸 수 있으면 Markdown 전체를 렌더링한다. 출력은 저장소 밖 임시 디렉터리에 둔다.

   ```bash
   npx -y @mermaid-js/mermaid-cli -i FLOW.md -o "<임시 디렉터리>/FLOW.rendered.md"
   ```

   다이어그램마다 SVG가 생성되면 통과다. 파싱 오류가 나면 해당 블록을 고치고 다시 실행한다.
   네트워크·브라우저 다운로드 문제로 도구 자체가 실행되지 않으면 2로 넘어가고, 보고에
   "mermaid-cli 미실행, 문법 자가 점검만 수행"이라고 적는다.
2. 도구를 쓸 수 없으면 블록마다 다음을 점검한다.
   - [ ] 첫 줄이 `flowchart TD` 또는 `sequenceDiagram`
   - [ ] 모든 라벨·간선 라벨이 큰따옴표로 감싸져 있고, 라벨 안 따옴표는 `#quot;`
   - [ ] 소문자 `end` 노드 ID 없음, `o`·`x`로 시작하는 ID 앞 공백
   - [ ] `subgraph`마다 짝이 맞는 `end`
   - [ ] 노드 약 15개 이하, 모든 종료 지점에 `ok`/`fail`/`skip` 클래스 지정
   - [ ] "⚠️ 주의할 명령" 표의 명령마다 `⚠️` 라벨과 `danger`/`guarded` 클래스가 있는 노드
   - [ ] 사용한 클래스의 `classDef`가 블록 끝에 있음
