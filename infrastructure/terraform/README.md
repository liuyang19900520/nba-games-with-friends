# AI Agent EC2 - Terraform Configuration

## Overview

This Terraform config creates an EC2 t4g.small (ARM) instance for running the AI Agent (FastAPI + LangChain).

## Architecture

```
Internet → Elastic IP (固定) → EC2 t4g.small → Docker → AI Agent (FastAPI:8000)
```

## Cost Estimate

| Resource | 24/7 | 8h/day | Notes |
|----------|------|--------|-------|
| EC2 t4g.small | $15.5/月 | ~$5.2/月 | 按需启停 |
| EBS 8GB gp3 | $0.96/月 | $0.96/月 | 停机也收费 |
| Elastic IP | $0/月 | $3.6/月 | ⚠️ 停机时收费 $0.005/h |
| **Total** | **~$16.5/月** | **~$9.8/月** | |

> ⚠️ 注意: AWS 从 2024 年起对未绑定运行实例的 Elastic IP 收费。
> 停机时 EIP 约 $0.005/h ≈ $3.6/月。可以考虑停机时释放 EIP。

## Prerequisites

1. AWS CLI configured (`aws configure`)
2. Terraform installed
3. SSH key pair exists in AWS

## Usage

```bash
cd infrastructure/terraform

# First time: initialize Terraform
terraform init

# Preview changes
terraform plan

# Create resources
terraform apply

# Destroy all resources (when no longer needed)
terraform destroy
```

## Daily Operations

```bash
# Start instance (morning)
aws ec2 start-instances --instance-ids <INSTANCE_ID> --region ap-northeast-1

# Stop instance (night)
aws ec2 stop-instances --instance-ids <INSTANCE_ID> --region ap-northeast-1

# SSH into instance
ssh -i ~/.ssh/LightsailDefaultKey-ap-northeast-1.pem ubuntu@<ELASTIC_IP>
```

## First Deployment (after terraform apply)

```bash
# SSH into the instance
ssh -i ~/.ssh/LightsailDefaultKey-ap-northeast-1.pem ubuntu@<ELASTIC_IP>

# Clone the repo
git clone https://github.com/liuyang19900520/nba-games-with-friends.git
cd nba-games-with-friends/services/ai-agent

# Create .env file with your secrets
cat > .env << 'EOF'
SUPABASE_URL=https://cihryhmlyihjvonkhrpp.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_key_here
SUPABASE_ANON_KEY=your_key_here
OPENAI_API_KEY=your_key_here
DEEPSEEK_API_KEY=your_key_here
LANGCHAIN_TRACING_V2=true
LANGCHAIN_ENDPOINT=https://api.smith.langchain.com
LANGCHAIN_PROJECT=nba-agent-dev
LANGCHAIN_API_KEY=your_key_here
TAVILY_API_KEY=your_key_here
HUGGINGFACE_API_KEY=your_key_here
EOF

# Build and run
docker compose up --build -d

# Check health
curl http://localhost:8000/health
```
