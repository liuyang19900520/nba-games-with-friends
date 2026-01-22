#!/bin/bash
# NBA Worker 启动脚本
# 自动阻止 Mac 睡眠并启动 Docker worker

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🏀 NBA Data Sync Worker 启动脚本"
echo "=================================="

# 检查 Docker 是否运行
if ! docker info > /dev/null 2>&1; then
    echo "⏳ 启动 Docker Desktop..."
    open -a Docker
    
    # 等待 Docker 启动
    for i in {1..60}; do
        if docker info > /dev/null 2>&1; then
            echo "✅ Docker 已就绪"
            break
        fi
        echo "   等待中... ($i/60)"
        sleep 2
    done
fi

# 阻止 Mac 睡眠 (后台运行)
echo "☕ 启用 caffeinate (阻止睡眠)..."
caffeinate -d -i -s -w $$ &
CAFFEINATE_PID=$!

# 捕获退出信号，清理 caffeinate
cleanup() {
    echo ""
    echo "🛑 正在停止..."
    kill $CAFFEINATE_PID 2>/dev/null || true
    docker compose --profile dev down
    echo "✅ 已清理"
}
trap cleanup EXIT INT TERM

# 启动 worker
echo "🚀 启动 Docker worker..."
docker compose --profile dev up --build nba-worker-dev

echo "Worker 已停止"
