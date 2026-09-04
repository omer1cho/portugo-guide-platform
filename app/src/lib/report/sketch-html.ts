/**
 * ה-HTML של סקיצת הדוח הדו-שבועי — גרסה 7 (4.9.26): "מסך אחד".
 * שלושה חלקים בלבד: המדדים (עם שלוש השוואות + מגמה), למה זה זז, מה עושים.
 * הטבלאות המלאות עוברות לעמוד דוח במערכת (קישור). נתוני 21.8 עד 3.9.
 * חלונות ההשוואה: שבועיים לפני = 7.8-20.8, חודש לפני = 24.7-6.8, מגמה = 4 חלונות של שבועיים.
 * מודל העלויות כמו גרסאות 5-6 (יוחלף במנוע השכר האמיתי + עלות רכב בפועל בבנייה).
 * נשלח דרך /api/report/sketch. יוחלף בתבנית דינמית כשהדוח האמיתי ייבנה.
 */
export const REPORT_SKETCH_HTML = `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"></head>
<body style="margin:0; padding:0; background:#f3f4f6;">
<div dir="rtl" style="font-family:'Segoe UI',Arial,sans-serif; background:#f3f4f6; padding:24px 12px; color:#1f2937;">

  <div style="max-width:640px; margin:0 auto 16px; background:#fffbeb; border:1px dashed #d97706; border-radius:10px; padding:12px 16px; font-size:13px; color:#92400e; text-align:right;">
    דוגמה גרסה 7: מבנה "מסך אחד". אותם נתונים כמו גרסה 6 (21.8 עד 3.9), בפורמט חדש. הקישור לדוח המלא עוד לא פעיל.
  </div>

  <div style="max-width:640px; margin:0 auto; background:#ffffff; border-radius:14px; overflow:hidden; border:1px solid #e5e7eb;">

    <div style="background:#166534; color:#ffffff; padding:22px 28px 18px; text-align:right;">
      <div style="font-size:13px; letter-spacing:1px; opacity:0.85; margin-bottom:4px;">PORTUGO · דוח דו-שבועי</div>
      <div style="font-size:21px; font-weight:700;">21 באוגוסט עד 3 בספטמבר 2026</div>
      <div style="font-size:14.5px; line-height:1.6; margin-top:10px; background:rgba(255,255,255,0.12); border-radius:8px; padding:8px 12px;">
        <strong>בשורה אחת:</strong> הקלאסי חזק, אבל הרווח ירד ב-36% כי הפרטיים, הקולינרי וסיורי היום המלאים נעלמו לשבועיים.
      </div>
    </div>

    <div style="padding:18px 28px 14px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:10px; font-weight:700;">המדדים</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px; border-collapse:collapse;">
        <tr style="color:#6b7280; font-size:11.5px;">
          <td style="padding:5px 0; border-bottom:1px solid #e5e7eb;">מדד</td>
          <td style="padding:5px 0; border-bottom:1px solid #e5e7eb; text-align:center; font-weight:700; color:#111827;">עכשיו</td>
          <td style="padding:5px 0; border-bottom:1px solid #e5e7eb; text-align:center;">מול שבועיים לפני</td>
          <td style="padding:5px 0; border-bottom:1px solid #e5e7eb; text-align:center;">מול חודש לפני</td>
          <td style="padding:5px 0; border-bottom:1px solid #e5e7eb; text-align:center;">מגמה · 4 תקופות</td>
        </tr>
        <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 0; font-weight:600;">רווח מוערך</td><td style="text-align:center; font-weight:700; font-size:14px;">3,310€</td><td style="text-align:center; color:#b91c1c; font-weight:600;">🔴 -36%</td><td style="text-align:center; color:#b91c1c; font-weight:600;">🔴 -40%</td><td style="text-align:center; color:#6b7280; font-size:12px; white-space:nowrap;">3.6k · 5.6k · 5.2k · <b style="color:#111827;">3.3k</b></td></tr>
        <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 0; font-weight:600;">משתתפים</td><td style="text-align:center; font-weight:700; font-size:14px;">283</td><td style="text-align:center; color:#b45309; font-weight:600;">🟡 -6%</td><td style="text-align:center; color:#b91c1c; font-weight:600;">🔴 -17%</td><td style="text-align:center; color:#6b7280; font-size:12px; white-space:nowrap;">257 · 341 · 300 · <b style="color:#111827;">283</b></td></tr>
        <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 0; font-weight:600;">סיורים</td><td style="text-align:center; font-weight:700; font-size:14px;">37</td><td style="text-align:center; color:#b91c1c; font-weight:600;">🔴 -14%</td><td style="text-align:center; color:#b91c1c; font-weight:600;">🔴 -27%</td><td style="text-align:center; color:#6b7280; font-size:12px; white-space:nowrap;">39 · 51 · 43 · <b style="color:#111827;">37</b></td></tr>
        <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 0; font-weight:600;">ממוצע משתתפים בסיור יום</td><td style="text-align:center; font-weight:700; font-size:14px;">6.5</td><td style="text-align:center; color:#b91c1c; font-weight:600;">🔴 היה 9.5</td><td style="text-align:center; color:#b91c1c; font-weight:600;">🔴 היה 11.5</td><td style="text-align:center; color:#6b7280; font-size:12px; white-space:nowrap;">8 · 11.5 · 9.5 · <b style="color:#111827;">6.5</b></td></tr>
        <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 0; font-weight:600;">לקוח בכמה סיורים</td><td style="text-align:center; font-weight:700; font-size:14px;">22%</td><td style="text-align:center; color:#b45309; font-weight:600;">🟡 היה 25%</td><td style="text-align:center; color:#15803d; font-weight:600;">🟢 היה 15%</td><td style="text-align:center; color:#6b7280; font-size:12px; white-space:nowrap;">13 · 15 · 25 · <b style="color:#111827;">22</b></td></tr>
        <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 0; font-weight:600;">טיפ ממוצע לאיש בקלאסי</td><td style="text-align:center; font-weight:700; font-size:14px;">18.9€</td><td style="text-align:center; color:#15803d; font-weight:600;">🟢 יציב</td><td style="text-align:center; color:#b45309; font-weight:600;">🟡 היה 19.5€</td><td style="text-align:center; color:#6b7280; font-size:12px; white-space:nowrap;">21.5 · 19.5 · 18.5 · <b style="color:#111827;">18.9</b></td></tr>
        <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 0; font-weight:600;">מבקרים בדפי הטיפים</td><td style="text-align:center; font-weight:700; font-size:14px;">412</td><td style="text-align:center; color:#15803d; font-weight:600;">🟢 +70%</td><td style="text-align:center; color:#9ca3af;">חדש</td><td style="text-align:center; color:#6b7280; font-size:12px; white-space:nowrap;">· · 242 · <b style="color:#111827;">412</b></td></tr>
        <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 0; font-weight:600;">המרה לסיור נוסף מהדף</td><td style="text-align:center; font-weight:700; font-size:14px;">5%</td><td style="text-align:center; color:#15803d; font-weight:600;">🟢 היה 4%</td><td style="text-align:center; color:#9ca3af;">חדש</td><td style="text-align:center; color:#6b7280; font-size:12px; white-space:nowrap;">· · 4 · <b style="color:#111827;">5</b></td></tr>
        <tr style="border-bottom:1px solid #f3f4f6;"><td style="padding:8px 0; font-weight:600;">לחיצות ביקורת מהדף</td><td style="text-align:center; font-weight:700; font-size:14px;">3%</td><td style="text-align:center; color:#b45309; font-weight:600;">🟡 יציב</td><td style="text-align:center; color:#9ca3af;">חדש</td><td style="text-align:center; color:#6b7280; font-size:12px; white-space:nowrap;">· · 2.5 · <b style="color:#111827;">3</b></td></tr>
        <tr><td style="padding:8px 0; font-weight:600; color:#6b7280;">לחיצות לרשתות מהדף</td><td style="text-align:center; color:#9ca3af;">—</td><td style="text-align:center; color:#9ca3af;">יתחיל למדוד</td><td style="text-align:center; color:#9ca3af;">אחרי הבלוק</td><td style="text-align:center; color:#9ca3af; font-size:12px;">החדש בדף</td></tr>
      </table>
      <div style="font-size:11px; color:#9ca3af; margin-top:8px;">ירוק = שיפור או יציב, צהוב = ירידה קטנה, אדום = ירידה של יותר מ-10%. מגמה = ארבע תקופות של שבועיים, מהישנה לחדשה. "מול שנה שעברה" יתווסף מאפריל 2027.</div>
    </div>

    <div style="padding:18px 28px 14px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:10px; font-weight:700;">למה זה זז</div>
      <div style="font-size:13.5px; line-height:1.7; color:#374151;">
        <div style="padding:4px 0;">🔴 <strong>רווח:</strong> 2 פרטיים במקום 7, אפס קולינרי במקום 4, ושלוש סינטרות של 5 עד 6 משתתפים שהפסידו יחד 48€. הקלאסי דווקא עלה ב-30%.</div>
        <div style="padding:4px 0;">🔴 <strong>סיורי יום:</strong> 5 מתוך 6 יצאו עם 5 עד 6 משתתפים, בדיוק על נקודת האיזון. לפני חודש הממוצע היה 11.5.</div>
        <div style="padding:4px 0;">🟡 <strong>משתתפים:</strong> הירידה קטנה, וכולה בסיורים בתשלום. 213 איש בקלאסי, רק 39 המשיכו לסיור יום.</div>
        <div style="padding:4px 0;">🟢 <strong>דפי הטיפים:</strong> 412 מבקרים, 5:41 דקות בממוצע בדף ליסבון. פאדו הוא תחום העניין השני אחרי מסעדות (Fado in Chiado: 20 לחיצות).</div>
      </div>
    </div>

    <div style="padding:18px 28px 14px; border-bottom:1px solid #f3f4f6; text-align:right;">
      <div style="font-size:15px; color:#166534; margin-bottom:10px; font-weight:700;">מה עושים</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:13px; border-collapse:collapse;">
        <tr style="color:#6b7280; font-size:11.5px;">
          <td style="padding:5px 0; border-bottom:1px solid #e5e7eb; width:28%;">כדי לשפר</td>
          <td style="padding:5px 0; border-bottom:1px solid #e5e7eb;">הפעולה</td>
          <td style="padding:5px 0; border-bottom:1px solid #e5e7eb; width:14%; text-align:center;">מי</td>
        </tr>
        <tr style="border-bottom:1px solid #f3f4f6; vertical-align:top;"><td style="padding:8px 0; font-weight:600;">ממוצע בסיור יום</td><td style="padding:8px 8px 8px 0; line-height:1.55; color:#374151;">כלל רצפת ה-6: סיור יום עם פחות מ-6 משתתפים 48 שעות לפני היציאה מקבל הצעה לתאריך סמוך. בשבועיים האלה זה היה שווה כ-300€.</td><td style="padding:8px 0; text-align:center; color:#6b7280;">עומר, רונה</td></tr>
        <tr style="border-bottom:1px solid #f3f4f6; vertical-align:top;"><td style="padding:8px 0; font-weight:600;">לקוח בכמה סיורים</td><td style="padding:8px 8px 8px 0; line-height:1.55; color:#374151;">בסוף כל קלאסי: "נשארו 4 מקומות לסינטרה של מחרתיים", לא הצעה כללית. כל משתתף שממשיך לסיור יום שיוצא ממילא משאיר כ-75€.</td><td style="padding:8px 0; text-align:center; color:#6b7280;">מדריכים</td></tr>
        <tr style="border-bottom:1px solid #f3f4f6; vertical-align:top;"><td style="padding:8px 0; font-weight:600;">המרה מדף הטיפים</td><td style="padding:8px 8px 8px 0; line-height:1.55; color:#374151;">בלוק "הסיור הבא" עם תאריכים קרובים אמיתיים ומקומות פנויים, במקום רשימת סיורים כללית בתחתית הדף.</td><td style="padding:8px 0; text-align:center; color:#6b7280;">גוגו</td></tr>
        <tr style="border-bottom:1px solid #f3f4f6; vertical-align:top;"><td style="padding:8px 0; font-weight:600;">לחיצות ביקורת</td><td style="padding:8px 8px 8px 0; line-height:1.55; color:#374151;">כפתור הביקורת לראש הדף, ליד הברכה, ובנוסף הודעת וואטסאפ מהמדריך בערב הסיור עם קישור ישיר.</td><td style="padding:8px 0; text-align:center; color:#6b7280;">גוגו, מדריכים</td></tr>
        <tr style="border-bottom:1px solid #f3f4f6; vertical-align:top;"><td style="padding:8px 0; font-weight:600;">תנועה לרשתות</td><td style="padding:8px 8px 8px 0; line-height:1.55; color:#374151;">בלוק "עקבו אחרינו ותייגו אותנו" בדף הטיפים, עם קישורי אינסטגרם ופייסבוק. הלחיצות נמדדות ונכנסות לטבלה למעלה.</td><td style="padding:8px 0; text-align:center; color:#6b7280;">גוגו</td></tr>
        <tr style="vertical-align:top;"><td style="padding:8px 0; font-weight:600;">רווח בפורטו</td><td style="padding:8px 8px 8px 0; line-height:1.55; color:#374151;">קלאסי פורטו צמח ב-43% באוגוסט בלי מוצר המשך: מינימום 4 לטעימות, והדורו מוצע בסוף כל קלאסי פורטו כמו סינטרה בליסבון.</td><td style="padding:8px 0; text-align:center; color:#6b7280;">עומר, תום, דותן</td></tr>
      </table>
    </div>

    <div style="padding:16px 28px; text-align:center;">
      <a href="https://portugo-guide-platform.vercel.app/admin/report" style="display:inline-block; background:#166534; color:#ffffff; text-decoration:none; font-weight:700; font-size:14px; padding:10px 22px; border-radius:8px;">לדוח המלא במערכת: רווח לפי סיור, ימים בשבוע, מקורות הגעה, דפי הטיפים</a>
      <div style="font-size:11.5px; color:#9ca3af; margin-top:8px;">(העמוד עוד לא קיים, זו הדגמה של הקישור)</div>
    </div>

    <div style="padding:12px 28px 16px; font-size:11.5px; color:#9ca3af; text-align:center; line-height:1.6; border-top:1px solid #f3f4f6;">
      מקורות: הזמנות וסיורים, מודל התמחור, אנליטיקת דפי הטיפים · הדוח הבא: יום שישי, 18 בספטמבר 2026
    </div>

  </div>
</div>
</body>
</html>
`;
