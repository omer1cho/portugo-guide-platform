-- מיגרציה: הוספת activity_type חדש 'training_lead' לטבלת פעילויות.
-- 'training_lead' = הכשרה שמדריך בכיר העביר (אביב/מאיה/תום/דותן),
-- בניגוד ל-'training' (10€) שזו הכשרה שהמדריך השתתף בה כצד מתלמד.
--
-- אופן הרצה:
--   Supabase Dashboard → SQL Editor → להדביק → Run

alter table activities
  drop constraint if exists activities_activity_type_check;

alter table activities
  add constraint activities_activity_type_check
  check (activity_type in ('eshel', 'habraza', 'training', 'training_lead', 'external'));
