# =============================================================================
# Monitoring & Error Notification System
# =============================================================================
#
# Creates:
#   - SNS Topic for Error Alerts
#   - CloudWatch Metric Filter to catch [ERROR] logs in Payment Lambda
#   - CloudWatch Alarm to trigger SNS when errors occur
# =============================================================================

# 1. SNS Topic for Central Error Alerts
resource "aws_sns_topic" "error_alerts" {
  name = "nba-error-alerts"
}

# 2. CloudWatch Metric Filter to catch errors in the Payment Lambda (dev shared)
resource "aws_cloudwatch_log_metric_filter" "payment_error_filter" {
  name           = "PaymentErrorFilter"
  pattern        = "{ $.level = \"ERROR\" }"
  log_group_name = "/aws/lambda/nba-payment-dev" # The shared Lambda log group

  metric_transformation {
    name      = "ErrorCount"
    namespace = "NBA/Monitoring"
    value     = "1"
  }

  # Ensure the log group exists or depends on the lambda
  depends_on = [
    aws_lambda_function.payment
  ]
}

# 3. CloudWatch Alarm triggering the SNS Topic
resource "aws_cloudwatch_metric_alarm" "payment_error_alarm" {
  alarm_name          = "payment-lambda-error-alarm"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = "1"
  metric_name         = aws_cloudwatch_log_metric_filter.payment_error_filter.metric_transformation[0].name
  namespace           = aws_cloudwatch_log_metric_filter.payment_error_filter.metric_transformation[0].namespace
  period              = "60" # 1 minute
  statistic           = "Sum"
  threshold           = "1"  # Trigger on 1 or more errors
  alarm_description   = "Triggers when [ERROR] is logged in nba-payment-dev"
  
  alarm_actions       = [aws_sns_topic.error_alerts.arn]
  # Optional: also notify when it goes back to OK
  # ok_actions          = [aws_sns_topic.error_alerts.arn]

  treat_missing_data  = "notBreaching"
}

# Output the SNS Topic ARN so it can be easily referenced for the n8n webhook subscription
output "sns_error_alerts_topic_arn" {
  value       = aws_sns_topic.error_alerts.arn
  description = "The ARN of the SNS topic for error alerts to subscribe the n8n webhook to."
}
