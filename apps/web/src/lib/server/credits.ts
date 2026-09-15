import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from './errors';
import { getAppEnvironment } from './config';

export async function creditRpc(db: SupabaseClient, name: string, args: Record<string, unknown>) {
  const { data, error } = await db.rpc(name, { ...args, p_environment: getAppEnvironment() });
  if (error) {
    console.error('[credits]', { procedure: name, code: error.code });
    throw new AppError('Credits are temporarily unavailable. Please try again later.', 'CREDIT_UNAVAILABLE', 503);
  }
  return data as { state: string; balance: number; result?: Record<string, unknown>; code?: string };
}
