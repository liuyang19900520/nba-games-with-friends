# =============================================================================
# Terraform Configuration - AI Agent EC2 Infrastructure
# =============================================================================
#
# This creates:
#   - EC2 t4g.small (ARM) instance with Docker pre-installed
#   - Security Group (SSH + HTTP 8000)
#   - Elastic IP (so IP stays the same after stop/start)
#
# Cost estimate: ~$5-6/month (8h/day usage + EBS + Elastic IP)
# =============================================================================

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

# =============================================================================
# Data Sources
# =============================================================================

# Get the default VPC (no need to create a new one)
data "aws_vpc" "default" {
  default = true
}

# Get default subnets
data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
  filter {
    name   = "default-for-az"
    values = ["true"]
  }
}

# Ubuntu 24.04 LTS ARM64 AMI (free, official)
data "aws_ami" "ubuntu_arm" {
  most_recent = true
  owners      = ["099720109477"] # Canonical

  filter {
    name   = "name"
    values = ["ubuntu/images/hvm-ssd-gp3/ubuntu-noble-24.04-arm64-server-*"]
  }

  filter {
    name   = "architecture"
    values = ["arm64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }
}

# =============================================================================
# Security Group
# =============================================================================

resource "aws_security_group" "ai_agent" {
  name        = "${var.project_name}-ai-agent-sg"
  description = "Security group for AI Agent EC2"
  vpc_id      = data.aws_vpc.default.id

  # SSH access
  ingress {
    description = "SSH"
    from_port   = 22
    to_port     = 22
    protocol    = "tcp"
    cidr_blocks = [var.allowed_ssh_cidr]
  }

  # AI Agent API (FastAPI on port 8000)
  ingress {
    description = "AI Agent API"
    from_port   = 8000
    to_port     = 8000
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Allow all outbound traffic
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name    = "${var.project_name}-ai-agent-sg"
    Project = var.project_name
  }
}

# =============================================================================
# EC2 Instance
# =============================================================================

resource "aws_instance" "ai_agent" {
  ami                    = data.aws_ami.ubuntu_arm.id
  instance_type          = var.instance_type
  key_name               = var.key_name
  vpc_security_group_ids = [aws_security_group.ai_agent.id]
  subnet_id              = data.aws_subnets.default.ids[0]

  # 8GB root volume (gp3 is cheaper and faster than gp2)
  root_block_device {
    volume_size = 8
    volume_type = "gp3"
    encrypted   = true
  }

  # User data script: install Docker + Docker Compose on first boot
  user_data = <<-EOF
    #!/bin/bash
    set -e

    echo "=== Starting AI Agent Server Setup ==="

    # Update system
    apt-get update -y
    apt-get upgrade -y

    # Install Docker
    curl -fsSL https://get.docker.com | sh

    # Add ubuntu user to docker group
    usermod -aG docker ubuntu

    # Install Docker Compose plugin
    apt-get install -y docker-compose-plugin

    # Install Git
    apt-get install -y git

    # Create app directory
    mkdir -p /home/ubuntu/ai-agent
    chown ubuntu:ubuntu /home/ubuntu/ai-agent

    # Enable Docker to start on boot
    systemctl enable docker
    systemctl start docker

    echo "=== Setup Complete ==="
  EOF

  tags = {
    Name        = "${var.project_name}-ai-agent"
    Project     = var.project_name
    Environment = "shared"
    Service     = "ai-agent"
  }
}

# =============================================================================
# Elastic IP (keeps the same IP after stop/start)
# =============================================================================

resource "aws_eip" "ai_agent" {
  instance = aws_instance.ai_agent.id
  domain   = "vpc"

  tags = {
    Name    = "${var.project_name}-ai-agent-eip"
    Project = var.project_name
  }
}
