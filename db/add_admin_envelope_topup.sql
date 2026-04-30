-- מיגרציה: יכולת לאדמין להוסיף כסף למעטפות מדריך, מבלי לגרוע מהקופה הראשית
--
-- שני transfer_type חדשים:
--   admin_topup_change    - תוספת למעטפת עודף (לא יוצא מהראשית)
--   admin_topup_expenses  - תוספת למעטפת הוצאות (לא יוצא מהראשית)
--
-- שימוש: כשפורטוגו נותנת למדריך כסף ביד (לא מהקופה הראשית), כדי שיכניס
-- למעטפות. עומר/רונה ירשמו את זה דרך /admin.
--
-- אופן הרצה:
--   Supabase Dashboard → SQL Editor → להדביק → Run

alter table transfers drop constraint if exists transfers_transfer_type_check;
alter table transfers add constraint transfers_transfer_type_check
  check (transfer_type in (
    'to_portugo',
    'cash_refill',
    'expenses_refill',
    'salary_withdrawal',
    'admin_topup_change',
    'admin_topup_expenses'
  ));
