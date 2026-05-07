-- מיגרציה: settled_at ב-transfers (תאריך הפקדה בפועל לבנק)
--
-- רקע: כשמדריך סוגר חודש ב-30/4 עם 660€ "ממתין להפקדה", השורה נוצרת עם
-- transfer_date=30/4. בפועל הוא הולך לבנק כעבור כמה ימים — ב-3/5 למשל.
-- הקשפלו של פורטוגו צריך לשייך את ה-660€ לחודש מאי (יום ההפקדה האמיתי),
-- לא לאפריל.
--
-- אופן הרצה:
--   Supabase Dashboard → SQL Editor → להדביק → Run

alter table transfers
  add column if not exists settled_at date;

create index if not exists transfers_settled_at_idx
  on transfers (settled_at)
  where settled_at is not null;

-- אבחון
select
  'transfers.settled_at' as field,
  exists (select 1 from information_schema.columns
          where table_name='transfers' and column_name='settled_at') as ready;
