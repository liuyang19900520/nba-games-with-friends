#!/bin/bash
# =============================================================================
# Data Sync Deploy Script (called by GitHub Actions or manually)
# This script runs ON the EC2 instance
# =============================================================================
set -e

APP_DIR="/home/ubuntu/nba-games-with-friends"

echo "🔄 Deploying Data Sync Worker to Docker..."

# Pull latest code
cd "$APP_DIR"
# Auto-detect remote name (default to origin if not found)
REMOTE_NAME=$(git remote | head -n 1)
REMOTE_NAME=${REMOTE_NAME:-origin}

echo "📡 Using remote: $REMOTE_NAME"
git fetch "$REMOTE_NAME"
git checkout "$1"  # branch name passed as argument (dev or main)
git pull "$REMOTE_NAME" "$1"

# Move to the service directory where docker-compose.yml is located
cd "$APP_DIR/services/data-sync"

# Rebuild and restart the docker container
echo "🐳 Rebuilding and restarting nba-worker container..."
sudo docker compose build nba-worker
sudo docker compose up -d nba-worker

# Wait and check status
sleep 5
if sudo docker ps | grep -q "nba-sync-worker"; then
    echo "✅ Deploy successful! Container is running."
else
    echo "❌ Container failed to start. Checking logs..."
    sudo docker logs --tail 20 nba-sync-worker
    exit 1
fi
