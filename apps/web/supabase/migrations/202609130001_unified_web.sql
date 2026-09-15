-- Unified web baseline. Apply once in the Supabase SQL editor before enabling AI/test credits.
-- No scheduler, queue service or AWS credentials are needed.
begin;

create table if not exists public.web_credit_accounts (
  environment text not null check (environment in ('local', 'production')),
  user_id uuid not null references auth.users(id) on delete cascade,
  ai_credits_remaining integer not null default 0 check (ai_credits_remaining >= 0),
  primary key (environment, user_id)
);

create table if not exists public.web_ai_requests (
  environment text not null check (environment in ('local', 'production')),
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null,
  kind text not null check (kind in ('prediction', 'lineup')),
  input_hash text not null,
  mode text not null check (mode in ('demo', 'llm')),
  status text not null default 'reserved' check (status in ('reserved', 'succeeded', 'failed')),
  result jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '2 minutes'),
  primary key (environment, user_id, request_id)
);
create index if not exists web_ai_requests_daily on public.web_ai_requests (mode, created_at, user_id);

create table if not exists public.web_credit_topups (
  environment text not null check (environment in ('local', 'production')),
  reference text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('demo', 'stripe_test')),
  credits integer not null default 5 check (credits = 5),
  created_at timestamptz not null default now(),
  primary key (environment, reference)
);

alter table public.web_credit_accounts enable row level security;
alter table public.web_ai_requests enable row level security;
alter table public.web_credit_topups enable row level security;
revoke all on public.web_credit_accounts, public.web_ai_requests, public.web_credit_topups from public, anon, authenticated;
grant all on public.web_credit_accounts, public.web_ai_requests, public.web_credit_topups to service_role;
-- Legacy v1 users/balance/RPC permissions are intentionally unchanged while v1 remains live.
-- Harden or retire those separately at cutover; these v2 RPCs never use the legacy balance.

create or replace function public.web_get_credit_balance(p_environment text, p_user_id uuid)
returns integer language plpgsql security definer set search_path = '' as $$
declare recovered integer; balance integer;
begin
  insert into public.web_credit_accounts (environment, user_id) values (p_environment, p_user_id) on conflict do nothing;
  select ai_credits_remaining into balance from public.web_credit_accounts where environment = p_environment and user_id = p_user_id for update;
  update public.web_ai_requests set status = 'failed'
    where environment = p_environment and user_id = p_user_id and status = 'reserved' and expires_at <= now();
  get diagnostics recovered = row_count;
  if recovered > 0 then
    update public.web_credit_accounts set ai_credits_remaining = ai_credits_remaining + recovered
      where environment = p_environment and user_id = p_user_id returning ai_credits_remaining into balance;
  end if;
  return balance;
end $$;

create or replace function public.web_reserve_ai_credit(
  p_environment text, p_user_id uuid, p_request_id uuid, p_kind text, p_input_hash text, p_mode text
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare balance integer; existing public.web_ai_requests; daily_start timestamptz;
begin
  if p_kind not in ('prediction', 'lineup') or p_mode not in ('demo', 'llm') or length(p_input_hash) <> 64 then
    raise exception 'Invalid request';
  end if;
  -- A database-wide lock makes the small shared paid-call cap atomic across serverless instances.
  if p_mode = 'llm' then perform pg_advisory_xact_lock(71020260913); end if;
  balance := public.web_get_credit_balance(p_environment, p_user_id);
  select * into existing from public.web_ai_requests where environment = p_environment and user_id = p_user_id and request_id = p_request_id;
  if found then
    if existing.input_hash <> p_input_hash or existing.kind <> p_kind or existing.mode <> p_mode then
      return jsonb_build_object('code', 'REQUEST_CONFLICT', 'balance', balance);
    elsif existing.status = 'succeeded' then
      return jsonb_build_object('state', 'succeeded', 'result', existing.result, 'balance', balance);
    else
      return jsonb_build_object('code', case when existing.status = 'reserved' then 'REQUEST_PENDING' else 'REQUEST_FAILED' end, 'balance', balance);
    end if;
  end if;
  daily_start := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC';
  if (select count(*) from public.web_ai_requests where environment = p_environment and user_id = p_user_id and mode = p_mode and created_at >= daily_start)
      >= (case when p_mode = 'llm' then 2 else 20 end)
    or (p_mode = 'llm' and (select count(*) from public.web_ai_requests where mode = 'llm' and created_at >= daily_start) >= 10) then
    return jsonb_build_object('code', 'RATE_LIMITED', 'balance', balance);
  end if;
  if balance < 1 then return jsonb_build_object('code', 'NO_CREDITS', 'balance', balance); end if;
  update public.web_credit_accounts set ai_credits_remaining = ai_credits_remaining - 1
    where environment = p_environment and user_id = p_user_id returning ai_credits_remaining into balance;
  insert into public.web_ai_requests (environment, user_id, request_id, kind, input_hash, mode)
    values (p_environment, p_user_id, p_request_id, p_kind, p_input_hash, p_mode);
  return jsonb_build_object('state', 'reserved', 'balance', balance);
end $$;

create or replace function public.web_complete_ai_request(p_environment text, p_user_id uuid, p_request_id uuid, p_result jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare balance integer; current_status text;
begin
  if p_result is null or jsonb_typeof(p_result) <> 'object' or octet_length(p_result::text) > 65536 then raise exception 'Invalid result'; end if;
  balance := public.web_get_credit_balance(p_environment, p_user_id);
  update public.web_ai_requests set status = 'succeeded', result = p_result
    where environment = p_environment and user_id = p_user_id and request_id = p_request_id and status = 'reserved';
  select status into current_status from public.web_ai_requests where environment = p_environment and user_id = p_user_id and request_id = p_request_id;
  return jsonb_build_object('state', current_status, 'balance', balance);
end $$;

create or replace function public.web_fail_ai_request(p_environment text, p_user_id uuid, p_request_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare balance integer; current_status text;
begin
  balance := public.web_get_credit_balance(p_environment, p_user_id);
  update public.web_ai_requests set status = 'failed'
    where environment = p_environment and user_id = p_user_id and request_id = p_request_id and status = 'reserved';
  if found then
    update public.web_credit_accounts set ai_credits_remaining = ai_credits_remaining + 1
      where environment = p_environment and user_id = p_user_id returning ai_credits_remaining into balance;
  end if;
  select status into current_status from public.web_ai_requests where environment = p_environment and user_id = p_user_id and request_id = p_request_id;
  return jsonb_build_object('state', current_status, 'balance', balance);
end $$;

create or replace function public.web_grant_test_credits(p_environment text, p_user_id uuid, p_source text, p_reference text default null)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare balance integer; ref text;
begin
  if p_source not in ('demo', 'stripe_test') then raise exception 'Test credits only'; end if;
  balance := public.web_get_credit_balance(p_environment, p_user_id);
  if p_source = 'demo' then
    ref := 'demo:' || p_user_id::text || ':' || (now() at time zone 'UTC')::date::text;
  else
    if p_reference is null or p_reference not like 'cs_test_%' or length(p_reference) > 255 then raise exception 'Invalid test session'; end if;
    ref := p_reference;
  end if;
  if exists (select 1 from public.web_credit_topups where environment = p_environment and reference = ref) then
    return jsonb_build_object('state', 'already_claimed', 'balance', balance);
  end if;
  if p_source = 'demo' and balance > 0 then return jsonb_build_object('state', 'credits_remaining', 'balance', balance); end if;
  insert into public.web_credit_topups(environment, reference, user_id, source) values (p_environment, ref, p_user_id, p_source) on conflict do nothing;
  if found then
    update public.web_credit_accounts set ai_credits_remaining = ai_credits_remaining + 5
      where environment = p_environment and user_id = p_user_id returning ai_credits_remaining into balance;
  end if;
  return jsonb_build_object('state', 'granted', 'balance', balance);
end $$;

revoke all on function public.web_get_credit_balance(text, uuid) from public, anon, authenticated;
revoke all on function public.web_reserve_ai_credit(text, uuid, uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.web_complete_ai_request(text, uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.web_fail_ai_request(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.web_grant_test_credits(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.web_get_credit_balance(text, uuid) to service_role;
grant execute on function public.web_reserve_ai_credit(text, uuid, uuid, text, text, text) to service_role;
grant execute on function public.web_complete_ai_request(text, uuid, uuid, jsonb) to service_role;
grant execute on function public.web_fail_ai_request(text, uuid, uuid) to service_role;
grant execute on function public.web_grant_test_credits(text, uuid, text, text) to service_role;
commit;
