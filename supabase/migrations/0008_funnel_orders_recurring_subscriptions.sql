-- Added 2026-09-02: every checkout plan became a real recurring subscription
-- (Authorize.Net ARB) instead of a one-time charge for the full term — see
-- netlify/functions/lib/authnet-arb.js. funnel_orders needs to track the
-- resulting subscription so the Hub can show it and let the patient cancel.

alter table public.funnel_orders
  add column if not exists authnet_subscription_id text,
  add column if not exists subscription_status text
    check (subscription_status is null or subscription_status in ('active', 'canceled'));

drop function if exists public.save_funnel_order(
  uuid, integer, integer, text, text, text, text, text, text, text, text, text, date, text, text, text, text, text, text
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
  p_treatment text default null,
  p_card_brand text default null,
  p_card_last4 text default null,
  p_customer_profile_id text default null,
  p_payment_profile_id text default null,
  p_authnet_subscription_id text default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into public.funnel_orders (
    lead_id, plan_months, amount_cents, status, gateway, gateway_transaction_id,
    first_name, last_name, address, city, us_state, zip, date_of_birth,
    product_name, treatment, card_brand, card_last4, customer_profile_id, payment_profile_id,
    authnet_subscription_id, subscription_status
  ) values (
    p_lead_id, p_plan_months, p_amount_cents, p_status, p_gateway, p_gateway_transaction_id,
    p_first_name, p_last_name, p_address, p_city, p_us_state, p_zip, p_date_of_birth,
    p_product_name, p_treatment, p_card_brand, p_card_last4, p_customer_profile_id, p_payment_profile_id,
    p_authnet_subscription_id, (case when p_authnet_subscription_id is not null then 'active' else null end)
  )
  on conflict (gateway_transaction_id) where gateway_transaction_id is not null
    do update set
      status = excluded.status,
      authnet_subscription_id = coalesce(public.funnel_orders.authnet_subscription_id, excluded.authnet_subscription_id),
      subscription_status = coalesce(public.funnel_orders.subscription_status, excluded.subscription_status)
  returning id;
$$;

grant execute on function public.save_funnel_order(
  uuid, integer, integer, text, text, text, text, text, text, text, text, text, date, text, text, text, text, text, text, text
) to anon;

drop function if exists public.get_funnel_orders_for_email(text);

create or replace function public.get_funnel_orders_for_email(p_email text)
returns table(
  id uuid, created_at timestamptz, plan_months integer, amount_cents integer,
  status text, gateway text, gateway_transaction_id text,
  product_name text, treatment text,
  card_brand text, card_last4 text, customer_profile_id text, payment_profile_id text,
  authnet_subscription_id text, subscription_status text
)
language sql
stable
security definer
set search_path = ''
as $$
  select o.id, o.created_at, o.plan_months, o.amount_cents, o.status, o.gateway,
         o.gateway_transaction_id, o.product_name, o.treatment,
         o.card_brand, o.card_last4, o.customer_profile_id, o.payment_profile_id,
         o.authnet_subscription_id, o.subscription_status
  from public.funnel_orders o
  join public.funnel_leads l on l.id = o.lead_id
  where lower(l.email) = lower(p_email)
  order by o.created_at desc
  limit 50;
$$;

grant execute on function public.get_funnel_orders_for_email(text) to anon, authenticated;

-- Cancellation write path (netlify/functions/cancelSubscription.js). Ownership
-- is checked HERE too (via the same funnel_leads email join), not just in the
-- calling function, so this RPC can never be used to cancel someone else's
-- subscription even if the caller's own check were ever bypassed. Returns
-- true only if a row actually matched and was updated.
create or replace function public.cancel_subscription_for_email(p_email text, p_authnet_subscription_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  update public.funnel_orders o
  set subscription_status = 'canceled'
  from public.funnel_leads l
  where o.lead_id = l.id
    and lower(l.email) = lower(p_email)
    and o.authnet_subscription_id = p_authnet_subscription_id
    and o.subscription_status = 'active';
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

grant execute on function public.cancel_subscription_for_email(text, text) to anon, authenticated;
