-- מטרות חיזוק מעטפות לסוף חודש — פר מדריך
-- ברירת מחדל: עודף 100€, הוצאות 150€
-- חריגים: דותן/מאיה/מני/עומר הבן → הוצאות 100€ (לא משתמשים הרבה)
-- ניר: 0/0 → לא נדרש חיזוק כרגע

ALTER TABLE guides ADD COLUMN IF NOT EXISTS target_change_balance numeric DEFAULT 100;
ALTER TABLE guides ADD COLUMN IF NOT EXISTS target_expenses_balance numeric DEFAULT 150;

UPDATE guides SET target_expenses_balance = 100
WHERE name IN ('דותן', 'מאיה', 'מני', 'עומר הבן');

UPDATE guides SET target_change_balance = 0, target_expenses_balance = 0
WHERE name = 'ניר';

SELECT name, target_change_balance, target_expenses_balance
FROM guides
ORDER BY name;
