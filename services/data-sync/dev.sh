#!/bin/bash
# NBA Worker Startup Script
# Automatically prevents Mac sleep and starts Docker worker

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "🏀 NBA Data Sync Worker Startup Script"
echo "=================================="

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "⏳ Starting Docker Desktop..."
    open -a Docker
    
    # 等待 Docker 启动
    for i in {1..60}; do
        if docker info > /dev/null 2>&1; then
            echo "✅ Docker 已就绪"
            break
        fi
        echo "   Waiting... ($i/60)"
        sleep 2
    done
fi

# Prevent Mac from sleeping (Run in background)
echo "☕ Enabling caffeinate (Prevent sleep)..."
caffeinate -d -i -s -w $$ &
CAFFEINATE_PID=$!

# Capture exit signal, cleanup caffeinate
cleanup() {
    echo ""
    echo "🛑 Stopping..."
    kill $CAFFEINATE_PID 2>/dev/null || true
    docker compose --profile dev down
    echo "✅ Cleaned up"
}
trap cleanup EXIT INT TERM

# Start worker
echo "🚀 Starting Docker worker..."
docker compose --profile dev up --build nba-worker-dev

echo "Worker stopped"
