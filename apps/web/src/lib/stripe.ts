import 'server-only';
import Stripe from 'stripe';
import { AppError } from '@/lib/server/errors';

let stripeInstance: Stripe | undefined;
export function getStripeServer(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key?.startsWith('sk_test_') && !key?.startsWith('rk_test_')) {
    throw new AppError('Configure a Stripe test key to use test checkout.', 'CHECKOUT_UNAVAILABLE', 503);
  }
  stripeInstance ??= new Stripe(key, { maxNetworkRetries: 1, timeout: 10_000 });
  return stripeInstance;
}
