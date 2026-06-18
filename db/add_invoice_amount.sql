-- מיגרציה: סכום הקבלה (TOTAL A PAGAR) על קבלת מס.
--
-- הרקע: הסכום שמופיע על שורת השכר בקשפלו חייב להיות הסכום שכתוב על ה-Fatura-Recibo,
-- ולא חישוב מהמשיכה מהקופה (שכוללת גם החזרי הוצאות ואין לה קשר לסכום הקבלה).
--
-- מעכשיו: המדריך מזין את סכום הקבלה בעת ההעלאה, והאדמין יכול לערוך בדף ההכנה.
--
-- אופן הרצה: Supabase Dashboard → SQL Editor → להדביק → Run

alter table receipt_acknowledgements
  add column if not exists invoice_amount numeric;

-- אבחון
select
  'receipt_acknowledgements.invoice_amount' as field,
  exists (select 1 from information_schema.columns
          where table_name = 'receipt_acknowledgements' and column_name = 'invoice_amount') as ready;
