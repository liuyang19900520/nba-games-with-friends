#!/bin/bash
set -e

# Configuration
# Hardcoded for now based on discovery, but could be parameterized
PUBLIC_IP="57.182.161.64"
REMOTE_USER="ubuntu"
REMOTE_HOST="${REMOTE_USER}@${PUBLIC_IP}"
# Using the key found in the user's home directory
SSH_KEY="${HOME}/.ssh/LightsailDefaultKey-ap-northeast-1.pem"
REMOTE_DIR="/home/ubuntu/n8n"
LOCAL_DIR="$(cd "$(dirname "$0")/n8n" && pwd)"

# Colors
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}=== n8n Automatic Deployment ===${NC}"
echo "Target: ${REMOTE_HOST}"
echo "Key: ${SSH_KEY}"
echo "Local Config: ${LOCAL_DIR}/docker-compose.yml"

# Verification
if [ ! -f "${SSH_KEY}" ]; then
    echo "Error: SSH Key not found at ${SSH_KEY}"
    exit 1
fi

if [ ! -f "${LOCAL_DIR}/docker-compose.yml" ]; then
    echo "Error: docker-compose.yml not found at ${LOCAL_DIR}/docker-compose.yml"
    exit 1
fi

echo ""
echo "[1/2] Copying updated docker-compose.yml..."
scp -o StrictHostKeyChecking=no -i "${SSH_KEY}" \
    "${LOCAL_DIR}/docker-compose.yml" \
    "${REMOTE_HOST}:${REMOTE_DIR}/docker-compose.yml"

# Sync Data Sync Worker
echo "[2/2] Restarting n8n services..."
ssh -o StrictHostKeyChecking=no -i "${SSH_KEY}" "${REMOTE_HOST}" \
    "cd ${REMOTE_DIR} && docker compose pull && docker compose up -d"

echo ""
echo -e "${GREEN}✅ Deployment Success!${NC}"
echo "n8n storage retention policy should now be updated."
