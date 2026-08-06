# mfe-architecture-plugin

마이크로 프론트엔드(Module Federation) 아키텍처를 다루는 플러그인이다.
기준 스택은 **React + rsbuild + `@module-federation/rsbuild-plugin`(빌드) +
`@module-federation/enhanced/runtime`(런타임)**, 구성은 **셸(Host) 1개 + 도메인 Remote N개**다.

## 구성

| 종류 | 이름 | 역할 |
|---|---|---|
| 에이전트 | `mfe-config-architect` | Host·Remote 설정(빌드·런타임 등록·노출·env)을 생성하거나 규약 대조로 검토 |
| 에이전트 | `remote-contract-manager` | Remote 가 `exposes` 로 공개한 계약을 `MFE_{RemoteName}` SKILL.md 로 기록·감사 |
| 스킬 | `mfe-runtime-troubleshooting` | 런타임 통합 실패를 6계열로 분류해 진단하는 절차 + 사례집 |
| 스킬 | `mfe-boundary-design` | 무엇을 모듈로 뗄지·무엇을 셸에 둘지·모듈 간 통신 경로를 정하는 판단 기준 + 사례집 |

## 리소스

```
resources/mfe-config-architect/
  mf-config-reference.md      ← 규칙 원본(역할 구분·shared 정책·init 등록·노출 규약·통신·등급 기준)
  review-output-format.md
resources/remote-contract-manager/
  contract-skill-format.md    ← 계약 SKILL.md 포맷 규칙
  result-output-format.md
```

에이전트 본문은 라우팅만 담고, 규칙 원본과 출력 형식은 위 리소스에서 필요한 시점에 Read 한다.

## 쓰는 순서

1. **무엇을 모듈로 뗄지 미정** → 스킬 `mfe-boundary-design`
2. **설정을 만들거나 검토** → 에이전트 `mfe-config-architect`
3. **노출면을 문서로 남김** → 에이전트 `remote-contract-manager`
4. **런타임에서 깨짐** → 스킬 `mfe-runtime-troubleshooting`

## 관련

- 프로젝트 폴더 구조(FSD)와 컴포넌트 설계는 `frontend-support-plugin`
- 공용 컴포넌트 라이브러리 인터페이스 문서화는 `ui-template-manage-plugin`
