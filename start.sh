#!/usr/bin/env bash
# 案头 antou —— macOS / Linux / Git Bash 启动脚本
set -u
cd "$(dirname "$0")" || exit 1

echo "案头 antou - 本地启动"
echo "当前目录：$(pwd)"
echo

PY=""
for c in python3 python; do
  if command -v "$c" >/dev/null 2>&1; then PY="$c"; break; fi
done
if [ -z "$PY" ]; then
  echo "[x] 没找到 Python。请先安装 Python 3.9+"
  exit 1
fi

if [ ! -f dist/index.html ]; then
  if [ -f package.json ]; then
    echo "没找到 dist/，尝试构建..."
    command -v npm >/dev/null 2>&1 || { echo "[x] 没有 dist/ 也没有 npm"; exit 1; }
    [ -d node_modules ] || npm install
    npm run build
    [ -f dist/index.html ] || { echo "[x] 构建失败"; exit 1; }
  else
    echo "[x] 当前目录既没有 dist/ 也没有 package.json，可能解压不完整"
    exit 1
  fi
fi

exec "$PY" -u serve.py --port 8000 --open
