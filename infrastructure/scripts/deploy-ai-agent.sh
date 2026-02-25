#!/bin/bash
# =============================================================================
# AI Agent Deploy Script (called by GitHub Actions or manually)
# This script runs ON the EC2 instance
# =============================================================================
set -e

APP_DIR="/home/ubuntu/nba-games-with-friends"
SERVICE_DIR="$APP_DIR/services/ai-agent"

echo "🔄 Deploying AI Agent..."

# Pull latest code
cd "$APP_DIR"
# Auto-detect remote name (default to origin if not found)
REMOTE_NAME=$(git remote | head -n 1)
REMOTE_NAME=${REMOTE_NAME:-origin}

echo "📡 Using remote: $REMOTE_NAME"
git fetch "$REMOTE_NAME"
git checkout "$1"  # branch name passed as argument (dev or main)
git pull "$REMOTE_NAME" "$1"

# Update dependencies
cd "$SERVICE_DIR"
source venv/bin/activate
pip install -r requirements.txt --quiet

# Determine Service and Port based on branch
BRANCH=$1
if [ "$BRANCH" == "main" ]; then
    SERVICE="ai-agent-main"
    PORT=8001
else
    SERVICE="ai-agent-dev"
    PORT=8000
fi

# Restart service
echo "🔄 Restarting service: $SERVICE"
sudo systemctl restart $SERVICE

# Wait and check health
sleep 3
if curl -sf http://localhost:$PORT/health > /dev/null 2>&1; then
    echo "✅ Deploy successful! Health check passed on port $PORT."
else
    echo "❌ Health check failed. Checking logs..."
    sudo journalctl -u $SERVICE -n 20 --no-pager
    exit 1
fi
