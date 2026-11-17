#!/usr/bin/env bash
# 작업 폴더에 playwright-core 를 설치한다 (브라우저 바이너리는 받지 않는다 — 설치된 Chrome 에 접속만 한다).
# 사용: setup.sh <작업 폴더>
set -euo pipefail

WORK="${1:?작업 폴더를 첫 인자로 준다}"
mkdir -p "$WORK"
cd "$WORK"

if [ -d node_modules/playwright-core ]; then
  echo "playwright-core 가 이미 있다: ${WORK}/node_modules/playwright-core"
  exit 0
fi
[ -f package.json ] || npm init -y >/dev/null
npm install --no-audit --no-fund playwright-core >/dev/null
echo "설치됨: ${WORK}/node_modules/playwright-core"
