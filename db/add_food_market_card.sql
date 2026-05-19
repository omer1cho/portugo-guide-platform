-- מיגרציה: תת-קופה "כרטיס טיים אאוט" (Time Out Market בליסבון) — סיור קולינרי
--
-- רעיון:
--   * מדריכים שמדריכים קולינרי בליסבון משתמשים בכרטיס פיזי נטען של שוק
--     טיים אאוט. המדריך מטעין את הכרטיס בכסף מקופת ההוצאות (לפני הסיור),
--     ובמעמד השימוש בסיור מקבל קבלה אמיתית מהשוק.
--   * הפיצ'ר הזה מפריד בין הטענת הכרטיס (פעולה פנימית, ללא קבלה) לבין
--     הוצאות שמשולמות מהכרטיס (יש קבלה כרגיל).
--   * "מי מדריך קולינרי" נקבע דינמית בקוד — מי שעשה לפחות סיור קולינרי
--     אחד בעבר. אין דגל ידני בטבלת guides.
--
-- ─── 1) הרחבת transfer_type עם 'card_load' ──────────────────────────
-- ההטענה היא העברה פנימית: יוצא מקופת ההוצאות, נכנס לכרטיס.
-- ביטול הטענה = מחיקת השורה הזו (כמו cancel_refill הקיים).
alter table transfers drop constraint if exists transfers_transfer_type_check;
alter table transfers add constraint transfers_transfer_type_check
  check (transfer_type in (
    'to_portugo',
    'cash_refill',
    'expenses_refill',
    'salary_withdrawal',
    'admin_topup_change',
    'admin_topup_expenses',
    'card_load'
  ));

-- ─── 2) הוספת payment_source לטבלת expenses ─────────────────────────
-- expenses_box (ברירת מחדל) = ההוצאה יורדת מקופת ההוצאות הרגילה
-- food_market_card = ההוצאה יורדת מכרטיס טיים אאוט
alter table expenses
  add column if not exists payment_source text not null default 'expenses_box'
    check (payment_source in ('expenses_box', 'food_market_card'));

-- אינדקס לסינון מהיר של הוצאות מהכרטיס לפי מדריך
create index if not exists idx_expenses_guide_payment_source
  on expenses (guide_id, payment_source);

-- ─── סיום ───────────────────────────────────────────────────────────
-- אחרי הרצה: ה-UI ב-/cash-boxes יציג את תת-הקופה למדריכים שעשו קולינרי
-- בעבר, וב-/expenses יוצע בחירת מקור תשלום (קופת הוצאות / כרטיס טיים אאוט).
