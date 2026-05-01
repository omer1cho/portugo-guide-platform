-- אישורי הוצאת קבלה — שורה אחת לכל מדריך-חודש שאישר שהוציא קבלה
-- אם אין שורה עבור (guide, year, month) → המדריך עוד לא הוציא קבלה (או לא לחץ על הכפתור)
-- admin_notified_at: כשהאדמין קיבל התראה על איחור (אחרי 7 ימים מתחילת החודש העוקב)

CREATE TABLE IF NOT EXISTS receipt_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id uuid REFERENCES guides(id) NOT NULL,
  year int NOT NULL,
  month int NOT NULL,  -- 1-12
  acknowledged_at timestamptz NOT NULL DEFAULT now(),
  admin_notified_at timestamptz,
  UNIQUE(guide_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_receipt_ack_guide ON receipt_acknowledgements(guide_id);

SELECT 'receipt_acknowledgements created' AS status;
