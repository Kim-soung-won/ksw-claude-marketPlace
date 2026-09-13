# C4 Modelizer 스키마 스펙 (사람용 요약)

> **권위 소스**: 이 문서는 사람이 읽기 위한 요약이다. 실제 스키마의 **단일 진실
> 소스는 앱 코드에서 생성된** [번들 JSON Schema](../../../schema/c4-model.schema.json)(JSON Schema)이며,
> 원본 타입은 `src/types/c4ModelFile.ts`다. 필드·enum이 아래와 어긋나면 **생성된
> 스키마가 우선**한다 (`npm run gen:schema`로 갱신). 최종 검증은 항상
> [번들 검증기](../../../schema/validate.mjs)로 한다.

이 스키마는 **논리 4레벨(system/container/component/code) + 물리 deployment 레이어**를 담는다.

## 최상위 구조

```json
{
  "schemaVersion": 2,
  "viewLevel": "system",
  "systems": [],
  "containers": [],
  "components": [],
  "codeElements": [],
  "deployment": { "schemaVersion": 1, "nodes": [] }
}
```

- `schemaVersion`은 반드시 숫자 `2`.
- `systems`/`containers`/`components`/`codeElements` **4개 배열이 전부 존재**해야
  import가 성공한다 (비어 있어도 `[]`로 포함).
- `viewLevel`: `'system' | 'container' | 'component' | 'code'` 중 하나. 보통 `"system"`으로 시작.
- 선택: `activeSystemId`, `activeContainerId`, `activeComponentId`.
- `deployment`는 **선택** — 물리 레이어가 없으면 통째로 생략한다(논리만 있는 파일).

## 논리 노드 공통 필드 (BaseBlock)

- `id`: string, 전체 모델에서 고유 (예: "sys-api", "cont-api-db")
- `name`: string
- `position`: `{ "x": number, "y": number }`
- `type`: 노드 유형 문자열
- 선택: `description`, `url`, `technology`, `healthCheck`

### 노드 유형별 필수 필드

| 유형     | type          | 계층 참조 필드                                  | 기타 |
| -------- | ------------- | ----------------------------------------------- | ---- |
| 시스템   | `"system"`    | (없음)                                          | `connections[]` |
| 컨테이너 | `"container"` | `systemId` 필수                                 | `connections[]` |
| 컴포넌트 | `"component"` | `systemId` + `containerId` 필수                 | `connections[]` |
| 코드     | `"code"`      | `systemId` + `containerId` + `componentId` 필수 | `codeType`('class'\|'function'\|'interface'\|'variable'\|'other'), 선택 `code`, `connections[]` |

`connections`는 모든 노드에 배열로 반드시 포함(연결 없으면 `[]`).

**ConnectionData** (소스 노드 `connections` 안): `targetId`(필수), 선택 `label`,
`technology`, `description`, `sourceHandle`, `targetHandle`, `labelPosition`, `bidirectional`.

### healthCheck 필드 (선택 — 라이브 상태 표시용)

노드가 실행 중인 서버/서비스이고 접근 정보를 확인할 수 있으면 채운다. 앱이 이
주소를 주기적으로 호출해 연결선 색으로 상태를 표시한다(초록=정상/주황=느림/빨강=응답없음).

```json
"healthCheck": { "url": "http://localhost:8080/actuator/health", "verified": false }
```

- `url`: 추출 우선순위 — ① 명시적 health 엔드포인트(`/actuator/health`, `/healthz`,
  `/health`, `/ping`, docker-compose `healthcheck.test`) → ② 서비스 포트(docker
  `ports`, `.env.example` PORT류, k8s Service/Ingress) → ③ 없으면 루트(`http://localhost:<port>/`).
- `verified`: **자료에서 뽑거나 자동 생성할 때는 항상 `false`.** 사용자가 앱에서 실제
  주소로 확인·수정하면 `true`가 된다. 호스트명은 컨테이너 내부 이름(`redis:6379`) 대신
  `localhost` + 호스트 매핑 포트로 치환.
- `intervalMs`(선택): 폴링 주기. 특별한 이유 없으면 생략(기본 15초).
- 적용 대상: HTTP로 응답하는 실행 프로세스에만. DB·브로커 자체, 액터(users),
  외부 SaaS엔 넣지 않는다. 확신 없으면 넣지 말고 후보로 보고.

### technology 필드 (아이콘·색상·노드 모양 결정)

`technology` 값은 앱 내장 카탈로그(`src/data/technologies/*.json`)의 **소문자 id와
정확히 일치**해야 렌더링된다. "PostgreSQL" 같은 표기는 매칭 실패 — "postgresql"처럼 쓴다.

사용 가능한 id:

- 언어: java, javascript, typescript, python, ruby, php, c, cpp, csharp, go, kotlin, swift, dart, rust, scala, perl, haskell, elixir, clojure, erlang, objectivec, shell, powershell, r, matlab, fsharp, visualbasic, lua, groovy, nim
- 프레임워크: react, angular, vue, nextjs, nuxtjs, svelte, nestjs, django, rails, spring, flask, express, laravel, symfony, bootstrap, tailwind, gatsby, ember
- DB: postgresql, mysql, mariadb, mongodb, redis, cassandra, oracle, sqlserver, sqlite, dynamodb, elasticsearch, neo4j, couchdb, influxdb (이 id를 쓰면 노드가 DB 원통 모양으로 렌더링)
- 메시지 브로커: kafka, rabbitmq, amazonsqs, redisstreams, nats, mqtt
- 클라우드: aws, azure, gcp, ibmcloud, oraclecloud, digitalocean, heroku, vercel, netlify
- DevOps: docker, kubernetes, terraform, ansible, jenkins, githubactions, gitlabci, argo, helm
- 모니터링: prometheus, grafana, newrelic, splunk, opentelemetry, jaeger, zipkin
- 프로토콜(주로 connection용): http, https, tcp, udp, websocket, grpc, amqp, ftp, sftp, ssh, dns
- SaaS: stripe, twilio, sendgrid, shopify, algolia, cloudflare, mailchimp
- 보안: vault, snyk, trivy, auth0, okta
- 코드 호스팅: github, gitlab, bitbucket, azuredevops, sourceforge, gitea
- 일반 시스템: users, server, database-server, client-device, mobile-device, router, firewall, cloud, vpn, storage, load-balancer
- 커스텀: mfe

적용 규칙:

- 기술을 **식별할 수 있는** 노드에 채운다. 자료에 기술이 드러나지 않으면(기획서 등)
  무리하게 지어내지 말고 비우거나 사용자에게 묻는다.
- 노드당 id 1개. 가장 대표적인 것 선택(API=프레임워크/언어, 프론트=react 등, DB=엔진 id).
- 정확히 일치하는 id가 없으면(FastAPI, TimescaleDB 등) 가장 가까운 상위 id를 쓰고
  ("python", "postgresql", "server"), 구체명은 `name`/`description`에 명시.
- connection의 `technology`엔 통신 방식(http/websocket/grpc/amqp…), `label`엔 무엇을 주고받는지.

## 작성 지침 (논리)

- **position (레이어드 흐름 배치)**: 등장 순서로 채우지 말고 의존 흐름이 왼쪽→오른쪽으로
  읽히게 레이어를 나눈다. 레벨별 독립 캔버스이므로 같은 부모끼리 각각 적용:
  1. connection 방향으로 호출하는 쪽=왼쪽, 받는 쪽=오른쪽. 전형: 액터/클라이언트 →
     프론트/게이트웨이 → 핵심 서비스 → 저장소·외부 SaaS. 상호연결은 인접 레이어에.
  2. 레이어 간 x 400, 레이어 내 y 250. (레이어0 x=0, 레이어1 x=400 …)
  3. 노드 적은 레이어는 세로 중앙 정렬.
  4. 같은 레이어 세로 순서는 연결 상대와 가깝게(교차 최소화).
  5. 연결 없는 노드는 오른쪽/아래로 모아 본 흐름을 안 가리게.
  - 인터뷰로 노드가 점진 추가되면 **흐름이 바뀔 때마다 그 레벨 전체 position을 다시 계산**한다.
- **연결은 같은 레벨끼리만**. 상위-하위 관계는 connection이 아니라 `systemId`/`containerId`/`componentId`로.
- 계층 참조 무결성: 모든 참조 id는 실존 노드를 가리켜야 한다.
- 모든 노드에 `description`을 채운다(역할 + 무엇으로 구현됐는지).

## deployment (물리) 레이어

논리 컨테이너를 실제 인프라 위에 배치하는 **단순 3계층** 트리다. 저장 형태:

```json
"deployment": {
  "schemaVersion": 1,
  "nodes": [
    { "id": "env-prod", "name": "Production", "nodeType": "environment", "position": {"x":40,"y":40}, "technology": "AWS ap-northeast-2" },
    { "id": "eks", "name": "EKS 클러스터", "nodeType": "node", "parentId": "env-prod", "position": {"x":24,"y":200}, "technology": "Kubernetes 1.29" },
    { "id": "api-inst", "name": "주문 API", "nodeType": "containerInstance", "parentId": "eks", "position": {"x":20,"y":40}, "containerId": "cont-api", "replicas": 3, "environment": "prod" }
  ]
}
```

DeploymentNode 필드:

- `id`(고유), `name`, `nodeType`, `position{x,y}`
- `nodeType`: `'environment' | 'node' | 'containerInstance'`
- `parentId`: 부모 노드 id. **3계층 부모 규칙**:
  - `environment` → 최상위 (parentId 없음)
  - `node` → 부모는 `environment`
  - `containerInstance` → 부모는 `node`
- `technology`(선택): 자유 라벨 ("AWS EC2", "ap-northeast-2", "db.r6g.large"). 카탈로그 id 아님.
- `description`(선택)
- containerInstance 전용: `containerId`(논리 `containers[]`의 실존 id 참조 — **참조 무결성 필수**),
  `replicas`(숫자), `environment`(라벨: prod/staging…)

주의:
- containerInstance의 `containerId`는 반드시 실존 container를 가리켜야 한다(끊기면 앱에서 "⚠ deleted" 표시).
- position은 넣어도 되지만 **앱이 자동 레이아웃**하므로 대략값이어도 무방하다.
- 물리 정보가 없으면 `deployment` 필드 자체를 넣지 않는다.

## designIntent (설계 의도) 레이어 — 1급 자산

아키텍처 사실과 별개로 **왜 그렇게 설계했는가**를 담는다. 앱의 Design Intent
드로어에서 보이고 편집되며 model JSON에 함께 저장된다(없으면 필드 생략).

```json
"designIntent": {
  "personas": ["기획자", "개발자"],
  "glossary": { "정산": "가맹점에 대금을 지급하는 배치" },
  "decisions": [
    { "id": "d1", "topic": "결제 처리", "choice": "외부 PG 사용",
      "why": "PCI 범위 축소", "rejected": ["자체 구현"], "relatedIds": ["cont-pg-gateway"], "decidedBy": "개발자" }
  ],
  "openQuestions": [ { "id": "q1", "question": "캐시 TTL 미정", "blockedIds": ["cont-cache"] } ],
  "outOfScope": ["code 레벨은 이번 범위 아님"],
  "nextStep": "주문 API 컴포넌트 분해",
  "lastUpdated": "2026-09-07"
}
```

- `decisions[].why`는 **필수**(검증기가 강제) — 이유 없는 결정은 기록하지 않는다.
- `relatedIds`/`blockedIds`는 논리 노드 또는 deployment 노드 id를 가리킨다(끊기면 경고).
- `openQuestions`(아직 못 정함) vs `outOfScope`(의도적으로 안 함)를 구분한다.

## 최종 검증

저장 후 반드시 기계 검증:

```bash
node "<플러그인 루트>/schema/validate.mjs" <파일.json>
```

id 고유성·계층 참조·connection 동일 레벨·deployment 3계층 부모 규칙·containerInstance
container 참조까지 강제한다. **PASS(exit 0)**가 나올 때까지 고쳐 재검증한다.
