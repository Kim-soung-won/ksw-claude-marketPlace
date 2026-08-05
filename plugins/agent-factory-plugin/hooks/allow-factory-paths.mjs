#!/usr/bin/env node
/**
 * allow-factory-paths — PreToolUse 권한 자동 허용 hook.
 *
 * session-feedback-summarizer 워크플로는 매 실행마다 사용자 레벨 홈
 * (`~/.agent-factory/`)의 큐·digest 를 읽고 세션 기록 `.md`·`metrics.json` 을 쓰는데,
 * 그때마다 권한 프롬프트가 뜬다. 플러그인 서브에이전트는 frontmatter 의
 * `permissionMode`·`hooks` 가 보안상 무시되므로(로드 시 드롭), 허용은 **플러그인 훅**에서
 * 건다.
 *
 * 허용 범위는 의도적으로 좁다 — **이 플러그인이 소유한 홈 디렉터리 내부의 경로**와
 * **이 플러그인이 번들한 스크립트를 그대로 실행하는 Bash 명령**뿐이다. 그 밖의 도구 호출은
 * 아무 판정도 내리지 않고(=stdout 없이 exit 0) 평소의 권한 흐름에 그대로 맡긴다.
 * `deny` 규칙은 hook 의 allow 보다 항상 우선하므로, 사용자가 이 경로를 명시적으로 막아
 * 두었다면 그쪽이 이긴다.
 *
 * 다른 훅과 같은 규칙: 가볍고, 무슨 일이 있어도 흐름을 막지 않는다(항상 exit 0).
 */
import path from "node:path";
import os from "node:os";

const PLUGIN_ROOT = process.argv[2] || "";

function factoryHome() {
  return process.env.AGENT_FACTORY_HOME || path.join(os.homedir(), ".agent-factory");
}

/** target 이 dir 내부(또는 dir 자신)인가. 경로 문자열 prefix 비교의 오탐(`~/.agent-factoryX`)을 피한다. */
function isInside(dir, target) {
  if (!target) return false;
  const rel = path.relative(path.resolve(dir), path.resolve(target));
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

/** 도구 입력에서 파일시스템 대상 경로를 뽑는다. 없으면 null. */
function targetPath(toolName, input = {}) {
  switch (toolName) {
    case "Read":
    case "Write":
    case "Edit":
    case "NotebookEdit":
      return input.file_path || input.notebook_path || null;
    case "Glob":
    case "Grep":
      return input.path || null;
    default:
      return null;
  }
}

/** 이 플러그인이 번들한 스크립트를 실행하는 명령인가. */
function isBundledScript(command) {
  if (!command || !PLUGIN_ROOT) return false;
  const scripts = [
    path.join(PLUGIN_ROOT, "scripts", "distill-session.mjs"),
    path.join(PLUGIN_ROOT, "hooks", "push-sessions.mjs"),
  ];
  return scripts.some((s) => command.includes(s));
}

function main(payload) {
  const tool = payload.tool_name;
  const input = payload.tool_input || {};

  let allow = false;
  let reason = "";

  if (tool === "Bash") {
    allow = isBundledScript(input.command);
    reason = "agent-factory-plugin 번들 스크립트 실행";
  } else {
    const target = targetPath(tool, input);
    allow = isInside(factoryHome(), target);
    reason = "agent-factory 사용자 레벨 홈 내부 경로";
  }

  if (!allow) return; // 판정하지 않음 — 평소 권한 흐름 그대로

  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "allow",
        permissionDecisionReason: reason,
      },
    })
  );
}

let raw = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (c) => (raw += c));
process.stdin.on("end", () => {
  try {
    main(JSON.parse(raw || "{}"));
  } catch {
    /* 판정 없이 통과 */
  }
  process.exit(0);
});
