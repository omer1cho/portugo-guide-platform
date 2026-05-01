-- תיקון RLS לטבלת receipt_acknowledgements
-- כשיצרנו את הטבלה Supabase הפעילה RLS אוטומטית בלי policy → לא ניתן להכניס שורות.
-- מוסיפים policy זהה לשאר הטבלאות: מדריך רואה ומכניס רק את השורות שלו, אדמין רואה הכל.

ALTER TABLE receipt_acknowledgements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "receipt_ack: own or admin" ON receipt_acknowledgements;
CREATE POLICY "receipt_ack: own or admin" ON receipt_acknowledgements
  FOR ALL TO authenticated
  USING (guide_id = auth_guide_id() OR auth_is_admin())
  WITH CHECK (guide_id = auth_guide_id() OR auth_is_admin());

SELECT 'OK' AS status;
