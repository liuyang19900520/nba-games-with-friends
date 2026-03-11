# =============================================================================
# Payment Lambda + API Gateway
# =============================================================================
#
# Creates:
#   - nba-payment  Lambda + HTTP API Gateway
#   - Shared IAM role with Secrets Manager access
# =============================================================================

# =============================================================================
# IAM Role
# =============================================================================

resource "aws_iam_role" "payment_lambda" {
  name = "nba-payment-lambda-role-v2"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Project = var.project_name
  }
}

# CloudWatch Logs permission
resource "aws_iam_role_policy_attachment" "payment_lambda_logs" {
  role       = aws_iam_role.payment_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Secrets Manager permission
resource "aws_iam_role_policy" "payment_lambda_secrets" {
  name = "secrets-manager-access"
  role = aws_iam_role.payment_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = "arn:aws:secretsmanager:${var.aws_region}:*:secret:nba-game/*"
      }
    ]
  })
}

# =============================================================================
# Lambda Function
# =============================================================================

# Dummy zip for initial creation (GitHub Actions will deploy real code)
data "archive_file" "payment_init" {
  type        = "zip"
  output_path = "${path.module}/.tmp/payment-init.zip"

  source {
    content  = "exports.handler = async () => ({ statusCode: 200, body: JSON.stringify({ status: 'init' }) });"
    filename = "index.mjs"
  }
}

resource "aws_lambda_function" "payment" {
  function_name = "nba-payment"
  description   = "Payment Lambda"
  role          = aws_iam_role.payment_lambda.arn
  handler       = "index.handler"
  runtime       = "nodejs22.x"
  architectures = ["arm64"]
  memory_size   = 256
  timeout       = 30

  filename         = data.archive_file.payment_init.output_path
  source_code_hash = data.archive_file.payment_init.output_base64sha256

  # Code will be managed by GitHub Actions, ignore future changes
  lifecycle {
    ignore_changes = [filename, source_code_hash]
  }

  tags = {
    Project     = var.project_name
    Service     = "payment"
  }
}

# =============================================================================
# API Gateway HTTP API
# =============================================================================

resource "aws_apigatewayv2_api" "payment" {
  name          = "nba-payment"
  protocol_type = "HTTP"
  description   = "Payment Lambda API"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 300
  }

  # IMPORTANT: Destroying this resource changes the API URL,
  # which breaks the Stripe webhook configuration.
  # To force destroy, temporarily remove this block.
  lifecycle {
    prevent_destroy = true
  }

  tags = {
    Project     = var.project_name
  }
}

# Lambda integration
resource "aws_apigatewayv2_integration" "payment" {
  api_id                 = aws_apigatewayv2_api.payment.id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.payment.invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# Default route (catch-all)
resource "aws_apigatewayv2_route" "payment" {
  api_id    = aws_apigatewayv2_api.payment.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.payment.id}"
}

# Root route
resource "aws_apigatewayv2_route" "payment_root" {
  api_id    = aws_apigatewayv2_api.payment.id
  route_key = "ANY /"
  target    = "integrations/${aws_apigatewayv2_integration.payment.id}"
}

# Auto-deploy stage
resource "aws_apigatewayv2_stage" "payment" {
  api_id      = aws_apigatewayv2_api.payment.id
  name        = "$default"
  auto_deploy = true

  tags = {
    Project     = var.project_name
  }
}

# Permission: allow API Gateway to invoke Lambda
resource "aws_lambda_permission" "payment_apigw" {
  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.payment.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.payment.execution_arn}/*/*"
}
