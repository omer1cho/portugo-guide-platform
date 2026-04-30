-- מיגרציה: תמיכה בחצאי-אנשים בסיורים קלאסיים
--
-- מדיניות פורטוגו:
--   אם משתתף פורש באמצע סיור (אחרי נקודה מסוימת) הוא נספר כחצי.
--   לכן בסיור קלאסי מספר האנשים יכול להיות עשרוני (1.5, 2.5, ...).
--
-- מה השתנה:
--   • bookings.people: INTEGER → NUMERIC
--   • bookings.kids: נשאר INTEGER (ילדים תמיד שלמים)
--
-- אופן הרצה:
--   Supabase Dashboard → SQL Editor → להדביק → Run

alter table bookings
  alter column people type numeric using people::numeric;

-- ילדים נשארים שלמים — הם תמיד נספרים כיחידים, לא חצאים.
-- לא משנים את הטיפוס של kids.
