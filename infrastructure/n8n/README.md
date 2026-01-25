# n8n Deployment Guide

## Architecture

```
AWS Lightsail (57.182.161.64)
├── Docker
│   ├── n8n (Workflow Engine) - Port 5678 internal
│   └── Caddy (Reverse Proxy) - Port 80/443 external
└── Data: SQLite in Docker volume (n8n_n8n_data)
```

## Quick Access

| Resource | Value |
|----------|-------|
| URL | https://57.182.161.64.nip.io |
| SSH | `ssh -i ~/.ssh/LightsailDefaultKey-ap-northeast-1.pem ubuntu@57.182.161.64` |
| Config Dir (Server) | `/home/ubuntu/n8n/` |
| Config Dir (Local) | `infrastructure/n8n/aws/` |

## Deployment

### First Time Setup

```bash
cd infrastructure/n8n/aws

# 1. Create .env from example
cp .env.example .env
# Edit .env with your values

# 2. Run deployment script
./03-deploy.sh 57.182.161.64
```

### Redeploy/Update

```bash
# SSH to server
ssh -i ~/.ssh/LightsailDefaultKey-ap-northeast-1.pem ubuntu@57.182.161.64

# Update and restart
cd ~/n8n
docker compose pull
docker compose up -d
```

## Common Operations

```bash
# View logs
docker logs n8n --tail 50
docker logs caddy --tail 50

# Restart services
docker compose restart

# Check health
curl https://57.182.161.64.nip.io/healthz
```

## Important Files

| File | Purpose |
|------|---------|
| `aws/docker-compose.yml` | Production Docker config (Caddy + n8n) |
| `aws/Caddyfile` | Caddy reverse proxy with auto-HTTPS |
| `aws/.env.example` | Environment variables template |
| `aws/03-deploy.sh` | Deployment script |
| `workflows/*.json` | Workflow definitions (backup) |

## Troubleshooting

### SSL Certificate Issues
Caddy auto-manages Let's Encrypt certificates. If issues occur:
```bash
docker logs caddy | grep -i cert
docker compose restart caddy
```

### n8n Won't Start
Check encryption key matches existing data:
```bash
cat /var/lib/docker/volumes/n8n_n8n_data/_data/config
```

### Port 443 Not Accessible
Verify Lightsail firewall:
```bash
aws lightsail get-instance --instance-name nba-cloud-hub-1gb --query 'instance.networking.ports'
```

## Data Backup

Workflow data is in Docker volume. To backup:
```bash
docker run --rm -v n8n_n8n_data:/data -v $(pwd):/backup alpine tar czf /backup/n8n-backup.tar.gz /data
```
