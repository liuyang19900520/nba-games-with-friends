#!/bin/bash
set -e

# Configuration - Update these values
REMOTE_HOST=""  # e.g., ubuntu@1.2.3.4
SSH_KEY=""      # e.g., ~/.ssh/LightsailDefaultKey-ap-northeast-1.pem
REMOTE_DIR="/home/ubuntu/n8n"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_usage() {
    echo "Usage: $0 <public_ip> [ssh_key_path]"
    echo ""
    echo "Arguments:"
    echo "  public_ip     - The public IP of your Lightsail instance"
    echo "  ssh_key_path  - Path to SSH key (default: ~/.ssh/LightsailDefaultKey-ap-northeast-1.pem)"
    echo ""
    echo "Example:"
    echo "  $0 1.2.3.4"
    echo "  $0 1.2.3.4 ~/.ssh/my-key.pem"
}

if [ -z "$1" ]; then
    print_usage
    exit 1
fi

PUBLIC_IP=$1
SSH_KEY=${2:-~/.ssh/LightsailDefaultKey-ap-northeast-1.pem}
REMOTE_HOST="ubuntu@${PUBLIC_IP}"
N8N_HOST="${PUBLIC_IP}.nip.io"

echo -e "${GREEN}=== n8n Deployment Script ===${NC}"
echo "Remote Host: ${REMOTE_HOST}"
echo "SSH Key: ${SSH_KEY}"
echo "n8n Domain: ${N8N_HOST}"
echo ""

# Check if .env exists, if not create from example
if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"

    # Generate random password
    N8N_PASSWORD=$(openssl rand -base64 12)

    cat > .env << EOF
N8N_HOST=${N8N_HOST}
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=${N8N_PASSWORD}
TIMEZONE=Asia/Tokyo
EOF

    echo -e "${GREEN}.env created with:${NC}"
    echo "  User: admin"
    echo "  Password: ${N8N_PASSWORD}"
    echo ""
    echo -e "${YELLOW}SAVE THIS PASSWORD! It won't be shown again.${NC}"
    echo ""
fi

# Check for required secrets
REQUIRED_VARS=("SUPABASE_URL" "SUPABASE_SERVICE_KEY" "SUPABASE_ANON_KEY" "LINE_CHANNEL_TOKEN")
MISSING_VARS=()

for VAR in "${REQUIRED_VARS[@]}"; do
    if ! grep -q "^${VAR}=" .env; then
        MISSING_VARS+=("$VAR")
    fi
done

if [ ${#MISSING_VARS[@]} -ne 0 ]; then
    echo -e "${YELLOW}Missing required environment variables in .env:${NC}"
    for VAR in "${MISSING_VARS[@]}"; do
        read -p "${VAR}: " VALUE
        echo "${VAR}=${VALUE}" >> .env
    done
    echo -e "${GREEN}Secrets added to .env${NC}"
fi

# Verify SSH key exists
if [ ! -f "${SSH_KEY}" ]; then
    echo -e "${RED}Error: SSH key not found at ${SSH_KEY}${NC}"
    echo "Download it from Lightsail console: Account > SSH keys"
    exit 1
fi

# Get script directory for static files
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "[1/4] Creating remote directory..."
ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no "${REMOTE_HOST}" "mkdir -p ${REMOTE_DIR}"

echo "[2/4] Copying configuration files..."
scp -i "${SSH_KEY}" \
    "${SCRIPT_DIR}/docker-compose.yml" \
    "${SCRIPT_DIR}/Caddyfile" \
    .env \
    "${SCRIPT_DIR}/02-init-server.sh" \
    "${REMOTE_HOST}:${REMOTE_DIR}/"

echo "[3/4] Running server initialization..."
ssh -i "${SSH_KEY}" "${REMOTE_HOST}" "cd ${REMOTE_DIR} && chmod +x 02-init-server.sh && ./02-init-server.sh"

echo "[4/4] Starting n8n services..."
ssh -i "${SSH_KEY}" "${REMOTE_HOST}" "cd ${REMOTE_DIR} && docker-compose pull && docker-compose up -d"

echo ""
echo -e "${GREEN}=== Deployment Complete ===${NC}"
echo ""
echo "n8n is now available at: https://${N8N_HOST}"
echo ""
echo "Check logs with:"
echo "  ssh -i ${SSH_KEY} ${REMOTE_HOST} 'cd ${REMOTE_DIR} && docker-compose logs -f'"
echo ""
echo "Your other services (NestJS/Go) can call n8n webhooks at:"
echo "  https://${N8N_HOST}/webhook/{workflow-path}"
echo "  https://${N8N_HOST}/webhook-test/{workflow-path}"
