/**
 * ה-HTML של סקיצת הדוח הדו-שבועי (נתוני 19.7-1.8.2026).
 * נשלח דרך /api/report/sketch. כשהדוח האמיתי ייבנה, הקובץ הזה יוחלף
 * בתבנית דינמית שמתמלאת מהנתונים.
 */
export const REPORT_SKETCH_HTML = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; background:#f3f4f6;">
<div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif; background:#f3f4f6; padding:24px 12px; color:#1f2937;">

  <div style="max-width:640px; margin:0 auto 16px; background:#fffbeb; border:1px dashed #d97706; border-radius:10px; padding:12px 16px; font-size:13px; color:#92400e; text-align:right;">
    זו סקיצה לאישור, לא הדוח עצמו. כל המספרים אמיתיים מהמערכת: 19.7 עד 1.8 מול 5.7 עד 18.7.
    אחרי שתאשרי את המבנה ואת דרך ההפעלה, מייל כזה יגיע אוטומטית כל שבועיים ביום שני בבוקר.
  </div>

  <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e5e7eb;">

    <div style="background:#166534; color:#ffffff; padding:28px 28px 22px; text-align:right;">
      <div style="font-size:13px; letter-spacing:1px; opacity:0.85; margin-bottom:6px;">PORTUGO</div>
      <div style="font-size:22px; font-weight:700;">תמונת מצב דו-שבועית</div>
      <div style="font-size:14px; opacity:0.9; margin-top:4px;">19 ביולי עד 1 באוגוסט 2026 · בהשוואה לשבועיים שלפני</div>
    </div>

    <div style="padding:22px 28px; background:#f0fdf4; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:14px; font-weight:700;">השורה התחתונה</div>
      <div style="font-size:14.5px; line-height:1.7; padding:5px 0;">🟩 <strong>שבועיים חזקים:</strong> 307 משתתפים, עלייה של 26%. אבל הטיפ הממוצע לאיש בקלאסי ירד מ-21.1€ ל-19.9€.</div>
      <div style="font-size:14.5px; line-height:1.7; padding:5px 0;">🟩 <strong>פער של 9€ לאיש</strong> בין המדריכים החזקים לחלשים בקלאסי. שווה מאות אירו בחודש.</div>
      <div style="font-size:14.5px; line-height:1.7; padding:5px 0;">🟩 <strong>מסעדות</strong> הן העניין מספר 1 בדפי הטיפים החדשים. יש כאן פתח לשיתופי פעולה.</div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:14px; font-weight:700;">המספרים בקצרה</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate; border-spacing:5px;">
        <tr>
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
            <div style="font-size:12px; color:#6b7280;">קופה בקלאסי</div>
            <div style="font-size:20px; font-weight:700; color:#111827;">3,838€</div>
            <div style="font-size:12px; font-weight:600; color:#15803d;">▲ 37% (היו 2,805€)</div>
          </td>
          <td width="25%" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 10px; text-align:right; vertical-align:top;">
            <div style="font-size:12px; color:#6b7280;">טיפ לאיש בקלאסי</div>
            <div style="font-size:20px; font-weight:700; color:#111827;">19.9€</div>
            <div style="font-size:12px; font-weight:600; color:#b91c1c;">▼ 6% (היה 21.1€)</div>
          </td>
        </tr>
      </table>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:14px; font-weight:700;">שלוש תובנות להחלטה</div>

      <div style="border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px; margin-bottom:12px;">
        <span style="display:inline-block; font-size:11px; font-weight:700; padding:2px 10px; border-radius:99px; background:#fef2f2; color:#b91c1c;">לתשומת לב</span>
        <div style="font-size:14.5px; font-weight:700; margin:8px 0 6px;">הטיפ לאיש יורד כשהקהל הופך משפחתי</div>
        <div style="font-size:13.5px; line-height:1.65; color:#4b5563;">64% מהמשתתפים בשבועיים האלה הגיעו במשפחות (לעומת 56% קודם). משפחות גדולות עם ילדים נותנות פחות טיפ לראש, ולכן הקופה גדלה אבל הממוצע לאיש יורד.</div>
        <div style="margin-top:8px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px;"><strong style="color:#166534;">לשקול:</strong> הצעת המשך ממוקדת משפחות בסוף הקלאסי (סינטרה, קולינרי) כדי להמיר את הקהל הזה להכנסה קבועה במקום טיפים.</div>
      </div>

      <div style="border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px; margin-bottom:12px;">
        <span style="display:inline-block; font-size:11px; font-weight:700; padding:2px 10px; border-radius:99px; background:#eff6ff; color:#1d4ed8;">הזדמנות</span>
        <div style="font-size:14.5px; font-weight:700; margin:8px 0 6px;">פער גדול בין מדריכים בטיפ לאיש</div>
        <table role="presentation" cellpadding="0" cellspacing="0" style="font-size:13px; width:100%;">
          <tr><td style="width:90px; color:#4b5563; padding:3px 0;">דותן</td><td><div style="height:13px; width:172px; max-width:100%; border-radius:4px; background:#16a34a;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">24.5€ (15 א׳)</td></tr>
          <tr><td style="color:#4b5563; padding:3px 0;">עומר הבן</td><td><div style="height:13px; width:170px; max-width:100%; border-radius:4px; background:#16a34a;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">24.3€ (14 א׳)</td></tr>
          <tr><td style="color:#4b5563; padding:3px 0;">אביב</td><td><div style="height:13px; width:162px; max-width:100%; border-radius:4px; background:#16a34a;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">23.1€ (48 א׳)</td></tr>
          <tr><td style="color:#4b5563; padding:3px 0;">תום</td><td><div style="height:13px; width:142px; max-width:100%; border-radius:4px; background:#16a34a;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">20.3€ (36 א׳)</td></tr>
          <tr><td style="color:#4b5563; padding:3px 0;">דניאל</td><td><div style="height:13px; width:127px; max-width:100%; border-radius:4px; background:#86efac;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">18.1€ (16 א׳)</td></tr>
          <tr><td style="color:#4b5563; padding:3px 0;">שקד</td><td><div style="height:13px; width:118px; max-width:100%; border-radius:4px; background:#86efac;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">16.9€ (18 א׳)</td></tr>
          <tr><td style="color:#4b5563; padding:3px 0;">נופר</td><td><div style="height:13px; width:107px; max-width:100%; border-radius:4px; background:#86efac;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">15.3€ (20 א׳)</td></tr>
          <tr><td style="color:#4b5563; padding:3px 0;">מני</td><td><div style="height:13px; width:105px; max-width:100%; border-radius:4px; background:#86efac;"></div></td><td style="color:#6b7280; font-size:12px; padding-right:8px; white-space:nowrap;">15.0€ (26 א׳)</td></tr>
        </table>
        <div style="font-size:13.5px; line-height:1.65; color:#4b5563; margin-top:8px;">הערה הוגנת: קבוצות גדולות מורידות ממוצע, ולמני היו קבוצות של 13 בממוצע. ועדיין, הפער עקבי גם בתקופה הקודמת.</div>
        <div style="margin-top:8px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px;"><strong style="color:#166534;">לשקול:</strong> שיחת שיטות קצרה בהובלת אביב או דותן במפגש הצוות הבא. סגירת חצי מהפער שווה בערך 400€ בחודש למדריכים.</div>
      </div>

      <div style="border:1px solid #e5e7eb; border-radius:10px; padding:14px 16px;">
        <span style="display:inline-block; font-size:11px; font-weight:700; padding:2px 10px; border-radius:99px; background:#f0fdf4; color:#15803d;">עובד טוב</span>
        <div style="font-size:14.5px; font-weight:700; margin:8px 0 6px;">לקוחות חוזרים בצמיחה: 36 ← 54 משתתפים</div>
        <div style="font-size:13.5px; line-height:1.65; color:#4b5563;">כמעט 1 מכל 5 משתתפים הגיע כלקוח חוזר. יחד עם המלצות מחברים (33) זה 28% מהפעילות שמגיעה בלי שקל שיווק. בנוסף: גוגל נשאר מקור מספר 1 עם 44% מהמשתתפים, ובתקופה הקודמת הופיעו לראשונה לקוחות שהגיעו דרך בינה מלאכותית.</div>
        <div style="margin-top:8px; font-size:13.5px; color:#111827; background:#f9fafb; border-radius:8px; padding:8px 12px;"><strong style="color:#166534;">לשקול:</strong> זה מחזק את ההחלטה לקדם את פרויקט SEO/GEO של האתר. הנתון של הבינה המלאכותית הוא סימן מוקדם ששווה לעקוב אחריו בכל דוח.</div>
      </div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:14px; font-weight:700;">דפי הטיפים (שבוע ראשון באוויר)</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate; border-spacing:5px;">
        <tr>
          <td width="50%" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 14px; font-size:13px; line-height:1.7; text-align:right; vertical-align:top;">
            <div style="font-weight:700; font-size:14px; margin-bottom:4px;">ליסבון</div>
            161 צפיות · 152 מבקרים<br>
            36% נשארו לקרוא לעומק<br>
            זמן ממוצע: 2:54 דקות
          </td>
          <td width="50%" style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:10px; padding:12px 14px; font-size:13px; line-height:1.7; text-align:right; vertical-align:top;">
            <div style="font-weight:700; font-size:14px; margin-bottom:4px;">פורטו</div>
            80 צפיות · 75 מבקרים<br>
            43% נשארו לקרוא לעומק<br>
            זמן ממוצע: 4:12 דקות
          </td>
        </tr>
      </table>
      <div style="font-size:13.5px; line-height:1.65; color:#4b5563; margin-top:8px;">
        מה הכי מעניין את האורחים: <strong>מסעדות</strong> (28 לחיצות בשתי הערים), ובראשן Os Cabaças בליסבון עם 14 לחיצות. אחר כך שופינג (11).
        5 אורחים לחצו על כפתור הביקורת בגוגל ישירות מהדף.
      </div>
    </div>

    <div style="padding:22px 28px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:14px; font-weight:700;">על שולחנך</div>
      <div style="background:#fffbeb; border:1px solid #fde68a; border-radius:10px; padding:14px 16px; font-size:14px; line-height:1.7;">
        שאלה אחת לשבועיים הקרובים: המסעדות מושכות הכי הרבה עניין בדפי הטיפים.
        האם לפנות ל-2, 3 מסעדות מומלצות (כמו Os Cabaças) להסדר הטבה לאורחי פורטוגו?
        זה מחזק את חוויית הלקוח בלי לעלות שקל, ואולי גם פותח מקור הכנסה.
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
