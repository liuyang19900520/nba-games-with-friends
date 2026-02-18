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
git fetch origin
git checkout "$1"  # branch name passed as argument (dev or main)
git pull origin "$1"

# Update dependencies
cd "$SERVICE_DIR"
source venv/bin/activate
pip install -r requirements.txt --quiet

# Restart service
sudo systemctl restart ai-agent

# Wait and check health
sleep 3
if curl -sf http://localhost:8000/health > /dev/null 2>&1; then
    echo "✅ Deploy successful! Health check passed."
else
    echo "❌ Health check failed. Checking logs..."
    sudo journalctl -u ai-agent -n 20 --no-pager
    exit 1
fi
