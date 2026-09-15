import { beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
vi.mock('@/lib/auth/supabase', () => ({ createClient: vi.fn() }));
vi.mock('@/lib/db/supabase-server', () => ({ createServerClient: vi.fn() }));
vi.mock('@/lib/stripe', () => ({ getStripeServer: vi.fn() }));
import { createClient } from '@/lib/auth/supabase';
import { createServerClient } from '@/lib/db/supabase-server';
import { getStripeServer } from '@/lib/stripe';
import { getAiMode, getAppEnvironment, canWriteLegacyAccount } from '@/lib/server/config';
import { handleAiRequest } from '@/lib/ai/request';
import { predictInputSchema, gameDateSchema, seasonForDate } from '@/lib/ai/contracts';
import { POST as checkout } from '@/app/api/payment/create-session/route';
import { POST as webhook } from '@/app/api/payment/webhook/route';

const user = '00000000-0000-4000-8000-000000000001';
const id = '10000000-0000-4000-8000-000000000001';
const db = { rpc: vi.fn() };
const stripe = { prices: { retrieve: vi.fn() }, checkout: { sessions: { create: vi.fn() } }, webhooks: { constructEvent: vi.fn() } };
function req(body: unknown = {}, headers: Record<string, string> = {}) {
  return new Request('http://localhost:3000/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', 'Idempotency-Key': id, ...headers }, body: JSON.stringify(body) });
}
const authenticated = () => vi.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: { id: user } }, error: null }) } } as never);
beforeEach(() => {
  vi.resetAllMocks(); vi.unstubAllEnvs();
  vi.stubEnv('VERCEL_ENV', '');
  vi.stubEnv('AI_MODE', 'demo');
  vi.stubEnv('PAYMENT_MODE', 'demo');
  authenticated();
  vi.mocked(createServerClient).mockReturnValue(db as never);
  vi.mocked(getStripeServer).mockReturnValue(stripe as never);
  db.rpc.mockResolvedValue({ data: { state: 'granted', balance: 5 }, error: null });
});
describe('environment and validation', () => {
  it('keeps local production builds in local scope and opts in to model calls', () => {
    vi.stubEnv('NODE_ENV', 'production'); vi.stubEnv('DEEPSEEK_API_KEY', 'test');
    expect(getAppEnvironment()).toBe('local'); expect(getAiMode()).toBe('demo');
    expect(canWriteLegacyAccount(user)).toBe(false);
    vi.stubEnv('LOCAL_TEST_USER_IDS', user); expect(canWriteLegacyAccount(user)).toBe(true);
    vi.stubEnv('VERCEL_ENV', 'production'); expect(getAppEnvironment()).toBe('production');
  });
  it('rejects invalid dates and derives the season instead of fixing one year', () => {
    expect(gameDateSchema.safeParse('2026-02-30').success).toBe(false);
    expect(seasonForDate('2026-09-13')).toBe('2025-26');
    expect(seasonForDate('2026-10-20')).toBe('2026-27');
  });
});
describe('AI request boundary', () => {
  it('validates before reserving and rejects unauthenticated requests', async () => {
    const task = { kind: 'prediction' as const, schema: predictInputSchema, run: vi.fn() };
    expect((await handleAiRequest(req({}), task)).status).toBe(400);
    expect(db.rpc).not.toHaveBeenCalled();
    vi.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never);
    const body = { home_team: 'A', away_team: 'B', game_date: '2026-09-13' };
    expect((await handleAiRequest(req(body), task)).status).toBe(401);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('rejects cross-origin requests', async () => {
    expect((await handleAiRequest(req({}, { Origin: 'https://attacker.test' }), { kind: 'lineup', schema: z.object({}), run: vi.fn() })).status).toBe(403);
  });
  it('settles before returning a result and replays persisted work without inference', async () => {
    const run = vi.fn().mockResolvedValue({ players: ['a'] });
    db.rpc.mockResolvedValueOnce({ data: { state: 'reserved', balance: 4 }, error: null })
      .mockResolvedValueOnce({ data: { state: 'succeeded', balance: 4 }, error: null });
    const first = await handleAiRequest(req(), { kind: 'lineup', schema: z.object({}), run });
    expect(await first.text()).toContain('"credits_remaining":4');
    expect(db.rpc).toHaveBeenLastCalledWith('web_complete_ai_request', expect.objectContaining({ p_environment: 'local', p_user_id: user }));
    run.mockClear();
    db.rpc.mockResolvedValueOnce({ data: { state: 'succeeded', balance: 4, result: { players: ['a'] } }, error: null });
    expect(await (await handleAiRequest(req(), { kind: 'lineup', schema: z.object({}), run })).text()).toContain('event: result');
    expect(run).not.toHaveBeenCalled();
  });
  it('refunds a failed generation and emits no result', async () => {
    db.rpc.mockResolvedValueOnce({ data: { state: 'reserved', balance: 4 }, error: null })
      .mockResolvedValueOnce({ data: { state: 'failed', balance: 5 }, error: null });
    const result = await handleAiRequest(req(), { kind: 'lineup', schema: z.object({}), run: vi.fn().mockRejectedValue(new Error('private provider detail')) });
    const text = await result.text();
    expect(text).toContain('event: error'); expect(text).not.toContain('event: result'); expect(text).not.toContain('private provider detail');
    expect(db.rpc).toHaveBeenLastCalledWith('web_fail_ai_request', expect.objectContaining({ p_request_id: id }));
  });
});
describe('test checkout', () => {
  it('does not accept browser-selected identity or price and needs authentication', async () => {
    expect((await checkout(req({ userId: 'someone_else', priceId: 'price_untrusted' }))).status).toBe(400);
    expect(getStripeServer).not.toHaveBeenCalled();
    vi.mocked(createClient).mockResolvedValue({ auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as never);
    expect((await checkout(req())).status).toBe(401);
  });
  it('defaults to the local demo page without Stripe calls', async () => {
    expect(await (await checkout(req())).json()).toEqual({ url: '/payment/demo' });
    expect(getStripeServer).not.toHaveBeenCalled();
  });
  it('binds Stripe sessions to the authenticated user, environment and configured price', async () => {
    vi.stubEnv('PAYMENT_MODE', 'stripe_test'); vi.stubEnv('STRIPE_CREDITS_PRICE_ID', 'price_server');
    stripe.prices.retrieve.mockResolvedValue({ active: true, livemode: false, recurring: null });
    stripe.checkout.sessions.create.mockResolvedValue({ id: 'cs_test_1', url: 'https://checkout.stripe.com/test' });
    expect((await checkout(req())).status).toBe(200);
    expect(stripe.checkout.sessions.create).toHaveBeenCalledWith(expect.objectContaining({
      client_reference_id: user, metadata: expect.objectContaining({ environment: 'local', price_id: 'price_server' }),
      success_url: 'http://localhost:3000/payment/success?session_id={CHECKOUT_SESSION_ID}',
    }), expect.objectContaining({ idempotencyKey: expect.stringContaining(user) }));
  });
});
describe('webhook verification', () => {
  function event(extra: Record<string, unknown> = {}, sessionExtra: Record<string, unknown> = {}) {
    vi.stubEnv('PAYMENT_MODE', 'stripe_test'); vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_test');
    vi.stubEnv('STRIPE_CREDITS_PRICE_ID', 'price_server');
    stripe.webhooks.constructEvent.mockReturnValue({ livemode: false, type: 'checkout.session.completed', ...extra, data: { object: {
      id: 'cs_test_fixture', livemode: false, payment_status: 'paid', client_reference_id: user,
      metadata: { purpose: 'nba_web_test_credits_v1', environment: 'local', price_id: 'price_server', credits_amount: '5' },
      ...sessionExtra,
    } } });
  }
  it('requires a signature and refuses live/unpaid/other-environment events', async () => {
    event();
    expect((await webhook(req())).status).toBe(400);
    event({ livemode: true });
    expect((await webhook(req({}, { 'stripe-signature': 'test' }))).status).toBe(400);
    event({}, { payment_status: 'unpaid' });
    expect((await webhook(req({}, { 'stripe-signature': 'test' }))).status).toBe(200);
    event({}, { metadata: { environment: 'production' } });
    expect((await webhook(req({}, { 'stripe-signature': 'test' }))).status).toBe(200);
    expect(db.rpc).not.toHaveBeenCalled();
  });
  it('grants through the atomic transaction and returns failure for database retry', async () => {
    event();
    expect((await webhook(req({}, { 'stripe-signature': 'test' }))).status).toBe(200);
    expect(db.rpc).toHaveBeenCalledWith('web_grant_test_credits', expect.objectContaining({ p_environment: 'local', p_reference: 'cs_test_fixture', p_user_id: user }));
    db.rpc.mockResolvedValueOnce({ data: null, error: { code: 'DB_DOWN' } });
    expect((await webhook(req({}, { 'stripe-signature': 'test' }))).status).toBe(503);
  });
});
