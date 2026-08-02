/**
 * ה-HTML של סקיצת הדוח הדו-שבועי — גרסה 2 (אחרי חידודי עומר 2.8):
 * הכנסה לעסק במקום טיפים, ימים חזקים/חלשים, רווחיות פר סיור, דפי טיפים מול מטרות.
 * נשלח דרך /api/report/sketch. יוחלף בתבנית דינמית כשהדוח האמיתי ייבנה.
 */
export const REPORT_SKETCH_HTML = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; background:#f3f4f6;">
<div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif; background:#f3f4f6; padding:24px 12px; color:#1f2937;">

  <div style="max-width:640px; margin:0 auto 16px; background:#fffbeb; border:1px dashed #d97706; border-radius:10px; padding:12px 16px; font-size:13px; color:#92400e; text-align:right;">
    סקיצה מעודכנת לאישור (גרסה 2, אחרי החידודים שלך). כל המספרים אמיתיים מהמערכת.
    חלונות הזמן: השוואת שבועיים (19.7 עד 1.8 מול 5.7 עד 18.7) + מבט על יולי המלא לניתוחי ימים וסיורים.
  </div>

  <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e5e7eb;">

    <div style="background:#166534; color:#ffffff; padding:28px 28px 22px; text-align:right;">
      <div style="font-size:13px; letter-spacing:1px; opacity:0.85; margin-bottom:6px;">PORTUGO</div>
      <div style="font-size:22px; font-weight:700;">תמונת מצב דו-שבועית</div>
      <div style="font-size:14px; opacity:0.9; margin-top:4px;">19 ביולי עד 1 באוגוסט 2026 · בהשוואה לשבועיים שלפני</div>
    </div>

    <div style="padding:22px 28px; background:#f0fdf4; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:14px; font-weight:700;">השורה התחתונה</div>
      <div style="font-size:14.5px; line-height:1.7; padding:5px 0;">🟩 <strong>הכנסה לעסק: 10,088€ בשבועיים</strong>, עלייה של 9%. אבל היא מרוכזת בחמישי-שישי, ושבת-ראשון כמעט ריקים.</div>
      <div style="font-size:14.5px; line-height:1.7; padding:5px 0;">🟩 <strong>הקלאסי הוא מנוע הלידים, סיורי היום הם מנוע הרווח:</strong> משתתף קלאסי מכניס לעסק כ-8€, משתתף סינטרה כ-87€. ההמרה ביניהם היא המנוף הגדול ביותר.</div>
      <div style="font-size:14.5px; line-height:1.7; padding:5px 0;">🟩 <strong>18% מההזמנות הן של לקוח שעושה יותר מסיור אחד.</strong> דפי הטיפים עוד לא רתומים להגדיל את המספר הזה.</div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:14px; font-weight:700;">המספרים בקצרה</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate; border-spacing:5px;">
        <tr>
          <td width="25%" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 10px; text-align:right; vertical-align:top;">
            <div style="font-size:12px; color:#6b7280;">הכנסה לפורטוגו</div>
            <div style="font-size:20px; font-weight:700; color:#111827;">10,088€</div>
            <div style="font-size:12px; font-weight:600; color:#15803d;">▲ 9% (היו 9,252€)</div>
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
      <div style="font-size:11.5px; color:#9ca3af; margin-top:6px;">הכנסה לפורטוגו: בקלאסי = ההפרשה פחות הבסיס למדריך; בשאר הסיורים = מחיר ללקוח. לפני שכר מדריכים והוצאות (כרטיסים, אוכל).</div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:4px; font-weight:700;">איפה הכסף · מבט על יולי המלא</div>
      <div style="font-size:12.5px; color:#6b7280; margin-bottom:12px;">הכנסה לפורטוגו לפי סוג סיור, ממוין מהגבוה לנמוך</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px; border-collapse:collapse;">
        <tr style="color:#6b7280; font-size:12px;">
          <td style="padding:6px 0; border-bottom:1px solid #e5e7eb;">סיור</td>
          <td style="padding:6px 0; border-bottom:1px solid #e5e7eb; text-align:center;">סיורים</td>
          <td style="padding:6px 0; border-bottom:1px solid #e5e7eb; text-align:center;">משתתפים</td>
          <td style="padding:6px 0; border-bottom:1px solid #e5e7eb; text-align:center;">הכנסה</td>
          <td style="padding:6px 0; border-bottom:1px solid #e5e7eb; text-align:center;">למשתתף</td>
        </tr>
        <tr><td style="padding:7px 0; font-weight:600;">סינטרה</td><td style="text-align:center;">8</td><td style="text-align:center;">86</td><td style="text-align:center; font-weight:700;">7,480€</td><td style="text-align:center; color:#15803d; font-weight:700;">87€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">פרטיים (ליסבון + פורטו)</td><td style="text-align:center;">11</td><td style="text-align:center;">69</td><td style="text-align:center; font-weight:700;">4,419€</td><td style="text-align:center; color:#15803d; font-weight:700;">64€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">דורו</td><td style="text-align:center;">2</td><td style="text-align:center;">24</td><td style="text-align:center; font-weight:700;">2,464€</td><td style="text-align:center; color:#15803d; font-weight:700;">103€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">קלאסי ליסבון</td><td style="text-align:center;">34</td><td style="text-align:center;">259</td><td style="text-align:center; font-weight:700;">2,162€</td><td style="text-align:center; color:#b45309; font-weight:700;">8.3€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">קולינרי</td><td style="text-align:center;">8</td><td style="text-align:center;">35</td><td style="text-align:center; font-weight:700;">2,035€</td><td style="text-align:center; color:#15803d; font-weight:700;">58€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">קלאסי פורטו</td><td style="text-align:center;">23</td><td style="text-align:center;">138</td><td style="text-align:center; font-weight:700;">1,079€</td><td style="text-align:center; color:#b45309; font-weight:700;">7.8€</td></tr>
        <tr><td style="padding:7px 0; font-weight:600;">טעימות, אובידוש, בלם</td><td style="text-align:center;">6</td><td style="text-align:center;">23</td><td style="text-align:center; font-weight:700;">1,230€</td><td style="text-align:center;">53€</td></tr>
      </table>
      <div style="margin-top:10px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px; line-height:1.65;">
        <strong style="color:#166534;">מה זה אומר:</strong> 397 איש עברו בקלאסי ביולי, שמכניס לעסק כ-8€ לאיש. כל 10 מהם שממירים לסיור יום שווים כ-870€ נוספים. הקלאסי הוא ליד שכבר שילמנו עליו, ההמרה היא הרווח.
      </div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:4px; font-weight:700;">ימים חזקים וחלשים · יולי המלא</div>
      <div style="font-size:12.5px; color:#6b7280; margin-bottom:12px;">הכנסה לפורטוגו לפי יום בשבוע</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px; width:100%;">
        <tr><td style="width:60px; color:#4b5563; padding:3px 0;">שישי</td><td><div style="height:13px; width:100%; max-width:320px; border-radius:4px; background:#16a34a;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">7,420€ · 17 סיורים</td></tr>
        <tr><td style="color:#4b5563; padding:3px 0;">חמישי</td><td><div style="height:13px; width:61%; max-width:194px; border-radius:4px; background:#16a34a;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">4,500€ · 20 סיורים</td></tr>
        <tr><td style="color:#4b5563; padding:3px 0;">שלישי</td><td><div style="height:13px; width:39%; max-width:124px; border-radius:4px; background:#4ade80;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">2,870€ · 12 סיורים</td></tr>
        <tr><td style="color:#4b5563; padding:3px 0;">שני</td><td><div style="height:13px; width:36%; max-width:115px; border-radius:4px; background:#4ade80;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">2,664€ · 11 סיורים</td></tr>
        <tr><td style="color:#4b5563; padding:3px 0;">רביעי</td><td><div style="height:13px; width:31%; max-width:99px; border-radius:4px; background:#4ade80;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">2,297€ · 13 סיורים</td></tr>
        <tr><td style="color:#4b5563; padding:3px 0;">שבת</td><td><div style="height:13px; width:9%; max-width:30px; border-radius:4px; background:#fbbf24;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">700€ · 10 סיורים</td></tr>
        <tr><td style="color:#4b5563; padding:3px 0;">ראשון</td><td><div style="height:13px; width:6%; max-width:18px; border-radius:4px; background:#fbbf24;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">418€ · 9 סיורים</td></tr>
      </table>
      <div style="margin-top:10px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px; line-height:1.65;">
        <strong style="color:#166534;">מה זה אומר:</strong> חמישי-שישי מייצרים 57% מההכנסה החודשית. בשבת-ראשון רצים בעיקר סיורי קלאסי, כלומר יש בהם 101 משתתפים אבל כמעט בלי הכנסה לעסק. יש כאן יומיים שלמים שמחכים לסיור יום או לדחיפת פרטיים.
      </div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:14px; font-weight:700;">שלוש תובנות להחלטה</div>

      <div style="border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px; margin-bottom:12px;">
        <span style="display:inline-block; font-size:11px; font-weight:700; padding:2px 10px; border-radius:99px; background:#eff6ff; color:#1d4ed8;">המנוף הגדול</span>
        <div style="font-size:14.5px; font-weight:700; margin:8px 0 6px;">המרה מקלאסי לסיורי יום</div>
        <div style="font-size:13.5px; line-height:1.65; color:#4b5563;">18% מההזמנות כבר מגיעות מלקוח שעושה יותר מסיור אחד (54 משתתפים בשבועיים). זה קורה כמעט לבד. הקהל הנוכחי משפחתי במיוחד (64% מהמשתתפים), וסינטרה היא בדיוק המוצר למשפחות.</div>
        <div style="margin-top:8px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px;"><strong style="color:#166534;">לשקול:</strong> תסריט קבוע לכל מדריך בסוף קלאסי (חצי דקה על סינטרה + הטבת החבילה) ובלוק "ממשיכים איתנו" בדפי הטיפים. שתי משפחות מומרות בשבועיים = כ-1,000€ בחודש.</div>
      </div>

      <div style="border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px; margin-bottom:12px;">
        <span style="display:inline-block; font-size:11px; font-weight:700; padding:2px 10px; border-radius:99px; background:#fef2f2; color:#b91c1c;">לתשומת לב</span>
        <div style="font-size:14.5px; font-weight:700; margin:8px 0 6px;">סוף השבוע כמעט לא מייצר הכנסה</div>
        <div style="font-size:13.5px; line-height:1.65; color:#4b5563;">שבת וראשון יחד: 1,118€ בלבד בכל יולי, לעומת 7,420€ ביום שישי אחד. המדריכים עובדים (19 סיורים, 101 משתתפים), אבל כמעט הכל קלאסי.</div>
        <div style="margin-top:8px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px;"><strong style="color:#166534;">לשקול:</strong> לקבע סיור יום אחד בסופ"ש (סינטרה של יום ראשון?) ולבדוק בדוח הבא אם הוא מתמלא. גם חצי תפוסה משנה את התמונה של היומיים האלה.</div>
      </div>

      <div style="border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px;">
        <span style="display:inline-block; font-size:11px; font-weight:700; padding:2px 10px; border-radius:99px; background:#f0fdf4; color:#15803d;">עובד טוב</span>
        <div style="font-size:14.5px; font-weight:700; margin:8px 0 6px;">גוגל מביא 44% מהמשתתפים, והבינה המלאכותית התחילה להביא גם</div>
        <div style="font-size:13.5px; line-height:1.65; color:#4b5563;">גוגל נשאר מקור מספר 1 בפער גדול (134 משתתפים בשבועיים), והמלצות מחברים מוסיפות עוד 11%. בתקופה הקודמת נרשמו לראשונה משתתפים שהגיעו דרך בינה מלאכותית.</div>
        <div style="margin-top:8px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px;"><strong style="color:#166534;">לשקול:</strong> זה מחזק את ההצדקה לפרויקט SEO/GEO של האתר. נעקוב אחרי מקור הבינה המלאכותית בכל דוח.</div>
      </div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:4px; font-weight:700;">דפי הטיפים · מול שתי המטרות שלהם</div>
      <div style="font-size:12.5px; color:#6b7280; margin-bottom:12px;">227 מבקרים בשבוע הראשון (ליסבון 152, פורטו 75) · זמן ממוצע בדף: 3 עד 4 דקות</div>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate; border-spacing:5px;">
        <tr>
          <td width="50%" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 14px; font-size:13px; line-height:1.7; text-align:right; vertical-align:top;">
            <div style="font-weight:700; font-size:14px; margin-bottom:4px;">מטרה 1: הרשמה לסיור נוסף</div>
            אין עדיין בלוק "הסיור הבא שלכם" בדף,
            אז אי אפשר למדוד המרה.<br>
            <span style="color:#b45309; font-weight:600;">זה החור המרכזי בדף כרגע.</span>
          </td>
          <td width="50%" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 14px; font-size:13px; line-height:1.7; text-align:right; vertical-align:top;">
            <div style="font-weight:700; font-size:14px; margin-bottom:4px;">מטרה 2: פידבקים</div>
            11 לחיצות על ביקורת/פידבק<br>
            (5 ביקורת גוגל, 6 "ספרו איך היה")<br>
            <span style="color:#b45309; font-weight:600;">כ-5% מהמבקרים. יש לאן לצמוח.</span>
          </td>
        </tr>
      </table>

      <div style="margin-top:10px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px; line-height:1.65;">
        <strong style="color:#166534;">לשקול:</strong> (1) בלוק "ממשיכים איתנו" בראש הדף עם סינטרה, קולינרי ודורו + הטבת חבילה, ומדידת לחיצות. זה יהפוך ל-KPI הראשי של הדף בדוח.
        (2) העלאת כפתור הביקורת בגוגל למעלה + הודעת וואטסאפ קבועה מהמדריך בערב הסיור עם קישור ישיר.
        אגב, הדף כבר מוכיח ערך: מסעדות הן העניין הגדול (28 לחיצות), וזה נכס לשיתופי פעולה.
      </div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:14px; font-weight:700;">בריאות הצוות (לא משפיע ישירות על רווחיות העסק)</div>
      <div style="font-size:13.5px; line-height:1.7; color:#4b5563;">
        הטיפ הממוצע לאיש בקלאסי ירד מ-21.1€ ל-19.9€, כנראה בגלל תמהיל משפחתי. הפער בין המדריכים נשאר גדול: 15 עד 24.5€ לאיש.
        זה כסף של המדריכים ולא של העסק, אבל הוא חשוב לשימור ולמוטיבציה, ופער עקבי מרמז על שיטות שאפשר ללמד.
        פירוט מלא פר מדריך יופיע בנספח קבוע בסוף הדוח.
      </div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:14px; font-weight:700;">על שולחנך</div>
      <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:14px 16px; font-size:14px; line-height:1.7;">
        החלטה אחת לשבועיים הקרובים: להרים את בלוק "ממשיכים איתנו" בדפי הטיפים ולתת למדריכים תסריט המרה קצר לסוף הקלאסי?
        זו הדרך הזולה ביותר להזיז את שני המספרים החשובים: אחוז הלקוחות בכמה סיורים (18%) וההכנסה למשתתף קלאסי (8€).
      </div>
    </div>

    <div style="padding:16px 28px; font-size:11.5px; color:#9ca3af; text-align:center; line-height:1.6;">
      נוצר אוטומטית ממערכת פורטוגו · מקורות: נתוני הזמנות וסיורים + אנליטיקת דפי הטיפים<br>
      הדוח הבא: יום שני, 17 באוגוסט 2026
    </div>

  </div>
</div>
</body>
</html>
`;
