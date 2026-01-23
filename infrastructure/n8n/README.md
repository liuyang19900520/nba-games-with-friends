# n8n Docker 部署指南

## 迁移步骤

### 步骤1: SSH连接到Lightsail

```bash
ssh -i your-key.pem ubuntu@57.182.161.64
```

### 步骤2: 上传配置文件

在本地终端运行 (将文件上传到服务器):

```bash
# 创建目录
ssh -i your-key.pem ubuntu@57.182.161.64 "mkdir -p ~/n8n-docker/ssl"

# 上传配置文件
scp -i your-key.pem docker-compose.yml ubuntu@57.182.161.64:~/n8n-docker/
scp -i your-key.pem nginx.conf ubuntu@57.182.161.64:~/n8n-docker/
scp -i your-key.pem migrate-to-docker.sh ubuntu@57.182.161.64:~/n8n-docker/
scp -i your-key.pem .env.example ubuntu@57.182.161.64:~/n8n-docker/
```

### 步骤3: 在服务器上运行迁移脚本

```bash
# SSH到服务器
ssh -i your-key.pem ubuntu@57.182.161.64

# 进入目录并运行脚本
cd ~/n8n-docker
chmod +x migrate-to-docker.sh
./migrate-to-docker.sh
```

### 步骤4: 创建.env配置文件

```bash
# 复制示例文件
cp .env.example .env

# 编辑配置
nano .env
```

填写以下信息:
- `DB_HOST`: 你的Postgres数据库地址
- `DB_USER`: 数据库用户名
- `DB_PASSWORD`: 数据库密码
- `N8N_ENCRYPTION_KEY`: 从现有n8n获取 (脚本会自动提取)

### 步骤5: 启动Docker容器

```bash
# 启动服务
docker-compose up -d

# 查看日志
docker-compose logs -f

# 查看容器状态
docker-compose ps
```

### 步骤6: 验证

访问 https://57.182.161.64.nip.io 确认n8n正常运行

---

## 关键配置说明

### 执行日志自动清理 (已配置)

```yaml
EXECUTIONS_DATA_PRUNE=true           # 启用自动清理
EXECUTIONS_DATA_MAX_AGE=168          # 保留7天 (168小时)
EXECUTIONS_DATA_SAVE_ON_ERROR=all    # 保存所有错误执行
EXECUTIONS_DATA_SAVE_ON_SUCCESS=none # 不保存成功执行 (节省内存)
```

### 工作流错误自动停用 (已配置)

Error Notifier工作流已配置为:
1. 捕获工作流错误
2. 发送LINE通知
3. 自动停用出错的工作流

---

## 常用命令

```bash
# 启动
docker-compose up -d

# 停止
docker-compose down

# 查看日志
docker-compose logs -f n8n

# 重启
docker-compose restart

# 更新n8n版本
docker-compose pull
docker-compose up -d

# 进入容器
docker exec -it n8n sh
```

---

## 故障排除

### 1. SSL证书问题

如果没有现有证书，可以使用Let's Encrypt:

```bash
# 安装certbot
sudo apt install certbot

# 获取证书 (先停止nginx)
docker-compose stop nginx
sudo certbot certonly --standalone -d 57.182.161.64.nip.io

# 复制证书
sudo cp /etc/letsencrypt/live/57.182.161.64.nip.io/fullchain.pem ~/n8n-docker/ssl/
sudo cp /etc/letsencrypt/live/57.182.161.64.nip.io/privkey.pem ~/n8n-docker/ssl/

# 重启nginx
docker-compose start nginx
```

### 2. 凭证无法解密

确保 `N8N_ENCRYPTION_KEY` 与原来的n8n一致。

获取原始密钥:
```bash
cat ~/.n8n/config | grep encryptionKey
```

### 3. 数据库连接失败

检查数据库配置和网络:
```bash
docker exec -it n8n ping your-db-host
```
