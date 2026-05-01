// מדיניות עריכת נתונים פר-חודש.
//
// הכלל:
//   1. החודש הנוכחי — תמיד פתוח לעריכה.
//   2. החודש שקדם לחודש הנוכחי (Apr כשאנחנו ב-May) — פתוח לעריכה
//      כל עוד אנחנו ב-5 ימים הראשונים של החודש הנוכחי, וכל עוד המדריך
//      עוד לא סגר את משכורת אותו חודש (אין שורה salary_withdrawal).
//   3. כל חודש אחר (ישן יותר, או אחרי 5 ימים, או אחרי סגירת משכורת) — נעול.
//
// הבסיס לסגירה: האם יש שורת transfer מסוג salary_withdrawal עבור המדריך
// בטווח התאריכים של החודש הנבחר. salary_withdrawal נוצר ב-/close-month
// כשהמדריך לוחץ "אישור פעולות".

import type { SupabaseClient } from '@supabase/supabase-js';

const GRACE_DAYS = 5;

/** האם החודש הנבחר הוא החודש הנוכחי (לפי "עכשיו"). */
export function isCurrentMonth(year: number, month: number, now: Date = new Date()): boolean {
  return year === now.getFullYear() && month === now.getMonth();
}

/** החודש שקדם לחודש הנוכחי (לפי "עכשיו"). */
function previousMonth(now: Date = new Date()): { year: number; month: number } {
  const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return { year: d.getFullYear(), month: d.getMonth() };
}

/** האם החודש הנבחר הוא החודש הקודם (לפי "עכשיו"). */
export function isPreviousMonth(year: number, month: number, now: Date = new Date()): boolean {
  const p = previousMonth(now);
  return year === p.year && month === p.month;
}

/**
 * האם המדריך רשאי לערוך נתונים בחודש הנבחר.
 * salaryClosedForViewedMonth: האם יש salary_withdrawal לחודש הזה.
 */
export function canEditMonth(
  viewYear: number,
  viewMonth: number,
  salaryClosedForViewedMonth: boolean,
  now: Date = new Date(),
): boolean {
  if (isCurrentMonth(viewYear, viewMonth, now)) return true;
  if (isPreviousMonth(viewYear, viewMonth, now)) {
    return now.getDate() <= GRACE_DAYS && !salaryClosedForViewedMonth;
  }
  return false;
}

/**
 * הסבר טקסטואלי למצב העריכה — מה להציג למדריך כשהחודש לא פתוח.
 * מחזיר null אם החודש פתוח לעריכה.
 */
export function getMonthEditExplanation(
  viewYear: number,
  viewMonth: number,
  salaryClosedForViewedMonth: boolean,
  now: Date = new Date(),
): string | null {
  if (canEditMonth(viewYear, viewMonth, salaryClosedForViewedMonth, now)) return null;
  if (isPreviousMonth(viewYear, viewMonth, now)) {
    if (salaryClosedForViewedMonth) {
      return 'סגרת את המשכורת לחודש זה — לא ניתן להוסיף או לערוך.';
    }
    return `תקופת ההשלמה (${GRACE_DAYS} ימים) הסתיימה. לא ניתן להוסיף או לערוך חודש זה.`;
  }
  return 'חודש זה נעול לעריכה. רק החודש הנוכחי פתוח.';
}

/**
 * הסבר חיובי כשפתוח לעריכה בתקופת השלמה — לעודד למלא לפני שייסגר.
 * מחזיר null אם זה החודש הנוכחי או שהחודש כבר נעול.
 */
export function getGracePeriodNotice(
  viewYear: number,
  viewMonth: number,
  salaryClosedForViewedMonth: boolean,
  now: Date = new Date(),
): string | null {
  if (!isPreviousMonth(viewYear, viewMonth, now)) return null;
  if (!canEditMonth(viewYear, viewMonth, salaryClosedForViewedMonth, now)) return null;
  const remaining = GRACE_DAYS - now.getDate() + 1;
  return `תקופת השלמה: עוד ${remaining} ${remaining === 1 ? 'יום' : 'ימים'} להשלים נתונים לחודש זה.`;
}

/**
 * בדיקה ב-DB: האם יש salary_withdrawal עבור המדריך בחודש הנבחר.
 * משתמשים בזה ב-pages שלא טוענות salaryWithdrawn לבד (expenses, transfers).
 */
export async function checkSalaryClosed(
  supabase: SupabaseClient,
  guideId: string,
  year: number,
  month: number,
): Promise<boolean> {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  const { data, error } = await supabase
    .from('transfers')
    .select('id')
    .eq('guide_id', guideId)
    .eq('transfer_type', 'salary_withdrawal')
    .gte('transfer_date', start)
    .lte('transfer_date', end)
    .limit(1);

  if (error) return false;
  return (data?.length ?? 0) > 0;
}

/** פורמט YYYY-MM להעברה בלינק. משמש כדי ש-/add-tour וכו' יידעו לאיזה חודש החזרה. */
export function formatYearMonthParam(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}
