# =============================================================================
# Variables - AI Agent EC2 Infrastructure
# =============================================================================

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "ap-northeast-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "nba-game"
}

variable "instance_type" {
  description = "EC2 instance type (ARM-based for cost efficiency)"
  type        = string
  default     = "t4g.small" # 2 vCPU, 2GB RAM, ARM
}

variable "key_name" {
  description = "Name of existing AWS key pair for SSH access"
  type        = string
  default     = "nba-game-key"
}

variable "ssh_private_key_path" {
  description = "Local path to SSH private key"
  type        = string
  default     = "~/.ssh/LightsailDefaultKey-ap-northeast-1.pem"
}

variable "allowed_ssh_cidr" {
  description = "CIDR block allowed for SSH access (your IP)"
  type        = string
  default     = "0.0.0.0/0" # TODO: restrict to your IP for security
}

variable "n8n_webhook_url" {
  description = "The public n8n Webhook URL to subscribe to the SNS error alerts topic"
  type        = string
  default     = "https://57.182.161.64.nip.io/webhook/aws-sns-alerts"
}
