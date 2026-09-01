-- Reconciliation migration (see 0004's header note).
-- Remote migration name/version this file reconstructs:
-- funnel_orders_relax_lead_and_plan_constraints (20260827163249).
--
-- Two constraints from 0001 turned out to be too strict for the real checkout
-- flow that got wired up right after save_funnel_order_rpc (previous file):
--
--   * lead_id NOT NULL — a checkout completed without a prior quiz session
--     (direct /checkout visit, a QA run) has no funnel_leads row to reference,
--     but the charge still happened and must still be recorded. See
--     netlify/functions/lib/funnel-orders.js: `leadId: order.leadId || null`.
--   * plan_months IN (1, 3, 6) — pricing.json added 12- and 24-month tiers.
alter table public.funnel_orders
  alter column lead_id drop not null;

alter table public.funnel_orders
  drop constraint if exists funnel_orders_plan_months_check;

alter table public.funnel_orders
  add constraint funnel_orders_plan_months_check
  check (plan_months = any (array[1, 3, 6, 12, 24]));
