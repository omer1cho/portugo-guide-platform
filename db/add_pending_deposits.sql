-- מיגרציה: מעטפת המתנה להפקדה
--
-- רקע: כשמדריך סוגר חודש ויש לו כסף שהוא יצטרך להפקיד,
-- במציאות לוקח לו זמן להפקיד. כעת הקופה הראשית "תקועה" עם הכסף.
-- הפתרון: כפתור "העבר למעטפת המתנה" שמיד מוריד את הסכום מהקופה הראשית
-- ומעביר אותו למעטפת חדשה (קופה 4) שעולה באדום עד שהמדריך יפקיד בפועל.
--
-- בדאטהבייס: שורת transfer רגילה (transfer_type='to_portugo') עם דגל
-- חדש is_pending_deposit=true. כך הקופה הראשית מתחשבת בסכום (פוחתת) ויש
-- מקור אמת אחד. כשהמדריך מפקיד — הדגל נופל ל-false ומצרפים אסמכתא.
--
-- אופן הרצה:
--   Supabase Dashboard → SQL Editor → להדביק → Run

-- ───────────────────────────────────────────────────────────
-- עמודה חדשה: is_pending_deposit
-- ───────────────────────────────────────────────────────────
alter table transfers
  add column if not exists is_pending_deposit boolean default false;

-- אינדקס קל לשליפת pending פתוחים
create index if not exists transfers_pending_idx
  on transfers (guide_id, is_pending_deposit)
  where is_pending_deposit = true;
