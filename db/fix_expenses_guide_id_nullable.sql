-- תיקון: לאפשר הוצאות "קבלה ידנית של אדמין" בלי מדריך מקושר.
--
-- הבעיה: עמודת expenses.guide_id הוגדרה NOT NULL (schema.sql).
-- הפיצ'ר addAdminExpense מכניס שורה עם guide_id = null (is_admin_added=true),
-- וזה נכשל על "violates not-null constraint".
--
-- התיקון: להסיר את אילוץ ה-NOT NULL מהעמודה.
-- בטוח: הוצאות של מדריכים תמיד מספקות guide_id, ושאילתות שמסננות
-- .eq('guide_id', id) ממילא לא מחזירות שורות עם null — אז הוצאות אדמין
-- לא ידלפו לנתונים של אף מדריך. ה-FK עם on delete cascade ממשיך לעבוד.
--
-- אופן הרצה: Supabase Dashboard → SQL Editor → להדביק → Run

alter table expenses alter column guide_id drop not null;

-- אבחון
select
  'expenses.guide_id nullable' as field,
  (select is_nullable from information_schema.columns
   where table_name = 'expenses' and column_name = 'guide_id') as is_nullable;
