-- ============================================================
-- אנליטיקה לדפי הטיפים (portugo-tips.vercel.app)
-- טבלת אירועים: כניסות, הקלקות, עומק גלילה וזמן בדף.
-- בלי עוגיות ובלי מידע אישי - session_id הוא מזהה אקראי לביקור.
-- ============================================================

create table if not exists tips_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  page text not null,          -- 'lisbon' / 'porto'
  session_id text not null,    -- מזהה אקראי לביקור (לא מזהה אדם)
  event_type text not null,    -- 'page_view' / 'click' / 'page_leave'
  target text,                 -- מה הוקלק (בעברית, למשל "מקום: Tapabento")
  meta jsonb                   -- פרטים: ref, mobile, max_scroll, seconds...
);

-- אבטחה: RLS פעיל בלי שום policy - רק המפתח הסודי בצד השרת כותב וקורא
alter table tips_events enable row level security;

create index if not exists tips_events_page_created_idx
  on tips_events (page, created_at desc);
create index if not exists tips_events_type_idx
  on tips_events (event_type);
