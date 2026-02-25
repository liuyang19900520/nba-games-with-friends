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

# Set correct Docker Compose project name
PROJECT_NAME="nba-sync-$1"

# Rebuild and restart the docker container
echo "🐳 Rebuilding and restarting sync-worker container for $PROJECT_NAME..."
sudo docker compose -p "$PROJECT_NAME" build sync-worker
sudo docker compose -p "$PROJECT_NAME" up -d sync-worker

# Wait and check status
sleep 3
if sudo docker ps | grep -q "$PROJECT_NAME-sync-worker"; then
    echo "✅ Deploy successful! Container is running."
else
    echo "❌ Container failed to start. Checking logs..."
    sudo docker logs --tail 20 "$PROJECT_NAME-sync-worker-1" || sudo docker logs --tail 20 "$PROJECT_NAME-sync-worker"
    exit 1
fi
