-- מיגרציה: תעריף ההפרשה לפורטוגו לראש משלם בסיורי קלאסי, לכל מדריך בנפרד.
--
-- מדריכים ותיקים: 10€ לראש (ברירת המחדל)
-- מדריכים חדשים מעתה ואילך: 11€ לראש
--
-- אופן הרצה:
--   Supabase Dashboard → SQL Editor → להדביק → Run

-- 1. הוספת העמודה (ברירת מחדל 10€ לכל המדריכים הקיימים)
alter table guides
  add column if not exists classic_transfer_per_person numeric default 10;

-- 2. הוספת ניר (מדריך חדש בליסבון, 11€ לראש)
insert into guides (name, city, travel_type, has_vat, has_mgmt_bonus, mgmt_bonus_amount, is_admin, classic_transfer_per_person)
values ('ניר', 'lisbon', 'monthly', false, false, 0, false, 11)
on conflict (name) do update set
  city = excluded.city,
  travel_type = excluded.travel_type,
  has_vat = excluded.has_vat,
  has_mgmt_bonus = excluded.has_mgmt_bonus,
  mgmt_bonus_amount = excluded.mgmt_bonus_amount,
  is_admin = excluded.is_admin,
  classic_transfer_per_person = excluded.classic_transfer_per_person;
