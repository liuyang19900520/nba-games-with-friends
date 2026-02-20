/**
 * Payment Lambda Function
 *
 * Best practices implemented:
 * - Input validation with detailed error messages
 * - Idempotency check for webhook events
 * - Comprehensive payment/transaction logging
 * - Structured logging with request tracing
 * - Proper error handling with retry logic consideration
 * - Database error checking
 * - Health check endpoint
 * - Complete webhook event handling
 */

import { Stripe } from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

// ============================================================================
// Constants
// ============================================================================

const REGION = 'ap-northeast-1';
const SECRET_NAME = 'nba-game/payment-secrets';
// Default allowed origins (fallback if not in secrets)
const DEFAULT_ALLOWED_ORIGINS = ['http://localhost:3000', 'http://localhost:3001'];

// Payment statuses
const PaymentStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  ACTIVE: 'active',
  CANCELED: 'canceled',
  FAILED: 'failed',
  REFUNDED: 'refunded',
};

// Webhook event types we handle (one-time payment model)
const WebhookEvents = {
  CHECKOUT_COMPLETED: 'checkout.session.completed',
  CHECKOUT_EXPIRED: 'checkout.session.expired',
  CHARGE_REFUNDED: 'charge.refunded',
};

// ============================================================================
// Caching & Initialization
// ============================================================================

let cachedSecrets = null;
let stripeClient = null;
let supabaseClient = null;

async function getSecrets() {
  if (cachedSecrets) return cachedSecrets;

  const client = new SecretsManagerClient({ region: REGION });

  const response = await client.send(
    new GetSecretValueCommand({
      SecretId: SECRET_NAME,
      VersionStage: "AWSCURRENT",
    })
  );

  cachedSecrets = JSON.parse(response.SecretString);

  // Validate required secrets
  const requiredSecrets = ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  for (const key of requiredSecrets) {
    if (!cachedSecrets[key]) {
      throw new Error(`Missing required secret: ${key}`);
    }
  }

  // Parse allowed origins from secrets if available
  if (cachedSecrets.ALLOWED_ORIGINS) {
    cachedSecrets.parsedAllowedOrigins = cachedSecrets.ALLOWED_ORIGINS.split(',').map(o => o.trim());
  } else {
    cachedSecrets.parsedAllowedOrigins = DEFAULT_ALLOWED_ORIGINS;
  }

  return cachedSecrets;
}

function getStripe(secrets) {
  if (!stripeClient) {
    stripeClient = new Stripe(secrets.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16',
      maxNetworkRetries: 2,
    });
  }
  return stripeClient;
}

function getSupabase(secrets) {
  if (!supabaseClient) {
    supabaseClient = createClient(secrets.SUPABASE_URL, secrets.SUPABASE_SERVICE_ROLE_KEY);
  }
  return supabaseClient;
}

// ============================================================================
// Logging
// ============================================================================

class Logger {
  constructor(requestId) {
    this.requestId = requestId;
  }

  _log(level, message, data = {}) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level,
      requestId: this.requestId,
      message,
      ...data,
    }));
  }

  info(message, data) { this._log('INFO', message, data); }
  warn(message, data) { this._log('WARN', message, data); }
  error(message, data) { this._log('ERROR', message, data); }
}

// ============================================================================
// CORS
// ============================================================================

function getCorsHeaders(origin, secrets) {
  const allowedOrigins = secrets.parsedAllowedOrigins || DEFAULT_ALLOWED_ORIGINS;
  const isAllowed = allowedOrigins.includes(origin);
  const responseOrigin = isAllowed ? origin : (secrets.APP_URL || allowedOrigins[0]);

  return {
    "Access-Control-Allow-Origin": responseOrigin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, stripe-signature, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

// ============================================================================
// Response Helpers
// ============================================================================

function jsonResponse(statusCode, body, corsHeaders) {
  return {
    statusCode,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function errorResponse(statusCode, message, code, corsHeaders) {
  return jsonResponse(statusCode, { error: message, code }, corsHeaders);
}

// ============================================================================
// Input Validation
// ============================================================================

function validateCreateSessionInput(body) {
  const errors = [];

  if (!body) {
    return { valid: false, errors: ['Request body is required'] };
  }

  let parsed;
  try {
    parsed = typeof body === 'string' ? JSON.parse(body) : body;
  } catch {
    return { valid: false, errors: ['Invalid JSON body'] };
  }

  const { userId, priceId } = parsed;

  if (!userId || typeof userId !== 'string') {
    errors.push('userId is required and must be a string');
  }

  if (!priceId || typeof priceId !== 'string') {
    errors.push('priceId is required and must be a string');
  }

  // UUID format validation for userId
  if (userId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId)) {
    errors.push('userId must be a valid UUID');
  }

  // Stripe price ID format validation
  if (priceId && !priceId.startsWith('price_')) {
    errors.push('priceId must be a valid Stripe price ID');
  }

  return {
    valid: errors.length === 0,
    errors,
    data: parsed,
  };
}

// ============================================================================
// Idempotency Check
// ============================================================================

async function checkIdempotency(supabase, eventId, logger) {
  const { data, error } = await supabase
    .from('webhook_events')
    .select('id, processed_at')
    .eq('stripe_event_id', eventId)
    .single();

  if (error && error.code !== 'PGRST116') { // PGRST116 = not found
    logger.error('Idempotency check failed', { error: error.message });
    throw new Error('Database error during idempotency check');
  }

  if (data) {
    logger.info('Duplicate event detected, skipping', { eventId, processedAt: data.processed_at });
    return true; // Already processed
  }

  return false; // Not processed yet
}

async function markEventProcessed(supabase, eventId, eventType, status, logger) {
  const { error } = await supabase
    .from('webhook_events')
    .insert({
      stripe_event_id: eventId,
      event_type: eventType,
      status,
      processed_at: new Date().toISOString(),
    });

  if (error) {
    logger.error('Failed to mark event as processed', { error: error.message, eventId });
    // Don't throw - this is not critical
  }
}

// ============================================================================
// Database Operations
// ============================================================================

async function createPaymentRecord(supabase, data, logger) {
  const { error } = await supabase.from('payments').insert(data);

  if (error) {
    // Log error but don't throw - payment record is for tracking, not critical for checkout
    logger.warn('Failed to create payment record', { error: error.message, data });
    return false;
  }
  return true;
}

async function updatePaymentRecord(supabase, filter, data, logger) {
  const { error, count } = await supabase
    .from('payments')
    .update(data)
    .match(filter);

  if (error) {
    logger.error('Failed to update payment record', { error: error.message, filter, data });
    throw new Error('Failed to update payment record');
  }

  return count;
}

async function updateUserPremiumStatus(supabase, filter, data, logger) {
  const { error } = await supabase
    .from('users')
    .update(data)
    .match(filter);

  if (error) {
    logger.error('Failed to update user premium status', { error: error.message, filter, data });
    throw new Error('Failed to update user premium status');
  }
}

async function recordTransaction(supabase, data, logger) {
  const { error } = await supabase.from('payment_transactions').insert(data);

  if (error) {
    // Log but don't throw - transaction logging is not critical
    logger.warn('Failed to record transaction', { error: error.message, data });
  }
}

// ============================================================================
// Route Handlers
// ============================================================================

async function handleHealthCheck(corsHeaders) {
  return jsonResponse(200, {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '2.0.0',
  }, corsHeaders);
}

async function handleCreateSession(body, secrets, corsHeaders, logger) {
  // Validate input
  const validation = validateCreateSessionInput(body);
  if (!validation.valid) {
    logger.warn('Validation failed', { errors: validation.errors });
    return errorResponse(400, validation.errors.join(', '), 'VALIDATION_ERROR', corsHeaders);
  }

  const { userId, priceId } = validation.data;
  const stripe = getStripe(secrets);
  const supabase = getSupabase(secrets);

  // Use the origin from the request as success/cancel base URL if it's allowed
  // Fallback to APP_URL from secrets
  const allowedOrigins = secrets.parsedAllowedOrigins || DEFAULT_ALLOWED_ORIGINS;
  const requestOrigin = corsHeaders["Access-Control-Allow-Origin"];
  const appUrl = (requestOrigin && requestOrigin !== '*') ? requestOrigin : secrets.APP_URL;

  logger.info('Creating checkout session', { userId, priceId });

  // Check if user exists and their credit balance
  const { data: user } = await supabase
    .from('users')
    .select('id, ai_credits_remaining')
    .eq('id', userId)
    .single();

  // Prevent purchase when user still has unused credits (non-stackable)
  if (user?.ai_credits_remaining > 0) {
    logger.info('User still has credits remaining', { userId, credits: user.ai_credits_remaining });
    return errorResponse(400, 'You still have AI credits remaining. Use them before purchasing more.', 'CREDITS_REMAINING', corsHeaders);
  }

  // If user doesn't exist in public.users, create a record
  if (!user) {
    logger.info('Creating user record in public.users', { userId });
    const { error: insertError } = await supabase
      .from('users')
      .insert({ id: userId, has_premium: false });

    if (insertError && insertError.code !== '23505') { // 23505 = duplicate key (race condition)
      logger.error('Failed to create user record', { error: insertError.message });
      // Continue anyway - user record is not critical for checkout
    }
  }

  // Get price details from Stripe
  let price;
  try {
    price = await stripe.prices.retrieve(priceId, { expand: ['product'] });
  } catch (err) {
    logger.error('Invalid price ID', { priceId, error: err.message });
    return errorResponse(400, 'Invalid price ID', 'INVALID_PRICE', corsHeaders);
  }

  // Create Stripe checkout session (one-time payment)
  // payment_method_types omitted — uses methods enabled in Stripe Dashboard (card, PayPay, etc.)
  const session = await stripe.checkout.sessions.create({
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'payment',
    success_url: `${appUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/payment/cancel`,
    client_reference_id: userId,
    customer_email: undefined, // Email will be collected during checkout
    metadata: {
      userId,
      priceId,
      productName: price.product?.name || 'AI Credits Pack',
      credits_amount: '5',
    },
    allow_promotion_codes: true,
    billing_address_collection: 'auto',
    locale: 'ja', // Japanese locale
  });

  // Create payment record with full details
  await createPaymentRecord(supabase, {
    user_id: userId,
    stripe_session_id: session.id,
    stripe_price_id: priceId,
    amount: price.unit_amount,
    currency: price.currency,
    status: PaymentStatus.PENDING,
    created_at: new Date().toISOString(),
    metadata: {
      productName: price.product?.name,
      type: 'one_time_credits',
      credits_amount: 5,
    },
  }, logger);

  logger.info('Checkout session created', {
    userId,
    sessionId: session.id,
    amount: price.unit_amount,
    currency: price.currency,
  });

  return jsonResponse(200, { url: session.url, sessionId: session.id }, corsHeaders);
}

async function handleWebhook(body, headers, secrets, corsHeaders, logger) {
  const stripe = getStripe(secrets);
  const supabase = getSupabase(secrets);
  const sig = headers['stripe-signature'];

  if (!sig) {
    logger.warn('Missing stripe-signature header');
    return errorResponse(400, 'Missing stripe-signature header', 'MISSING_SIGNATURE', corsHeaders);
  }

  // Verify webhook signature
  let event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, secrets.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    logger.error('Webhook signature verification failed', { error: err.message });
    return errorResponse(400, 'Webhook signature verification failed', 'INVALID_SIGNATURE', corsHeaders);
  }

  logger.info('Webhook received', { eventId: event.id, eventType: event.type });

  // Idempotency check
  const isDuplicate = await checkIdempotency(supabase, event.id, logger);
  if (isDuplicate) {
    return jsonResponse(200, { received: true, duplicate: true }, corsHeaders);
  }

  // Process event
  let processingStatus = 'success';
  try {
    await processWebhookEvent(event, supabase, stripe, logger);
  } catch (err) {
    logger.error('Webhook processing failed', { eventId: event.id, error: err.message });
    processingStatus = 'failed';
    // Don't return error - we still want to acknowledge receipt to Stripe
  }

  // Mark event as processed
  await markEventProcessed(supabase, event.id, event.type, processingStatus, logger);

  return jsonResponse(200, { received: true, eventId: event.id }, corsHeaders);
}

async function processWebhookEvent(event, supabase, stripe, logger) {
  const eventType = event.type;
  const data = event.data.object;

  switch (eventType) {
    case WebhookEvents.CHECKOUT_COMPLETED:
      await handleCheckoutCompleted(data, supabase, stripe, logger);
      break;

    case WebhookEvents.CHECKOUT_EXPIRED:
      await handleCheckoutExpired(data, supabase, logger);
      break;

    case WebhookEvents.CHARGE_REFUNDED:
      await handleChargeRefunded(data, supabase, logger);
      break;

    default:
      logger.info('Unhandled event type', { eventType });
  }
}

// ============================================================================
// Webhook Event Handlers
// ============================================================================

async function handleCheckoutCompleted(session, supabase, stripe, logger) {
  const userId = session.client_reference_id;
  const customerId = session.customer;
  const paymentIntentId = session.payment_intent;

  logger.info('Processing checkout.session.completed (one-time payment)', {
    sessionId: session.id,
    userId,
    paymentIntentId,
  });

  // Update payment record
  await updatePaymentRecord(supabase,
    { stripe_session_id: session.id },
    {
      status: PaymentStatus.ACTIVE,
      stripe_customer_id: customerId,
      amount_paid: session.amount_total,
      currency: session.currency,
      payment_method_type: session.payment_method_types?.[0],
      updated_at: new Date().toISOString(),
    },
    logger
  );

  // Grant 5 AI credits using atomic RPC function
  const { data: creditsResult, error: creditsError } = await supabase
    .rpc('grant_ai_credits', { p_user_id: userId, p_amount: 5 });

  if (creditsError) {
    logger.error('Failed to grant credits via RPC', { error: creditsError.message, userId });
    // Fallback: direct update
    await updateUserPremiumStatus(supabase,
      { id: userId },
      {
        has_premium: true,
        ai_credits_remaining: 5,
        stripe_customer_id: customerId,
        premium_activated_at: new Date().toISOString(),
      },
      logger
    );
  } else {
    // Update customer ID separately
    await updateUserPremiumStatus(supabase,
      { id: userId },
      { stripe_customer_id: customerId },
      logger
    );
    logger.info('Credits granted via RPC', { userId, credits: creditsResult });
  }

  // Record transaction
  await recordTransaction(supabase, {
    user_id: userId,
    stripe_session_id: session.id,
    stripe_payment_intent_id: paymentIntentId,
    event_type: 'credits_purchased',
    amount: session.amount_total,
    currency: session.currency,
    status: 'completed',
    metadata: { credits_granted: 5 },
    created_at: new Date().toISOString(),
  }, logger);

  logger.info('One-time payment completed, credits granted', { userId });
}

async function handleCheckoutExpired(session, supabase, logger) {
  logger.info('Processing checkout.session.expired', { sessionId: session.id });

  await updatePaymentRecord(supabase,
    { stripe_session_id: session.id },
    {
      status: PaymentStatus.FAILED,
      failure_reason: 'Session expired',
      updated_at: new Date().toISOString(),
    },
    logger
  );
}

async function handleChargeRefunded(charge, supabase, logger) {
  logger.info('Processing charge.refunded', {
    chargeId: charge.id,
    amount: charge.amount_refunded,
  });

  // Find and update payment by customer
  const customerId = charge.customer;
  if (customerId) {
    await updatePaymentRecord(supabase,
      { stripe_customer_id: customerId },
      {
        status: PaymentStatus.REFUNDED,
        refunded_amount: charge.amount_refunded,
        refunded_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      logger
    );

    // Revoke premium and credits on full refund
    if (charge.refunded) {
      await updateUserPremiumStatus(supabase,
        { stripe_customer_id: customerId },
        { has_premium: false, ai_credits_remaining: 0 },
        logger
      );
    }
  }

  // Record transaction
  await recordTransaction(supabase, {
    stripe_charge_id: charge.id,
    event_type: 'charge_refunded',
    amount: charge.amount_refunded,
    currency: charge.currency,
    status: 'completed',
    created_at: new Date().toISOString(),
  }, logger);
}

// ============================================================================
// Main Handler
// ============================================================================

export const handler = async (event) => {
  const requestId = event.requestContext?.requestId || `req_${Date.now()}`;
  const logger = new Logger(requestId);

  let secrets;
  let corsHeaders;

  try {
    // Initialize
    secrets = await getSecrets();
    const appUrl = secrets.APP_URL;

    // Parse event (support both REST API v1 and HTTP API v2)
    const httpMethod = event.httpMethod || event.requestContext?.http?.method;
    const path = event.path || event.rawPath;
    const body = event.body;
    const headers = event.headers || {};
    const origin = headers.origin || headers.Origin || '';

    corsHeaders = getCorsHeaders(origin, secrets);

    logger.info('Request received', { method: httpMethod, path, origin });

    // Handle CORS preflight
    if (httpMethod === 'OPTIONS') {
      return { statusCode: 200, headers: corsHeaders, body: '' };
    }

    // Route handling
    if (httpMethod === 'GET' && path === '/health') {
      return handleHealthCheck(corsHeaders);
    }

    if (httpMethod === 'POST' && path === '/create-session') {
      return await handleCreateSession(body, secrets, corsHeaders, logger);
    }

    if (httpMethod === 'POST' && path === '/webhook') {
      return await handleWebhook(body, headers, secrets, corsHeaders, logger);
    }

    // 404 for unknown routes
    logger.warn('Route not found', { method: httpMethod, path });
    return errorResponse(404, 'Not Found', 'NOT_FOUND', corsHeaders);

  } catch (err) {
    logger.error('Unhandled error', {
      error: err.message,
      stack: err.stack,
    });

    // Ensure we have corsHeaders even on early errors
    if (!corsHeaders) {
      corsHeaders = {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, stripe-signature",
      };
    }

    return errorResponse(500, 'Internal server error', 'INTERNAL_ERROR', corsHeaders);
  }
};
