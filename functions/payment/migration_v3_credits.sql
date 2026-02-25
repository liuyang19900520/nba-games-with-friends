-- Migration: One-Time Payment + AI Credits System
-- Version: 3.0
-- Description: Convert from subscription model to one-time payment with AI credits
--
-- Changes:
-- 1. Add ai_credits_remaining column to users table
-- 2. Create atomic decrement_ai_credit() function (race-condition safe)
-- 3. Create grant_ai_credits() function (enforces non-stackable credits)
-- 4. Migrate existing premium users to 5 credits
-- 5. Update active_subscribers view to active_credit_users view

-- ============================================
-- 1. Add AI credits column to users table
-- ============================================
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS ai_credits_remaining INTEGER DEFAULT 0 NOT NULL;

-- Index for quick credit lookups
CREATE INDEX IF NOT EXISTS idx_users_credits
ON public.users(ai_credits_remaining)
WHERE ai_credits_remaining > 0;

-- ============================================
-- 2. Atomic credit decrement function
-- ============================================
-- Returns remaining credits AFTER decrement, or -1 if insufficient.
-- Uses UPDATE ... WHERE ai_credits_remaining > 0 for atomic row-level locking.
CREATE OR REPLACE FUNCTION public.decrement_ai_credit(p_user_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining INTEGER;
BEGIN
  UPDATE public.users
  SET ai_credits_remaining = ai_credits_remaining - 1
  WHERE id = p_user_id AND ai_credits_remaining > 0
  RETURNING ai_credits_remaining INTO v_remaining;

  IF NOT FOUND THEN
    RETURN -1;  -- No credits available
  END IF;

  RETURN v_remaining;
END;
$$;

COMMENT ON FUNCTION public.decrement_ai_credit IS 'Atomically decrement AI credit for a user. Returns remaining credits or -1 if none available.';

-- ============================================
-- 3. Grant credits function (non-stackable)
-- ============================================
-- Only sets credits when ai_credits_remaining = 0 (enforces non-stackable).
-- Returns the new credit balance.
CREATE OR REPLACE FUNCTION public.grant_ai_credits(p_user_id UUID, p_amount INTEGER DEFAULT 5)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_remaining INTEGER;
BEGIN
  UPDATE public.users
  SET ai_credits_remaining = p_amount,
      has_premium = TRUE,
      premium_activated_at = NOW()
  WHERE id = p_user_id AND ai_credits_remaining = 0
  RETURNING ai_credits_remaining INTO v_remaining;

  IF NOT FOUND THEN
    -- User still has credits or user doesn't exist
    SELECT ai_credits_remaining INTO v_remaining
    FROM public.users WHERE id = p_user_id;
    RETURN COALESCE(v_remaining, -1);
  END IF;

  RETURN v_remaining;
END;
$$;

COMMENT ON FUNCTION public.grant_ai_credits IS 'Grant AI credits to a user. Only works when current credits = 0 (non-stackable).';

-- ============================================
-- 4. Migrate existing premium users
-- ============================================
UPDATE public.users
SET ai_credits_remaining = 5
WHERE has_premium = TRUE AND ai_credits_remaining = 0;

-- ============================================
-- 5. Recreate view with new columns
-- ============================================
DROP VIEW IF EXISTS public.active_subscribers;
CREATE VIEW public.active_subscribers AS
SELECT
    u.id,
    u.has_premium,
    u.ai_credits_remaining,
    u.stripe_customer_id,
    u.premium_activated_at,
    p.amount,
    p.currency,
    p.status as payment_status
FROM public.users u
LEFT JOIN public.payments p ON u.stripe_customer_id = p.stripe_customer_id
WHERE u.ai_credits_remaining > 0 OR u.has_premium = TRUE;
