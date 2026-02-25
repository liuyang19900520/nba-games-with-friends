-- Migration: Payment System with Full Audit Trail
-- Version: 2.0
-- Description: Complete payment system with idempotency, transaction logging, and audit trail

-- ============================================
-- 1. Update users table with premium fields
-- ============================================
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS has_premium BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
ADD COLUMN IF NOT EXISTS premium_activated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS premium_canceled_at TIMESTAMPTZ;

-- Indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_subscription_id ON public.users(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_users_customer_id ON public.users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_has_premium ON public.users(has_premium) WHERE has_premium = TRUE;

-- ============================================
-- 2. Create/Update payments table (main payment records)
-- ============================================
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    stripe_session_id TEXT UNIQUE,
    stripe_subscription_id TEXT,
    stripe_customer_id TEXT,
    stripe_price_id TEXT,

    -- Amount details
    amount INTEGER,                    -- Amount in smallest currency unit (e.g., cents/yen)
    amount_paid INTEGER,               -- Actual amount paid (may differ due to discounts)
    currency TEXT DEFAULT 'jpy',

    -- Status tracking
    status TEXT DEFAULT 'pending',     -- pending, processing, active, canceled, failed, refunded
    failure_reason TEXT,

    -- Payment method info
    payment_method_type TEXT,          -- card, konbini, etc.

    -- Refund tracking
    refunded_amount INTEGER DEFAULT 0,
    refunded_at TIMESTAMPTZ,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    canceled_at TIMESTAMPTZ
);

-- Add new columns if table already exists
DO $$
BEGIN
    ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS stripe_price_id TEXT;
    ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS amount_paid INTEGER;
    ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS failure_reason TEXT;
    ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payment_method_type TEXT;
    ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refunded_amount INTEGER DEFAULT 0;
    ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ;
    ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
    ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Indexes for payments
CREATE INDEX IF NOT EXISTS idx_payments_subscription_id ON public.payments(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);

-- ============================================
-- 3. Create webhook_events table (idempotency)
-- ============================================
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT DEFAULT 'success',     -- success, failed
    error_message TEXT,
    processed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast idempotency lookups
CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_event_id ON public.webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events(created_at DESC);

-- Cleanup old webhook events (keep 90 days)
-- Run this periodically via cron or scheduled function
-- DELETE FROM public.webhook_events WHERE created_at < NOW() - INTERVAL '90 days';

-- ============================================
-- 4. Create payment_transactions table (audit log)
-- ============================================
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

    -- Stripe references
    stripe_session_id TEXT,
    stripe_subscription_id TEXT,
    stripe_invoice_id TEXT,
    stripe_charge_id TEXT,
    stripe_payment_intent_id TEXT,

    -- Event info
    event_type TEXT NOT NULL,          -- checkout_completed, invoice_paid, invoice_payment_failed, subscription_canceled, charge_refunded

    -- Amount
    amount INTEGER,
    currency TEXT DEFAULT 'jpy',

    -- Status
    status TEXT NOT NULL,              -- completed, failed, pending
    failure_reason TEXT,

    -- Metadata
    metadata JSONB DEFAULT '{}',

    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes for transactions
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_subscription_id ON public.payment_transactions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_transactions_event_type ON public.payment_transactions(event_type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.payment_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.payment_transactions(status);

-- ============================================
-- 5. Enable RLS (Row Level Security)
-- ============================================
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 6. RLS Policies
-- ============================================

-- Payments: Users can view their own payments
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
CREATE POLICY "Users can view own payments"
ON public.payments FOR SELECT
USING (auth.uid() = user_id);

-- Payments: Service role can do everything (for Lambda)
DROP POLICY IF EXISTS "Service role full access to payments" ON public.payments;
CREATE POLICY "Service role full access to payments"
ON public.payments FOR ALL
USING (auth.role() = 'service_role');

-- Webhook events: Only service role
DROP POLICY IF EXISTS "Service role access to webhook_events" ON public.webhook_events;
CREATE POLICY "Service role access to webhook_events"
ON public.webhook_events FOR ALL
USING (auth.role() = 'service_role');

-- Transactions: Users can view their own transactions
DROP POLICY IF EXISTS "Users can view own transactions" ON public.payment_transactions;
CREATE POLICY "Users can view own transactions"
ON public.payment_transactions FOR SELECT
USING (auth.uid() = user_id);

-- Transactions: Service role can do everything
DROP POLICY IF EXISTS "Service role full access to transactions" ON public.payment_transactions;
CREATE POLICY "Service role full access to transactions"
ON public.payment_transactions FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- 7. Helper Functions
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for payments table
DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. Views for easy querying
-- ============================================

-- Active subscribers view
CREATE OR REPLACE VIEW public.active_subscribers AS
SELECT
    u.id,
    u.has_premium,
    u.stripe_subscription_id,
    u.stripe_customer_id,
    u.premium_activated_at,
    u.premium_expires_at,
    p.amount,
    p.currency,
    p.status as payment_status
FROM public.users u
LEFT JOIN public.payments p ON u.stripe_subscription_id = p.stripe_subscription_id
WHERE u.has_premium = TRUE;

-- Payment summary view
CREATE OR REPLACE VIEW public.payment_summary AS
SELECT
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_transactions,
    COUNT(*) FILTER (WHERE status = 'active') as successful,
    COUNT(*) FILTER (WHERE status = 'failed') as failed,
    COUNT(*) FILTER (WHERE status = 'canceled') as canceled,
    SUM(amount) FILTER (WHERE status = 'active') as total_amount,
    currency
FROM public.payments
GROUP BY DATE_TRUNC('day', created_at), currency
ORDER BY date DESC;

-- ============================================
-- 9. Comments for documentation
-- ============================================
COMMENT ON TABLE public.payments IS 'Main payment records linked to Stripe checkout sessions';
COMMENT ON TABLE public.webhook_events IS 'Stripe webhook events for idempotency checking';
COMMENT ON TABLE public.payment_transactions IS 'Audit log of all payment-related events';
COMMENT ON COLUMN public.payments.amount IS 'Amount in smallest currency unit (e.g., yen for JPY)';
COMMENT ON COLUMN public.payments.status IS 'Payment status: pending, processing, active, canceled, failed, refunded';
