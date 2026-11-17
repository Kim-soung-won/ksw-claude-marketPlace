#!/usr/bin/env bash
# 점검 전용 임시 Chrome 을 별도 프로필·디버깅 포트로 띄운다.
# 사용: [CHROME=<실행 파일>] launch-chrome.sh <작업 폴더> [포트=9333] [창 폭=1440] [창 높이=900]
set -euo pipefail

WORK="${1:?작업 폴더를 첫 인자로 준다 (프로필이 이 안에 만들어진다)}"
PORT="${2:-9333}"
WIDTH="${3:-1440}"
HEIGHT="${4:-900}"

# 이미 같은 포트에 떠 있으면 다시 띄우지 않는다
if curl -s "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
  echo "이미 실행 중: http://127.0.0.1:${PORT}"
  exit 0
fi

# CHROME 환경 변수로 실행 파일을 직접 지정할 수 있다. 없으면 흔한 설치 위치에서 찾는다.
CHROME_BIN=""
for c in \
  "${CHROME:-}" \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "$(command -v google-chrome || true)" \
  "$(command -v google-chrome-stable || true)" \
  "$(command -v chromium || true)" \
  "$(command -v chromium-browser || true)"; do
  if [ -n "$c" ] && [ -x "$c" ]; then CHROME_BIN="$c"; break; fi
done
if [ -z "$CHROME_BIN" ]; then
  echo "Chrome 실행 파일을 찾지 못했다. CHROME=<실행 파일 경로> 를 주고 다시 실행한다." >&2
  exit 1
fi

mkdir -p "${WORK}/chrome-profile" "${WORK}/shots"
"$CHROME_BIN" \
  --user-data-dir="${WORK}/chrome-profile" \
  --remote-debugging-port="${PORT}" \
  --no-first-run --no-default-browser-check \
  --window-size="${WIDTH},${HEIGHT}" \
  about:blank >/dev/null 2>&1 &

# 디버깅 포트가 열릴 때까지 최대 15초 기다린다
for _ in $(seq 1 30); do
  if curl -s "http://127.0.0.1:${PORT}/json/version" >/dev/null 2>&1; then
    echo "실행됨: http://127.0.0.1:${PORT} (프로필: ${WORK}/chrome-profile)"
    exit 0
  fi
  sleep 0.5
done
echo "Chrome 이 ${PORT} 포트에서 응답하지 않는다." >&2
exit 1
