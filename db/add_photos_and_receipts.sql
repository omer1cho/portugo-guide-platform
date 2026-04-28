-- מיגרציה: תמיכה בהעלאת תמונות סיור וקבלות
--
-- מה השתנה:
--   • tours: עמודת photo_url לתמונת סיור אחת
--   • expenses: עמודות receipt_url + tour_type (לארגון התיקיות)
--   • שני באקטים חדשים ב-Storage עם הרשאות בסיסיות
--
-- אופן הרצה:
--   Supabase Dashboard → SQL Editor → להדביק → Run

-- ───────────────────────────────────────────────────────────
-- 1. עמודות חדשות בטבלאות
-- ───────────────────────────────────────────────────────────
alter table tours
  add column if not exists photo_url text;

alter table expenses
  add column if not exists receipt_url text,
  add column if not exists tour_type text;

-- ───────────────────────────────────────────────────────────
-- 2. יצירת באקטים ב-Storage
-- ───────────────────────────────────────────────────────────
-- נשמור באקטים כ-public כדי שהדשבורד יוכל להציג תמונות בלי signed URLs.
-- הקבצים עצמם לא מקושרים מאף מקום פומבי, רק מתוך האפליקציה.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('tour-photos', 'tour-photos', true, 15728640, array['image/jpeg','image/jpg','image/png','image/webp','image/heic']),
  ('expense-receipts', 'expense-receipts', true, 15728640, array['image/jpeg','image/jpg','image/png','image/webp','image/heic'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ───────────────────────────────────────────────────────────
-- 3. הרשאות storage — מאפשרים לאנונימי להעלות ולקרוא
-- ───────────────────────────────────────────────────────────
-- מורידים מדיניות קודמת (אם קיימת) כדי להימנע מכפילויות
drop policy if exists "anon insert tour photos"      on storage.objects;
drop policy if exists "anon read tour photos"        on storage.objects;
drop policy if exists "anon insert expense receipts" on storage.objects;
drop policy if exists "anon read expense receipts"   on storage.objects;

create policy "anon insert tour photos" on storage.objects
  for insert to anon
  with check (bucket_id = 'tour-photos');

create policy "anon read tour photos" on storage.objects
  for select to anon
  using (bucket_id = 'tour-photos');

create policy "anon insert expense receipts" on storage.objects
  for insert to anon
  with check (bucket_id = 'expense-receipts');

create policy "anon read expense receipts" on storage.objects
  for select to anon
  using (bucket_id = 'expense-receipts');
