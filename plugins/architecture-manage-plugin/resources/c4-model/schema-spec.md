# C4 Modelizer schemaVersion 2 flat 스키마 — 단일 소스 스펙

이 문서가 이 플러그인에서 C4 모델 JSON을 생성·편집·해석하는 모든 에이전트·스킬
(`c4-schema-generator`, `c4-schema-reader`, `/c4-interview`, `syncing-c4-model`)의
**스펙 단일 소스**다. 스펙·카탈로그·배치 규칙을 다른 문서에 중복 기술하지 않는다.
(검증 소스: C4 Modelizer의 src/utils/jsonIO.ts, @archivisio/c4-modelizer-sdk)

## 최상위 구조

```json
{
  "schemaVersion": 2,
  "viewLevel": "system",
  "systems": [],
  "containers": [],
  "components": [],
  "codeElements": []
}
```

- `schemaVersion`은 반드시 숫자 `2`.
- `systems`, `containers`, `components`, `codeElements` **4개 배열이 전부
  존재해야** import가 성공한다 (importModel이 Array.isArray로 4개 모두 체크).
  비어 있어도 빈 배열로 반드시 포함하고, 편집 중에도 배열을 삭제하지 않는다.
- `viewLevel`: `'system' | 'container' | 'component' | 'code'` 중 하나.
  일반적으로 `"system"`으로 시작.
- 선택 필드: `activeSystemId`, `activeContainerId`, `activeComponentId`.

## 노드 공통 필드와 계층 참조

모든 노드에 필수 (BaseBlock): `id`(모델 전체 고유, 예: `"sys-api"`,
`"cont-api-db"`), `name`, `type`, `position`(`{"x": n, "y": n}`),
`connections`(연결이 없으면 `[]`). `technology`와 `description`은 스펙상
선택이지만 **이 플러그인에서는 식별 가능한 한 항상 채운다** — 이름·연결만
있고 설명·기술이 빈 노드를 남기지 마라 (예: description "FastAPI 기반 REST
API 서버. 백테스트 잡 실행과 운영 대시보드 API 제공").

계층 소속은 connection이 아니라 참조 필드로 표현한다:

| type | 계층 참조 필수 필드 | 기타 |
|---|---|---|
| `"system"` | (없음) | |
| `"container"` | `systemId` | |
| `"component"` | `systemId` + `containerId` | |
| `"code"` | `systemId` + `containerId` + `componentId` | `codeType`('class'\|'function'\|'interface'\|'variable'\|'other'), 선택 `code`(string) |

**연결은 같은 레벨의 노드끼리만** 만든다: system↔system,
container↔container, component↔component, code↔code.

노드를 **삭제**할 때는 다른 노드의 `connections`에서 그 id를 가리키는 항목과,
계층 참조로 소속된 하위 노드(container/component/codeElement)도 함께 정리한다.

## connection 구조

소스 노드의 `connections` 배열 안 객체:

```json
{
  "targetId": "cont-db",
  "label": "틱 적재",
  "technology": "postgresql",
  "description": "trades 하이퍼테이블에 실시간 데이터 기록"
}
```

- `targetId` 필수 — 실존하는 노드의 id.
- `technology`에는 통신 방식(http, https, websocket, grpc, amqp 등),
  `label`에는 무엇을 주고받는지 적는다.
- 선택: `description`, `bidirectional`, `sourceHandle`, `targetHandle`,
  `labelPosition`.
- **인프로세스 호출 관례**: 프로세스 경계가 없는 호출도 엣지로 표기해야
  하면 `technology`를 임시 부여하되(기존 파일은 `grpc` 사용), `description`에
  "인프로세스 호출"임을 명시한다.

## healthCheck 필드 (선택 — 라이브 상태 표시용)

노드가 실행 중인 서버/서비스이고 접근 정보를 확인할 수 있으면 `healthCheck`
객체를 채운다. 앱이 이 주소를 주기적으로 호출해 해당 노드로 들어오는 연결선
색으로 상태를 표시한다 (초록=정상, 주황=느림, 빨강=응답 없음).

```json
"healthCheck": {
  "url": "http://localhost:8080/actuator/health",
  "verified": false
}
```

- `url`: 브라우저에서 호출할 health check 주소. 소스에서 추출할 때 우선순위:
  1. 명시적 health 엔드포인트 — Spring Actuator(`/actuator/health`),
     `/healthz`, `/health`, `/ping` 라우트 정의, docker-compose의
     `healthcheck.test` 명령
  2. 서비스 포트 — docker-compose `ports` 호스트 매핑, `.env.example`의
     PORT류 변수, k8s Service/Ingress
  3. 없으면 루트 경로(`http://localhost:<port>/`)
- `verified`: **에이전트가 생성·수정할 때는 항상 `false`로 넣는다.** 소스코드의
  주소는 docker 내부 호스트명(`redis:6379`), env 플레이스홀더, 환경별 차이
  때문에 그대로 접근 가능하다는 보장이 없다 — 사용자가 앱에서 실제 주소로
  확인·수정하면 `true`가 된다. 호스트명은 컨테이너 내부 이름 대신
  `localhost` + 호스트 매핑 포트로 치환해서 넣는다.
- `intervalMs`(선택): 폴링 주기. 특별한 이유가 없으면 생략 (기본 15초).
- 적용 대상: 실행 프로세스인 노드(API 서버, 프론트 dev 서버, DB 관리 UI 등
  HTTP로 응답하는 것)에만 넣는다. HTTP를 말하지 않는 DB·브로커 자체, 액터
  (users), 외부 SaaS에는 넣지 않는다. 확신이 없으면 넣지 말고 보고의
  "분석 한계"에 후보로 남긴다.
- **동기화(기존 파일 편집) 시**: 기존 `healthCheck`는 그대로 보존한다. 서비스의
  포트·health 엔드포인트가 바뀌는 변경이면 `url`을 갱신하되 `verified`를
  `false`로 되돌린다 (사용자가 앱에서 재확인).

## technology 필드 (매우 중요 — 아이콘·색상·노드 모양이 여기서 결정된다)

`technology` 값은 앱 내장 기술 카탈로그(src/data/technologies/\*.json)의
**소문자 id와 정확히 일치**해야만 아이콘·색상이 렌더링된다. "PostgreSQL",
"TypeScript" 같은 표기는 매칭에 실패해 아무것도 표시되지 않는다 —
반드시 "postgresql", "typescript"처럼 카탈로그 id를 쓴다.

사용 가능한 id 전체 목록:

- 언어: java, javascript, typescript, python, ruby, php, c, cpp, csharp, go,
  kotlin, swift, dart, rust, scala, perl, haskell, elixir, clojure, erlang,
  objectivec, shell, powershell, r, matlab, fsharp, visualbasic, lua, groovy, nim
- 프레임워크: react, angular, vue, nextjs, nuxtjs, svelte, nestjs, django,
  rails, spring, flask, express, laravel, symfony, bootstrap, tailwind,
  gatsby, ember
- DB: postgresql, mysql, mariadb, mongodb, redis, cassandra, oracle,
  sqlserver, sqlite, dynamodb, elasticsearch, neo4j, couchdb, influxdb
  (이 목록의 id를 쓰면 노드가 자동으로 DB 원통 모양으로 렌더링된다)
- 메시지 브로커: kafka, rabbitmq, amazonsqs, redisstreams, nats, mqtt
- 클라우드: aws, azure, gcp, ibmcloud, oraclecloud, digitalocean, heroku,
  vercel, netlify
- DevOps: docker, kubernetes, terraform, ansible, jenkins, githubactions,
  gitlabci, argo, helm
- 모니터링: prometheus, grafana, newrelic, splunk, opentelemetry, jaeger, zipkin
- 프로토콜(주로 connection용): http, https, tcp, udp, websocket, grpc, amqp,
  ftp, sftp, ssh, dns
- SaaS: stripe, twilio, sendgrid, shopify, algolia, cloudflare, mailchimp
- 보안: vault, snyk, trivy, auth0, okta
- 코드 호스팅: github, gitlab, bitbucket, azuredevops, sourceforge, gitea
- 일반 시스템: users, server, database-server, client-device, mobile-device,
  router, firewall, cloud, vpn, storage, load-balancer
- 커스텀: mfe

적용 규칙:

- **기술을 식별할 수 있는 모든 노드에 `technology`를 채워라.** 비워두면
  다이어그램에서 그 노드가 무슨 애플리케이션인지 알 수 없다.
- 노드당 id는 1개만 가능하므로 가장 대표적인 것을 고른다: API 서버는
  프레임워크(예: FastAPI 미지원 시 언어 "python"), 프론트엔드는 "react" 등
  프레임워크, DB는 엔진 id, 외부 클라우드 서비스는 "aws" 등.
- 카탈로그에 정확히 일치하는 id가 없으면 (예: FastAPI, TimescaleDB,
  Telegram) 가장 가까운 상위 개념 id를 쓰고("python", "postgresql",
  "server"), 구체 기술명은 `name`이나 `description`에 명시한다
  (예: name "API Server (FastAPI)", description "TimescaleDB 확장 사용").
- connection의 `technology`에는 통신 방식을 채운다: http, websocket, grpc,
  amqp 등.

## position 배치 (레이어드 흐름 배치)

`position`은 다이어그램 좌표일 뿐 아키텍처 의미는 없지만, 노드가 겹치면
렌더링이 망가진다. 노드를 등장 순서대로 그리드에 채우지 말고, **의존 흐름이
왼쪽→오른쪽으로 읽히도록** 계층(레이어)을 나눠 배치한다. 레벨별로 독립된
캔버스에 그려지므로 systems끼리, 같은 부모의 containers끼리 각각 아래 절차를
적용한다:

1. **레이어 나누기**: connection 방향을 기준으로 호출하는 쪽을 왼쪽, 호출받는
   쪽을 오른쪽 레이어에 둔다. 전형적 순서 — 액터/클라이언트(users,
   client-device 등) → 프론트엔드/게이트웨이 → 핵심 서비스 → 저장소(DB·캐시·
   브로커)와 외부 SaaS. 상호(bidirectional) 연결은 같은 레이어 또는 인접
   레이어에 둔다.
2. **좌표 계산**: 레이어 간 x 간격 400, 같은 레이어 안에서는 세로로 y 간격
   250. 예: 레이어 0 → x=0, 레이어 1 → x=400, 레이어 2 → x=800.
3. **세로 중앙 정렬**: 노드 수가 적은 레이어는 y를 가운데로 맞춘다. 예:
   옆 레이어가 3개(y=0,250,500)면 1개짜리 레이어는 y=250에 둔다.
4. **교차 최소화**: 같은 레이어 안에서의 세로 순서는 연결 상대가 가까워지도록
   정한다 — 서로 연결된 노드끼리 비슷한 y에 오게 하면 선 교차가 줄어든다.
5. **연결 없는 노드**는 캔버스 오른쪽 끝이나 아래쪽에 따로 모아 본 흐름을
   가리지 않게 한다.

**증분 편집(기존 파일에 노드 추가) 시**: 같은 레벨 형제 노드들의 x/y를 먼저
확인하고, 호출 관계상 맞는 레이어(x)의 빈 y 슬롯(기존 최댓값 + 250 등)에
배치한다. 노드 추가·connection 변화로 흐름이 크게 바뀌면 해당 레벨(같은
부모) 전체의 position을 다시 계산해 배치가 흐트러지지 않게 유지한다.

## 검증 체크리스트 (저장 전 반드시 수행, 실패 시 수정 후 재검증)

- [ ] JSON 파싱 성공 (`python3 -m json.tool <파일> > /dev/null`)
- [ ] 4개 최상위 배열(systems/containers/components/codeElements) 모두 존재
- [ ] 모든 `id`가 모델 전체에서 고유
- [ ] 모든 `systemId`/`containerId`/`componentId`/`targetId`가 실존 노드 id를 참조
- [ ] connection은 같은 레벨 노드끼리만 연결
- [ ] 모든 노드에 `connections` 배열 존재 (없으면 `[]`)

**주의**: C4 Modelizer의 import 검증은 느슨해서 형식 오류 시 조용히 실패하거나
렌더링이 깨진다. 필수 필드(특히 4개 최상위 배열, id/name/position/type, 하위
노드의 계층 참조 필드, connections 배열) 누락에 특히 주의하라.

## 편집 예시

새 워커 컨테이너 추가 시 — `containers` 배열에 노드를 추가하고, 그 워커가
호출하는 대상(예: DB)으로의 connection을 함께 넣는다:

```json
{
  "id": "cont-report-worker",
  "name": "리포트 워커",
  "type": "container",
  "systemId": "sys-qsim",
  "technology": "python",
  "description": "일일 리포트 생성 배치 워커. Celery 기반.",
  "position": { "x": 400, "y": 1150 },
  "connections": [
    {
      "targetId": "cont-db",
      "label": "집계 조회",
      "technology": "postgresql",
      "description": "리포트용 집계 데이터 읽기"
    }
  ]
}
```
