-- תיקון: לאפשר את כל פורמטי התמונה של אייפון בבאקט tour-photos.
--
-- הבעיה: מדריכה באייפון לא הצליחה להעלות תמונה מהגלריה. תמונות אייפון הן
-- HEIC/HEIF, וה-bucket קיבל רק חלק מהסוגים. כשהאחסון לא מזהה את הסוג כמותר,
-- ההעלאה נכשלת (כמו שקרה עם PDF), והשגיאה נבלעה אז המדריכה לא ידעה.
--
-- אופן הרצה: Supabase Dashboard → SQL Editor → להדביק → Run

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg','image/jpg','image/png','image/webp',
  'image/heic','image/heif','image/gif'
]
where id = 'tour-photos';

-- אבחון
select id, allowed_mime_types from storage.buckets where id = 'tour-photos';
