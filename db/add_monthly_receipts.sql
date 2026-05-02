-- מיגרציה: דרישת אסמכתא (תמונה של הקבלה) בעת אישור "הוצאתי קבלה" החודשית
--
-- מה השתנה:
--   • receipt_acknowledgements: עמודה receipt_url
--   • באקט חדש ב-Storage: monthly-receipts (עם הרשאות בסיסיות)
--
-- אופן הרצה:
--   Supabase Dashboard → SQL Editor → להדביק → Run

-- ───────────────────────────────────────────────────────────
-- 1. עמודת receipt_url בטבלת receipt_acknowledgements
-- ───────────────────────────────────────────────────────────
alter table receipt_acknowledgements
  add column if not exists receipt_url text;

-- ───────────────────────────────────────────────────────────
-- 2. יצירת באקט חדש ל-Storage לקבלות חודשיות (קבלת מס מהמדריך לפורטוגו)
-- ───────────────────────────────────────────────────────────
-- public כדי שהדשבורד יוכל להציג את האסמכתאות בלי signed URLs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('monthly-receipts', 'monthly-receipts', true, 15728640,
   array['image/jpeg','image/jpg','image/png','image/webp','image/heic'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ───────────────────────────────────────────────────────────
-- 3. הרשאות storage — כמו שאר הבאקטים
-- ───────────────────────────────────────────────────────────
drop policy if exists "anon insert monthly receipts" on storage.objects;
drop policy if exists "anon read monthly receipts"   on storage.objects;

create policy "anon insert monthly receipts" on storage.objects
  for insert to anon
  with check (bucket_id = 'monthly-receipts');

create policy "anon read monthly receipts" on storage.objects
  for select to anon
  using (bucket_id = 'monthly-receipts');

select 'monthly-receipts: ready' as status;
