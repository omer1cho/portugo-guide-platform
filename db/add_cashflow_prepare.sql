-- מיגרציה: תשתית לדף /admin/cashflow/[year]/[month]/prepare (שלב 2)
--
-- מה השתנה:
--   1. expenses: עמודות חדשות לסיווג קשפלו
--   2. receipt_acknowledgements: עמודת invoice_date (תאריך הוצאת ה-Fatura-Recibo)
--   3. טבלה חדשה cashflow_runs (היסטוריית הרצות קשפלו)
--
-- אופן הרצה:
--   Supabase Dashboard → SQL Editor → להדביק → Run

-- ───────────────────────────────────────────────────────────
-- 1. עמודות חדשות בטבלת expenses
-- ───────────────────────────────────────────────────────────
alter table expenses
  add column if not exists supplier_name      text,
  add column if not exists receipt_number     text,
  add column if not exists cashflow_category  text not null default 'regular'
    check (cashflow_category in ('regular','multibanco','excluded')),
  add column if not exists is_admin_added     boolean not null default false;

-- אינדקס לסינון מהיר לפי חודש + סיווג
create index if not exists expenses_cashflow_idx
  on expenses (expense_date, cashflow_category);


-- ───────────────────────────────────────────────────────────
-- 2. עמודת invoice_date ב-receipt_acknowledgements
--    (תאריך הוצאת חשבונית מס — קובע באיזה חודש הקבלה מופיעה בקשפלו.
--     עשוי להיות אחרי תום חודש העבודה: למשל קבלה למרץ הוצאה ב-5 לאפריל
--     → תופיע בגליון של אפריל.)
-- ───────────────────────────────────────────────────────────
alter table receipt_acknowledgements
  add column if not exists invoice_date date;

create index if not exists receipt_ack_invoice_date_idx
  on receipt_acknowledgements (invoice_date);


-- ───────────────────────────────────────────────────────────
-- 3. טבלת cashflow_runs — היסטוריית הרצות
-- ───────────────────────────────────────────────────────────
create table if not exists cashflow_runs (
  id                   uuid primary key default gen_random_uuid(),
  year                 int  not null,
  month                int  not null check (month between 1 and 12),
  tours_income         numeric not null default 0,
  total_outflow        numeric not null default 0,
  previous_balance     numeric not null default 0,
  final_balance        numeric,
  transactions_count   int not null default 0,
  excel_file_url       text,
  generated_by         uuid references guides(id),
  generated_at         timestamptz not null default now(),
  notes                text default ''
);

create index if not exists cashflow_runs_period_idx
  on cashflow_runs (year, month, generated_at desc);


-- ───────────────────────────────────────────────────────────
-- 4. RLS — אדמין בלבד (לכל שלוש השכבות)
-- ───────────────────────────────────────────────────────────
alter table cashflow_runs enable row level security;

drop policy if exists "cashflow_runs: admin only" on cashflow_runs;
create policy "cashflow_runs: admin only" on cashflow_runs
  for all
  using (auth_is_admin())
  with check (auth_is_admin());


-- ───────────────────────────────────────────────────────────
-- 5. אבחון
-- ───────────────────────────────────────────────────────────
select
  'expenses.supplier_name'        as field,
  exists (select 1 from information_schema.columns
          where table_name='expenses' and column_name='supplier_name') as ready
union all
select 'expenses.cashflow_category',
  exists (select 1 from information_schema.columns
          where table_name='expenses' and column_name='cashflow_category')
union all
select 'expenses.receipt_number',
  exists (select 1 from information_schema.columns
          where table_name='expenses' and column_name='receipt_number')
union all
select 'expenses.is_admin_added',
  exists (select 1 from information_schema.columns
          where table_name='expenses' and column_name='is_admin_added')
union all
select 'receipt_acknowledgements.invoice_date',
  exists (select 1 from information_schema.columns
          where table_name='receipt_acknowledgements' and column_name='invoice_date')
union all
select 'cashflow_runs',
  exists (select 1 from information_schema.tables
          where table_name='cashflow_runs');
