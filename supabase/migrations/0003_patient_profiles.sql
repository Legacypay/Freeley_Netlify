-- Patient profiles for the /hub portal — one row per Supabase Auth user,
-- created automatically on signup. Mirrors the funnel_leads/waitlist
-- security model: RLS on, policies scoped strictly to the owning user via
-- auth.uid(), and the auto-create step runs as SECURITY DEFINER since a
-- brand-new user has no session yet to satisfy an RLS INSERT check.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  email text,
  full_name text
);

alter table public.profiles enable row level security;

-- A patient can read and update only their own profile row. No anon
-- access at all (unlike funnel_leads/waitlist, which are anon-writable
-- via RPC) — profiles only exist for signed-in users.
create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user is created (email
-- sign-up, Google OAuth, etc.) — full_name comes from whatever the client
-- passed in signUp()'s options.data, or Google's profile data for OAuth.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Reuses the set_updated_at() trigger function already created by the
-- funnel_leads migration (0001) — same convention, no duplicate function.
create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- handle_new_user() is trigger-only (fires on auth.users insert). Postgres
-- grants EXECUTE to PUBLIC by default at function-creation time — which
-- applies to every role including anon/authenticated regardless of
-- per-role revokes, so PUBLIC (not the individual roles) is the one to
-- revoke it from — that's what actually closes the PostgREST RPC endpoint.
revoke execute on function public.handle_new_user() from public;
