'use server';

import { createClient } from '@/lib/auth/supabase';
import { createServerClient } from '@/lib/db/supabase-server';
import { requireUser } from '@/lib/server/http';
import { getPaymentMode, getAppEnvironment } from '@/lib/server/config';
import { creditRpc } from '@/lib/server/credits';
import { revalidatePath } from 'next/cache';

export async function getCreditsRemaining(): Promise<number> {
  try {
    const auth = await createClient();
    const { data: { user } } = await auth.auth.getUser();
    if (!user) return 0;
    const { data, error } = await createServerClient().rpc('web_get_credit_balance', { p_environment: getAppEnvironment(), p_user_id: user.id });
    if (error) { console.error('[credits-read]', { code: error.code }); return 0; }
    return typeof data === 'number' ? data : 0;
  } catch { return 0; }
}

export async function checkPremiumStatus(): Promise<boolean> {
  return (await getCreditsRemaining()) > 0;
}

export async function claimDemoCredits(): Promise<{ balance?: number; error?: string }> {
  try {
    const user = await requireUser();
    if (getPaymentMode() !== 'demo') return { error: 'Demo checkout is not enabled.' };
    const result = await creditRpc(createServerClient(), 'web_grant_test_credits', {
      p_user_id: user.id, p_source: 'demo', p_reference: null,
    });
    if (result.state === 'already_claimed') return { error: 'You have already claimed today’s demo credits. Try again tomorrow (UTC).' };
    if (result.state === 'credits_remaining') return { error: 'Use your remaining credits before topping up.' };
    revalidatePath('/home');
    return { balance: result.balance };
  } catch { return { error: 'Demo credits are temporarily unavailable. Please try again later.' }; }
}

export async function getTestCheckoutStatus(sessionId: string): Promise<{ paid: boolean; balance?: number }> {
  if (!/^cs_test_[A-Za-z0-9_]{1,240}$/.test(sessionId)) return { paid: false };
  const user = await requireUser();
  const { data, error } = await createServerClient().from('web_credit_topups')
    .select('reference').eq('environment', getAppEnvironment()).eq('reference', sessionId).eq('user_id', user.id).eq('source', 'stripe_test').maybeSingle();
  if (error || !data) return { paid: false };
  return { paid: true, balance: await getCreditsRemaining() };
}
