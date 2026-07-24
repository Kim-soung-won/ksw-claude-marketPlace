#!/usr/bin/env node
/**
 * distill-session — 세션 JSONL 델타 구간을 요약·피드백에 필요한 신호만 남긴
 * 압축 digest로 전처리한다(결정론적, LLM 없음). summarizer 에이전트는 원본 JSONL이
 * 아니라 이 digest만 읽으므로 토큰 사용량이 크게 준다.
 *
 * 버리는 것(요약·피드백에 불필요한 부피):
 *   - thinking의 signature(base64), usage/cache_creation/iterations 토큰 장부의 중첩
 *   - uuid/parentUuid/requestId/sourceToolAssistantUUID
 *   - toolUseResult의 file.content·originalFile·structuredPatch 전문(중복 파일 덤프)
 *   - 성공한 tool_result의 장문 stdout(길이·head만 남김)
 * 남기는 것(신호):
 *   - user 프롬프트 텍스트, assistant 최종 텍스트
 *   - tool_use의 name + 압축 input(Edit→파일, Agent→subagent_type, Skill→skill명 …)
 *   - 에러(is_error + 짧은 메시지) — 재작업/정정 루프 신호
 *   - 에이전트 경계(attributionAgent) — 누가 무엇을 했는지
 *   - 턴별 집계 토큰(비용 피드백용)
 *
 * JSONL 이벤트 스키마의 근거는 claude-code-jsonl 스킬이다.
 *
 * 사용:
 *   node distill-session.mjs --drain [--dir <gitRoot>]
 *       ~/.agent-factory/queue.jsonl 중 **해당 레포(gitRoot)** 항목만 distill해 JSON
 *       배열로 출력하고, 처리분을 processed.jsonl로 옮긴다. 다른 레포 항목은 큐에 남는다.
 *   node distill-session.mjs <jsonlPath> --from-offset N --to-offset M
 *       단일 구간을 distill해 digest 하나를 출력한다(상태 변경 없음).
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { PROCESSED_PATH, QUEUE_PATH, projectSessionsDir } from "../lib/factory-home.mjs";

const TEXT_LIMIT = 600;
const CMD_LIMIT = 200;
const ERR_LIMIT = 300;
const STDOUT_HEAD = 120;
// 델타당 timeline 항목 수 상한 — 델타 크기와 무관하게 digest 를 유계로 만든다.
// 큰 델타(예: 세션 전체가 한 커밋에 잡힌 경우)에서 timeline 이 무한정 길어져 digest 가
// 부풀고 summarizer 토큰이 과소모되던 문제를 막는다. 실측 튜닝 가능한 상수.
const TIMELINE_LIMIT = 400;

// 감정 신호 어휘 사전(확장 가능). 결정론적 감지라 LLM이 놓치지 않는다.
// 부정 신호는 assistant "출력"에서, 긍정 신호는 user "입력"에서만 찾는다.
const NEGATIVE_OUTPUT_MARKERS = ["미안", "죄송", "실수", "잘못", "착오", "오류였", "헷갈", "깜빡"];
const POSITIVE_INPUT_MARKERS = ["좋아", "좋네", "좋은데", "잘했", "훌륭", "완벽", "굿", "최고", "나이스"];

/** 텍스트에서 어휘 사전과 일치하는 마커를 모은다. */
function matchMarkers(text, lexicon) {
  if (typeof text !== "string") return [];
  return lexicon.filter((m) => text.includes(m));
}

function truncate(s, n) {
  if (typeof s !== "string") return s;
  const t = s.replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n) + `…(+${t.length - n})` : t;
}

function readSlice(jsonlPath, fromOffset, toOffset) {
  const fd = fs.openSync(jsonlPath, "r");
  try {
    const size = fs.fstatSync(fd).size;
    const start = Math.max(0, Math.min(fromOffset || 0, size));
    const end = Math.max(start, Math.min(toOffset ?? size, size));
    const len = end - start;
    if (len <= 0) return [];
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, start);
    return buf.toString("utf8").split("\n");
  } finally {
    fs.closeSync(fd);
  }
}

/** tool_use input을 도구별로 한 줄 신호로 압축한다. */
function compactToolInput(name, input) {
  if (!input || typeof input !== "object") return undefined;
  const base = (p) => (typeof p === "string" ? p.split("/").pop() : p);
  switch (name) {
    case "Edit":
    case "Write":
    case "Read":
    case "NotebookEdit":
      return base(input.file_path);
    case "Bash":
      return truncate(input.command, CMD_LIMIT);
    case "Agent":
      return truncate(
        `${input.subagent_type || "general"}: ${input.description || ""}`,
        TEXT_LIMIT,
      );
    case "Skill":
      return input.args ? `${input.skill} (${truncate(input.args, 80)})` : input.skill;
    case "Task":
    case "Artifact":
      return base(input.file_path) || truncate(input.description, 120);
    default:
      if (name && name.startsWith("mcp__")) {
        const parts = name.split("__");
        return parts.length >= 3 ? `${parts[1]}/${parts.slice(2).join("__")}` : name;
      }
      return undefined;
  }
}

function addUsage(totals, usage) {
  if (!usage) return;
  totals.input += usage.input_tokens || 0;
  totals.output += usage.output_tokens || 0;
  totals.cache_read += usage.cache_read_input_tokens || 0;
  totals.cache_creation += usage.cache_creation_input_tokens || 0;
}

/**
 * timeline 을 결정론적으로 유계화한다(LLM 없이 배열 순회만). 반환 `{ timeline, meta }`.
 *
 * 신호 보존 우선순위:
 *   P0 = 절대 보존 — user/assistant 텍스트(감정 flag 포함)·에러 항목
 *   P1 = 압축/축소 대상 — tool_use (반복은 접고, 넘치면 버린다)
 *   P2 = 최우선 폐기 — 성공 stdout 길이 항목
 *
 * 패스 A) 연속 실행 접기: 인접 tool_use 가 tool·by 모두 같으면 하나로 접어 repeat:n 을
 *         단다(text/error/stdout 이 사이에 오면 run 이 끊긴다). 'Read/Edit 버스트'를
 *         O(1) 로 보존하고 에이전트 경계(by)를 유지한다.
 * 패스 B) 여전히 초과면 P2(stdout)를 등장 순서로 폐기.
 * 패스 C) 그래도 초과면 P0 를 전부 보존한 채 남은 P1 을 budget(limit - P0수)까지만 채운다.
 *         P0 만으로 limit 를 넘으면 P0 는 전부 남긴다(soft cap — 핵심 신호는 손실 금지).
 */
function boundTimeline(timeline) {
  const total = timeline.length;
  const meta = {
    limit: TIMELINE_LIMIT,
    total_original: total,
    collapsed_runs: 0,
    collapsed_items: 0,
    dropped_stdout: 0,
    dropped_tools: 0,
  };

  const isP0 = (it) => it.role === "user" || it.role === "assistant" || it.error === true;
  const isStdout = (it) => typeof it.result_len === "number";
  const isTool = (it) => typeof it.tool === "string";

  // 패스 A — 인접 동일 tool_use 접기
  const collapsed = [];
  for (const it of timeline) {
    const prev = collapsed[collapsed.length - 1];
    if (
      isTool(it) &&
      prev &&
      isTool(prev) &&
      prev.tool === it.tool &&
      prev.by === it.by
    ) {
      prev.repeat = (prev.repeat || 1) + 1;
      meta.collapsed_items += 1;
      if (prev.repeat === 2) meta.collapsed_runs += 1;
      continue;
    }
    collapsed.push(isTool(it) ? { ...it } : it);
  }

  if (collapsed.length <= TIMELINE_LIMIT) {
    return { timeline: collapsed, meta };
  }

  // 패스 B — 성공 stdout 항목 폐기
  let afterB = collapsed;
  const stdoutCount = collapsed.filter(isStdout).length;
  if (stdoutCount > 0) {
    afterB = collapsed.filter((it) => {
      if (isStdout(it)) {
        meta.dropped_stdout += 1;
        return false;
      }
      return true;
    });
  }

  if (afterB.length <= TIMELINE_LIMIT) {
    return { timeline: afterB, meta };
  }

  // 패스 C — P0 전량 보존 + P1 을 budget 까지만
  const p0 = afterB.filter(isP0);
  const budget = Math.max(TIMELINE_LIMIT - p0.length, 0);
  const result = [];
  let kept = 0;
  for (const it of afterB) {
    if (isP0(it)) {
      result.push(it);
    } else if (kept < budget) {
      result.push(it);
      kept += 1;
    } else {
      meta.dropped_tools += 1;
    }
  }
  return { timeline: result, meta };
}

/** attributionAgent 별 계량 누산기를 가져오거나 만든다(에이전트별 토큰·호출·에러). */
function bumpAgent(map, key) {
  let m = map.get(key);
  if (!m) {
    m = {
      agent: key,
      input: 0,
      output: 0,
      cache_read: 0,
      cache_creation: 0,
      tool_calls: 0,
      errors: 0,
    };
    map.set(key, m);
  }
  return m;
}

/** attributionAgent 문자열("plugin:agent" 또는 "agent")에서 순수 에이전트 이름만. */
function bareAgentName(key) {
  const i = key.lastIndexOf(":");
  return i === -1 ? key : key.slice(i + 1);
}

/** 델타 구간 라인들을 압축 digest로 전처리한다. */
function distillWindow(entry) {
  const lines = readSlice(entry.jsonl_path, entry.from_offset, entry.to_offset);
  const timeline = [];
  const totals = { input: 0, output: 0, cache_read: 0, cache_creation: 0 };
  const agentsSeen = new Set();
  // 에이전트별 결정론적 계량치(Sub-agents/Plugins 화면용). attributionAgent 태그된
  // 이벤트만 귀속한다 — 메인 세션 토큰은 totals(cost_tokens)에 이미 있다.
  const agentMetrics = new Map();
  // subagent_type 별 실제 spawn 횟수(Agent tool_use 카운트). frontmatter 의 unique
  // 집합보다 정확하다.
  const spawnCounts = new Map();
  // 감정 신호: 부정=assistant 출력, 긍정=user 입력
  const signals = { negative_output: [], positive_input: [] };
  let events = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let ev;
    try {
      ev = JSON.parse(trimmed);
    } catch {
      continue; // 방어적 파싱: 실패한 라인은 skip
    }
    events++;
    if (ev.attributionAgent) agentsSeen.add(ev.attributionAgent);

    const msg = ev.message;
    if (ev.type === "assistant" && msg) {
      addUsage(totals, msg.usage);
      // 서브에이전트가 낸 토큰은 그 에이전트에 귀속한다.
      if (ev.attributionAgent) addUsage(bumpAgent(agentMetrics, ev.attributionAgent), msg.usage);
      for (const item of msg.content || []) {
        if (item.type === "text" && item.text && item.text.trim()) {
          const entryOut = { role: "assistant", text: truncate(item.text, TEXT_LIMIT) };
          const neg = matchMarkers(item.text, NEGATIVE_OUTPUT_MARKERS);
          if (neg.length > 0) {
            entryOut.flag = "negative";
            entryOut.markers = neg;
            signals.negative_output.push({ markers: neg, text: truncate(item.text, ERR_LIMIT) });
          }
          timeline.push(entryOut);
        } else if (item.type === "tool_use") {
          const t = { tool: item.name };
          const s = compactToolInput(item.name, item.input);
          if (s !== undefined) t.arg = s;
          if (ev.attributionAgent) {
            t.by = ev.attributionAgent;
            bumpAgent(agentMetrics, ev.attributionAgent).tool_calls += 1;
          }
          // Agent 도구 호출 = 서브에이전트 spawn. subagent_type 별로 센다.
          if (item.name === "Agent" && item.input && item.input.subagent_type) {
            const st = item.input.subagent_type;
            spawnCounts.set(st, (spawnCounts.get(st) || 0) + 1);
          }
          timeline.push(t);
        }
        // thinking(signature 포함)은 통째로 버린다.
      }
    } else if (ev.type === "user" && msg) {
      const c = msg.content;
      if (typeof c === "string") {
        if (c.trim()) {
          const entryIn = { role: "user", text: truncate(c, TEXT_LIMIT) };
          const pos = matchMarkers(c, POSITIVE_INPUT_MARKERS);
          if (pos.length > 0) {
            entryIn.flag = "positive";
            entryIn.markers = pos;
            signals.positive_input.push({ markers: pos, text: truncate(c, ERR_LIMIT) });
          }
          timeline.push(entryIn);
        }
      } else if (Array.isArray(c)) {
        for (const item of c) {
          if (item.type === "tool_result" && item.is_error) {
            if (ev.attributionAgent) bumpAgent(agentMetrics, ev.attributionAgent).errors += 1;
            const body =
              typeof item.content === "string"
                ? item.content
                : JSON.stringify(item.content);
            timeline.push({ error: true, message: truncate(body, ERR_LIMIT) });
          }
          // 성공 tool_result의 장문 stdout·파일 덤프는 버린다(길이 신호만 남길 수도 있음).
          else if (item.type === "tool_result" && typeof item.content === "string") {
            const len = item.content.length;
            if (len > STDOUT_HEAD * 4) {
              timeline.push({ result_len: len, head: truncate(item.content, STDOUT_HEAD) });
            }
          }
        }
      }
    }
  }

  // 에이전트별 계량치에 spawn 수를 합쳐 확정한다(순수 이름으로 매칭).
  const agentCosts = [...agentMetrics.values()].map((m) => ({
    ...m,
    spawns: spawnCounts.get(bareAgentName(m.agent)) || 0,
  }));

  // timeline 을 유계화한다. cost_tokens·agent_costs·agents·signals·event_count 은
  // 이미 유계인 집계·계량치라 상한과 무관하게 완전하게 둔다.
  const { timeline: boundedTimeline, meta: timelineMeta } = boundTimeline(timeline);

  // 세션 기록·계량치는 레포가 아니라 사용자 레벨에 저장한다. 슬러그 계산(해시)은
  // 결정론적 스크립트가 하고, summarizer(LLM)는 digest.sessions_dir 를 그대로 Write
  // 대상으로 쓰면 되므로 해시 계산을 LLM 에 맡기지 않는다.
  const projectPath = entry.git_root ?? null;

  return {
    session_id: entry.session_id,
    commit: entry.commit,
    commit_message: entry.commit_message || null,
    cwd: entry.cwd,
    // 파일이 레포 밖에 저장되므로 어느 프로젝트 기록인지 digest 가 스스로 밝힌다.
    project_path: projectPath,
    project_name: projectPath ? path.basename(projectPath) : null,
    // summarizer 가 .md 를 쓸 디렉터리. 단일 구간 디버그 모드(git_root 없음)면 null.
    sessions_dir: projectPath ? projectSessionsDir(projectPath) : null,
    captured_at: entry.captured_at,
    event_count: events,
    agents: [...agentsSeen],
    cost_tokens: totals,
    // 기계 정밀 계량치 — .md(사람 요약)와 분리해 metrics.json 사이드카로 전송한다.
    agent_costs: agentCosts,
    signals,
    timeline: boundedTimeline,
    // timeline 이 상한으로 압축·절단됐는지 알린다(절단분은 요약 근거로 삼지 않게).
    timeline_meta: timelineMeta,
  };
}

/**
 * 에이전트별 결정론적 계량치를 사용자 레벨
 * `~/.agent-factory/sessions/<projectSlug>/<sha7>.metrics.json` 사이드카로 쓴다.
 *
 * 이 값은 LLM(summarizer)을 거치지 않고 서버로 직접 간다 — 토큰·비용은 정확해야
 * 의미가 있어서, 사람이 읽는 요약 `.md` 와 기계 정밀 계량치를 파일로 분리한다.
 * 파일명은 `.md` 와 같은 sha7 prefix 라, push 훅이 `.md` 로부터 짝을 찾을 수 있다.
 *
 * 파일이 레포 밖(사용자 레벨)에 있으므로, 어느 프로젝트 기록인지 내용에 담는다
 * (`project_path`/`project_name`). push 는 파일 위치가 아니라 이 값으로 프로젝트를
 * 복원해 서버에 보낸다.
 */
function writeMetricsSidecar(entry, digest) {
  if (!entry.git_root || !entry.commit) return;
  const sha7 = entry.commit.slice(0, 7);
  const dir = projectSessionsDir(entry.git_root);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(
      path.join(dir, `${sha7}.metrics.json`),
      JSON.stringify(
        {
          commit: entry.commit,
          project_path: entry.git_root,
          project_name: path.basename(entry.git_root),
          agent_costs: digest.agent_costs,
        },
        null,
        2,
      ),
    );
  } catch {
    /* 사이드카 실패는 흐름을 막지 않는다 — .md 요약은 그대로 나간다 */
  }
}

/**
 * 큐에서 `gitRoot` 레포의 항목만 골라 distill 하고, 큐에서 제거한다.
 *
 * 큐는 사용자 레벨(`~/.agent-factory/queue.jsonl`)에 모든 레포의 델타가 섞여 쌓인다.
 * 요약 결과 `.md` 는 해당 레포에 써야 하므로, 여기서 **다른 레포 항목은 손대지 않고
 * 큐에 그대로 남긴다.** 실패분도 남겨 다음 기회에 재시도한다.
 */
function drain(gitRoot) {
  const queuePath = QUEUE_PATH();
  if (!fs.existsSync(queuePath)) return [];

  const lines = fs.readFileSync(queuePath, "utf8").split("\n").filter((l) => l.trim());
  const digests = [];
  const processed = [];
  const keep = [];

  for (const line of lines) {
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue; // 깨진 줄은 버린다
    }
    // git_root 가 없는 항목은 구버전 훅이 남긴 것이라 대상 판별이 안 된다 → 이 레포 것으로 본다.
    const owner = entry.git_root ?? gitRoot;
    if (owner !== gitRoot) {
      keep.push(line);
      continue;
    }
    try {
      const digest = distillWindow(entry);
      digests.push(digest);
      writeMetricsSidecar(entry, digest);
      processed.push({ ...entry, processed: true, distilled_at: new Date().toISOString() });
    } catch {
      keep.push(line); // distill 실패 → 큐에 남겨 재시도
    }
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
function resolveGitRoot(dir) {
  try {
    return execFileSync("git", ["-C", dir, "rev-parse", "--show-toplevel"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
  } catch {
    return dir; // git 레포가 아니면 준 경로를 그대로 쓴다
  }
}

function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "--drain") {
    const dirIdx = argv.indexOf("--dir");
    const dir = dirIdx >= 0 ? argv[dirIdx + 1] : process.cwd();
    process.stdout.write(JSON.stringify(drain(resolveGitRoot(dir)), null, 2) + "\n");
    return;
  }
  // 단일 구간 모드
  const jsonlPath = argv[0];
  if (!jsonlPath) {
    process.stderr.write("usage: distill-session.mjs --drain | <jsonlPath> [--from-offset N] [--to-offset M]\n");
    process.exit(1);
  }
  const getNum = (flag) => {
    const i = argv.indexOf(flag);
    return i >= 0 ? Number(argv[i + 1]) : undefined;
  };
  const digest = distillWindow({
    session_id: null,
    commit: null,
    cwd: process.cwd(),
    captured_at: null,
    jsonl_path: jsonlPath,
    from_offset: getNum("--from-offset") ?? 0,
    to_offset: getNum("--to-offset"),
  });
  process.stdout.write(JSON.stringify(digest, null, 2) + "\n");
}

main();
