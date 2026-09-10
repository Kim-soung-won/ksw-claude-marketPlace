# C4 Modelizer schemaVersion 2 flat 스키마 참조

## 목차

- 최상위 구조
- 노드 공통 필드와 계층 참조
- connection 구조
- technology 필드 규칙과 카탈로그
- position 배치 관례
- 편집 예시

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
- 4개 배열(`systems`, `containers`, `components`, `codeElements`)이 모두
  존재해야 import가 성공한다. 비어 있어도 빈 배열로 유지한다 — 편집 중
  배열을 삭제하지 않는다.
- `viewLevel`: `'system' | 'container' | 'component' | 'code'`.

## 노드 공통 필드와 계층 참조

모든 노드에 필수: `id`(모델 전체 고유, 예: `"sys-api"`, `"cont-web"`),
`name`, `type`, `position`(`{"x": n, "y": n}`), `connections`(없으면 `[]`).
`technology`와 `description`은 스펙상 선택이지만 이 프로젝트에서는 항상
채운다.

선택 필드 `healthCheck`(`{"url": string, "verified": boolean,
"intervalMs"?: number}`): 실행 중인 HTTP 서비스 노드에만 붙는 라이브 health
check 주소다. 앱이 이 주소를 폴링해 해당 노드로 들어오는 연결선 색으로
상태를 표시한다. 동기화 중 이 필드를 만나면 그대로 보존하고, 서비스의
포트·health 엔드포인트가 바뀌는 변경이면 `url`을 갱신하되 `verified`를
`false`로 되돌린다(사용자가 앱에서 재확인). 새로 추가하는 서버 노드에
넣을 때도 `verified: false`로 넣는다.

계층 소속은 connection이 아니라 참조 필드로 표현한다:

| type | 계층 참조 필수 필드 |
|---|---|
| `"system"` | (없음) |
| `"container"` | `systemId` |
| `"component"` | `systemId` + `containerId` |
| `"code"` | `systemId` + `containerId` + `componentId` (+ `codeType`) |

연결(`connections`)은 **같은 레벨의 노드끼리만** 만든다: system↔system,
container↔container, component↔component. 노드를 삭제할 때는 다른 노드의
`connections`에서 그 id를 가리키는 항목과, 하위 노드(계층 참조로 소속된
container/component)도 함께 정리한다.

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

- `targetId` 필수, 실존 노드 id.
- `technology`에는 통신 방식(http, https, websocket, grpc, amqp,
  postgresql 등), `label`에는 무엇을 주고받는지 적는다.
- 선택: `bidirectional`, `sourceHandle`, `targetHandle`, `labelPosition`.
- **인프로세스 호출 관례**: 프로세스 경계가 없는 호출도 엣지로 표기해야
  하면 `technology`를 임시 부여하되(기존 파일은 `grpc` 사용), `description`
  에 "인프로세스 호출"임을 명시한다.

## technology 필드 규칙과 카탈로그

`technology` 값은 앱 내장 카탈로그의 **소문자 id와 정확히 일치**해야
아이콘·색상이 렌더링된다 ("PostgreSQL" ✗ → "postgresql" ✓).

- 언어: java, javascript, typescript, python, ruby, php, c, cpp, csharp, go,
  kotlin, swift, dart, rust, scala, perl, haskell, elixir, clojure, erlang,
  objectivec, shell, powershell, r, matlab, fsharp, visualbasic, lua, groovy,
  nim
- 프레임워크: react, angular, vue, nextjs, nuxtjs, svelte, nestjs, django,
  rails, spring, flask, express, laravel, symfony, bootstrap, tailwind,
  gatsby, ember
- DB (노드가 자동으로 원통 모양이 됨): postgresql, mysql, mariadb, mongodb,
  redis, cassandra, oracle, sqlserver, sqlite, dynamodb, elasticsearch,
  neo4j, couchdb, influxdb
- 메시지 브로커: kafka, rabbitmq, amazonsqs, redisstreams, nats, mqtt
- 클라우드: aws, azure, gcp, ibmcloud, oraclecloud, digitalocean, heroku,
  vercel, netlify
- DevOps: docker, kubernetes, terraform, ansible, jenkins, githubactions,
  gitlabci, argo, helm
- 모니터링: prometheus, grafana, newrelic, splunk, opentelemetry, jaeger,
  zipkin
- 프로토콜 (주로 connection용): http, https, tcp, udp, websocket, grpc,
  amqp, ftp, sftp, ssh, dns
- SaaS: stripe, twilio, sendgrid, shopify, algolia, cloudflare, mailchimp
- 보안: vault, snyk, trivy, auth0, okta
- 코드 호스팅: github, gitlab, bitbucket, azuredevops, sourceforge, gitea
- 일반 시스템: users, server, database-server, client-device, mobile-device,
  router, firewall, cloud, vpn, storage, load-balancer
- 커스텀: mfe

카탈로그에 정확히 일치하는 id가 없으면(예: FastAPI, TimescaleDB, Telegram)
가장 가까운 상위 개념 id를 쓰고("python", "postgresql", "server"/"cloud"),
구체 기술명은 `name`이나 `description`에 명시한다 — 예: name
"API 백엔드 (FastAPI)", technology "python".

## position 배치 관례

`position`은 다이어그램 좌표일 뿐 아키텍처 의미는 없지만, 새 노드가 기존
노드와 겹치면 렌더링이 망가진다.

- 기존 파일은 레이어드 흐름 배치를 따른다: 호출하는 쪽이 왼쪽, 호출받는
  쪽이 오른쪽. 레이어 간 x 간격 400, 같은 레이어 안 y 간격 250.
- 새 노드는 **같은 레벨 형제 노드들의 x/y를 먼저 확인**하고, 호출 관계상
  맞는 레이어(x)의 빈 y 슬롯(기존 최댓값 + 250 등)에 배치한다.
- 연결이 없는 노드는 오른쪽 끝이나 아래쪽에 둔다.

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
