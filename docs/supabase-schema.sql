-- Run this in Supabase SQL Editor to create the cloud sync table and RLS.
-- Option B from plan: single key-value table for all synced keys.

create table if not exists public.user_data (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  payload jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique(user_id, key)
);

create index if not exists user_data_user_id_key on public.user_data(user_id, key);

alter table public.user_data enable row level security;

-- Drop existing policies so this script can be re-run safely (e.g. after a failed partial run).
drop policy if exists "Users can read own data" on public.user_data;
drop policy if exists "Users can insert own data" on public.user_data;
drop policy if exists "Users can update own data" on public.user_data;
drop policy if exists "Users can delete own data" on public.user_data;

create policy "Users can read own data"
  on public.user_data for select
  using (auth.uid() = user_id);

create policy "Users can insert own data"
  on public.user_data for insert
  with check (auth.uid() = user_id);

create policy "Users can update own data"
  on public.user_data for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own data"
  on public.user_data for delete
  using (auth.uid() = user_id);

-- Subscription per user (builder admin: subscribe date, start/end, plan).
create table if not exists public.user_subscriptions (
  user_id uuid not null references auth.users(id) on delete cascade primary key,
  plan text,
  subscribed_at timestamptz,
  start_date date,
  end_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_subscriptions enable row level security;

drop policy if exists "Users can read own subscription" on public.user_subscriptions;
create policy "Users can read own subscription"
  on public.user_subscriptions for select
  using (auth.uid() = user_id);

-- Insert/update/delete only via service role (api-server admin). No policy for insert/update/delete so anon/authenticated cannot write; service role bypasses RLS.

-- Referral verification: link app user to exchange UID and store last-known volume for minimum-volume gating.
create table if not exists public.user_referral_verification (
  user_id uuid not null references auth.users(id) on delete cascade,
  exchange text not null,
  exchange_uid text not null,
  referral_volume_30d_usdt numeric,
  referral_volume_365d_usdt numeric,
  last_verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, exchange)
);

create index if not exists user_referral_verification_exchange_uid on public.user_referral_verification(exchange, exchange_uid);

alter table public.user_referral_verification enable row level security;

-- Only service role writes; users can read own row (optional, for "your linked Bybit UID" in settings).
drop policy if exists "Users can read own referral verification" on public.user_referral_verification;
create policy "Users can read own referral verification"
  on public.user_referral_verification for select
  using (auth.uid() = user_id);

-- Insert/update/delete via service role only (admin referral verify).

-- Optional: Storage bucket for backups. Create in Dashboard: Storage -> New bucket -> name "backups", private.
-- Then in Storage -> backups -> Policies, add:
-- Policy 1 (SELECT): name "Users can read own backups", allowed operation SELECT,
--   target roles authenticated, USING: (bucket_id = 'backups' AND (storage.foldername(name))[1] = auth.uid()::text)
-- Policy 2 (INSERT): name "Users can upload own backups", allowed operation INSERT,
--   WITH CHECK: (bucket_id = 'backups' AND (storage.foldername(name))[1] = auth.uid()::text)
-- Policy 3 (DELETE): name "Users can delete own backups", allowed operation DELETE,
--   USING: (bucket_id = 'backups' AND (storage.foldername(name))[1] = auth.uid()::text)
