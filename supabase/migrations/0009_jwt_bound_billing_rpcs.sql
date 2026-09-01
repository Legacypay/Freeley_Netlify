-- 0009: bind the Hub billing RPCs to the caller's own JWT.
--
-- Security audit 2026-09-01 (Critical): get_funnel_orders_for_email(text) and
-- cancel_subscription_for_email(text, text) were SECURITY DEFINER, took the
-- email as a PARAMETER, and were granted to `anon`. The anon key ships in the
-- browser bundle, so anyone could POST
--   /rest/v1/rpc/get_funnel_orders_for_email {"p_email": "<victim>"}
-- and read that patient's orders (treatment, amounts, card brand/last4, CIM
-- ids, subscription id), then cancel the subscription's local record via the
-- second RPC — bypassing every check in getBillingHistory.js /
-- cancelSubscription.js by going straight to PostgREST.
--
-- Fix: the email now comes from the caller's verified JWT (auth.jwt()), not
-- from an argument, and the functions are executable by `authenticated` only.
-- netlify/functions/lib/funnel-orders.js calls them with the patient's own
-- Supabase access token forwarded as the Authorization header, so PostgREST
-- evaluates auth.jwt() as that patient. There is no way to name another email.

create or replace function public.get_my_funnel_orders()
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
  where nullif(auth.jwt() ->> 'email', '') is not null
    and lower(l.email) = lower(auth.jwt() ->> 'email')
  order by o.created_at desc
  limit 50;
$$;

revoke execute on function public.get_my_funnel_orders() from public, anon;
grant execute on function public.get_my_funnel_orders() to authenticated;

create or replace function public.cancel_my_subscription(p_authnet_subscription_id text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := nullif(auth.jwt() ->> 'email', '');
  v_updated integer;
begin
  if v_email is null or p_authnet_subscription_id is null or p_authnet_subscription_id = '' then
    return false;
  end if;
  update public.funnel_orders o
  set subscription_status = 'canceled'
  from public.funnel_leads l
  where o.lead_id = l.id
    and lower(l.email) = lower(v_email)
    and o.authnet_subscription_id = p_authnet_subscription_id
    and o.subscription_status = 'active';
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

revoke execute on function public.cancel_my_subscription(text) from public, anon;
grant execute on function public.cancel_my_subscription(text) to authenticated;

-- Close the email-parameter endpoints for good.
drop function if exists public.get_funnel_orders_for_email(text);
drop function if exists public.cancel_subscription_for_email(text, text);
