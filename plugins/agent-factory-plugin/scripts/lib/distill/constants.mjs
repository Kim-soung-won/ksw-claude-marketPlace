/**
 * distill 공용 상수 — 압축 한계값과 감정 신호 어휘 사전. 계층 최하단(의존 없음).
 */
export const TEXT_LIMIT = 600;
export const CMD_LIMIT = 200;
export const ERR_LIMIT = 300;
export const STDOUT_HEAD = 120;
// 델타당 timeline 항목 수 상한 — 델타 크기와 무관하게 digest 를 유계로 만든다.
// 큰 델타(예: 세션 전체가 한 커밋에 잡힌 경우)에서 timeline 이 무한정 길어져 digest 가
// 부풀고 summarizer 토큰이 과소모되던 문제를 막는다. 실측 튜닝 가능한 상수.
export const TIMELINE_LIMIT = 400;

// ── 세션 위생(컨텍스트 경계) 지표 상한 — 전부 실측 튜닝 가능한 상수다.
// 세션당 유지할 컨텍스트 크기 샘플 수(커밋당 1개 적재). 상한 초과 시 오래된 앞부분을
// 버리되, 누적 reset 카운터는 별도 보존해 프루닝의 영향을 받지 않는다(hygiene.mjs).
export const MAX_HYGIENE_SAMPLES = 200;
// session-hygiene.json 이 담을 세션 수 상한. 초과 시 updated_at 이 오래된 세션부터
// 버려 파일 무한성장을 막는다(현재 세션은 방금 갱신돼 최신이라 살아남는다).
export const MAX_HYGIENE_SESSIONS = 500;
// 최종 tool_result 스파이크 목록 상한(재청구 추정 비용 상위 N개).
export const MAX_RESULT_SPIKES = 10;
// 스파이크로 볼 최소 tool_result 길이(글자). 더 이상 timeline result_len 문턱
// (STDOUT_HEAD * 4 = 480자)과 동일하지 않다 — 480자(~120토큰)는 몇 줄짜리 출력이면
// 다 걸려 신호가 약했다. 의미 있는 크기로 상향한다. RESULT_SPIKE_MIN > STDOUT_HEAD*4
// 이어야 core 의 outer timeline gate(len > 480) 안에서 자연히 상위 게이팅된다.
export const RESULT_SPIKE_MIN = 2000;
// 순회 중 잔류 턴 확정 전까지 모으는 스파이크 후보 버퍼 상한(메모리 유계화).
// 순회가 끝나야 turns_resident 를 알 수 있어 후보를 잠시 쌓는다 — len 하위부터 evict 한다.
export const MAX_SPIKE_CANDIDATES = 200;
// 유저 입력(프롬프트·붙여넣기)을 컨텍스트 급상승 원인으로 볼 최소 길이(글자). 사용자가 스스로
// 넣은 대용량 컨텍스트(예: API 응답 붙여넣기)를 잡되, 평범한 상세 지시는 안 걸리도록
// tool_result 문턱(RESULT_SPIKE_MIN)보다 높게 둔다. 내용은 싣지 않고 길이·라벨만 기록한다.
export const USER_INPUT_SPIKE_MIN = 4000;
// 턴별 컨텍스트 시계열의 방어적 상한(포인트 수). 다운샘플 없이 전량 저장하되, 폭주 세션이
// 한 커밋에 통째로 잡히는 극단(수천 턴)에서 행이 무한정 커지는 것만 막는다. 실제 델타는
// 보통 수십~수백 턴이라 이 상한엔 걸리지 않는다. 초과 시 앞부분(초반 턴)부터 유지한다.
export const MAX_CONTEXT_SERIES = 5000;

// 감정 신호 어휘 사전(확장 가능). 결정론적 감지라 LLM이 놓치지 않는다.
// 부정 신호는 assistant "출력"에서, 긍정 신호는 user "입력"에서만 찾는다.
export const NEGATIVE_OUTPUT_MARKERS = ["미안", "죄송", "실수", "잘못", "착오", "오류였", "헷갈", "깜빡"];
export const POSITIVE_INPUT_MARKERS = ["좋아", "좋네", "좋은데", "잘했", "훌륭", "완벽", "굿", "최고", "나이스"];
