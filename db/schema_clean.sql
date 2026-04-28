--
--  —   
-- Schema for Supabase (Postgres)
--

--
-- 1.  (Guides)
--
create table guides (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  email text unique,
  city text not null check (city in ('lisbon', 'porto')),
  travel_type text not null check (travel_type in ('monthly', 'daily')),
  travel_monthly_amount numeric default 30,
  travel_daily_amount numeric default 3,
  has_vat boolean default false,
  vat_rate numeric default 0.23,
  has_mgmt_bonus boolean default false,
  mgmt_bonus_amount numeric default 0,
  is_active boolean default true,
  is_admin boolean default false,
  created_at timestamptz default now()
);

-- Seed current guides
insert into guides (name, city, travel_type, has_vat, has_mgmt_bonus, mgmt_bonus_amount) values
  ('אביב', 'lisbon', 'monthly', false, false, 0),
  ('יניב', 'lisbon', 'monthly', false, false, 0),
  ('תום', 'porto', 'monthly', false, false, 0),
  ('מאיה', 'lisbon', 'monthly', true, true, 200),
  ('מני', 'lisbon', 'daily', true, false, 0),
  ('עומר הבן', 'lisbon', 'daily', false, false, 0),
  ('דותן', 'porto', 'daily', false, false, 0);


--
-- 2.  (Tours) — one row per tour (date + tour_type + guide)
--
create table tours (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references guides(id) on delete cascade,
  tour_date date not null,
  tour_type text not null,
  category text not null check (category in ('classic', 'fixed', 'private', 'other')),
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_tours_guide_date on tours(guide_id, tour_date);


--
-- 3.  (Bookings) — sub-groups within a tour
--
create table bookings (
  id uuid primary key default gen_random_uuid(),
  tour_id uuid not null references tours(id) on delete cascade,
  people int not null default 0,
  kids int default 0,
  price numeric default 0,
  tip numeric default 0,
  customer_type text default '',
  source text default '',
  payment_method text default '',
  change_given numeric default 0,
  costs numeric default 0,
  notes text default '',
  created_at timestamptz default now()
);

create index idx_bookings_tour on bookings(tour_id);


--
-- 4.  (Activities) — , , 
--
create table activities (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references guides(id) on delete cascade,
  activity_date date not null,
  activity_type text not null check (activity_type in ('eshel', 'habraza', 'training', 'external')),
  amount numeric not null default 0,
  notes text default '',
  created_at timestamptz default now()
);

create index idx_activities_guide_date on activities(guide_id, activity_date);


--
-- 5.  (Transfers) — guide moving money to Portugo
--
create table transfers (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references guides(id) on delete cascade,
  transfer_date date not null,
  amount numeric not null,
  transfer_type text not null default 'to_portugo'
    check (transfer_type in ('to_portugo', 'cash_refill', 'expenses_refill')),
  notes text default '',
  created_at timestamptz default now()
);

create index idx_transfers_guide_date on transfers(guide_id, transfer_date);


--
-- 6.  (Expenses) — from the expenses envelope
--
create table expenses (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references guides(id) on delete cascade,
  expense_date date not null,
  item text default '',
  amount numeric not null,
  quantity numeric default null,
  notes text default '',
  created_at timestamptz default now()
);

create index idx_expenses_guide_date on expenses(guide_id, expense_date);


--
-- 7.  (Cash Boxes) — current state per guide
--
create table cash_boxes (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references guides(id) on delete cascade,
  box_type text not null check (box_type in ('main', 'surplus', 'expenses')),
  reported_balance numeric default 0,
  last_reported_at timestamptz default now(),
  unique(guide_id, box_type)
);


--
-- 8.   (Closed Months) — once closed, no edits allowed
--
create table closed_months (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references guides(id) on delete cascade,
  year int not null,
  month int not null check (month between 1 and 12),
  closed_at timestamptz default now(),
  closed_by uuid references guides(id),
  total_salary numeric,
  receipt_amount numeric,
  transfer_to_guide numeric,
  unique(guide_id, year, month)
);


--
-- 9.   (Manual Overrides) — corrections by admin
--
create table overrides (
  id uuid primary key default gen_random_uuid(),
  target_type text not null, -- 'tour', 'booking', etc.
  target_id uuid not null,
  field text not null,
  original_value text,
  new_value text,
  reason text,
  created_by uuid references guides(id),
  created_at timestamptz default now()
);


--
-- 10.    (Monthly Summary View)
-- A convenience view for the dashboard
--
create or replace view monthly_tour_summary as
select
  t.guide_id,
  g.name as guide_name,
  extract(year from t.tour_date)::int as year,
  extract(month from t.tour_date)::int as month,
  t.id as tour_id,
  t.tour_date,
  t.tour_type,
  t.category,
  t.notes,
  coalesce(sum(b.people), 0) as total_people,
  coalesce(sum(b.kids), 0) as total_kids,
  coalesce(sum(b.price), 0) as total_collected,
  coalesce(sum(b.tip), 0) as total_tips,
  coalesce(sum(b.costs), 0) as total_costs
from tours t
join guides g on g.id = t.guide_id
left join bookings b on b.tour_id = t.id
group by t.id, g.name, t.guide_id, t.tour_date, t.tour_type, t.category, t.notes;


--
-- Row Level Security (RLS) — every guide only sees their own data;
-- admins see everything. (We'll add policies in a later migration.)
-- For now: enable RLS but leave open for admin setup.
--
-- alter table tours enable row level security;
-- alter table bookings enable row level security;
-- alter table activities enable row level security;
-- alter table transfers enable row level security;
-- alter table expenses enable row level security;
-- alter table cash_boxes enable row level security;

--
-- End of schema
--
