/**
 * 큐 오케스트레이션 — 사용자 레벨 큐를 레포 단위로 파티션·병합해 distill 하고, 큐
 * 재작성·processed append·metrics 사이드카까지 부수효과를 맡는다. 계층: core ← orchestrate.
 */
import fs from "node:fs";
import { execFileSync } from "node:child_process";
import { QUEUE_PATH, PROCESSED_PATH, appendLog } from "../../../lib/factory-home.mjs";
import { distillCommit, writeMetricsSidecar } from "./core.mjs";

// distinct sha 의 liveness 를 캐시한다(같은 drain 안 반복 git 호출 회피).
const commitLivenessCache = new Map();

/**
 * sha 가 현재 git 히스토리에 살아있는 커밋인지 본다. amend/reset 로 HEAD 가 바뀌면
 * 큐에 '고아 sha'(이제 존재하지 않는 커밋)가 남을 수 있어, 이를 판별해 별도 기록으로
 * 서버에 보내지 않기 위한 것이다.
 */
function commitExists(gitRoot, sha) {
  if (!sha) return false;
  const key = `${gitRoot} ${sha}`;
  if (commitLivenessCache.has(key)) return commitLivenessCache.get(key);
  let live = false;
  try {
    execFileSync("git", ["-C", gitRoot, "rev-parse", "--verify", "--quiet", `${sha}^{commit}`], {
      stdio: ["ignore", "ignore", "ignore"],
    });
    live = true;
  } catch {
    live = false;
  }
  commitLivenessCache.set(key, live);
  return live;
}

/**
 * 한 레포(gitRoot)의 큐 항목(mine: [{ entry, line }])을 **커밋 단위로 병합**해 distill 한다.
 * 파일 I/O 를 하지 않고 `{ digests, processed, keepLines }` 만 산출한다 — 큐 재작성·
 * processed.jsonl append 는 호출자(drain·drainAll)가 담당해, 단일 레포/전체 큐 어느
 * 경로에서든 이 그룹 처리 코어를 그대로 재사용한다.
 *
 * 한 세션에서 git commit 을 여러 번(커밋·amend·reset 후 재커밋) 실행하면 capture 가 같은
 * sha 에 여러 델타 구간을 큐에 쌓는다. 여기서 같은 커밋의 구간들을 하나의 digest 로 합쳐
 * **커밋당 기록 1개**를 만든다. amend/reset 로 사라진 고아 커밋의 델타는 offset 상 바로
 * 뒤따르는 실 커밋에 접어 넣는다(fold-forward) — 뒤 커밋이 아직 없으면 keepLines 로 넘겨
 * 큐에 남긴다(작업 유실·존재하지 않는 커밋 전송 둘 다 방지). commitExists 는 이 gitRoot
 * 히스토리를 기준으로 조회하므로 그룹마다 자기 레포의 liveness 로 정확히 계산된다.
 *
 * 파싱 실패 라인은 호출자가 이미 걸렀고, distill 실패 그룹은 keepLines 로 남겨 재시도한다.
 */
function distillGroup(gitRoot, mine) {
  const keepLines = [];
  const digests = [];
  const processed = [];

  // offset 오름차순(안정 정렬). 같은 sha 델타는 워터마크상 연속 구간이라 순서가 확정된다.
  mine.sort((a, b) => (a.entry.from_offset || 0) - (b.entry.from_offset || 0));

  // 커밋 단위 그룹 + fold-forward.
  const groups = []; // { commit, own: [item], folded: [item] }
  const byCommit = new Map();
  let pendingOrphans = [];

  for (const item of mine) {
    const sha = item.entry.commit;
    if (sha && commitExists(gitRoot, sha)) {
      let g = byCommit.get(sha);
      if (!g) {
        g = { commit: sha, own: [], folded: [] };
        byCommit.set(sha, g);
        groups.push(g);
      }
      g.own.push(item);
      // 앞서 쌓인 고아(사라진 커밋의 델타)를 이 실 커밋에 접어 넣는다.
      if (pendingOrphans.length > 0) {
        g.folded.push(...pendingOrphans);
        pendingOrphans = [];
      }
    } else if (!sha) {
      // commit 비어있음(HEAD 조회 실패 등 엣지) — 병합하지 않고 개별 싱글턴으로 둔다.
      groups.push({ commit: null, own: [item], folded: [] });
    } else {
      // non-empty 이나 not-live → 고아. 뒤따르는 실 커밋에 접힐 때까지 대기.
      pendingOrphans.push(item);
    }
  }
  // 뒤따르는 실 커밋이 이번 처리에 없는 말미 고아 → 큐에 남겨 다음 기회로 미룬다.
  for (const o of pendingOrphans) keepLines.push(o.line);

  for (const g of groups) {
    const all = [...g.own, ...g.folded].sort(
      (a, b) => (a.entry.from_offset || 0) - (b.entry.from_offset || 0),
    );
    // meta 는 이 커밋의 '자기' 항목 중 captured_at 최신 것(amend 후 최신 메시지 반영).
    // 자기 항목이 없으면(commit=null 싱글턴 등) 첫 항목을 쓴다.
    const ownLatest = g.own.reduce(
      (latest, it) =>
        !latest || (it.entry.captured_at || "") > (latest.entry.captured_at || "") ? it : latest,
      null,
    );
    const meta = (ownLatest ?? all[0]).entry;
    try {
      const digest = distillCommit(all.map((x) => x.entry), meta);
      digests.push(digest);
      writeMetricsSidecar(meta, digest);
      for (const x of all) {
        processed.push({ ...x.entry, processed: true, distilled_at: new Date().toISOString() });
      }
    } catch (err) {
      for (const x of all) keepLines.push(x.line); // 그룹 단위 롤백 → 큐에 남겨 재시도
      appendLog("distill", `distill 실패 (${meta.commit?.slice(0, 7) ?? "?"}): ${err}`);
    }
  }

  return { digests, processed, keepLines };
}

/**
 * 큐에서 `gitRoot` 레포 항목을 골라 커밋 단위로 병합해 distill 하고, 큐에서 제거한다.
 * 그룹 처리 코어는 distillGroup 이 담당하고, 여기서는 큐 파티션(mine/others)과 파일
 * I/O(큐 재작성·processed append)만 맡는다. 다른 레포 항목은 큐에 남겨 둔다.
 */
export function drain(gitRoot) {
  const queuePath = QUEUE_PATH();
  if (!fs.existsSync(queuePath)) return [];

  const lines = fs.readFileSync(queuePath, "utf8").split("\n").filter((l) => l.trim());
  const keep = [];
  const mine = []; // 이 레포 항목: { entry, line }

  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue; // 깨진 줄은 버린다
    }
    // git_root 가 없는 항목은 구버전 훅이 남긴 것이라 판별 불가 → 이 레포 것으로 본다.
    const owner = entry.git_root ?? gitRoot;
    if (owner !== gitRoot) {
      keep.push(line);
      continue;
    }
    mine.push({ entry, line });
  }

  const { digests, processed, keepLines } = distillGroup(gitRoot, mine);
  keep.push(...keepLines);

  if (processed.length > 0) {
    fs.appendFileSync(
      PROCESSED_PATH(),
      processed.map((p) => JSON.stringify(p)).join("\n") + "\n",
    );
  }
  fs.writeFileSync(queuePath, keep.length > 0 ? keep.join("\n") + "\n" : "");
  return digests;
}

/**
 * 큐 **전체**를 git_root별로 그룹핑해 각 그룹을 자기 레포 기준으로 distill 한다. 저장이
 * 사용자 레벨(머신당 1큐)로 통합돼 있으므로, 어느 경로에서 실행하든 큐에 쌓인 모든 레포의
 * 미처리 델타를 처리한다(레포 스코프인 --drain 과 대비).
 *
 * git_root 없는(구버전 훅) 항목은 귀속할 레포가 없어 유효한 sessions_dir 를 만들 수 없다 →
 * 큐에 남기고 로그만 남긴다(작업 유실 방지). 처리분은 processed.jsonl 로 옮기고 큐는 단
 * 한 번만 재작성한다. 한 레포 그룹의 distill 실패는 그룹 단위 롤백(keepLines)으로 격리돼
 * 다른 레포 그룹 처리를 막지 않는다.
 */
export function drainAll() {
  const queuePath = QUEUE_PATH();
  if (!fs.existsSync(queuePath)) return [];

  const lines = fs.readFileSync(queuePath, "utf8").split("\n").filter((l) => l.trim());
  const keep = [];
  const byRoot = new Map(); // gitRoot → [{ entry, line }]

  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue; // 깨진 줄은 버린다
    }
    if (!entry.git_root) {
      // 귀속할 레포가 없어 sessions_dir 를 못 만든다 → 큐 잔류 + 관측 로그.
      keep.push(line);
      appendLog("distill", "git_root 없는 큐 항목 --all에서 스킵");
      continue;
    }
    let arr = byRoot.get(entry.git_root);
    if (!arr) {
      arr = [];
      byRoot.set(entry.git_root, arr);
    }
    arr.push({ entry, line });
  }

  const digests = [];
  const processed = [];
  for (const [gitRoot, mine] of byRoot) {
    const res = distillGroup(gitRoot, mine);
    digests.push(...res.digests);
    processed.push(...res.processed);
    keep.push(...res.keepLines);
  }

  if (processed.length > 0) {
    fs.appendFileSync(
      PROCESSED_PATH(),
      processed.map((p) => JSON.stringify(p)).join("\n") + "\n",
    );
  }
  fs.writeFileSync(queuePath, keep.length > 0 ? keep.join("\n") + "\n" : "");
  return digests;
}

/**
 * 큐 항목의 `git_root` 와 맞춰야 하므로 **레포 루트로 정규화**한다.
 * 하위 디렉토리에서 실행해도 같은 레포의 항목이 잡히게 하려는 것이다.
 */
export function resolveGitRoot(dir) {
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return dir; // git 레포가 아니면 준 경로를 그대로 쓴다
  }
}
