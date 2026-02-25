# Payment Lambda Function

A production-ready AWS Lambda function for handling Stripe payments with comprehensive best practices.

## Features

- **Input Validation**: Strict validation of all inputs with detailed error messages
- **Idempotency**: Webhook events are deduplicated using `webhook_events` table
- **Transaction Logging**: Complete audit trail in `payment_transactions` table
- **Structured Logging**: JSON logs with request tracing for easy debugging
- **Error Handling**: Proper error classification and retry considerations
- **Health Check**: `/health` endpoint for monitoring
- **CORS Support**: Configurable for local development and production

## API Endpoints

### `GET /health`
Health check endpoint for monitoring.

```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "2.0.0"
}
```

### `POST /create-session`
Creates a Stripe Checkout session.

**Request:**
```json
{
  "userId": "uuid-of-user",
  "priceId": "price_xxxxx"
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/...",
  "sessionId": "cs_xxxxx"
}
```

**Error Codes:**
- `VALIDATION_ERROR`: Invalid input
- `USER_NOT_FOUND`: User doesn't exist
- `ALREADY_PREMIUM`: User already has premium
- `INVALID_PRICE`: Price ID doesn't exist in Stripe

### `POST /webhook`
Stripe webhook endpoint. Handles the following events:
- `checkout.session.completed` - Activates premium
- `checkout.session.expired` - Marks payment as failed
- `invoice.paid` - Renews premium
- `invoice.payment_failed` - Records failure, revokes after 3 attempts
- `customer.subscription.updated` - Updates subscription status
- `customer.subscription.deleted` - Revokes premium
- `charge.refunded` - Handles refunds

## Database Schema

### Tables

1. **`payments`** - Main payment records
   - Links to Stripe sessions, subscriptions, customers
   - Tracks amount, currency, status
   - Stores payment method type, refund info

2. **`webhook_events`** - Idempotency tracking
   - Stores Stripe event IDs to prevent duplicate processing
   - Auto-cleanup recommended for events older than 90 days

3. **`payment_transactions`** - Audit log
   - Complete history of all payment-related events
   - Useful for debugging and reporting

### Views

- **`active_subscribers`** - All users with active premium
- **`payment_summary`** - Daily payment statistics

## Configuration

### AWS Secrets Manager

Store these secrets in `nba-game/payment-secrets`:

```json
{
  "STRIPE_SECRET_KEY": "sk_live_xxxxx",
  "STRIPE_WEBHOOK_SECRET": "whsec_xxxxx",
  "SUPABASE_URL": "https://xxxxx.supabase.co",
  "SUPABASE_SERVICE_ROLE_KEY": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "APP_URL": "https://your-app.com"
}
```

### Lambda Configuration

- **Runtime**: Node.js 20.x
- **Memory**: 256MB (recommended)
- **Timeout**: 30s
- **Architecture**: arm64 (cost-effective)

## Deployment

```bash
# Package
cd functions/payment
zip -r function.zip index.mjs package.json node_modules

# Deploy
aws lambda update-function-code \
  --function-name nba-payment \
  --zip-file fileb://function.zip \
  --region ap-northeast-1
```

## Database Migration

Run the migration in Supabase SQL Editor:

```bash
# Copy contents of migration.sql and run in Supabase Dashboard > SQL Editor
```

## Monitoring

### CloudWatch Logs

Logs are structured JSON for easy querying:

```json
{
  "timestamp": "2024-01-01T00:00:00.000Z",
  "level": "INFO",
  "requestId": "req_xxxxx",
  "message": "Checkout session created",
  "userId": "uuid",
  "sessionId": "cs_xxxxx"
}
```

### Key Metrics to Monitor

1. **Error rate**: Count of `level=ERROR` logs
2. **Webhook failures**: `event_type=* AND status=failed` in webhook_events
3. **Payment conversion**: Ratio of `pending` to `active` in payments table

## Error Handling

| Error Code | HTTP Status | Retryable | Description |
|------------|-------------|-----------|-------------|
| `VALIDATION_ERROR` | 400 | No | Invalid input |
| `USER_NOT_FOUND` | 404 | No | User doesn't exist |
| `ALREADY_PREMIUM` | 400 | No | Already subscribed |
| `INVALID_PRICE` | 400 | No | Bad price ID |
| `MISSING_SIGNATURE` | 400 | No | Webhook missing signature |
| `INVALID_SIGNATURE` | 400 | No | Webhook signature invalid |
| `INTERNAL_ERROR` | 500 | Yes | Server error |

## Testing

### Test Cards (Stripe Test Mode)

| Card Number | Result |
|-------------|--------|
| 4242 4242 4242 4242 | Success |
| 4000 0000 0000 3220 | 3D Secure required |
| 4000 0000 0000 9995 | Declined (insufficient funds) |
| 4000 0000 0000 0002 | Declined |

### Local Testing

```bash
# Test health endpoint
curl https://your-api.execute-api.ap-northeast-1.amazonaws.com/health

# Test create-session (requires valid userId and priceId)
curl -X POST https://your-api.execute-api.ap-northeast-1.amazonaws.com/create-session \
  -H "Content-Type: application/json" \
  -d '{"userId":"uuid","priceId":"price_xxx"}'
```

## Security Considerations

1. **Webhook Signature Verification**: All webhooks are verified using Stripe's signature
2. **CORS**: Restricted to configured origins
3. **Input Validation**: All inputs are validated before processing
4. **Secrets**: Stored in AWS Secrets Manager, never in code
5. **RLS**: Row Level Security enabled on all payment tables
