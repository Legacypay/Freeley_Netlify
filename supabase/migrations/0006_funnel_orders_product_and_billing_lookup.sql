-- Reconciliation migration (see 0004's header note).
-- Remote migration name/version this file reconstructs:
-- funnel_orders_product_and_billing_lookup (20260827165814).
--
-- Adds product_name/treatment (what was actually purchased — the Hub's
-- Billing tab has nothing else to display a line item with) and the
-- get_funnel_orders_for_email RPC that reads them back, joined to
-- funnel_leads for the email match. NOTE (see docs/AUTHORIZE_NET_SETUP.md /
-- the 2026-09-01 pipeline audit): this join is an INNER join and funnel_orders
-- has no email column of its own, so an order with a null lead_id (see 0005)
-- is invisible to the Hub's Billing tab forever, and a patient who used a
-- different email at checkout than in the quiz won't find their order either.
-- Left as-is here to faithfully reconstruct what's actually live in
-- production; fixing it is a separate, deliberate schema change (add an
-- email column to funnel_orders, left-join), not a reconciliation edit.
alter table public.funnel_orders
  add column if not exists product_name text,
  add column if not exists treatment text;

drop function if exists public.save_funnel_order(
  uuid, integer, integer, text, text, text, text, text, text, text, text, text, date
);

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
  p_date_of_birth date default null,
  p_product_name text default null,
  p_treatment text default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into public.funnel_orders (
    lead_id, plan_months, amount_cents, status, gateway, gateway_transaction_id,
    first_name, last_name, address, city, us_state, zip, date_of_birth,
    product_name, treatment
  ) values (
    p_lead_id, p_plan_months, p_amount_cents, p_status, p_gateway, p_gateway_transaction_id,
    p_first_name, p_last_name, p_address, p_city, p_us_state, p_zip, p_date_of_birth,
    p_product_name, p_treatment
  )
  on conflict (gateway_transaction_id) where gateway_transaction_id is not null
    do update set status = excluded.status
  returning id;
$$;

grant execute on function public.save_funnel_order(
  uuid, integer, integer, text, text, text, text, text, text, text, text, text, date, text, text
) to anon;

create or replace function public.get_funnel_orders_for_email(p_email text)
returns table(
  id uuid, created_at timestamptz, plan_months integer, amount_cents integer,
  status text, gateway text, gateway_transaction_id text,
  product_name text, treatment text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.created_at, o.plan_months, o.amount_cents, o.status, o.gateway,
         o.gateway_transaction_id, o.product_name, o.treatment
  from public.funnel_orders o
  join public.funnel_leads l on l.id = o.lead_id
  where lower(l.email) = lower(p_email)
  order by o.created_at desc
  limit 50;
$$;

grant execute on function public.get_funnel_orders_for_email(text) to anon, authenticated;
