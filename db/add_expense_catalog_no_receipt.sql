-- מיגרציה: הוספת תמיכה בפריטי קטלוג שלא מחייבים קבלה + תיקוני נתונים
--
-- מה השתנה:
--   • expense_catalog: עמודה חדשה requires_receipt (ברירת מחדל TRUE)
--   • תיקון נתונים: יקב פורטו בטעימות מ-10€ ל-5€ לאדם
--   • הוספה: בירה בטעימות פורטו (1€/כוס, ללא חובת קבלה)
--
-- אופן הרצה:
--   Supabase Dashboard → SQL Editor → להדביק → Run

-- ───────────────────────────────────────────────────────────
-- 1. עמודה חדשה: requires_receipt
-- ───────────────────────────────────────────────────────────
alter table expense_catalog
  add column if not exists requires_receipt boolean default true;

-- ───────────────────────────────────────────────────────────
-- 2. יקב פורטו: 5€/אדם במקום 10€ (משימה 9)
-- ───────────────────────────────────────────────────────────
update expense_catalog
set unit_price = 5
where tour_type = 'טעימות'
  and item_name like '%יקב%';

-- ───────────────────────────────────────────────────────────
-- 3. הוספת פריט "בירה" לטעימות פורטו (משימה 11)
--    1€ לכוס, חישוב לפי כמות, **ללא חובת קבלה**
-- ───────────────────────────────────────────────────────────
insert into expense_catalog (tour_type, item_name, calc_type, unit_price, sort_order, is_active, requires_receipt)
values ('טעימות', 'בירה', 'unit', 1, 99, true, false)
on conflict do nothing;

-- בדיקה: כל הפריטים של טעימות
select item_name, calc_type, unit_price, requires_receipt
from expense_catalog
where tour_type = 'טעימות'
order by sort_order;
