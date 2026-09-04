/**
 * ה-HTML של סקיצת הדוח הדו-שבועי — גרסה 6 (4.9.26):
 * דוגמה עדכנית על נתוני 21.8 עד 3.9 (מול 7.8 עד 20.8) + אוגוסט המלא מול יולי.
 * אותו מודל כמו גרסה 5: רווח = הכנסת החברה פחות רכב (פרדאוטו לפי גודל קבוצה,
 * דורו: ז'ורז' 280€ עד 7 / איבורבס 475€), כרטיסים (פנה 20, אובידוש 18, דורו 26,
 * יקב אראבידה 10.2), אוכל (קולינרי 19, טעימות 25), שכר מדריך ואשל.
 * קלאסי נספר לפי ההפרשה לחברה בלבד. פרטיים: שכר לפי טבלת קלאסי פרטי (הערכה).
 * נשלח דרך /api/report/sketch. יוחלף בתבנית דינמית כשהדוח האמיתי ייבנה.
 */
export const REPORT_SKETCH_HTML = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; background:#f3f4f6;">
<div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif; background:#f3f4f6; padding:24px 12px; color:#1f2937;">

  <div style="max-width:640px; margin:0 auto 16px; background:#fffbeb; border:1px dashed #d97706; border-radius:10px; padding:12px 16px; font-size:13px; color:#92400e; text-align:right;">
    דוגמה להתייחסות, גרסה 6 (4.9). נתונים אמיתיים מהמערכת: השבועיים 21.8 עד 3.9 מול השבועיים שלפני, ואוגוסט המלא מול יולי.
    אותו מודל עלויות כמו בגרסה 5.
  </div>

  <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e5e7eb;">

    <div style="background:#166534; color:#ffffff; padding:28px 28px 22px; text-align:right;">
      <div style="font-size:13px; letter-spacing:1px; opacity:0.85; margin-bottom:6px;">PORTUGO</div>
      <div style="font-size:22px; font-weight:700;">תמונת מצב דו-שבועית</div>
      <div style="font-size:14px; opacity:0.9; margin-top:4px;">21 באוגוסט עד 3 בספטמבר 2026 · בהשוואה לשבועיים שלפני</div>
    </div>

    <div style="padding:22px 28px; background:#f0fdf4; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:14px; font-weight:700;">השורה התחתונה</div>
      <div style="font-size:14.5px; line-height:1.7; padding:5px 0;">🟩 <strong>הקלאסי חזק, המוצרים הרווחיים נעלמו לשבועיים:</strong> הרווח המוערך ירד ב-36% ל-3,312€. הקלאסי בשתי הערים דווקא עלה ב-30%, אבל היו רק 2 פרטיים (במקום 7), אפס קולינרי (במקום 4), וסיורי היום יצאו חצי ריקים.</div>
      <div style="font-size:14.5px; line-height:1.7; padding:5px 0;">🟩 <strong>5 מתוך 6 סיורי היום יצאו עם 5 עד 6 משתתפים,</strong> בדיוק על רצפת ה-6 שזיהינו ביולי. שלוש הסינטרות של התקופה הפסידו יחד 48€.</div>
      <div style="font-size:14.5px; line-height:1.7; padding:5px 0;">🟩 <strong>דפי הטיפים תפסו תאוצה:</strong> 412 מבקרים (עלייה של 70%), זמן קריאה ממוצע של 5:41 דקות בליסבון, ופאדו התגלה כתחום העניין השני אחרי מסעדות.</div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:14px; font-weight:700;">המספרים בקצרה</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate; border-spacing:5px;">
        <tr>
          <td width="25%" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 10px; text-align:right; vertical-align:top;">
            <div style="font-size:12px; color:#6b7280;">רווח גולמי מוערך</div>
            <div style="font-size:20px; font-weight:700; color:#111827;">3,312€</div>
            <div style="font-size:12px; font-weight:600; color:#b91c1c;">▼ 36% (היו 5,161€)</div>
          </td>
          <td width="25%" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 10px; text-align:right; vertical-align:top;">
            <div style="font-size:12px; color:#6b7280;">משתתפים</div>
            <div style="font-size:20px; font-weight:700; color:#111827;">283</div>
            <div style="font-size:12px; font-weight:600; color:#b91c1c;">▼ 6% (היו 300)</div>
          </td>
          <td width="25%" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 10px; text-align:right; vertical-align:top;">
            <div style="font-size:12px; color:#6b7280;">סיורים</div>
            <div style="font-size:20px; font-weight:700; color:#111827;">37</div>
            <div style="font-size:12px; font-weight:600; color:#b91c1c;">▼ 14% (היו 43)</div>
          </td>
          <td width="25%" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 10px; text-align:right; vertical-align:top;">
            <div style="font-size:12px; color:#6b7280;">לקוח בכמה סיורים</div>
            <div style="font-size:20px; font-weight:700; color:#111827;">22%</div>
            <div style="font-size:12px; font-weight:600; color:#6b7280;">מהמשתתפים (היו 25%)</div>
          </td>
        </tr>
      </table>
      <div style="font-size:11.5px; color:#9ca3af; margin-top:6px;">רווח גולמי מוערך = הכנסות פחות רכב (מחירוני פרדאוטו לפי גודל קבוצה, דורו לפי ז'ורז' ואיבורבס), כרטיסים ואטרקציות, אוכל, שכר מדריך ואשל. לפני תקורה קבועה (כ-3,400€ לחודש) ולפני עלויות שכר בפרטיים המחושבות כאן בהערכה גסה.</div>
      <div style="margin-top:10px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px; line-height:1.65;">
        <strong style="color:#166534;">מאיפה הירידה:</strong> פרטיים 1,165€ (היו 2,053€), סיורי יום 289€ (היו 1,228€), קולינרי 0€ (היו 506€).
        לעומתם הקלאסי בליסבון ובפורטו הביא 1,714€ (היו 1,322€). כלומר לא חסר קהל, חסר המשך: 213 איש בקלאסי, 39 בסיורי יום.
      </div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:4px; font-weight:700;">איפה הרווח · מבט על אוגוסט המלא</div>
      <div style="font-size:12.5px; color:#6b7280; margin-bottom:12px;">רווח מוערך לפי סוג סיור, אחרי עלויות, ממוין מהגבוה לנמוך</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px; border-collapse:collapse;">
        <tr style="color:#6b7280; font-size:12px;">
          <td style="padding:6px 0; border-bottom:1px solid #e5e7eb;">סיור</td>
          <td style="padding:6px 0; border-bottom:1px solid #e5e7eb; text-align:center;">סיורים</td>
          <td style="padding:6px 0; border-bottom:1px solid #e5e7eb; text-align:center;">משתתפים</td>
          <td style="padding:6px 0; border-bottom:1px solid #e5e7eb; text-align:center;">הכנסה</td>
          <td style="padding:6px 0; border-bottom:1px solid #e5e7eb; text-align:center;">עלויות</td>
          <td style="padding:6px 0; border-bottom:1px solid #e5e7eb; text-align:center;">רווח</td>
          <td style="padding:6px 0; border-bottom:1px solid #e5e7eb; text-align:center;">לאיש</td>
        </tr>
        <tr><td style="padding:7px 0; font-weight:600;">פרטיים ליסבון</td><td style="text-align:center;">7</td><td style="text-align:center;">49</td><td style="text-align:center;">2,923€</td><td style="text-align:center; color:#9ca3af;">465€</td><td style="text-align:center; font-weight:700;">2,458€</td><td style="text-align:center; color:#15803d; font-weight:700;">50€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">קלאסי ליסבון</td><td style="text-align:center;">32</td><td style="text-align:center;">242</td><td style="text-align:center;">2,366€</td><td style="text-align:center; color:#9ca3af;">485€</td><td style="text-align:center; font-weight:700;">1,881€</td><td style="text-align:center; color:#b45309; font-weight:700;">7.8€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">קלאסי פורטו</td><td style="text-align:center;">26</td><td style="text-align:center;">192</td><td style="text-align:center;">1,750€</td><td style="text-align:center; color:#9ca3af;">335€</td><td style="text-align:center; font-weight:700;">1,415€</td><td style="text-align:center; color:#b45309; font-weight:700;">7.4€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">דורו</td><td style="text-align:center;">3</td><td style="text-align:center;">34</td><td style="text-align:center;">3,465€</td><td style="text-align:center; color:#9ca3af;">2,447€</td><td style="text-align:center; font-weight:700;">1,018€</td><td style="text-align:center; color:#15803d; font-weight:700;">30€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">קולינרי</td><td style="text-align:center;">6</td><td style="text-align:center;">25</td><td style="text-align:center;">1,655€</td><td style="text-align:center; color:#9ca3af;">720€</td><td style="text-align:center; font-weight:700;">935€</td><td style="text-align:center; color:#15803d; font-weight:700;">37€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">פרטיים פורטו</td><td style="text-align:center;">3</td><td style="text-align:center;">22</td><td style="text-align:center;">758€</td><td style="text-align:center; color:#9ca3af;">200€</td><td style="text-align:center; font-weight:700;">558€</td><td style="text-align:center; color:#15803d; font-weight:700;">25€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">סינטרה</td><td style="text-align:center;">7</td><td style="text-align:center;">52</td><td style="text-align:center;">4,720€</td><td style="text-align:center; color:#9ca3af;">4,166€</td><td style="text-align:center; font-weight:700;">554€</td><td style="text-align:center; color:#b45309; font-weight:700;">11€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">טעימות</td><td style="text-align:center;">4</td><td style="text-align:center;">8</td><td style="text-align:center;">500€</td><td style="text-align:center; color:#9ca3af;">350€</td><td style="text-align:center; font-weight:700;">150€</td><td style="text-align:center;">19€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">בלם</td><td style="text-align:center;">4</td><td style="text-align:center;">17</td><td style="text-align:center;">285€</td><td style="text-align:center; color:#9ca3af;">158€</td><td style="text-align:center; font-weight:700;">127€</td><td style="text-align:center;">7.5€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600; color:#b91c1c;">אראבידה</td><td style="text-align:center;">1</td><td style="text-align:center;">5</td><td style="text-align:center;">435€</td><td style="text-align:center; color:#9ca3af;">472€</td><td style="text-align:center; font-weight:700; color:#b91c1c;">-37€</td><td style="text-align:center; color:#b91c1c; font-weight:700;">-7€</td></tr>
        <tr style="border-top:2px solid #e5e7eb;"><td style="padding:8px 0; font-weight:700;">סה"כ אוגוסט</td><td style="text-align:center; font-weight:700;">93</td><td style="text-align:center; font-weight:700;">646</td><td style="text-align:center; font-weight:700;">18,857€</td><td style="text-align:center; color:#6b7280; font-weight:700;">9,798€</td><td style="text-align:center; font-weight:700; color:#166534;">9,062€</td><td style="text-align:center; color:#166534; font-weight:700;">48%</td></tr>
      </table>
      <div style="font-size:11.5px; color:#9ca3af; margin-top:6px;">הקלאסי נספר לפי חלק החברה בלבד (ההפרשה), לא כל הקופה. יולי לפי אותו מודל: 92 סיורים, 624 משתתפים, כ-10,600€ רווח.</div>
      <div style="margin-top:10px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px; line-height:1.65;">
        <strong style="color:#166534;">מה זה אומר:</strong> אוגוסט הביא יותר אנשים מיולי (646 מול 624) ופחות רווח (9,062€ מול כ-10,600€, ירידה של 14%).
        הסיבה בשורה אחת: סינטרה. ביולי 8 סינטרות עם 86 איש (כ-11 בסיור) הרוויחו 2,030€; באוגוסט 7 סינטרות עם 52 איש (כ-7 בסיור) הרוויחו 554€.
        אותו רכב, אותו מדריך, חצי מהאנשים. בצד החיובי: קלאסי פורטו צמח ב-43% במשתתפים (192 מול 134).
      </div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:4px; font-weight:700;">ימים חזקים וחלשים · אוגוסט המלא</div>
      <div style="font-size:12.5px; color:#6b7280; margin-bottom:12px;">רווח מוערך לפי יום בשבוע</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px; width:100%;">
        <tr><td style="width:60px; color:#4b5563; padding:3px 0;">שישי</td><td><div style="height:13px; width:100%; max-width:310px; border-radius:4px; background:#16a34a;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">2,723€ · 14 סיורים</td></tr>
        <tr><td style="color:#4b5563; padding:3px 0;">שלישי</td><td><div style="height:13px; width:57%; max-width:177px; border-radius:4px; background:#4ade80;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">1,553€ · 17 סיורים</td></tr>
        <tr><td style="color:#4b5563; padding:3px 0;">רביעי</td><td><div style="height:13px; width:55%; max-width:169px; border-radius:4px; background:#4ade80;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">1,486€ · 11 סיורים</td></tr>
        <tr><td style="color:#4b5563; padding:3px 0;">שבת</td><td><div style="height:13px; width:45%; max-width:138px; border-radius:4px; background:#4ade80;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">1,214€ · 15 סיורים</td></tr>
        <tr><td style="color:#4b5563; padding:3px 0;">שני</td><td><div style="height:13px; width:31%; max-width:97px; border-radius:4px; background:#4ade80;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">853€ · 14 סיורים</td></tr>
        <tr><td style="color:#4b5563; padding:3px 0;">ראשון</td><td><div style="height:13px; width:25%; max-width:77px; border-radius:4px; background:#fbbf24;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">672€ · 9 סיורים</td></tr>
        <tr><td style="color:#4b5563; padding:3px 0;">חמישי</td><td><div style="height:13px; width:21%; max-width:64px; border-radius:4px; background:#fbbf24;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">560€ · 13 סיורים</td></tr>
      </table>
      <div style="margin-top:10px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px; line-height:1.65;">
        <strong style="color:#166534;">מה זה אומר:</strong> שתי הפתעות מול יולי. סוף השבוע התעורר: שבת וראשון הביאו 1,886€ (21% מהרווח) לעומת 733€ ביולי, בזכות 15 סיורים בשבתות.
        ויום חמישי, שביולי היה מספר 2 עם 2,850€, צנח ל-560€: 13 סיורים, כמעט כולם קלאסי, בלי סיור יום אחד רווחי.
      </div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:14px; font-weight:700;">שלוש תובנות להחלטה</div>

      <div style="border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px; margin-bottom:12px;">
        <span style="display:inline-block; font-size:11px; font-weight:700; padding:2px 10px; border-radius:99px; background:#fef2f2; color:#b91c1c;">לתשומת לב</span>
        <div style="font-size:14.5px; font-weight:700; margin:8px 0 6px;">סיורי היום יוצאים על הרצפה: 5, 6, 6, 6, 6</div>
        <div style="font-size:13.5px; line-height:1.65; color:#4b5563;">ששת סיורי היום של השבועיים: סינטרה 5 (21.8), דורו 6 (26.8), סינטרה 6 (28.8), דורו 10 (28.8), סינטרה 6 (1.9), אראבידה 6 (3.9).
        חוץ מהדורו של 10, כולם על נקודת האיזון או מתחתיה. שלוש הסינטרות יחד: 17 משתתפים, הפסד של 48€. אילו היו יוצאות כשתי סינטרות של 8 ו-9, אותם 17 אנשים היו משאירים כ-250€ רווח, כי רכב אחד נחסך.</div>
        <div style="margin-top:8px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px;"><strong style="color:#166534;">לשקול:</strong> כלל איחוד: סיור יום שנמצא מתחת ל-6 משתתפים 48 שעות לפני היציאה מקבל הצעה לתאריך סמוך (עם הטבה קטנה למי שעובר). הדוח יעקוב כמה סיורים אוחדו וכמה נחסך.</div>
      </div>

      <div style="border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px; margin-bottom:12px;">
        <span style="display:inline-block; font-size:11px; font-weight:700; padding:2px 10px; border-radius:99px; background:#eff6ff; color:#1d4ed8;">המנוף הגדול</span>
        <div style="font-size:14.5px; font-weight:700; margin:8px 0 6px;">הקלאסי מלא, סיורי היום חצי ריקים: אותו קהל, פער של יומיים</div>
        <div style="font-size:13.5px; line-height:1.65; color:#4b5563;">213 איש עשו קלאסי בשבועיים האלה, 39 המשיכו לסיור יום. הקהל משפחתי (57%) ורובו מגיע מגוגל (46%), כלומר מתכנן מראש ולא מכיר אותנו לפני הסיור.
        המקומות הפנויים בסינטרה ובדורו הם הרווח הזול ביותר שיש: הרכב והמדריך כבר שולמו, וכל משתתף נוסף משאיר כ-75€.
        בדפי הטיפים 22 איש לחצו על סיור נוסף (5% מהמבקרים), עלייה מ-4%, אבל עדיין רחוק ממה שהמספרים מאפשרים.</div>
        <div style="margin-top:8px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px;"><strong style="color:#166534;">לשקול:</strong> להצמיד את ההמלצה על סיור היום לסוף הקלאסי עם "היום נשארו 4 מקומות לסינטרה של מחרתיים", לא הצעה כללית. שני זוגות בשבוע שעוברים כך = כ-1,200€ רווח בחודש, וגם הסיורים על הרצפה נדחפים מעליה.</div>
      </div>

      <div style="border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px;">
        <span style="display:inline-block; font-size:11px; font-weight:700; padding:2px 10px; border-radius:99px; background:#f0fdf4; color:#15803d;">הזדמנות</span>
        <div style="font-size:14.5px; font-weight:700; margin:8px 0 6px;">פורטו צומחת בקלאסי, ואין לה מוצר המשך</div>
        <div style="font-size:13.5px; line-height:1.65; color:#4b5563;">קלאסי פורטו: 192 משתתפים באוגוסט, 43% יותר מיולי, ב-26 סיורים. אבל ההמשך דל: טעימות יצאו 4 פעמים עם 8 איש בסך הכל (שניים בסיור, כ-35€ רווח לסיור), והדורו יצא 3 פעמים (18, 6 ו-10 משתתפים).
        בליסבון על כל 4 אנשי קלאסי יש אחד בסיור יום; בפורטו על כל 6, וכולם בדורו. הקהל של פורטו קיים וגדל, המוצר השני חסר לו.</div>
        <div style="margin-top:8px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px;"><strong style="color:#166534;">לשקול:</strong> מינימום 4 משתתפים לטעימות (מתחת לזה: להציע העברה לתאריך אחר), ולבדוק שהדורו מוצע בסוף כל קלאסי פורטו כמו סינטרה בליסבון.</div>
      </div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:4px; font-weight:700;">דפי הטיפים · חודש באוויר</div>
      <div style="font-size:12.5px; color:#6b7280; margin-bottom:12px;">412 מבקרים בשבועיים (ליסבון 271, פורטו 141), עלייה של 70% מהשבועיים שלפני</div>

      <div style="font-size:14px; font-weight:700; margin-bottom:6px;">מעורבות: הדף מחזיק אנשים, ואפילו יותר</div>
      <div style="font-size:13.5px; line-height:1.65; color:#4b5563; margin-bottom:12px;">
        זמן ממוצע בדף: ליסבון 5:41 דקות (היו 3:38), פורטו 3:39 דקות (היו 2:27). 45% מהמבקרים גוללים לעומק וקוראים באמת.
        כמעט כולם בנייד, כמעט כולם מגיעים ישירות מהברקוד או מהקישור בוואטסאפ.
      </div>

      <div style="font-size:14px; font-weight:700; margin-bottom:6px;">מה מעניין אותם</div>
      <div style="font-size:13.5px; line-height:1.65; color:#4b5563; margin-bottom:12px;">
        מסעדות במקום הראשון בפער: 72 לחיצות על הקטגוריה בשתי הערים. המקום הבודד הכי נלחץ בליסבון הוא דווקא Fado in Chiado (20 לחיצות), וקטגוריית מופעי הפאדו נלחצה 17 פעמים: פאדו הוא תחום העניין השני, לפני שופינג ותצפיות.
        אחריהם Churrasqueira do Marquês (15), A Marisqueira do Lis (14), תצפית Senhora do Monte (13) ו-Ramiro (12). בפורטו מובילות המסעדות (27) והמפה המלאה (10).
      </div>

      <div style="font-size:14px; font-weight:700; margin-bottom:6px;">שתי מטרות הפעולה של הדף</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate; border-spacing:5px;">
        <tr>
          <td width="50%" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 14px; font-size:13px; line-height:1.7; text-align:right; vertical-align:top;">
            <div style="font-weight:700; font-size:14px; margin-bottom:4px;">הרשמה לסיור נוסף</div>
            22 לחיצות על סיורים (ליסבון 16, פורטו 6), לעומת 10 בשבועיים שלפני. מאז ההשקה מובילים בלם, דורו וסינטרה.<br>
            <span style="color:#b45309; font-weight:600;">כ-5% מהמבקרים (היו 4%). עולה לאט, הבלוק עדיין עמוק בדף.</span>
          </td>
          <td width="50%" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 14px; font-size:13px; line-height:1.7; text-align:right; vertical-align:top;">
            <div style="font-weight:700; font-size:14px; margin-bottom:4px;">פידבקים וביקורות</div>
            12 לחיצות ישירות על ביקורת (גוגל 10, פייסבוק 2) ועוד 21 על הסרגל התחתון "ספרו איך היה" ו"לסיור הבא שלכם".<br>
            <span style="color:#b45309; font-weight:600;">כ-3% מהמבקרים על כפתור הביקורת. הזמן בדף מוכיח אהדה, הכפתור לא ממיר אותה.</span>
          </td>
        </tr>
      </table>

      <div style="margin-top:10px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px; line-height:1.65;">
        <strong style="color:#166534;">לשקול:</strong> (1) פאדו: 37 לחיצות בשבועיים הן בסיס לשיחת שיתוף פעולה עם Fado in Chiado (קוד הנחה לאורחי פורטוגו תמורת עמלה או חשיפה), וגם סימן שסיור ערב עם פאדו הוא מוצר שהקהל כבר מחפש.
        (2) כפתור הביקורת לראש הדף, ליד ברכת "היה כיף אתכם", במקום בתחתית.
        (3) בלוק "הסיור הבא" עם תאריכים קרובים אמיתיים ומקומות פנויים, לא רשימת סיורים כללית.
      </div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:14px; font-weight:700;">שיווק וצוות בקצרה</div>
      <div style="font-size:13.5px; line-height:1.7; color:#4b5563;">
        <strong>מקורות הגעה:</strong> גוגל 46%, לקוח חוזר 22%, פייסבוק 12%, המלצה מחבר 9%, אינסטגרם 5%. חדש בתקופה הזו: 7 משתתפים ציינו "פודקאסט" כמקור, מקור שלא הופיע לפני כן ושווה לברר איזה.
        בינה מלאכותית: 5 משתתפים (8 בכל אוגוסט), עדיין קטן אבל קבוע.<br>
        <strong>בריאות הצוות:</strong> הטיפ הממוצע לאיש בקלאסי יציב: 18.8€ (היו 18.5€). הפער בין מדריכים נשאר גדול: אביב 23.4€ ונופר 22.2€ בראש, גיא 14.5€ (בשתי קבוצות גדולות של כ-20 איש, שם הטיפ לאיש תמיד נמוך יותר).
        זה כסף של המדריכים ולא של העסק, אבל חשוב לשימור ולמוטיבציה.
      </div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:14px; font-weight:700;">על שולחנך</div>
      <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:14px 16px; font-size:14px; line-height:1.7;">
        החלטה אחת לשבועיים הקרובים: כלל רצפת ה-6 לסיורי היום. מתחת ל-6 משתתפים 48 שעות לפני היציאה, מציעים תאריך סמוך.
        בשבועיים האלה זה היה שווה כ-300€ (שלוש סינטרות לשתיים), ובאוגוסט כולו ההפרש בין חודש של סינטרות של 7 לחודש של סינטרות של 11 היה כ-1,500€.
        זו ההחלטה עם היחס הכי טוב בין מאמץ לכסף שיש כרגע על השולחן.
      </div>
    </div>

    <div style="padding:16px 28px; font-size:11.5px; color:#9ca3af; text-align:center; line-height:1.6;">
      נוצר ממערכת פורטוגו · מקורות: הזמנות וסיורים, מודל התמחור, אנליטיקת דפי הטיפים<br>
      הדוח הבא: יום שישי, 18 בספטמבר 2026
    </div>

  </div>
</div>
</body>
</html>
`;
