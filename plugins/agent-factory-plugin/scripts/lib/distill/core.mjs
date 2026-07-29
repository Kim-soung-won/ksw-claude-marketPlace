/**
 * 코어 distill — 델타 구간 라인을 압축 digest 로 전처리하고, 에이전트별 계량치를
 * metrics.json 사이드카로 쓴다. 계층: constants/compact/subagents/factory-home ← core.
 */
import fs from "node:fs";
import path from "node:path";
import { appendLog, projectSessionsDir } from "../../../lib/factory-home.mjs";
import {
  readSlice,
  truncate,
  matchMarkers,
  addUsage,
  bumpAgent,
  boundTimeline,
  compactToolInput,
} from "./compact.mjs";
import {
  TEXT_LIMIT,
  ERR_LIMIT,
  STDOUT_HEAD,
  RESULT_SPIKE_MIN,
  MAX_SPIKE_CANDIDATES,
  NEGATIVE_OUTPUT_MARKERS,
  POSITIVE_INPUT_MARKERS,
} from "./constants.mjs";
import { resolveSubagentsDir, attributeSubagents } from "./subagents.mjs";
import { computeDeltaHygiene, recordSessionSample } from "./hygiene.mjs";

/**
 * 여러 큐 항목(같은 커밋의 델타 구간들)의 라인을 offset 순서로 이어붙인다.
 * 슬라이스 경계는 커밋 시점 파일 끝(=라인 경계)이라 concat 이 JSONL 라인을 쪼개지 않는다.
 */
export function collectLines(entries) {
  const sorted = [...entries].sort((a, b) => (a.from_offset || 0) - (b.from_offset || 0));
  const lines = [];
  for (const e of sorted) {
    for (const line of readSlice(e.jsonl_path, e.from_offset, e.to_offset)) {
      lines.push(line);
    }
  }
  return lines;
}

/** 단일 구간 → digest (하위호환 래퍼). CLI 단일 구간 모드가 이 시그니처를 쓴다. */
export function distillWindow(entry) {
  return distillLines(collectLines([entry]), entry);
}

/** 같은 커밋의 여러 구간을 하나의 digest 로 병합한다. meta 는 그 커밋의 신원 정보. */
export function distillCommit(entries, meta) {
  // 델타 병합(fold-forward/amend)된 여러 구간 중 하나라도 축소면 이 커밋을 리셋으로 본다.
  const m = { ...meta, delta_shrank: entries.some((e) => e.shrank === true) };
  return distillLines(collectLines(entries), m);
}

/**
 * 이어붙인 라인 배열을 압축 digest 로 전처리한다. meta 는 커밋 신원
 * ({ session_id, commit, commit_message, cwd, git_root, captured_at }).
 */
export function distillLines(lines, meta) {
  const timeline = [];
  const totals = { input: 0, output: 0, cache_read: 0, cache_creation: 0 };
  const agentsSeen = new Set();
  // 에이전트별 결정론적 계량치(Sub-agents/Plugins 화면용). 두 소스에서 채운다:
  //   1) 메인 트랜스크립트의 attributionAgent 태그(현재 이벤트 0건이나 향후 대비 유지).
  //   2) 세션 subagents/agent-<id>.jsonl 사이드카 — 루프 뒤 attributeSubagents 가
  //      델타 내 Agent tool_use id(toolUseId) 기준으로 읽어 이 맵에 누산한다.
  // 메인 세션 토큰은 totals(cost_tokens)에 있고, 여기엔 더하지 않는다(메인/서브 분리).
  // 사이드카가 없으면 아래 spawnCounts 로 spawn 수만 채운다(graceful degradation).
  const agentMetrics = new Map();
  // subagent_type 별 실제 spawn 횟수(Agent tool_use 카운트). attributionAgent 유무와
  // 무관하게 항상 잡히므로, agent_costs·agents 는 이 카운트를 기준으로 채운다.
  const spawnCounts = new Map();
  // 감정 신호: 부정=assistant 출력, 긍정=user 입력
  const signals = { negative_output: [], positive_input: [] };
  // 세션 위생(델타 스코프) 신호. lastTurnCtx = 마지막 assistant 턴의 컨텍스트 크기
  // (input+cache_read) = 이 커밋 시점 컨텍스트 크기 샘플. maxTurnContextJump = 인접 턴
  // 컨텍스트 최대 증가폭(대용량 read 등 단일 턴 급증). maxResultLen = 최대 tool_result
  // 길이. resultSpikeCandidates = 임계 초과 tool_result 후보(생성 시점 턴 인덱스 포함) —
  // 순회 종료 후 finalizeResultSpikes 가 "재청구 추정 비용(크기×잔류 턴)" 상위 N개로 마감한다.
  let lastTurnCtx = null;
  let maxTurnContext = 0;
  let prevTurnCtx = null;
  let maxTurnContextJump = 0;
  // 턴별 컨텍스트 크기 시계열 `[turnIndex, ctx]`(다운샘플 없이 전량). 컨텍스트가 언제
  // 부풀었는지(초과 비용 시점)를 그대로 담아 상세화면 스파크라인의 입력이 된다.
  const contextSeries = [];
  let maxResultLen = 0;
  // assistant 턴 카운터 — tool_result 의 "생성 시점 턴 인덱스"로 쓰이며, 잔류 턴 수 계산의 기준.
  let assistantTurns = 0;
  const resultSpikeCandidates = [];
  let events = 0;
  // 이 델타 구간 안에서 spawn 된 Agent tool_use 의 id 집합. meta.toolUseId 와 짝이며,
  // 서브에이전트 사이드카를 이 델타에 결정론적으로 귀속하는 1순위 키다(byte 구간 정합).
  const deltaAgentToolUseIds = new Set();
  // 델타의 시각 범위(ISO 문자열 사전식 비교). toolUseId 매칭 실패 시 폴백 판정에 쓴다.
  let timeStart = null;
  let timeEnd = null;

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
    if (typeof ev.timestamp === "string") {
      if (timeStart === null || ev.timestamp < timeStart) timeStart = ev.timestamp;
      if (timeEnd === null || ev.timestamp > timeEnd) timeEnd = ev.timestamp;
    }

    const msg = ev.message;
    if (ev.type === "assistant" && msg) {
      // 생성 시점 턴 인덱스 기준. usage 유무와 무관하게 assistant 메시지마다 센다.
      assistantTurns++;
      addUsage(totals, msg.usage);
      // 이 턴의 컨텍스트 크기 = input + cache_read(장부의 재청구 대상). 마지막 값이 이 커밋
      // 시점 컨텍스트 크기 샘플이 되고, 인접 턴 증가폭의 최대가 단일 턴 급증 신호다.
      const turnCtx =
        (msg.usage?.input_tokens || 0) + (msg.usage?.cache_read_input_tokens || 0);
      if (turnCtx > 0) {
        lastTurnCtx = turnCtx;
        contextSeries.push([assistantTurns, turnCtx]);
        if (turnCtx > maxTurnContext) maxTurnContext = turnCtx;
        if (prevTurnCtx !== null) {
          const jump = turnCtx - prevTurnCtx;
          if (jump > maxTurnContextJump) maxTurnContextJump = jump;
        }
        prevTurnCtx = turnCtx;
      }
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
            // 이 tool_use 의 id 를 델타에 기록해 사이드카를 결정론적으로 귀속한다.
            if (item.id) deltaAgentToolUseIds.add(item.id);
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
              if (len > maxResultLen) maxResultLen = len;
              // 대용량 tool_result(대용량 read 덤프 등) — 이후 턴마다 재청구되는 급증 신호.
              // 생성 시점 턴 인덱스를 함께 담아 순회 후 잔류 턴·재청구 비용으로 마감한다.
              // "먼저 나온 10개"가 아니라 후보를 모아(버퍼 상한 초과 시 len 최소를 evict)
              // 크기 상위를 유지하고, 최종 순위는 finalizeResultSpikes 가 재청구 비용으로 정한다.
              if (len >= RESULT_SPIKE_MIN) {
                resultSpikeCandidates.push({ len, turn_index: assistantTurns });
                if (resultSpikeCandidates.length > MAX_SPIKE_CANDIDATES) {
                  let minIdx = 0;
                  for (let k = 1; k < resultSpikeCandidates.length; k++) {
                    if (resultSpikeCandidates[k].len < resultSpikeCandidates[minIdx].len) minIdx = k;
                  }
                  resultSpikeCandidates.splice(minIdx, 1);
                }
              }
            }
          }
        }
      }
    }
  }

  // 서브에이전트 토큰·도구호출·에러를 사이드카에서 읽어 귀속한다. 현재 Claude Code 는
  // 서브에이전트 턴을 메인 트랜스크립트에 attributionAgent 로 남기지 않고
  // `<sessionId>/subagents/agent-<id>.jsonl` 별도 파일에 둔다. meta.toolUseId 가 이 델타
  // 안의 Agent tool_use id(deltaAgentToolUseIds)와 짝이면 그 사이드카를 이 델타에 귀속하고
  // (toolUseId 부재/불일치 시 첫 이벤트 timestamp 폴백), 계량치를 agentMetrics 에 누산한다.
  // 사이드카가 없으면(구세션·정리됨) 아래 spawnCounts 로 spawn 수만 채운다(graceful).
  // 잔존하는 attributionAgent 기반 누산 경로도 유지하지만(현재 이벤트 0건, 향후 대비 무해),
  // 둘이 동시에 존재하는 세션이 생기면 같은 에이전트를 이중 계상할 수 있다(현재는 없음).
  for (const { agentType, metrics } of attributeSubagents({
    subagentsDir: resolveSubagentsDir(meta),
    toolUseIds: deltaAgentToolUseIds,
    timeStart,
    timeEnd,
  })) {
    const t = bumpAgent(agentMetrics, agentType);
    t.input += metrics.input;
    t.output += metrics.output;
    t.cache_read += metrics.cache_read;
    t.cache_creation += metrics.cache_creation;
    t.tool_calls += metrics.tool_calls;
    t.errors += metrics.errors;
  }

  // 에이전트별 계량치와 spawn 수를 하나로 병합해 확정한다. 키는 전체 "plugin:agent"
  // 문자열 — attributionAgent·subagent_type·meta.agentType 이 모두 같은 형식이라
  // 자연히 합쳐진다. spawnCounts 를 시드로 삼으므로, 계량치가 전혀 없어도 spawn 된
  // 에이전트는 반드시 항목이 생긴다(토큰류는 0, spawns 만 채워짐).
  const costsByAgent = new Map();
  const ensureCost = (name) => {
    let m = costsByAgent.get(name);
    if (!m) {
      m = {
        agent: name,
        input: 0,
        output: 0,
        cache_read: 0,
        cache_creation: 0,
        tool_calls: 0,
        errors: 0,
        spawns: 0,
      };
      costsByAgent.set(name, m);
    }
    return m;
  };
  for (const m of agentMetrics.values()) {
    const t = ensureCost(m.agent);
    t.input += m.input;
    t.output += m.output;
    t.cache_read += m.cache_read;
    t.cache_creation += m.cache_creation;
    t.tool_calls += m.tool_calls;
    t.errors += m.errors;
  }
  for (const [type, count] of spawnCounts) {
    ensureCost(type).spawns += count;
  }
  const agentCosts = [...costsByAgent.values()];

  // timeline 을 유계화한다. cost_tokens·agent_costs·agents·signals·event_count 은
  // 이미 유계인 집계·계량치라 상한과 무관하게 완전하게 둔다.
  const { timeline: boundedTimeline, meta: timelineMeta } = boundTimeline(timeline);

  // 세션 기록·계량치는 레포가 아니라 사용자 레벨에 저장한다. 슬러그 계산(해시)은
  // 결정론적 스크립트가 하고, summarizer(LLM)는 digest.sessions_dir 를 그대로 Write
  // 대상으로 쓰면 되므로 해시 계산을 LLM 에 맡기지 않는다.
  const projectPath = meta.git_root ?? null;

  return {
    session_id: meta.session_id,
    commit: meta.commit,
    commit_message: meta.commit_message || null,
    cwd: meta.cwd,
    // 파일이 레포 밖에 저장되므로 어느 프로젝트 기록인지 digest 가 스스로 밝힌다.
    project_path: projectPath,
    project_name: projectPath ? path.basename(projectPath) : null,
    // summarizer 가 .md 를 쓸 디렉터리. 단일 구간 디버그 모드(git_root 없음)면 null.
    sessions_dir: projectPath ? projectSessionsDir(projectPath) : null,
    captured_at: meta.captured_at,
    event_count: events,
    // attributionAgent 로 관측된 에이전트 ∪ 실제 spawn 된 subagent_type. 후자를 합치므로
    // attributionAgent 가 비어도 어떤 sub-agent 를 썼는지가 항상 채워진다.
    agents: [...new Set([...agentsSeen, ...spawnCounts.keys()])],
    cost_tokens: totals,
    // 세션 위생(델타 스코프) 지표 — cr:gen 비율·출력 급증·턴 컨텍스트 급증(결정론적).
    hygiene_delta: computeDeltaHygiene({
      totals,
      maxResultLen,
      resultSpikeCandidates,
      totalAssistantTurns: assistantTurns,
      maxTurnContext,
      maxTurnContextJump,
      contextSeries,
    }),
    // 이 커밋 시점 컨텍스트 크기 샘플(세션 누적 스코프의 회귀 입력). 턴이 없으면 null.
    context_size_sample: lastTurnCtx,
    // 이 커밋 델타에서 파일 축소(compact/clear)가 있었는지. distillCommit 이 병합 구간 중
    // 하나라도 축소면 true 로 세팅하고, 단일 구간 모드는 meta.shrank 를 폴백으로 본다.
    delta_shrank: meta.delta_shrank === true || meta.shrank === true,
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
export function writeMetricsSidecar(entry, digest) {
  if (!entry.git_root || !entry.commit) return;
  const sha7 = entry.commit.slice(0, 7);
  const dir = projectSessionsDir(entry.git_root);

  // 세션 누적 스코프(기울기·리셋)는 커밋당 샘플 1개를 증분 적재해 복원한다(전체 재읽기 없음).
  // 저장 실패 시 null 을 반환하며, 아래에서 세션 스코프 필드를 null 병합한다(델타 스코프는
  // 그대로 나간다).
  const sessionScope = recordSessionSample({
    sessionId: entry.session_id,
    commit: entry.commit,
    capturedAt: entry.captured_at,
    contextSize: digest.context_size_sample ?? null,
    shrank: digest.delta_shrank === true,
  });

  const sessionHygiene = {
    // 델타 스코프(cr:gen 비율·출력 급증·턴 컨텍스트 급증).
    ...(digest.hygiene_delta || {}),
    delta_shrank: digest.delta_shrank === true,
    context_size_sample: digest.context_size_sample ?? null,
    // 세션 누적 스코프.
    session_resets: sessionScope ? sessionScope.session_resets : null,
    context_slope: sessionScope ? sessionScope.context_slope : null,
    context_samples: sessionScope ? sessionScope.context_samples : null,
  };

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
          // 세션 위생(컨텍스트 경계) 지표 — 서버 직송. 스키마는 additive.
          session_hygiene: sessionHygiene,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    // 사이드카 실패는 흐름을 막지 않는다(.md 요약은 그대로 나간다) — 로그만 남긴다.
    appendLog("distill", `metrics 사이드카 쓰기 실패 (${entry.commit?.slice(0, 7)}): ${err}`);
  }
}
