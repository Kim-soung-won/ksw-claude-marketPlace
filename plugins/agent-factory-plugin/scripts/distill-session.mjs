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
import { execFileSync } from "node:child_process";
import { PROCESSED_PATH, QUEUE_PATH } from "../lib/factory-home.mjs";

const TEXT_LIMIT = 600;
const CMD_LIMIT = 200;
const ERR_LIMIT = 300;
const STDOUT_HEAD = 120;

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

/** 델타 구간 라인들을 압축 digest로 전처리한다. */
function distillWindow(entry) {
  const lines = readSlice(entry.jsonl_path, entry.from_offset, entry.to_offset);
  const timeline = [];
  const totals = { input: 0, output: 0, cache_read: 0, cache_creation: 0 };
  const agentsSeen = new Set();
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
          if (ev.attributionAgent) t.by = ev.attributionAgent;
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

  return {
    session_id: entry.session_id,
    commit: entry.commit,
    commit_message: entry.commit_message || null,
    cwd: entry.cwd,
    captured_at: entry.captured_at,
    event_count: events,
    agents: [...agentsSeen],
    cost_tokens: totals,
    signals,
    timeline,
  };
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
      digests.push(distillWindow(entry));
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
