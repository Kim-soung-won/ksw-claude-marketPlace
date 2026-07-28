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
 * 이 파일은 CLI 엔트리다 — 로직은 lib/distill/ 하위 모듈로 분리돼 있다:
 *   constants(상수) ← compact(압축 유틸) ← subagents(사이드카 귀속) ← core(digest)
 *   ← orchestrate(큐 드레인). 여기서는 argv 파싱과 stdout 출력만 맡는다.
 *
 * 사용:
 *   node distill-session.mjs --all
 *       ~/.agent-factory/queue.jsonl **전체**를 git_root별로 그룹핑해
 *  각 그룹을 자기 레포
 *       기준으로 distill해 커밋별 digest JSON 배열로 출력하고, 처리분을 processed.jsonl로
 *       옮긴다. git_root 없는(구버전 훅) 항목은 귀속할 레포가 없어 큐에 남는다. 어느
 *       경로에서 실행하든 사용자 레벨 큐 전체가 대상이다(cwd/gitRoot 인자 무관).
 *   node distill-session.mjs --drain [--dir <gitRoot>]
 *       ~/.agent-factory/queue.jsonl 중 **해당 레포(gitRoot)** 항목만 distill해 JSON
 *       배열로 출력하고, 처리분을 processed.jsonl로 옮긴다. 다른 레포 항목은 큐에 남는다.
 *   node distill-session.mjs <jsonlPath> --from-offset N --to-offset M
 *       단일 구간을 distill해 digest 하나를 출력한다(상태 변경 없음).
 */
import { drain, drainAll, resolveGitRoot } from "./lib/distill/orchestrate.mjs";
import { distillWindow } from "./lib/distill/core.mjs";

function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "--all") {
    // 큐 전체(모든 레포)를 처리한다. cwd/gitRoot 인자를 받지 않는다.
    process.stdout.write(JSON.stringify(drainAll(), null, 2) + "\n");
    return;
  }
  if (argv[0] === "--drain") {
    const dirIdx = argv.indexOf("--dir");
    const dir = dirIdx >= 0 ? argv[dirIdx + 1] : process.cwd();
    process.stdout.write(JSON.stringify(drain(resolveGitRoot(dir)), null, 2) + "\n");
    return;
  }
  // 단일 구간 모드
  const jsonlPath = argv[0];
  if (!jsonlPath) {
    process.stderr.write("usage: distill-session.mjs --all | --drain [--dir <gitRoot>] | <jsonlPath> [--from-offset N] [--to-offset M]\n");
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
