-- Waitlist: email-only capture for the "coming soon" gate.
-- Mirrors the funnel_leads security model: RLS on, zero policies,
-- writes go exclusively through a SECURITY DEFINER RPC granted to anon.
create table if not exists public.waitlist (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  email text not null unique
    check (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  source text
);

create index if not exists waitlist_created_at_idx
  on public.waitlist (created_at desc);

-- RLS on, zero policies: nothing here is reachable through the Data API
-- by anon/authenticated. Browser writes go only through join_waitlist below.
alter table public.waitlist enable row level security;

-- Single write entry point. SECURITY DEFINER so it can insert despite the
-- no-policy RLS above; safe because it only inserts one whitelisted column
-- and returns nothing. Idempotent: re-submitting the same email is a no-op.
create or replace function public.join_waitlist(p_email text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.waitlist (email)
  values (lower(trim(p_email)))
  on conflict (email) do nothing;
$$;

grant execute on function public.join_waitlist to anon;
