-- Reconciliation migration (added 2026-09-02): this repo's migrations directory
-- had fallen behind production by three changes applied directly (Supabase MCP
-- apply_migration / SQL editor) without a matching local file ever being
-- committed. Files 0004-0006 below recreate those three changes, in their
-- original chronological order, so `0001` -> `0007` reproduces production's
-- actual schema. Verified against the live project's pg_catalog on 2026-09-01.
-- Remote migration name/version this file reconstructs: save_funnel_order_rpc
-- (20260827163224).
--
-- Introduces the save_funnel_order RPC — 0001 created the funnel_orders TABLE
-- but never a write path for it (checkout wasn't wired to a real payment
-- gateway yet at that point). Same SECURITY DEFINER / anon-RPC pattern as
-- save_funnel_lead: the table has RLS on with zero policies, so this function
-- is the only way a charge gets recorded. ON CONFLICT upserts by
-- gateway_transaction_id so a retried/duplicate webhook or client call can
-- never insert two rows for the same charge — that requires the partial
-- unique index below to exist before the function is created.
create unique index if not exists funnel_orders_gateway_transaction_id_key
  on public.funnel_orders (gateway_transaction_id)
  where gateway_transaction_id is not null;

create or replace function public.save_funnel_order(
  p_lead_id uuid,
  p_plan_months integer,
  p_amount_cents integer,
  p_status text,
  p_gateway text,
  p_gateway_transaction_id text,
  p_first_name text default null,
  p_last_name text default null,
  p_address text default null,
  p_city text default null,
  p_us_state text default null,
  p_zip text default null,
  p_date_of_birth date default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into public.funnel_orders (
    lead_id, plan_months, amount_cents, status, gateway, gateway_transaction_id,
    first_name, last_name, address, city, us_state, zip, date_of_birth
  ) values (
    p_lead_id, p_plan_months, p_amount_cents, p_status, p_gateway, p_gateway_transaction_id,
    p_first_name, p_last_name, p_address, p_city, p_us_state, p_zip, p_date_of_birth
  )
  on conflict (gateway_transaction_id) where gateway_transaction_id is not null
    do update set status = excluded.status
  returning id;
$$;

grant execute on function public.save_funnel_order(
  uuid, integer, integer, text, text, text, text, text, text, text, text, text, date
) to anon;
