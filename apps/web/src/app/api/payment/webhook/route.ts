import { NextResponse } from 'next/server';
import { z } from 'zod';
import type Stripe from 'stripe';
import { getStripeServer } from '@/lib/stripe';
import { getPaymentMode, getAppEnvironment } from '@/lib/server/config';
import { createServerClient } from '@/lib/db/supabase-server';
import { creditRpc } from '@/lib/server/credits';
import { AppError } from '@/lib/server/errors';
import { errorResponse } from '@/lib/server/http';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    if (getPaymentMode() !== 'stripe_test' || !process.env.STRIPE_WEBHOOK_SECRET) throw new AppError('Stripe test webhook is not enabled.', 'CHECKOUT_UNAVAILABLE', 503);
    const signature = request.headers.get('stripe-signature');
    if (!signature) throw new AppError('Missing signature.', 'INVALID_SIGNATURE');
    const rawBody = await request.text();
    let event: Stripe.Event;
    try { event = getStripeServer().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET); }
    catch { throw new AppError('Invalid signature.', 'INVALID_SIGNATURE'); }
    if (event.livemode) throw new AppError('Only test events are supported.', 'TEST_MODE_REQUIRED');
    if (event.type !== 'checkout.session.completed' && event.type !== 'checkout.session.async_payment_succeeded') {
      return NextResponse.json({ received: true });
    }
    const session = event.data.object as Stripe.Checkout.Session;
    // A checkout completion alone is not proof of payment.
    if (session.livemode || session.payment_status !== 'paid') return NextResponse.json({ received: true });
    // Production ignores locally-created checkout sessions; Stripe CLI can forward local events.
    if (session.metadata?.environment !== getAppEnvironment()) return NextResponse.json({ received: true });
    if (session.metadata?.purpose !== 'nba_web_test_credits_v1' ||
        session.metadata.price_id !== process.env.STRIPE_CREDITS_PRICE_ID ||
        session.metadata.credits_amount !== '5' || !z.uuid().safeParse(session.client_reference_id).success) {
      throw new AppError('Unknown test checkout.', 'INVALID_CHECKOUT');
    }
    // Session ID, receipt and balance change are committed in one database transaction.
    // Returning 5xx on DB failure lets Stripe retry; no failed event is marked as processed.
    await creditRpc(createServerClient(), 'web_grant_test_credits', {
      p_user_id: session.client_reference_id, p_source: 'stripe_test', p_reference: session.id,
    });
    return NextResponse.json({ received: true });
  } catch (error) { return errorResponse(error); }
}
