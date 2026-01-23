#!/bin/bash
set -e

echo "=== Server Initialization Script ==="
echo "Run this script on the remote server after SSH"

# Update system
echo "[1/4] Updating system packages..."
sudo apt update && sudo apt upgrade -y

# Create 2GB Swap
echo "[2/4] Creating 2GB Swap..."
if [ ! -f /swapfile ]; then
    sudo fallocate -l 2G /swapfile
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "Swap created successfully"
else
    echo "Swap already exists"
fi

# Show swap info
echo "Current swap status:"
free -h | grep -i swap

# Install Docker
echo "[3/4] Installing Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    rm get-docker.sh

    # Add current user to docker group
    sudo usermod -aG docker $USER
    echo "Docker installed successfully"
else
    echo "Docker already installed"
fi

# Install Docker Compose
echo "[4/4] Installing Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "Docker Compose installed successfully"
else
    echo "Docker Compose already installed"
fi

# Show versions
echo ""
echo "=== Installation Complete ==="
docker --version
docker-compose --version

echo ""
echo "IMPORTANT: Log out and log back in for docker group to take effect"
echo "Then run: ./03-deploy.sh"
