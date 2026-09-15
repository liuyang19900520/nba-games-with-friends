import 'server-only';
import { AppError } from './errors';

export type AiMode = 'demo' | 'llm';
export type PaymentMode = 'demo' | 'stripe_test';

export function getAppEnvironment(): 'local' | 'production' {
  // A local `next build && next start` still uses local data. NODE_ENV is not a data boundary.
  if (process.env.VERCEL_ENV === 'production') return 'production';
  return 'local';
}

export function canWriteLegacyAccount(userId: string): boolean {
  if (getAppEnvironment() === 'production') return true;
  return (process.env.LOCAL_TEST_USER_IDS || '').split(',').map(id => id.trim()).filter(Boolean).includes(userId);
}

export function getAiMode(): AiMode {
  const mode = process.env.AI_MODE || 'demo';
  if (mode !== 'demo' && mode !== 'llm') throw new AppError('AI configuration is unavailable.', 'CONFIGURATION_ERROR', 503);
  if (mode === 'llm' && !process.env.DEEPSEEK_API_KEY) throw new AppError('AI is not configured yet.', 'AI_UNAVAILABLE', 503);
  return mode;
}

export function getPaymentMode(): PaymentMode {
  const mode = process.env.PAYMENT_MODE || 'demo';
  if (mode !== 'demo' && mode !== 'stripe_test') throw new AppError('Test checkout is unavailable.', 'CONFIGURATION_ERROR', 503);
  return mode;
}
