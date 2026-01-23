#!/bin/bash
# n8n 迁移到Docker脚本
# 在Lightsail实例上运行此脚本

set -e

echo "=========================================="
echo "n8n 迁移到 Docker 脚本"
echo "=========================================="

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 1. 检查Docker是否安装
echo -e "\n${YELLOW}[1/6] 检查Docker安装...${NC}"
if ! command -v docker &> /dev/null; then
    echo "Docker未安装，正在安装..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
    echo -e "${GREEN}Docker安装完成${NC}"
else
    echo -e "${GREEN}Docker已安装${NC}"
fi

# 检查docker-compose
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "安装Docker Compose..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# 2. 获取现有n8n的加密密钥
echo -e "\n${YELLOW}[2/6] 获取现有n8n配置...${NC}"
N8N_CONFIG_PATH="$HOME/.n8n/config"
if [ -f "$N8N_CONFIG_PATH" ]; then
    ENCRYPTION_KEY=$(cat "$N8N_CONFIG_PATH" | grep -o '"encryptionKey":"[^"]*"' | cut -d'"' -f4)
    if [ -n "$ENCRYPTION_KEY" ]; then
        echo -e "${GREEN}找到加密密钥${NC}"
    else
        echo -e "${RED}警告: 未找到加密密钥，凭证可能无法迁移${NC}"
    fi
else
    echo -e "${RED}警告: 未找到n8n配置文件${NC}"
fi

# 3. 停止现有n8n服务
echo -e "\n${YELLOW}[3/6] 停止现有n8n服务...${NC}"
if systemctl is-active --quiet n8n 2>/dev/null; then
    sudo systemctl stop n8n
    sudo systemctl disable n8n
    echo -e "${GREEN}n8n服务已停止${NC}"
elif pm2 list 2>/dev/null | grep -q n8n; then
    pm2 stop n8n
    pm2 delete n8n
    echo -e "${GREEN}PM2 n8n进程已停止${NC}"
else
    # 尝试找到并杀死n8n进程
    pkill -f "n8n" 2>/dev/null || true
    echo "已尝试停止n8n进程"
fi

# 4. 创建Docker目录
echo -e "\n${YELLOW}[4/6] 创建Docker配置目录...${NC}"
mkdir -p ~/n8n-docker/ssl
cd ~/n8n-docker

# 5. 创建.env文件
echo -e "\n${YELLOW}[5/6] 配置环境变量...${NC}"
if [ ! -f .env ]; then
    echo "请输入以下配置信息:"

    read -p "Postgres主机地址: " DB_HOST
    read -p "Postgres端口 [5432]: " DB_PORT
    DB_PORT=${DB_PORT:-5432}
    read -p "Postgres数据库名 [n8n]: " DB_NAME
    DB_NAME=${DB_NAME:-n8n}
    read -p "Postgres用户名: " DB_USER
    read -sp "Postgres密码: " DB_PASSWORD
    echo ""

    cat > .env << EOF
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
N8N_ENCRYPTION_KEY=$ENCRYPTION_KEY
EOF

    echo -e "${GREEN}.env文件已创建${NC}"
else
    echo -e "${GREEN}.env文件已存在${NC}"
fi

# 6. 复制SSL证书
echo -e "\n${YELLOW}[6/6] 检查SSL证书...${NC}"
if [ -f /etc/letsencrypt/live/57.182.161.64.nip.io/fullchain.pem ]; then
    sudo cp /etc/letsencrypt/live/57.182.161.64.nip.io/fullchain.pem ~/n8n-docker/ssl/
    sudo cp /etc/letsencrypt/live/57.182.161.64.nip.io/privkey.pem ~/n8n-docker/ssl/
    sudo chown -R $USER:$USER ~/n8n-docker/ssl/
    echo -e "${GREEN}SSL证书已复制${NC}"
else
    echo -e "${YELLOW}未找到Let's Encrypt证书，可能需要手动配置SSL${NC}"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}准备工作完成!${NC}"
echo "=========================================="
echo ""
echo "下一步操作:"
echo "1. 将 docker-compose.yml 和 nginx.conf 上传到 ~/n8n-docker/"
echo "2. 检查 .env 文件配置是否正确"
echo "3. 运行: docker-compose up -d"
echo "4. 查看日志: docker-compose logs -f"
echo ""
