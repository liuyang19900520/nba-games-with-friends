# =============================================================================
# Payment Lambda + API Gateway
# =============================================================================
#
# Creates:
#   - nba-payment-dev  Lambda + HTTP API Gateway (for dev branch)
#   - nba-payment-prod Lambda + HTTP API Gateway (for main branch)
#   - Shared IAM role with Secrets Manager access
# =============================================================================

locals {
  payment_environments = {
    dev  = { name = "nba-payment-dev",  description = "Payment Lambda (dev)" }
    prod = { name = "nba-payment-prod", description = "Payment Lambda (prod)" }
  }
}

# =============================================================================
# IAM Role (shared by dev & prod)
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
# Lambda Functions (dev + prod)
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
  for_each = local.payment_environments

  function_name = each.value.name
  description   = each.value.description
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
    Environment = each.key
    Service     = "payment"
  }
}

# =============================================================================
# API Gateway HTTP API (dev + prod)
# =============================================================================

resource "aws_apigatewayv2_api" "payment" {
  for_each = local.payment_environments

  name          = each.value.name
  protocol_type = "HTTP"
  description   = "${each.value.description} API"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 300
  }

  tags = {
    Project     = var.project_name
    Environment = each.key
  }
}

# Lambda integration
resource "aws_apigatewayv2_integration" "payment" {
  for_each = local.payment_environments

  api_id                 = aws_apigatewayv2_api.payment[each.key].id
  integration_type       = "AWS_PROXY"
  integration_uri        = aws_lambda_function.payment[each.key].invoke_arn
  integration_method     = "POST"
  payload_format_version = "2.0"
}

# Default route (catch-all: ANY /{proxy+})
resource "aws_apigatewayv2_route" "payment" {
  for_each = local.payment_environments

  api_id    = aws_apigatewayv2_api.payment[each.key].id
  route_key = "$default"
  target    = "integrations/${aws_apigatewayv2_integration.payment[each.key].id}"
}

# Auto-deploy stage
resource "aws_apigatewayv2_stage" "payment" {
  for_each = local.payment_environments

  api_id      = aws_apigatewayv2_api.payment[each.key].id
  name        = "$default"
  auto_deploy = true

  tags = {
    Project     = var.project_name
    Environment = each.key
  }
}

# Permission: allow API Gateway to invoke Lambda
resource "aws_lambda_permission" "payment_apigw" {
  for_each = local.payment_environments

  statement_id  = "AllowAPIGateway"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.payment[each.key].function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.payment[each.key].execution_arn}/*/*"
}
