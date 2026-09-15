import { beforeAll, beforeEach, afterAll, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
let db: PGlite;
const user = '00000000-0000-4000-8000-000000000001';
const request = '10000000-0000-4000-8000-000000000001';
const hash = 'a'.repeat(64);
async function rpc(name: string, args: unknown[]) {
  const result = await db.query<{ data: Record<string, unknown> }>(`select public.${name}(${args.map((_, i) => '$' + (i + 1)).join(',')}) as data`, args);
  return result.rows[0]!.data;
}
const grant = (environment = 'local') => rpc('web_grant_test_credits', [environment, user, 'demo', null]);
const reserve = (id = request, environment = 'local', mode = 'demo', who = user) => rpc('web_reserve_ai_credit', [environment, who, id, 'prediction', hash, mode]);
beforeAll(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create table public.users(id uuid primary key, ai_credits_remaining integer);
    insert into public.users values ('${user}', 42);
    insert into auth.users select ('00000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid from generate_series(1,6) i;
  `);
  const sql = await readFile(new URL('../supabase/migrations/202609130001_unified_web.sql', import.meta.url), 'utf8');
  await db.exec(sql);
  await db.exec(sql); // The additive migration is safe to reapply.
});
beforeEach(async () => { await db.exec('truncate public.web_credit_accounts, public.web_ai_requests, public.web_credit_topups'); });
afterAll(async () => { await db.close(); });
describe('credit transactions', () => {
  it('separates local and production wallets and preserves v1 balance', async () => {
    await grant();
    expect(await rpc('web_get_credit_balance', ['production', user])).toBe(0);
    expect(await rpc('web_get_credit_balance', ['local', user])).toBe(5);
    expect((await db.query<{ ai_credits_remaining: number }>('select ai_credits_remaining from public.users')).rows[0]!.ai_credits_remaining).toBe(42);
  });
  it('deducts once on replay and refuses reused IDs with changed input', async () => {
    await grant();
    expect((await reserve()).balance).toBe(4);
    expect((await reserve()).code).toBe('REQUEST_PENDING');
    expect((await rpc('web_reserve_ai_credit', ['local', user, request, 'lineup', hash, 'demo'])).code).toBe('REQUEST_CONFLICT');
    await rpc('web_complete_ai_request', ['local', user, request, { prediction: { winner: 'A' } }]);
    const replay = await reserve();
    expect(replay.state).toBe('succeeded');
    expect(replay.balance).toBe(4);
    expect(replay.result).toEqual({ prediction: { winner: 'A' } });
  });
  it('refunds failed/expired work once and never refunds a completed request', async () => {
    await grant(); await reserve();
    await rpc('web_fail_ai_request', ['local', user, request]);
    expect((await rpc('web_fail_ai_request', ['local', user, request])).balance).toBe(5);
    expect((await reserve()).code).toBe('REQUEST_FAILED');
    const id = '10000000-0000-4000-8000-000000000002';
    await reserve(id);
    await db.exec("update public.web_ai_requests set expires_at = now() - interval '1 second' where status = 'reserved'");
    expect(await rpc('web_get_credit_balance', ['local', user])).toBe(5);
    expect(await rpc('web_get_credit_balance', ['local', user])).toBe(5);
    expect((await rpc('web_complete_ai_request', ['local', user, id, { ok: true }])).state).toBe('failed');
  });
  it('makes concurrent replay and top-ups idempotent', async () => {
    const grants = await Promise.all([grant(), grant()]);
    expect(grants.map(g => g.state).sort()).toEqual(['already_claimed', 'granted']);
    await Promise.all([reserve(), reserve()]);
    expect(await rpc('web_get_credit_balance', ['local', user])).toBe(4);
    await rpc('web_complete_ai_request', ['local', user, request, { ok: true }]);
    expect((await rpc('web_fail_ai_request', ['local', user, request])).balance).toBe(4);
    await rpc('web_grant_test_credits', ['local', user, 'stripe_test', 'cs_test_unique']);
    await rpc('web_grant_test_credits', ['local', user, 'stripe_test', 'cs_test_unique']);
    expect(await rpc('web_get_credit_balance', ['local', user])).toBe(9);
  });
  it('enforces paid-call caps including failed attempts across environments', async () => {
    for (let i = 1; i <= 5; i++) {
      const who = '00000000-0000-4000-8000-' + String(i).padStart(12, '0');
      await rpc('web_grant_test_credits', ['local', who, 'demo', null]);
      for (let j = 1; j <= 2; j++) {
        const id = '10000000-0000-4000-8000-' + String(j).padStart(12, '0');
        expect((await reserve(id, 'local', 'llm', who)).state).toBe('reserved');
        await rpc('web_fail_ai_request', ['local', who, id]);
      }
      expect((await reserve('10000000-0000-4000-8000-000000000003', 'local', 'llm', who)).code).toBe('RATE_LIMITED');
    }
    await grant('production');
    expect((await reserve(request, 'production', 'llm')).code).toBe('RATE_LIMITED');
  });
  it('does not expose credit writes or reads to browser roles', async () => {
    const rows = await db.query<{ allowed: boolean }>(`select has_function_privilege('authenticated', 'public.web_grant_test_credits(text, uuid, text, text)', 'execute') as allowed`);
    expect(rows.rows[0]!.allowed).toBe(false);
    expect((await db.query<{ allowed: boolean }>("select has_table_privilege('anon','public.web_credit_accounts','select') as allowed")).rows[0]!.allowed).toBe(false);
  });
});
