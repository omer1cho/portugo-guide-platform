-- מיגרציה: שדות שיבוצים בכרטיס המדריך (זמינות קבועה + חופשות)
--
-- מה השתנה:
--   • guides: 2 עמודות טקסט חדשות (אופציונליות, nullable)
--     - availability_notes: זמינות קבועה ("לא בשבת. מעדיפה ימי קיץ")
--     - vacation_notes:    חופשות מתוכננות ("10-20.7 בארץ")
--
-- בעתיד, כשנבנה מערכת שיבוצים אמיתית, הנתונים יעברו למבנה מובנה
-- (טבלאות נפרדות עם ימי שבוע, שעות, תאריכים מדויקים).
-- בינתיים — טקסט חופשי שעומר תכניס דרך דף /admin/guides.
--
-- אופן הרצה:
--   Supabase Dashboard → SQL Editor → להדביק → Run

alter table guides
  add column if not exists availability_notes text,
  add column if not exists vacation_notes text;

comment on column guides.availability_notes is 'זמינות קבועה — טקסט חופשי (ימים/שעות מועדפים או לא)';
comment on column guides.vacation_notes is 'חופשות עתידיות — טקסט חופשי (תאריכים שהמדריך מודיע מראש)';

select 'guide scheduling notes: ready' as status;
