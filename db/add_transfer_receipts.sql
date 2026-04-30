-- מיגרציה: תמיכה באסמכתא להעברה לפורטוגו
--
-- מה השתנה:
--   • transfers: עמודות receipt_url + is_deposit
--   • באקט חדש ב-Storage: transfer-receipts (עם הרשאות בסיסיות)
--
-- אופן הרצה:
--   Supabase Dashboard → SQL Editor → להדביק → Run

-- ───────────────────────────────────────────────────────────
-- 1. עמודות חדשות בטבלת transfers
-- ───────────────────────────────────────────────────────────
alter table transfers
  add column if not exists receipt_url text,
  add column if not exists is_deposit boolean default true;

-- ───────────────────────────────────────────────────────────
-- 2. יצירת באקט חדש ל-Storage
-- ───────────────────────────────────────────────────────────
-- public כדי שהדשבורד יוכל להציג את האסמכתאות בלי signed URLs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('transfer-receipts', 'transfer-receipts', true, 15728640,
   array['image/jpeg','image/jpg','image/png','image/webp','image/heic'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ───────────────────────────────────────────────────────────
-- 3. הרשאות storage — כמו שאר הבאקטים
-- ───────────────────────────────────────────────────────────
drop policy if exists "anon insert transfer receipts" on storage.objects;
drop policy if exists "anon read transfer receipts"   on storage.objects;

create policy "anon insert transfer receipts" on storage.objects
  for insert to anon
  with check (bucket_id = 'transfer-receipts');

create policy "anon read transfer receipts" on storage.objects
  for select to anon
  using (bucket_id = 'transfer-receipts');
