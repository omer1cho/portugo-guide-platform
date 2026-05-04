-- מיגרציה: מערכת משמרות (shifts) — שלב A
--
-- מה השתנה:
--   • טבלה חדשה shifts: כל שיבוץ הוא שורה
--   • RLS: אדמין רואה הכל, מדריך רואה רק את השיבוצים שלו
--   • trigger לעדכון updated_at אוטומטי
--
-- הקשר:
--   • הסיורים מסונכרנים אוטומטית פעם ביום מ-portugo.co.il/tours-calendar
--   • עומר משבצת מדריכים על השיבוצים, מוסיפה סיורים פרטיים ידנית
--   • מדריכים יראו "המשמרות שלי" בעמוד הבית (שלב B — לא בקובץ זה)
--
-- אופן הרצה:
--   Supabase Dashboard → SQL Editor → להדביק → Run

-- ───────────────────────────────────────────────────────────
-- 1. טבלת shifts
-- ───────────────────────────────────────────────────────────
create table if not exists shifts (
  id uuid primary key default gen_random_uuid(),

  -- מתי
  shift_date date not null,
  shift_time time not null,

  -- מה
  tour_type text not null,                  -- 'ליסבון הקלאסית', 'סינטרה והסביבה', וכו'
  city text not null check (city in ('lisbon', 'porto')),

  -- מי
  guide_id uuid references guides(id) on delete set null,

  -- סטטוס
  status text not null default 'draft'
    check (status in ('draft', 'published', 'cancelled')),

  -- מקור
  source text not null default 'manual'
    check (source in ('website', 'manual')),
  website_tour_id text,                     -- מזהה הסיור באתר (לזיהוי שינויים)

  -- הערות / דגלים
  notes text,
  manually_edited boolean not null default false,  -- אם עומר ערכה ידנית, הסנכרון לא ידרוס

  -- אישור מדריך (לעתיד — שלב C)
  requires_guide_approval boolean not null default false,
  guide_approval text check (guide_approval in ('pending', 'approved', 'rejected')),
  guide_responded_at timestamptz,

  -- מטא
  published_at timestamptz,                 -- מתי פורסם למדריכים (NULL = טנטטיבי)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ───────────────────────────────────────────────────────────
-- 2. אינדקסים
-- ───────────────────────────────────────────────────────────
create index if not exists idx_shifts_date on shifts(shift_date);
create index if not exists idx_shifts_guide on shifts(guide_id);
create index if not exists idx_shifts_status on shifts(status);
create index if not exists idx_shifts_source on shifts(source);

-- מניעת כפילויות מצד הסנכרון: לא אמור להיות שני שיבוצים website
-- עבור אותו (תאריך, שעה, סוג סיור, עיר). לידנית — אין מניעה (אולי 2 פרטיים באותה שעה).
create unique index if not exists ux_shifts_website
  on shifts(shift_date, shift_time, tour_type, city)
  where source = 'website';

-- ───────────────────────────────────────────────────────────
-- 3. trigger לעדכון updated_at
-- ───────────────────────────────────────────────────────────
create or replace function shifts_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_shifts_updated_at on shifts;
create trigger trg_shifts_updated_at
  before update on shifts
  for each row execute function shifts_set_updated_at();

-- ───────────────────────────────────────────────────────────
-- 4. RLS
-- ───────────────────────────────────────────────────────────
alter table shifts enable row level security;

-- אדמין: יכול הכל
drop policy if exists "admin all shifts" on shifts;
create policy "admin all shifts" on shifts
  for all to authenticated
  using (
    exists (
      select 1 from guides
      where guides.email ilike auth.jwt()->>'email'
        and guides.is_admin = true
    )
  )
  with check (
    exists (
      select 1 from guides
      where guides.email ilike auth.jwt()->>'email'
        and guides.is_admin = true
    )
  );

-- מדריך: יכול לראות רק את השיבוצים שלו, ורק כשפורסמו (status='published')
drop policy if exists "guide read own published shifts" on shifts;
create policy "guide read own published shifts" on shifts
  for select to authenticated
  using (
    status = 'published'
    and exists (
      select 1 from guides
      where guides.id = shifts.guide_id
        and guides.email ilike auth.jwt()->>'email'
    )
  );

-- אנון (cron job): כדי שהסנכרון יוכל לרוץ — אבל רק אם CRON_SECRET נכון.
-- בפועל הסנכרון ישתמש ב-service_role key של supabase, אז לא צריך policy ל-anon.
-- אם נצטרך לפתוח לאנון בעתיד, להוסיף כאן.

-- ───────────────────────────────────────────────────────────
-- 5. אישור
-- ───────────────────────────────────────────────────────────
select 'shifts: ready' as status;
