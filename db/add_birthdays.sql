-- מיגרציה: ימי הולדת לצוות פורטוגו
--
-- מה השתנה:
--   • guides: עמודה birthday (פורמט "MM-DD" - יום וחודש בלבד, חוזר כל שנה)
--   • מילוי תאריכי הולדת לצוות (10 אנשים, ניר חסר)
--   • פונקציית RPC public_team_birthdays() — מחזירה שם + יום הולדת לכל המדריכים,
--     עוקפת RLS כך שכל מדריך יוכל לראות גם של אחרים (למרות RLS המגביל על guides).
--
-- אופן הרצה:
--   Supabase Dashboard → SQL Editor → להדביק → Run

-- ───────────────────────────────────────────────────────────
-- 1. עמודת birthday בטבלת guides
-- ───────────────────────────────────────────────────────────
alter table guides
  add column if not exists birthday text;  -- פורמט "MM-DD" (לדוגמה "04-05")

comment on column guides.birthday is 'תאריך יום הולדת בפורמט MM-DD (חוזר כל שנה)';

-- ───────────────────────────────────────────────────────────
-- 2. מילוי תאריכי הולדת לצוות
-- ───────────────────────────────────────────────────────────
update guides set birthday = '03-12' where name = 'מאיה';
update guides set birthday = '04-05' where name = 'אביב';
update guides set birthday = '04-24' where name = 'עומר';
update guides set birthday = '07-14' where name = 'יניב';
update guides set birthday = '07-21' where name = 'תום';
update guides set birthday = '07-22' where name = 'מני';
update guides set birthday = '08-09' where name = 'רונה';
update guides set birthday = '09-01' where name = 'עומר הבן';
update guides set birthday = '09-05' where name = 'דותן';
-- ניר — חסר תאריך, יושלם בהמשך

-- ───────────────────────────────────────────────────────────
-- 3. פונקציית RPC ציבורית — שם + יום הולדת בלבד.
-- security definer = עוקפת RLS. מחזירה רק את 3 השדות הציבוריים.
-- ───────────────────────────────────────────────────────────
create or replace function public_team_birthdays()
  returns table (id uuid, name text, birthday text)
  language sql
  security definer
  set search_path = public
  as $$
    select id, name, birthday
    from guides
    where (is_active = true or is_admin = true) and birthday is not null;
  $$;

grant execute on function public_team_birthdays() to authenticated;

select 'birthdays: ready' as status;
