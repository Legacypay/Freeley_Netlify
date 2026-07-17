-- Freeley assessment funnel — lead capture schema.
--
-- Design notes (grounded in the actual funnel code, see
-- public/quiz-scripts/asw.js collectAllQuizData()):
-- * One row per quiz session. The client generates the row uuid,
--   calls save_funnel_lead() at contact-capture (step 2, so
--   abandoned sessions are still leads) and again as the user
--   progresses; the function upserts by that uuid.
-- * All browser access goes through the save_funnel_lead RPC —
--   the tables have RLS enabled with NO anon policies, so the Data
--   API exposes nothing directly. A direct anon UPDATE policy
--   without a SELECT policy would silently match 0 rows (Postgres
--   RLS: UPDATE must first read the row), and adding anon SELECT
--   would leak the whole leads table; the RPC avoids both.
-- * goals and symptoms are the only multi-value answers; the catalog
--   is 4 fixed products defined client-side, so text[] beats join
--   tables here.
-- * NO card data columns, ever. Payment must be integrated via
--   client-side tokenization (Authorize.Net Accept.js or Stripe);
--   orders store only the gateway's opaque references.

create table public.funnel_leads (
  id uuid primary key,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- step 2: contact + consent (minimum viable lead)
  email text not null,
  phone text not null,
  consented_at timestamptz not null default now(),

  -- step 1: goals (multi-select of the 4 product lines)
  goals text[] not null default '{}',

  -- step 3: basics
  age int check (age between 18 and 100),
  sex text,
  height_inches int,
  current_weight_lbs int check (current_weight_lbs between 80 and 800),
  us_state text check (us_state ~ '^[A-Z]{2}$'),

  -- step 4: symptoms (multi-select)
  symptoms text[] not null default '{}',

  -- steps 5-11: medical history free text + selections
  allergies text,
  medications text,
  conditions text,
  surgeries text,
  activity_level text,
  treatment_format text,
  physician_notes text,

  -- design-2 variant clinical screening flags (nullable until that
  -- funnel version is wired up)
  is_pregnant boolean,
  has_thyroid_history boolean,   -- MTC / MEN2
  has_pancreatitis boolean,

  -- funnel state
  completed_at timestamptz,      -- null = abandoned mid-funnel
  product_group int              -- 1|2, derived client-side
);

create index funnel_leads_created_at_idx on public.funnel_leads (created_at desc);
create index funnel_leads_email_idx on public.funnel_leads (email);

-- Orders are created only when a real payment gateway is integrated.
-- Until then the table exists so checkout work has a target, but the
-- funnel writes nothing here.
create table public.funnel_orders (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  lead_id uuid not null references public.funnel_leads (id),

  plan_months int not null check (plan_months in (1, 3, 6)),
  amount_cents int not null check (amount_cents > 0),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'refunded')),

  -- gateway references only — never card data
  gateway text,
  gateway_transaction_id text,

  -- shipping/patient details captured at checkout
  first_name text,
  last_name text,
  address text,
  city text,
  us_state text,
  zip text,
  date_of_birth date
);

create index funnel_orders_lead_id_idx on public.funnel_orders (lead_id);

-- RLS on, zero policies: nothing in these tables is directly
-- reachable through the Data API by anon or authenticated. Reads
-- happen in the Supabase dashboard / service role only; browser
-- writes go exclusively through save_funnel_lead below.
alter table public.funnel_leads enable row level security;
alter table public.funnel_orders enable row level security;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger funnel_leads_updated_at
  before update on public.funnel_leads
  for each row execute function public.set_updated_at();

-- The funnel's single write entry point. SECURITY DEFINER so it can
-- write despite the no-policy RLS above; safe because it can only
-- upsert the whitelisted columns of one row identified by the
-- client-generated uuid (unguessable; knowing one exposes writes to
-- one row, reads to none — the function returns only the id).
-- Partial payloads never erase earlier answers (coalesce).
create or replace function public.save_funnel_lead(
  p_id uuid,
  p_email text,
  p_phone text,
  p_goals text[] default null,
  p_age int default null,
  p_sex text default null,
  p_height_inches int default null,
  p_current_weight_lbs int default null,
  p_us_state text default null,
  p_symptoms text[] default null,
  p_allergies text default null,
  p_medications text default null,
  p_conditions text default null,
  p_surgeries text default null,
  p_activity_level text default null,
  p_treatment_format text default null,
  p_physician_notes text default null,
  p_is_pregnant boolean default null,
  p_has_thyroid_history boolean default null,
  p_has_pancreatitis boolean default null,
  p_completed_at timestamptz default null,
  p_product_group int default null
)
returns uuid
language sql
security definer
set search_path = ''
as $$
  insert into public.funnel_leads (
    id, email, phone, goals, age, sex, height_inches,
    current_weight_lbs, us_state, symptoms, allergies, medications,
    conditions, surgeries, activity_level, treatment_format,
    physician_notes, is_pregnant, has_thyroid_history,
    has_pancreatitis, completed_at, product_group
  ) values (
    p_id, p_email, p_phone, coalesce(p_goals, '{}'), p_age, p_sex,
    p_height_inches, p_current_weight_lbs, p_us_state,
    coalesce(p_symptoms, '{}'), p_allergies, p_medications,
    p_conditions, p_surgeries, p_activity_level, p_treatment_format,
    p_physician_notes, p_is_pregnant, p_has_thyroid_history,
    p_has_pancreatitis, p_completed_at, p_product_group
  )
  on conflict (id) do update set
    email = excluded.email,
    phone = excluded.phone,
    goals = case when p_goals is null then funnel_leads.goals else excluded.goals end,
    age = coalesce(excluded.age, funnel_leads.age),
    sex = coalesce(excluded.sex, funnel_leads.sex),
    height_inches = coalesce(excluded.height_inches, funnel_leads.height_inches),
    current_weight_lbs = coalesce(excluded.current_weight_lbs, funnel_leads.current_weight_lbs),
    us_state = coalesce(excluded.us_state, funnel_leads.us_state),
    symptoms = case when p_symptoms is null then funnel_leads.symptoms else excluded.symptoms end,
    allergies = coalesce(excluded.allergies, funnel_leads.allergies),
    medications = coalesce(excluded.medications, funnel_leads.medications),
    conditions = coalesce(excluded.conditions, funnel_leads.conditions),
    surgeries = coalesce(excluded.surgeries, funnel_leads.surgeries),
    activity_level = coalesce(excluded.activity_level, funnel_leads.activity_level),
    treatment_format = coalesce(excluded.treatment_format, funnel_leads.treatment_format),
    physician_notes = coalesce(excluded.physician_notes, funnel_leads.physician_notes),
    is_pregnant = coalesce(excluded.is_pregnant, funnel_leads.is_pregnant),
    has_thyroid_history = coalesce(excluded.has_thyroid_history, funnel_leads.has_thyroid_history),
    has_pancreatitis = coalesce(excluded.has_pancreatitis, funnel_leads.has_pancreatitis),
    completed_at = coalesce(excluded.completed_at, funnel_leads.completed_at),
    product_group = coalesce(excluded.product_group, funnel_leads.product_group)
  returning id;
$$;

grant execute on function public.save_funnel_lead to anon;
