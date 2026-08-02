/**
 * ה-HTML של סקיצת הדוח הדו-שבועי — גרסה 5 (2.8):
 * עלויות רכב דורו לפי מחירון הספקים של רונה (ז'ורז' 280€ עד 7, איבורבס 475€
 * ל-8-19). דורו: 656€ נטו (27€/איש). סה"כ יולי: 21,569 → 10,707 (50%).
 * נשלח דרך /api/report/sketch. יוחלף בתבנית דינמית כשהדוח האמיתי ייבנה.
 */
export const REPORT_SKETCH_HTML = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; background:#f3f4f6;">
<div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif; background:#f3f4f6; padding:24px 12px; color:#1f2937;">

  <div style="max-width:640px; margin:0 auto 16px; background:#fffbeb; border:1px dashed #d97706; border-radius:10px; padding:12px 16px; font-size:13px; color:#92400e; text-align:right;">
    סקיצה לאישור, גרסה 5. עודכן: עלויות רכב דורו לפי מחירון הספקים של רונה (ז'ורז' עד 7, איבורבס 475€ ל-8 עד 19),
    כל מספרי הרווח חושבו מחדש בהתאם. כל המספרים אמיתיים מהמערכת וממודל התמחור.
  </div>

  <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e5e7eb;">

    <div style="background:#166534; color:#ffffff; padding:28px 28px 22px; text-align:right;">
      <div style="font-size:13px; letter-spacing:1px; opacity:0.85; margin-bottom:6px;">PORTUGO</div>
      <div style="font-size:22px; font-weight:700;">תמונת מצב דו-שבועית</div>
      <div style="font-size:14px; opacity:0.9; margin-top:4px;">19 ביולי עד 1 באוגוסט 2026 · בהשוואה לשבועיים שלפני</div>
    </div>

    <div style="padding:22px 28px; background:#f0fdf4; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:14px; font-weight:700;">השורה התחתונה</div>
      <div style="font-size:14.5px; line-height:1.7; padding:5px 0;">🟩 <strong>יותר אנשים, פחות רווח:</strong> 307 משתתפים (עלייה של 26%) אבל הרווח הגולמי המוערך ירד ב-8% ל-4,736€. התמהיל קובע, לא הכמות.</div>
      <div style="font-size:14.5px; line-height:1.7; padding:5px 0;">🟩 <strong>הפרטיים הם המוצר הרווחי ביותר</strong> (כ-53€ לאיש ביולי), ומקום פנוי בסיור יום קיים הוא כמעט רווח נקי: כל משתתף נוסף בסינטרה שכבר יוצאת שווה כ-75€.</div>
      <div style="font-size:14.5px; line-height:1.7; padding:5px 0;">🟩 <strong>אובידוש עם 5 משתתפים הפסיד 63€.</strong> לסיורי רכב יש נקודת איזון של כ-6 משתתפים, ושווה להפוך את זה למדיניות.</div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:14px; font-weight:700;">המספרים בקצרה</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate; border-spacing:5px;">
        <tr>
          <td width="25%" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 10px; text-align:right; vertical-align:top;">
            <div style="font-size:12px; color:#6b7280;">רווח גולמי מוערך</div>
            <div style="font-size:20px; font-weight:700; color:#111827;">4,736€</div>
            <div style="font-size:12px; font-weight:600; color:#b91c1c;">▼ 8% (היו 5,147€)</div>
          </td>
          <td width="25%" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 10px; text-align:right; vertical-align:top;">
            <div style="font-size:12px; color:#6b7280;">משתתפים</div>
            <div style="font-size:20px; font-weight:700; color:#111827;">307</div>
            <div style="font-size:12px; font-weight:600; color:#15803d;">▲ 26% (היו 243)</div>
          </td>
          <td width="25%" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 10px; text-align:right; vertical-align:top;">
            <div style="font-size:12px; color:#6b7280;">סיורים</div>
            <div style="font-size:20px; font-weight:700; color:#111827;">44</div>
            <div style="font-size:12px; font-weight:600; color:#15803d;">▲ 7% (היו 41)</div>
          </td>
          <td width="25%" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 10px; text-align:right; vertical-align:top;">
            <div style="font-size:12px; color:#6b7280;">לקוח בכמה סיורים</div>
            <div style="font-size:20px; font-weight:700; color:#111827;">18%</div>
            <div style="font-size:12px; font-weight:600; color:#6b7280;">מההזמנות (יציב)</div>
          </td>
        </tr>
      </table>
      <div style="font-size:11.5px; color:#9ca3af; margin-top:6px;">רווח גולמי מוערך = הכנסות פחות רכב (מחירוני פרדאוטו/מורטה לפי גודל קבוצה), כרטיסים ואטרקציות, אוכל, שכר מדריך ואשל. לפני תקורה קבועה (כ-3,400€ לחודש) ולפני עלויות שכר בפרטיים המחושבות כאן בהערכה גסה.</div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:4px; font-weight:700;">איפה הרווח · מבט על יולי המלא</div>
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
        <tr><td style="padding:7px 0; font-weight:600;">פרטיים ליסבון</td><td style="text-align:center;">9</td><td style="text-align:center;">61</td><td style="text-align:center;">4,079€</td><td style="text-align:center; color:#9ca3af;">855€</td><td style="text-align:center; font-weight:700;">3,224€</td><td style="text-align:center; color:#15803d; font-weight:700;">53€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">קלאסי ליסבון</td><td style="text-align:center;">34</td><td style="text-align:center;">259</td><td style="text-align:center;">2,587€</td><td style="text-align:center; color:#9ca3af;">425€</td><td style="text-align:center; font-weight:700;">2,162€</td><td style="text-align:center; color:#b45309; font-weight:700;">8.3€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">סינטרה</td><td style="text-align:center;">8</td><td style="text-align:center;">86</td><td style="text-align:center;">7,480€</td><td style="text-align:center; color:#9ca3af;">5,326€</td><td style="text-align:center; font-weight:700;">2,154€</td><td style="text-align:center; color:#15803d; font-weight:700;">25€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">קלאסי פורטו</td><td style="text-align:center;">23</td><td style="text-align:center;">138</td><td style="text-align:center;">1,354€</td><td style="text-align:center; color:#9ca3af;">275€</td><td style="text-align:center; font-weight:700;">1,079€</td><td style="text-align:center; color:#b45309; font-weight:700;">7.8€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">קולינרי</td><td style="text-align:center;">8</td><td style="text-align:center;">35</td><td style="text-align:center;">2,035€</td><td style="text-align:center; color:#9ca3af;">996€</td><td style="text-align:center; font-weight:700;">1,039€</td><td style="text-align:center; color:#15803d; font-weight:700;">30€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">דורו</td><td style="text-align:center;">2</td><td style="text-align:center;">24</td><td style="text-align:center;">2,464€</td><td style="text-align:center; color:#9ca3af;">1,808€</td><td style="text-align:center; font-weight:700;">656€</td><td style="text-align:center; color:#15803d; font-weight:700;">27€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">טעימות</td><td style="text-align:center;">2</td><td style="text-align:center;">10</td><td style="text-align:center;">590€</td><td style="text-align:center; color:#9ca3af;">321€</td><td style="text-align:center; font-weight:700;">269€</td><td style="text-align:center; color:#15803d; font-weight:700;">27€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">פרטיים פורטו</td><td style="text-align:center;">2</td><td style="text-align:center;">8</td><td style="text-align:center;">340€</td><td style="text-align:center; color:#9ca3af;">190€</td><td style="text-align:center; font-weight:700;">150€</td><td style="text-align:center;">19€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">בלם</td><td style="text-align:center;">3</td><td style="text-align:center;">8</td><td style="text-align:center;">140€</td><td style="text-align:center; color:#9ca3af;">104€</td><td style="text-align:center; font-weight:700;">36€</td><td style="text-align:center;">4.6€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600; color:#b91c1c;">אובידוש</td><td style="text-align:center;">1</td><td style="text-align:center;">5</td><td style="text-align:center;">500€</td><td style="text-align:center; color:#9ca3af;">563€</td><td style="text-align:center; font-weight:700; color:#b91c1c;">-63€</td><td style="text-align:center; color:#b91c1c; font-weight:700;">-13€</td></tr>
        <tr style="border-top:2px solid #e5e7eb;"><td style="padding:8px 0; font-weight:700;">סה"כ יולי</td><td style="text-align:center; font-weight:700;">92</td><td style="text-align:center; font-weight:700;">634</td><td style="text-align:center; font-weight:700;">21,569€</td><td style="text-align:center; color:#6b7280; font-weight:700;">10,862€</td><td style="text-align:center; font-weight:700; color:#166534;">10,707€</td><td style="text-align:center; color:#166534; font-weight:700;">50%</td></tr>
      </table>
      <div style="font-size:11.5px; color:#9ca3af; margin-top:6px;">הקלאסי נספר לפי חלק החברה בלבד (ההפרשה), לא כל הקופה. רכב דורו: ז'ורז' עד 7 משתתפים (280€), מיניבוס איבורבס ל-8 עד 19 (475€), לפי מחירון הספקים של רונה.</div>
      <div style="margin-top:10px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px; line-height:1.65;">
        <strong style="color:#166534;">מה זה אומר:</strong> הקלאסי מביא את ההמונים (397 איש) ברווח קטן לאיש, סיורי היום והפרטיים עושים את הכסף.
        והכי חשוב: ברכב ובמדריך כבר שילמנו — משתתף נוסף בסיור יום שיוצא ממילא משאיר כ-75€ רווח (בסינטרה: 95€ מחיר פחות 20€ כרטיס).
        זה הופך את ההמרה מקלאסי למקומות הפנויים בסיורי היום למנוף הרווח הזול ביותר שיש לנו.
      </div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:4px; font-weight:700;">ימים חזקים וחלשים · יולי המלא</div>
      <div style="font-size:12.5px; color:#6b7280; margin-bottom:12px;">רווח מוערך לפי יום בשבוע</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px; width:100%;">
        <tr><td style="width:60px; color:#4b5563; padding:3px 0;">שישי</td><td><div style="height:13px; width:100%; max-width:310px; border-radius:4px; background:#16a34a;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">3,080€ · 17 סיורים</td></tr>
        <tr><td style="color:#4b5563; padding:3px 0;">חמישי</td><td><div style="height:13px; width:93%; max-width:287px; border-radius:4px; background:#16a34a;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">2,850€ · 20 סיורים</td></tr>
        <tr><td style="color:#4b5563; padding:3px 0;">שני</td><td><div style="height:13px; width:54%; max-width:169px; border-radius:4px; background:#4ade80;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">1,678€ · 11 סיורים</td></tr>
        <tr><td style="color:#4b5563; padding:3px 0;">רביעי</td><td><div style="height:13px; width:38%; max-width:119px; border-radius:4px; background:#4ade80;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">1,184€ · 13 סיורים</td></tr>
        <tr><td style="color:#4b5563; padding:3px 0;">שלישי</td><td><div style="height:13px; width:38%; max-width:119px; border-radius:4px; background:#4ade80;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">1,183€ · 12 סיורים</td></tr>
        <tr><td style="color:#4b5563; padding:3px 0;">שבת</td><td><div style="height:13px; width:13%; max-width:41px; border-radius:4px; background:#fbbf24;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">410€ · 10 סיורים</td></tr>
        <tr><td style="color:#4b5563; padding:3px 0;">ראשון</td><td><div style="height:13px; width:10%; max-width:32px; border-radius:4px; background:#fbbf24;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">323€ · 9 סיורים</td></tr>
      </table>
      <div style="margin-top:10px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px; line-height:1.65;">
        <strong style="color:#166534;">מה זה אומר:</strong> חמישי ושישי מייצרים 55% מהרווח החודשי (5,930€ מתוך 10,707€). שבת וראשון יחד: 733€ בלבד,
        למרות 19 סיורים ו-101 משתתפים (כמעט הכל קלאסי). יש יומיים בשבוע שבהם הקהל קיים אבל אין לו מוצר רווחי להמשיך אליו.
      </div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:14px; font-weight:700;">שלוש תובנות להחלטה</div>

      <div style="border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px; margin-bottom:12px;">
        <span style="display:inline-block; font-size:11px; font-weight:700; padding:2px 10px; border-radius:99px; background:#eff6ff; color:#1d4ed8;">המנוף הגדול</span>
        <div style="font-size:14.5px; font-weight:700; margin:8px 0 6px;">למלא מקומות פנויים בסיורי היום מתוך קהל הקלאסי</div>
        <div style="font-size:13.5px; line-height:1.65; color:#4b5563;">18% מההזמנות כבר מגיעות מלקוח שעושה כמה סיורים, כמעט בלי מאמץ יזום. הקהל משפחתי (64%), סינטרה היא המוצר הטבעי שלו, וכל מומר משאיר כ-75€ רווח שולי.</div>
        <div style="margin-top:8px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px;"><strong style="color:#166534;">לשקול:</strong> תסריט קצר וקבוע לסוף כל קלאסי + בלוק "ממשיכים איתנו" בדפי הטיפים. שתי משפחות בשבועיים = כ-1,200€ רווח בחודש.</div>
      </div>

      <div style="border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px; margin-bottom:12px;">
        <span style="display:inline-block; font-size:11px; font-weight:700; padding:2px 10px; border-radius:99px; background:#fef2f2; color:#b91c1c;">לתשומת לב</span>
        <div style="font-size:14.5px; font-weight:700; margin:8px 0 6px;">לסיורי רכב יש רצפה כלכלית: כ-6 משתתפים</div>
        <div style="font-size:13.5px; line-height:1.65; color:#4b5563;">הרכב והמדריך עולים כ-400 עד 470€ עוד לפני שעלה משתתף אחד. אובידוש של 5 משתתפים יצא בהפסד של 63€. מתחת ל-6 משתתפים, סיור יום עם רכב מפסיד או מגרד אפס. לפעמים זה קורה בגלל ביטולי רגע אחרון, לא בגלל תכנון. ובדורו יש גם מדרגה בקצה השני: המשתתף השמיני מקפיץ את הרכב מ-280€ ל-475€, אז דווקא 7 משתתפים הם נקודה מתוקה.</div>
        <div style="margin-top:8px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px;"><strong style="color:#166534;">לשקול:</strong> הדוח יעקוב כמה סיורי רכב ירדו מתחת לרצפה וכמה זה עלה בכל חודש. כשיצטברו נתונים, זה הבסיס להחלטה על מדיניות ביטולים (למשל דמי ביטול ב-24 השעות האחרונות) או איחוד תאריכים.</div>
      </div>

      <div style="border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px;">
        <span style="display:inline-block; font-size:11px; font-weight:700; padding:2px 10px; border-radius:99px; background:#fef2f2; color:#b91c1c;">לתשומת לב</span>
        <div style="font-size:14.5px; font-weight:700; margin:8px 0 6px;">סוף השבוע כמעט לא מייצר רווח</div>
        <div style="font-size:13.5px; line-height:1.65; color:#4b5563;">שבת וראשון: 733€ רווח בכל יולי, פחות ממה שמייצר יום שישי אחד ממוצע. המדריכים עובדים והקהל קיים, אבל אין מוצר רווחי ביומיים האלה.</div>
        <div style="margin-top:8px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px;"><strong style="color:#166534;">לשקול:</strong> לקבע סיור יום אחד בסופ"ש (סינטרה של ראשון?) ולעקוב בדוח הבא אם עבר את רצפת ה-6.</div>
      </div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:4px; font-weight:700;">דפי הטיפים · שבוע ראשון באוויר</div>
      <div style="font-size:12.5px; color:#6b7280; margin-bottom:12px;">227 מבקרים: ליסבון 152, פורטו 75</div>

      <div style="font-size:14px; font-weight:700; margin-bottom:6px;">מעורבות: הדף מחזיק אנשים</div>
      <div style="font-size:13.5px; line-height:1.65; color:#4b5563; margin-bottom:12px;">
        זמן ממוצע בדף: ליסבון 2:54 דקות, פורטו 4:12 דקות. 36% עד 43% מהמבקרים גוללים לעומק וקוראים באמת.
        אלה מספרים גבוהים מאוד לדף המלצות, והם אומרים שהקהל סומך על ההמלצות שלנו.
      </div>

      <div style="font-size:14px; font-weight:700; margin-bottom:6px;">מה מעניין אותם</div>
      <div style="font-size:13.5px; line-height:1.65; color:#4b5563; margin-bottom:12px;">
        מסעדות במקום הראשון בפער גדול: 28 לחיצות בשתי הערים, ובראשן Os Cabaças בליסבון (14). אחריהן שופינג (11 לחיצות,
        בעיקר הבוטיקים בפרינסיפה ריאל ושוק הפשפשים), ואז נקודות תצפית ובתי קפה. בפורטו בולטות Tapabento ו-NorteShopping.
        המפה המלאה של פורטו נלחצה 5 פעמים.
      </div>

      <div style="font-size:14px; font-weight:700; margin-bottom:6px;">שתי מטרות הפעולה של הדף</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate; border-spacing:5px;">
        <tr>
          <td width="50%" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 14px; font-size:13px; line-height:1.7; text-align:right; vertical-align:top;">
            <div style="font-weight:700; font-size:14px; margin-bottom:4px;">הרשמה לסיור נוסף</div>
            8 לחיצות על סיורים (קולינרי 2, "לסיור הבא שלכם" 2, סינטרה, אראבידה, דורו ובלם 1 כל אחד).<br>
            <span style="color:#b45309; font-weight:600;">כ-3.5% מהמבקרים. הבלוק קיים אבל שקט מדי.</span>
          </td>
          <td width="50%" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 14px; font-size:13px; line-height:1.7; text-align:right; vertical-align:top;">
            <div style="font-weight:700; font-size:14px; margin-bottom:4px;">פידבקים וביקורות</div>
            11 לחיצות: 5 ביקורת גוגל, 6 "ספרו איך היה".<br>
            <span style="color:#b45309; font-weight:600;">כ-5% מהמבקרים. יש לאן לצמוח.</span>
          </td>
        </tr>
      </table>

      <div style="margin-top:10px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px; line-height:1.65;">
        <strong style="color:#166534;">לשקול:</strong> (1) להרים את בלוק הסיורים לראש הדף עם הטבת החבילה. הלחיצות כבר נמדדות והן יהיו KPI קבוע כאן; כדי לראות גם סגירות, נוסיף סימון למי שמגיע מהדף לאתר, ואפשרות "דף הטיפים" בשדה מקור ההגעה.
        (2) העלאת כפתור הביקורת בגוגל + הודעת וואטסאפ מהמדריך בערב הסיור עם קישור ישיר.
        (3) העניין העצום במסעדות הוא נכס: גם תוכן להרחיב, וגם בסיס לשיחת שיתוף פעולה עם 2, 3 מסעדות מובילות.
      </div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:14px; font-weight:700;">שיווק וצוות בקצרה</div>
      <div style="font-size:13.5px; line-height:1.7; color:#4b5563;">
        <strong>מקורות הגעה:</strong> גוגל מוביל עם 44% מהמשתתפים, המלצות מחברים 11%, ובתקופה הקודמת נרשמו לראשונה לקוחות שהגיעו דרך בינה מלאכותית. מחזק את פרויקט SEO/GEO.<br>
        <strong>בריאות הצוות:</strong> הטיפ הממוצע לאיש בקלאסי ירד ל-19.9€ (מ-21.1€), והפער בין מדריכים נשאר גדול (15 עד 24.5€ לאיש).
        זה כסף של המדריכים ולא של העסק, אבל חשוב לשימור ולמוטיבציה. פירוט פר מדריך בנספח קבוע.
      </div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:14px; font-weight:700;">על שולחנך</div>
      <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:14px 16px; font-size:14px; line-height:1.7;">
        החלטה אחת לשבועיים הקרובים: להרים את מנוע ההמרה? בלוק "ממשיכים איתנו" בדפי הטיפים + תסריט קצר למדריכים בסוף הקלאסי.
        זו הדרך הזולה ביותר להזיז את המספר החשוב ביותר בדוח הזה: רווח שולי של כ-75€ על כל משתתף קלאסי שממשיך לסיור יום שכבר יוצא.
      </div>
    </div>

    <div style="padding:16px 28px; font-size:11.5px; color:#9ca3af; text-align:center; line-height:1.6;">
      נוצר אוטומטית ממערכת פורטוגו · מקורות: הזמנות וסיורים, מודל התמחור, אנליטיקת דפי הטיפים<br>
      הדוח הבא: יום שני, 17 באוגוסט 2026
    </div>

  </div>
</div>
</body>
</html>
`;
