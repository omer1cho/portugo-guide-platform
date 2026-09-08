-- מיגרציה: יומן פרסומי סידור עבודה (shift_publish_log)
--
-- למה: ב-4.9.26 עומר פרסמה את שבוע 6-12.9, ההודעה על המסך נראתה רגילה,
-- והשיבוצים נשארו טיוטה. לא הייתה שום דרך לבדוק בדיעבד מה באמת קרה.
-- מעכשיו כל לחיצה על "פרסמי" / "פרסמי מחדש" / "בטלי פרסום" נרשמת כאן,
-- יחד עם ספירה בלתי תלויה שהשרת עושה בעצמו אחרי הפעולה.
--
-- נכתב רק ע"י השרת (מפתח שירות, עוקף RLS). קריאה: אדמין בלבד.

create table if not exists shift_publish_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_email text,                                  -- מי לחצה (חשבון ההתחברות)
  action text not null check (action in ('publish', 'republish', 'unpublish')),
  week_start date not null,
  city text not null default 'all' check (city in ('all', 'lisbon', 'porto')),
  rows_affected int,                                 -- כמה שורות הדפדפן דיווח שעודכנו
  emails_sent int,                                   -- כמה מיילים יצאו למדריכים
  draft_after int,                                   -- ספירת השרת אחרי הפעולה: טיוטות שנשארו
  published_after int,                               -- ספירת השרת אחרי הפעולה: מפורסמים
  published_without_stamp int                        -- מפורסם בלי published_at = בדיוק התקלה של 4.9
);

create index if not exists idx_shift_publish_log_week
  on shift_publish_log (week_start desc, created_at desc);

alter table shift_publish_log enable row level security;

-- אין policy ל-insert/update/delete בכוונה: רק השרת כותב, עם מפתח השירות.
-- קריאה מותרת לאדמין בלבד (אותו תנאי כמו שאר טבלאות האדמין).
drop policy if exists "admin can read publish log" on shift_publish_log;
create policy "admin can read publish log" on shift_publish_log
  for select
  using (auth_is_admin());

-- אחרי הרצה: כל פרסום סידור נרשם. לצפייה בשלושת האחרונים:
--   select created_at, actor_email, action, week_start, city,
--          rows_affected, draft_after, published_after
--   from shift_publish_log order by created_at desc limit 3;
