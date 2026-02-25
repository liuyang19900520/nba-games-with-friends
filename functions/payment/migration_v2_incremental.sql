-- Migration V2 (Incremental)
-- 只包含新增内容，用于已执行过 V1 迁移的情况
-- Version: 2.0 incremental

-- ============================================
-- 1. users 表新增字段
-- ============================================
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS premium_activated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS premium_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS premium_canceled_at TIMESTAMPTZ;

-- 新索引
CREATE INDEX IF NOT EXISTS idx_users_customer_id ON public.users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_has_premium ON public.users(has_premium) WHERE has_premium = TRUE;

-- ============================================
-- 2. payments 表新增字段
-- ============================================
ALTER TABLE public.payments
ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
ADD COLUMN IF NOT EXISTS amount_paid INTEGER,
ADD COLUMN IF NOT EXISTS failure_reason TEXT,
ADD COLUMN IF NOT EXISTS payment_method_type TEXT,
ADD COLUMN IF NOT EXISTS refunded_amount INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ;

-- 新索引
CREATE INDEX IF NOT EXISTS idx_payments_customer_id ON public.payments(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_created_at ON public.payments(created_at DESC);

-- ============================================
-- 3. 新表：webhook_events（幂等性检查）
-- ============================================
CREATE TABLE IF NOT EXISTS public.webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stripe_event_id TEXT UNIQUE NOT NULL,
    event_type TEXT NOT NULL,
    status TEXT DEFAULT 'success',
    error_message TEXT,
    processed_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_stripe_event_id ON public.webhook_events(stripe_event_id);
CREATE INDEX IF NOT EXISTS idx_webhook_events_created_at ON public.webhook_events(created_at DESC);

-- ============================================
-- 4. 新表：payment_transactions（审计日志）
-- ============================================
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    stripe_session_id TEXT,
    stripe_subscription_id TEXT,
    stripe_invoice_id TEXT,
    stripe_charge_id TEXT,
    stripe_payment_intent_id TEXT,
    event_type TEXT NOT NULL,
    amount INTEGER,
    currency TEXT DEFAULT 'jpy',
    status TEXT NOT NULL,
    failure_reason TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON public.payment_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_subscription_id ON public.payment_transactions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_transactions_event_type ON public.payment_transactions(event_type);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON public.payment_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_status ON public.payment_transactions(status);

-- ============================================
-- 5. RLS 设置
-- ============================================
ALTER TABLE public.webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Webhook events: 只有 service role 可以访问
DROP POLICY IF EXISTS "Service role access to webhook_events" ON public.webhook_events;
CREATE POLICY "Service role access to webhook_events"
ON public.webhook_events FOR ALL
USING (auth.role() = 'service_role');

-- Transactions: 用户可以查看自己的记录
DROP POLICY IF EXISTS "Users can view own transactions" ON public.payment_transactions;
CREATE POLICY "Users can view own transactions"
ON public.payment_transactions FOR SELECT
USING (auth.uid() = user_id);

-- Transactions: Service role 完全访问
DROP POLICY IF EXISTS "Service role full access to transactions" ON public.payment_transactions;
CREATE POLICY "Service role full access to transactions"
ON public.payment_transactions FOR ALL
USING (auth.role() = 'service_role');

-- Payments: Service role 完全访问（如果之前没有）
DROP POLICY IF EXISTS "Service role full access to payments" ON public.payments;
CREATE POLICY "Service role full access to payments"
ON public.payments FOR ALL
USING (auth.role() = 'service_role');

-- ============================================
-- 6. 触发器：自动更新 updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_payments_updated_at ON public.payments;
CREATE TRIGGER update_payments_updated_at
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 7. 视图（可选，用于查询统计）
-- ============================================
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
