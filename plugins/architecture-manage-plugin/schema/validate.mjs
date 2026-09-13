// C4 Modelizer 모델 파일 검증기 (무의존 Node ESM)
//
// c4-model.schema.json(구조·enum의 단일 소스)이 표현할 수 없는
// **의미 규칙**을 강제한다: id 고유성, 부모/타깃 상호참조, connection 동일 레벨,
// deployment 3계층 부모 규칙, containerInstance → 논리 container 참조 무결성.
// 이걸 통과하면 앱에 import 했을 때 깨지지 않음을 보장한다.
//
// 사용:  node <플러그인 루트>/schema/validate.mjs <model.json>
//        node <플러그인 루트>/schema/validate.mjs <model.json> --json   (기계용 출력)
//
// enum 값은 c4-model.schema.json과 같은 TS 타입에서 나온 것이며 동기 상태여야 한다.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const LEVELS = ["system", "container", "component", "code"];
const ARRAY_KEYS = {
  system: "systems",
  container: "containers",
  component: "components",
  code: "codeElements",
};
const VIEW_LEVELS = ["system", "container", "component", "code"];
const CODE_TYPES = ["class", "function", "interface", "variable", "other"];
const DEP_NODE_TYPES = [
  "zone",
  "environment",
  "network",
  "subnet",
  "node",
  "containerInstance",
  "appliance",
  "external",
];
// 자식을 담을 수 있는(경계) 타입 — 부모는 반드시 이 중 하나여야 한다.
const DEP_CONTAINER_TYPES = [
  "zone",
  "environment",
  "network",
  "subnet",
  "node",
  "external",
];
const DEP_EDGE_KINDS = [
  "internal",
  "network",
  "peering",
  "vpn",
  "egress",
  "internet",
  "mgmt",
];
const APPLIANCE_KINDS = [
  "internet-gateway",
  "nat-gateway",
  "vpn-ipsec",
  "vpn-ssl",
  "peering",
  "firewall",
  "load-balancer",
  "router",
  "kms",
  "dns",
  "cdn",
  "gateway",
  "other",
];

/**
 * @param {unknown} model 파싱된 모델 객체
 * @returns {{ errors: string[], warnings: string[] }}
 */
export function validateModelFile(model) {
  const errors = [];
  const warnings = [];
  const E = (m) => errors.push(m);
  const W = (m) => warnings.push(m);

  if (model == null || typeof model !== "object" || Array.isArray(model)) {
    E("최상위가 객체가 아닙니다");
    return { errors, warnings };
  }

  if (model.schemaVersion !== 2) {
    E(`schemaVersion은 2여야 합니다 (현재: ${JSON.stringify(model.schemaVersion)})`);
  }
  if (!VIEW_LEVELS.includes(model.viewLevel)) {
    E(`viewLevel이 유효하지 않습니다: ${JSON.stringify(model.viewLevel)}`);
  }
  for (const key of Object.values(ARRAY_KEYS)) {
    if (!Array.isArray(model[key])) E(`최상위 배열 '${key}'가 없습니다`);
  }

  // --- 논리 블록 수집 + 기본 형태 검사 ---
  const byId = new Map(); // id -> block
  const typeOf = new Map(); // id -> level
  for (const level of LEVELS) {
    const arr = model[ARRAY_KEYS[level]];
    if (!Array.isArray(arr)) continue;
    arr.forEach((b, i) => {
      const where = `${ARRAY_KEYS[level]}[${i}]`;
      if (!b || typeof b !== "object") {
        E(`${where}가 객체가 아닙니다`);
        return;
      }
      if (typeof b.id !== "string" || !b.id) E(`${where}: id 누락`);
      if (typeof b.name !== "string" || !b.name) E(`${where}(${b.id ?? "?"}): name 누락`);
      if (b.type !== level) E(`${b.id}: type이 ${JSON.stringify(b.type)}, 기대 '${level}'`);
      if (!b.position || typeof b.position.x !== "number" || typeof b.position.y !== "number")
        E(`${b.id}: position 누락/형식 오류`);
      if (!Array.isArray(b.connections)) E(`${b.id}: connections 배열 누락 (없으면 [])`);
      if (typeof b.id === "string" && b.id) {
        if (byId.has(b.id)) E(`id 중복: ${b.id}`);
        byId.set(b.id, b);
        typeOf.set(b.id, level);
      }
    });
  }

  const refIsType = (id, level) => byId.has(id) && typeOf.get(id) === level;

  // --- 부모(상위 레벨) 참조 무결성 ---
  (model.containers ?? []).forEach((c) => {
    if (!c?.systemId) E(`container ${c?.id}: systemId 누락`);
    else if (!refIsType(c.systemId, "system"))
      E(`container ${c.id}: systemId ${c.systemId}가 실존 system을 가리키지 않음`);
  });
  (model.components ?? []).forEach((c) => {
    if (!refIsType(c?.containerId, "container"))
      E(`component ${c?.id}: containerId ${c?.containerId} 무효`);
    if (!refIsType(c?.systemId, "system"))
      E(`component ${c?.id}: systemId ${c?.systemId} 무효`);
  });
  (model.codeElements ?? []).forEach((c) => {
    if (!refIsType(c?.componentId, "component"))
      E(`code ${c?.id}: componentId ${c?.componentId} 무효`);
    if (!refIsType(c?.containerId, "container"))
      E(`code ${c?.id}: containerId ${c?.containerId} 무효`);
    if (!refIsType(c?.systemId, "system"))
      E(`code ${c?.id}: systemId ${c?.systemId} 무효`);
    if (!CODE_TYPES.includes(c?.codeType))
      E(`code ${c?.id}: codeType 무효 (${JSON.stringify(c?.codeType)})`);
  });

  // --- connection: 대상 존재 + 같은 레벨끼리만 ---
  for (const level of LEVELS) {
    (model[ARRAY_KEYS[level]] ?? []).forEach((b) => {
      if (!Array.isArray(b?.connections)) return;
      b.connections.forEach((cn) => {
        if (!cn || typeof cn.targetId !== "string") {
          E(`${b.id}: connection에 targetId 누락`);
          return;
        }
        if (!byId.has(cn.targetId)) E(`${b.id} → ${cn.targetId}: 연결 대상 없음`);
        else if (typeOf.get(cn.targetId) !== level)
          E(`${b.id} → ${cn.targetId}: 다른 레벨(${typeOf.get(cn.targetId)}) 연결 — connection은 같은 레벨끼리만`);
        if (cn.targetId === b.id) W(`${b.id}: 자기 자신에게 연결`);
      });
    });
  }

  // --- deployment(물리) 레이어 (선택) ---
  if (model.deployment !== undefined) {
    const d = model.deployment;
    if (d == null || typeof d !== "object" || Array.isArray(d)) {
      E("deployment가 객체가 아닙니다");
    } else {
      if (d.schemaVersion !== 1)
        E(`deployment.schemaVersion은 1이어야 합니다 (현재: ${JSON.stringify(d.schemaVersion)})`);
      if (!Array.isArray(d.nodes)) {
        E("deployment.nodes 배열 누락");
      } else {
        const depById = new Map();
        d.nodes.forEach((n, i) => {
          const where = `deployment.nodes[${i}]`;
          if (!n || typeof n !== "object") {
            E(`${where}가 객체가 아닙니다`);
            return;
          }
          if (typeof n.id !== "string" || !n.id) E(`${where}: id 누락`);
          if (typeof n.name !== "string" || !n.name) E(`deployment ${n.id ?? "?"}: name 누락`);
          if (!DEP_NODE_TYPES.includes(n.nodeType))
            E(`deployment ${n.id}: nodeType 무효 (${JSON.stringify(n.nodeType)})`);
          if (!n.position || typeof n.position.x !== "number" || typeof n.position.y !== "number")
            E(`deployment ${n.id}: position 누락/형식 오류`);
          if (typeof n.id === "string" && n.id) {
            if (depById.has(n.id)) E(`deployment id 중복: ${n.id}`);
            depById.set(n.id, n);
          }
        });
        d.nodes.forEach((n) => {
          // 부모가 있으면 실존하는 경계(컨테이너) 타입이어야 한다.
          if (n.parentId) {
            const p = depById.get(n.parentId);
            if (!p) E(`deployment ${n.id}: 부모 ${n.parentId} 없음`);
            else if (!DEP_CONTAINER_TYPES.includes(p.nodeType))
              E(`deployment ${n.id}: 부모 ${p.id}(${p.nodeType})는 자식을 담을 수 없는 타입`);
          }
          // 부모 사슬 순환 검출
          const seen = new Set([n.id]);
          let cur = n.parentId ? depById.get(n.parentId) : undefined;
          while (cur) {
            if (seen.has(cur.id)) {
              E(`deployment ${n.id}: 부모 사슬 순환`);
              break;
            }
            seen.add(cur.id);
            cur = cur.parentId ? depById.get(cur.parentId) : undefined;
          }
          if (n.applianceKind !== undefined && !APPLIANCE_KINDS.includes(n.applianceKind))
            E(`deployment ${n.id}: applianceKind 무효 (${JSON.stringify(n.applianceKind)})`);
          if (n.resources !== undefined) {
            if (n.resources == null || typeof n.resources !== "object" || Array.isArray(n.resources))
              E(`deployment ${n.id}: resources가 객체가 아닙니다`);
            else
              for (const k of ["cpu", "memory", "storage", "gpu"])
                if (n.resources[k] !== undefined && typeof n.resources[k] !== "string")
                  E(`deployment ${n.id}: resources.${k}는 문자열이어야 합니다`);
          }
          if (n.nodeType === "containerInstance") {
            if (!n.containerId)
              W(`deployment ${n.id}: containerId 없음 (논리 container 미연결)`);
            else if (!refIsType(n.containerId, "container"))
              E(`deployment ${n.id}: containerId ${n.containerId}가 실존 container를 가리키지 않음`);
          }
        });

        // 엣지 검증
        if (d.edges !== undefined) {
          if (!Array.isArray(d.edges)) {
            E("deployment.edges는 배열이어야 합니다");
          } else {
            const edgeIds = new Set();
            d.edges.forEach((e, i) => {
              const where = `deployment.edges[${i}]`;
              if (!e || typeof e !== "object") {
                E(`${where}가 객체가 아닙니다`);
                return;
              }
              if (typeof e.id !== "string" || !e.id) E(`${where}: id 누락`);
              else if (edgeIds.has(e.id)) E(`deployment edge id 중복: ${e.id}`);
              else edgeIds.add(e.id);
              if (!depById.has(e.source)) E(`${where}: source ${JSON.stringify(e.source)} 없는 노드`);
              if (!depById.has(e.target)) E(`${where}: target ${JSON.stringify(e.target)} 없는 노드`);
              if (e.source === e.target) W(`deployment edge ${e.id}: 자기 자신에게 연결`);
              if (e.kind !== undefined && !DEP_EDGE_KINDS.includes(e.kind))
                E(`deployment edge ${e.id}: kind 무효 (${JSON.stringify(e.kind)})`);
            });
          }
        }
      }
    }
  }

  // --- designIntent(설계 의도) 레이어 (선택, 1급 자산) ---
  if (model.designIntent !== undefined) {
    const di = model.designIntent;
    if (di == null || typeof di !== "object" || Array.isArray(di)) {
      E("designIntent가 객체가 아닙니다");
    } else {
      // 모든 노드(논리 + 배포)의 id 집합 — relatedIds/blockedIds 참조 확인용
      const knownIds = new Set(byId.keys());
      if (Array.isArray(model.deployment?.nodes))
        model.deployment.nodes.forEach((n) => n?.id && knownIds.add(n.id));

      if (di.decisions !== undefined) {
        if (!Array.isArray(di.decisions)) E("designIntent.decisions는 배열이어야 합니다");
        else
          di.decisions.forEach((d, i) => {
            const w = `designIntent.decisions[${i}]`;
            if (!d || typeof d !== "object") return E(`${w}가 객체가 아닙니다`);
            if (typeof d.id !== "string" || !d.id) E(`${w}: id 누락`);
            if (typeof d.topic !== "string" || !d.topic) E(`${w}(${d.id}): topic 누락`);
            if (typeof d.choice !== "string" || !d.choice) E(`${w}(${d.id}): choice 누락`);
            // "이유 없는 설계는 없다" — why는 필수
            if (typeof d.why !== "string" || !d.why.trim())
              E(`${w}(${d.id}): why(이유) 누락 — 결정에는 반드시 이유가 있어야 한다`);
            if (d.decidedAt !== undefined && (typeof d.decidedAt !== "string" || Number.isNaN(Date.parse(d.decidedAt))))
              W(`decision ${d.id}: decidedAt이 유효한 날짜/시간 문자열이 아님`);
            (d.relatedIds ?? []).forEach((rid) => {
              if (!knownIds.has(rid))
                W(`decision ${d.id}: relatedIds의 ${rid}가 실존 노드를 가리키지 않음`);
            });
          });
      }

      if (di.openQuestions !== undefined) {
        if (!Array.isArray(di.openQuestions)) E("designIntent.openQuestions는 배열이어야 합니다");
        else
          di.openQuestions.forEach((q, i) => {
            const w = `designIntent.openQuestions[${i}]`;
            if (!q || typeof q !== "object") return E(`${w}가 객체가 아닙니다`);
            if (typeof q.id !== "string" || !q.id) E(`${w}: id 누락`);
            if (typeof q.question !== "string" || !q.question) E(`${w}(${q.id}): question 누락`);
            (q.blockedIds ?? []).forEach((bid) => {
              if (!knownIds.has(bid))
                W(`question ${q.id}: blockedIds의 ${bid}가 실존 노드를 가리키지 않음`);
            });
          });
      }

      if (di.glossary !== undefined && (typeof di.glossary !== "object" || Array.isArray(di.glossary)))
        E("designIntent.glossary는 객체(용어→정의)여야 합니다");
      if (di.personas !== undefined && !Array.isArray(di.personas))
        E("designIntent.personas는 배열이어야 합니다");
      if (di.outOfScope !== undefined && !Array.isArray(di.outOfScope))
        E("designIntent.outOfScope는 배열이어야 합니다");
    }
  }

  return { errors, warnings };
}

// ---------------- CLI ----------------
function runCli() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const path = args.find((a) => !a.startsWith("--"));
  if (!path) {
    console.error("사용법: node <플러그인 루트>/schema/validate.mjs <model.json> [--json]");
    process.exit(2);
  }

  let model;
  try {
    model = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    if (asJson) console.log(JSON.stringify({ ok: false, errors: [`JSON 파싱 실패: ${e.message}`], warnings: [] }));
    else console.error(`❌ JSON 파싱 실패: ${e.message}`);
    process.exit(1);
  }

  const { errors, warnings } = validateModelFile(model);

  if (asJson) {
    console.log(JSON.stringify({ ok: errors.length === 0, errors, warnings }, null, 2));
  } else {
    warnings.forEach((w) => console.warn(`⚠️  ${w}`));
    if (errors.length === 0) {
      console.log(`✅ 검증 통과${warnings.length ? ` (경고 ${warnings.length}건)` : ""} — 앱에 import 가능`);
    } else {
      console.error(`❌ 검증 실패 (오류 ${errors.length}건):`);
      errors.forEach((e) => console.error(`   • ${e}`));
    }
  }
  process.exit(errors.length === 0 ? 0 : 1);
}

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  runCli();
}
