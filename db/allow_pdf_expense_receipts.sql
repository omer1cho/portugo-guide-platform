-- תיקון: לאפשר העלאת קבצי PDF לבאקט expense-receipts.
--
-- הבעיה: הבאקט expense-receipts הוגדר עם allowed_mime_types של תמונות בלבד
-- (add_photos_and_receipts.sql). כשמעלים קבלת מס כ-PDF (למשל קבלה ידנית של אדמין
-- עם Fatura-Recibo) מתקבלת שגיאה: "mime type application/pdf is not supported".
--
-- התיקון: להוסיף application/pdf לרשימת סוגי הקבצים המותרים.
-- (monthly-receipts כבר מקבל PDF בפועל; מוסיפים גם לו ליתר ביטחון, אידמפוטנטי.)
--
-- אופן הרצה: Supabase Dashboard → SQL Editor → להדביק → Run

update storage.buckets
set allowed_mime_types = array[
  'image/jpeg','image/jpg','image/png','image/webp','image/heic','application/pdf'
]
where id in ('expense-receipts', 'monthly-receipts');

-- אבחון
select id, allowed_mime_types
from storage.buckets
where id in ('expense-receipts', 'monthly-receipts');
