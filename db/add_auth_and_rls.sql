-- ═══════════════════════════════════════════════════════════════
-- מיגרציה: התקנת אימות זהות + הפרדת נתונים בין מדריכים (RLS)
-- ═══════════════════════════════════════════════════════════════
--
-- מה קורה כאן:
--   1. עדכון מיילים למדריכים הקיימים
--   2. הוספת אדמינים: עומר, רונה, ופורטוגו (משותף)
--   3. פונקציות עזר auth_guide_id() ו-auth_is_admin()
--   4. הפעלת RLS על כל הטבלאות עם נתוני מדריכים
--   5. שדרוג מדיניות Storage לדרוש משתמש מאומת
--
-- חשוב: אחרי הרצה — האפליקציה לא תעבוד לאף אחד עד שלא יתחבר
-- דרך מסך ה-Magic Link החדש.

-- ───────────────────────────────────────────────────────────────
-- 1. מיילים למדריכים הקיימים (lowercase לעקביות)
-- ───────────────────────────────────────────────────────────────
update guides set email = 'avivpollack@gmail.com'    where name = 'אביב';
update guides set email = 'yanivyt1@gmail.com'        where name = 'יניב';
update guides set email = 'drm210792@gmail.com'       where name = 'תום';
update guides set email = 'mayameidan1@gmail.com'     where name = 'מאיה';
update guides set email = 'meni.krispi@gmail.com'     where name = 'מני';
update guides set email = 'omertheking19@gmail.com'   where name = 'עומר הבן';
update guides set email = 'dotanbenshimol@gmail.com'  where name = 'דותן';
update guides set email = 'nirmagen8@gmail.com'       where name = 'ניר';

-- ───────────────────────────────────────────────────────────────
-- 2. אדמינים — עומר, רונה, פורטוגו (משותף)
--    is_active=false → לא יופיעו ברשימת מדריכים פעילים בתפריטים
-- ───────────────────────────────────────────────────────────────
insert into guides (name, email, city, travel_type, is_admin, is_active)
values
  ('עומר',           'omer1cho@gmail.com',     'lisbon', 'monthly', true, false),
  ('רונה',           'ronams6@gmail.com',      'lisbon', 'monthly', true, false),
  ('פורטוגו (משותף)', 'info.portugo@gmail.com', 'lisbon', 'monthly', true, false)
on conflict (name) do update set
  email = excluded.email,
  is_admin = excluded.is_admin,
  is_active = excluded.is_active;

-- ───────────────────────────────────────────────────────────────
-- 3. פונקציות עזר ל-RLS
-- ───────────────────────────────────────────────────────────────
create or replace function auth_guide_id() returns uuid
  language sql stable security definer set search_path = public
  as $$
    select id from guides where lower(email) = lower(auth.jwt() ->> 'email') limit 1;
  $$;

create or replace function auth_is_admin() returns boolean
  language sql stable security definer set search_path = public
  as $$
    select coalesce(
      (select is_admin from guides where lower(email) = lower(auth.jwt() ->> 'email')),
      false
    );
  $$;

-- ───────────────────────────────────────────────────────────────
-- 4. הפעלת RLS + מדיניות לכל טבלה
-- ───────────────────────────────────────────────────────────────

-- guides: כל מדריך רואה רק את הרשומה שלו, אדמין רואה הכל
alter table guides enable row level security;

drop policy if exists "guides: self or admin select" on guides;
create policy "guides: self or admin select" on guides
  for select to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email') or auth_is_admin());

drop policy if exists "guides: self or admin update" on guides;
create policy "guides: self or admin update" on guides
  for update to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email') or auth_is_admin())
  with check (lower(email) = lower(auth.jwt() ->> 'email') or auth_is_admin());

drop policy if exists "guides: admin insert" on guides;
create policy "guides: admin insert" on guides
  for insert to authenticated
  with check (auth_is_admin());

drop policy if exists "guides: admin delete" on guides;
create policy "guides: admin delete" on guides
  for delete to authenticated
  using (auth_is_admin());

-- tours
alter table tours enable row level security;
drop policy if exists "tours: own or admin" on tours;
create policy "tours: own or admin" on tours
  for all to authenticated
  using (guide_id = auth_guide_id() or auth_is_admin())
  with check (guide_id = auth_guide_id() or auth_is_admin());

-- bookings (מקושר דרך tour_id)
alter table bookings enable row level security;
drop policy if exists "bookings: own tour or admin" on bookings;
create policy "bookings: own tour or admin" on bookings
  for all to authenticated
  using (
    auth_is_admin()
    or tour_id in (select id from tours where guide_id = auth_guide_id())
  )
  with check (
    auth_is_admin()
    or tour_id in (select id from tours where guide_id = auth_guide_id())
  );

-- activities
alter table activities enable row level security;
drop policy if exists "activities: own or admin" on activities;
create policy "activities: own or admin" on activities
  for all to authenticated
  using (guide_id = auth_guide_id() or auth_is_admin())
  with check (guide_id = auth_guide_id() or auth_is_admin());

-- transfers
alter table transfers enable row level security;
drop policy if exists "transfers: own or admin" on transfers;
create policy "transfers: own or admin" on transfers
  for all to authenticated
  using (guide_id = auth_guide_id() or auth_is_admin())
  with check (guide_id = auth_guide_id() or auth_is_admin());

-- expenses
alter table expenses enable row level security;
drop policy if exists "expenses: own or admin" on expenses;
create policy "expenses: own or admin" on expenses
  for all to authenticated
  using (guide_id = auth_guide_id() or auth_is_admin())
  with check (guide_id = auth_guide_id() or auth_is_admin());

-- ───────────────────────────────────────────────────────────────
-- 5. שדרוג מדיניות Storage — דורש משתמש מאומת (לא anon כמו קודם)
-- ───────────────────────────────────────────────────────────────
drop policy if exists "anon insert tour photos"      on storage.objects;
drop policy if exists "anon read tour photos"        on storage.objects;
drop policy if exists "anon insert expense receipts" on storage.objects;
drop policy if exists "anon read expense receipts"   on storage.objects;
drop policy if exists "auth insert tour photos"      on storage.objects;
drop policy if exists "auth read tour photos"        on storage.objects;
drop policy if exists "auth insert expense receipts" on storage.objects;
drop policy if exists "auth read expense receipts"   on storage.objects;

create policy "auth insert tour photos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'tour-photos');

create policy "auth read tour photos" on storage.objects
  for select to authenticated
  using (bucket_id = 'tour-photos');

create policy "auth update tour photos" on storage.objects
  for update to authenticated
  using (bucket_id = 'tour-photos');

create policy "auth insert expense receipts" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'expense-receipts');

create policy "auth read expense receipts" on storage.objects
  for select to authenticated
  using (bucket_id = 'expense-receipts');

create policy "auth update expense receipts" on storage.objects
  for update to authenticated
  using (bucket_id = 'expense-receipts');
