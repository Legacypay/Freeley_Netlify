-- Applied 2026-08-27 via Supabase MCP (apply_migration funnel_orders_card_on_file).
-- Masked card display + Authorize.Net CIM references for the Hub's Billing tab.
-- Never PAN/CVV — Accept.js tokenizes in the browser; the server only ever
-- sees accountType ("Visa") and accountNumber ("XXXX1111") in the response.
alter table public.funnel_orders
  add column if not exists card_brand text,
  add column if not exists card_last4 text check (card_last4 is null or card_last4 ~ '^[0-9]{4}$'),
  add column if not exists customer_profile_id text,
  add column if not exists payment_profile_id text;

drop function if exists public.save_funnel_order(uuid,integer,integer,text,text,text,text,text,text,text,text,text,date);
drop function if exists public.save_funnel_order(uuid,integer,integer,text,text,text,text,text,text,text,text,text,date,text,text);

create or replace function public.save_funnel_order(
  p_lead_id uuid, p_plan_months integer, p_amount_cents integer, p_status text, p_gateway text, p_gateway_transaction_id text,
  p_first_name text default null, p_last_name text default null, p_address text default null, p_city text default null,
  p_us_state text default null, p_zip text default null, p_date_of_birth date default null,
  p_product_name text default null, p_treatment text default null,
  p_card_brand text default null, p_card_last4 text default null,
  p_customer_profile_id text default null, p_payment_profile_id text default null)
returns uuid language sql security definer set search_path to '' as $$
  insert into public.funnel_orders (
    lead_id, plan_months, amount_cents, status, gateway, gateway_transaction_id,
    first_name, last_name, address, city, us_state, zip, date_of_birth,
    product_name, treatment, card_brand, card_last4, customer_profile_id, payment_profile_id
  ) values (
    p_lead_id, p_plan_months, p_amount_cents, p_status, p_gateway, p_gateway_transaction_id,
    p_first_name, p_last_name, p_address, p_city, p_us_state, p_zip, p_date_of_birth,
    p_product_name, p_treatment, p_card_brand, p_card_last4, p_customer_profile_id, p_payment_profile_id
  )
  on conflict (gateway_transaction_id) where gateway_transaction_id is not null
    do update set status = excluded.status
  returning id;
$$;

drop function if exists public.get_funnel_orders_for_email(text);
create or replace function public.get_funnel_orders_for_email(p_email text)
returns table(id uuid, created_at timestamptz, plan_months integer, amount_cents integer, status text, gateway text,
              gateway_transaction_id text, product_name text, treatment text,
              card_brand text, card_last4 text, customer_profile_id text, payment_profile_id text)
language sql stable security definer set search_path to '' as $$
  select o.id, o.created_at, o.plan_months, o.amount_cents, o.status, o.gateway,
         o.gateway_transaction_id, o.product_name, o.treatment,
         o.card_brand, o.card_last4, o.customer_profile_id, o.payment_profile_id
  from public.funnel_orders o
  join public.funnel_leads l on l.id = o.lead_id
  where lower(l.email) = lower(p_email)
  order by o.created_at desc
  limit 50;
$$;
