-- מיגרציה: שמירת ערכי ההכנה של הקשפלו לכל חודש (יתרת פתיחה + הכנסת סיורים).
--
-- הרקע: שני השדות "יתרת חודש קודם" ו"הכנסת סיורים" בדף ההכנה היו state מקומי
-- בלבד, אז כל רענון איפס אותם. עכשיו נשמרים במסד (upsert לפי year+month).
--
-- אופן הרצה: Supabase Dashboard → SQL Editor → להדביק → Run

create table if not exists cashflow_month_settings (
  year             int not null,
  month            int not null check (month between 1 and 12),
  previous_balance numeric,
  tours_income     numeric,
  updated_at       timestamptz not null default now(),
  primary key (year, month)
);

alter table cashflow_month_settings enable row level security;

drop policy if exists "cashflow_settings: admin only" on cashflow_month_settings;
create policy "cashflow_settings: admin only" on cashflow_month_settings
  for all
  using (auth_is_admin())
  with check (auth_is_admin());

select 'cashflow_month_settings: ready' as status;
