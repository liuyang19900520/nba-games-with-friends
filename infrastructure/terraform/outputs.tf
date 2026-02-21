# =============================================================================
# Outputs - Reference values after terraform apply
# =============================================================================

output "instance_id" {
  description = "EC2 Instance ID (for stop/start commands)"
  value       = aws_instance.ai_agent.id
}

output "elastic_ip" {
  description = "Elastic IP address (fixed, won't change on stop/start)"
  value       = aws_eip.ai_agent.public_ip
}

output "ai_agent_url" {
  description = "AI Agent API URL"
  value       = "http://${aws_eip.ai_agent.public_ip}:8000"
}

output "ssh_command" {
  description = "SSH command to connect to the instance"
  value       = "ssh -i ${var.ssh_private_key_path} ubuntu@${aws_eip.ai_agent.public_ip}"
}

output "start_command" {
  description = "AWS CLI command to start the instance"
  value       = "aws ec2 start-instances --instance-ids ${aws_instance.ai_agent.id} --region ${var.aws_region}"
}

output "stop_command" {
  description = "AWS CLI command to stop the instance"
  value       = "aws ec2 stop-instances --instance-ids ${aws_instance.ai_agent.id} --region ${var.aws_region}"
}

# =============================================================================
# Payment Lambda Outputs
# =============================================================================

output "payment_api_url_dev" {
  description = "Payment API URL (dev)"
  value       = aws_apigatewayv2_api.payment["dev"].api_endpoint
}


