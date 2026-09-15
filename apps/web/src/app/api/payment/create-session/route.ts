import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getStripeServer } from '@/lib/stripe';
import { getPaymentMode, getAppEnvironment } from '@/lib/server/config';
import { readJson, requireUser, errorResponse } from '@/lib/server/http';
import { AppError } from '@/lib/server/errors';

export const runtime = 'nodejs';
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    if (!z.object({}).strict().safeParse(await readJson(request)).success) throw new AppError('Invalid checkout request.', 'VALIDATION_ERROR');
    const user = await requireUser();
    if (getPaymentMode() === 'demo') return NextResponse.json({ url: '/payment/demo' });

    const id = z.uuid().safeParse(request.headers.get('Idempotency-Key'));
    if (!id.success) throw new AppError('A checkout request ID is required.', 'VALIDATION_ERROR');
    const priceId = process.env.STRIPE_CREDITS_PRICE_ID;
    if (!priceId?.startsWith('price_')) throw new AppError('Test checkout is not configured.', 'CHECKOUT_UNAVAILABLE', 503);
    const stripe = getStripeServer();
    const price = await stripe.prices.retrieve(priceId);
    if (price.livemode || !price.active || price.recurring) throw new AppError('Only the configured one-time test product is supported.', 'CHECKOUT_UNAVAILABLE', 503);
    const origin = new URL(request.url).origin;
    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      payment_method_types: ['card'],
      success_url: origin + '/payment/success?session_id={CHECKOUT_SESSION_ID}',
      cancel_url: origin + '/payment/cancel',
      client_reference_id: user.id,
      metadata: { purpose: 'nba_web_test_credits_v1', environment: getAppEnvironment(), price_id: priceId, credits_amount: '5' },
    }, { idempotencyKey: `nba-test:${getAppEnvironment()}:${user.id}:${id.data}` });
    if (!session.url) throw new AppError('Test checkout could not be started.', 'CHECKOUT_UNAVAILABLE', 502);
    return NextResponse.json({ url: session.url, sessionId: session.id });
  } catch (error) { return errorResponse(error); }
}
