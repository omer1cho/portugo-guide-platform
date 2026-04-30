-- ════════════════════════════════════════════════════════════════
-- מיגרציה מאוחדת — להריץ פעם אחת ב-Supabase SQL Editor
-- ════════════════════════════════════════════════════════════════
-- מאחדת 4 מיגרציות שעדיין לא רצו אצל עומר:
--   1. חצאי-אנשים בקלאסי
--   2. אסמכתא להעברה (קבצים) + Storage bucket
--   3. הוספת כסף למעטפת מצד אדמין (transfer_type חדש)
--   4. תיקוני קטלוג: יקב פורטו 5€, בירה ללא קבלה (+ עמודה חדשה)
--
-- בטוח להרצה מספר פעמים (כל פעולה יש לה IF NOT EXISTS / ON CONFLICT)
-- ════════════════════════════════════════════════════════════════


-- ───────────────────────────────────────────────────────────
-- 1) חצאי-אנשים בסיורים קלאסיים
-- ───────────────────────────────────────────────────────────
alter table bookings
  alter column people type numeric using people::numeric;
-- (kids נשאר integer)


-- ───────────────────────────────────────────────────────────
-- 2) אסמכתא להעברה לפורטוגו (משימה 3)
-- ───────────────────────────────────────────────────────────
alter table transfers
  add column if not exists receipt_url text,
  add column if not exists is_deposit boolean default true;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('transfer-receipts', 'transfer-receipts', true, 15728640,
   array['image/jpeg','image/jpg','image/png','image/webp','image/heic'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "anon insert transfer receipts" on storage.objects;
drop policy if exists "anon read transfer receipts"   on storage.objects;

create policy "anon insert transfer receipts" on storage.objects
  for insert to anon
  with check (bucket_id = 'transfer-receipts');

create policy "anon read transfer receipts" on storage.objects
  for select to anon
  using (bucket_id = 'transfer-receipts');


-- ───────────────────────────────────────────────────────────
-- 3) Admin: הוספת כסף למעטפות (משימה 7)
-- ───────────────────────────────────────────────────────────
alter table transfers drop constraint if exists transfers_transfer_type_check;
alter table transfers add constraint transfers_transfer_type_check
  check (transfer_type in (
    'to_portugo',
    'cash_refill',
    'expenses_refill',
    'salary_withdrawal',
    'admin_topup_change',
    'admin_topup_expenses'
  ));


-- ───────────────────────────────────────────────────────────
-- 4) Catalog: עמודה requires_receipt + יקב 5€ + בירה
-- ───────────────────────────────────────────────────────────
alter table expense_catalog
  add column if not exists requires_receipt boolean default true;

-- יקב פורטו: 5€/אדם במקום 10€
update expense_catalog
set unit_price = 5
where tour_type = 'טעימות'
  and item_name like '%יקב%';

-- הוספת בירה לטעימות פורטו, ללא חובת קבלה
insert into expense_catalog (tour_type, item_name, calc_type, unit_price, sort_order, is_active, requires_receipt)
values ('טעימות', 'בירה', 'unit', 1, 99, true, false)
on conflict do nothing;


-- ───────────────────────────────────────────────────────────
-- בדיקה סופית: לראות שהכל נכנס
-- ───────────────────────────────────────────────────────────
select 'transfers columns' as section, column_name as info
from information_schema.columns
where table_name = 'transfers' and column_name in ('receipt_url','is_deposit','is_pending_deposit')

union all
select 'bookings.people type', data_type
from information_schema.columns
where table_name = 'bookings' and column_name = 'people'

union all
select 'expense_catalog rows (טעימות)', item_name || ' · ' || unit_price || '€ · receipt=' || requires_receipt::text
from expense_catalog
where tour_type = 'טעימות'

order by section;
