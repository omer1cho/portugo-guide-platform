// גיל של הפקדה ממתינה — כמה ימים הכסף מחכה אצל המדריך, ומאיזה חודש.
// משותף לדף הניהול ולמסכי המדריך, כדי שסכום שמחכה מיולי לא ייראה כמו סכום מאתמול.

/** אחרי כמה ימים הפקדה ממתינה נחשבת "מתעכבת" ומסומנת באדום חזק */
export const PENDING_STALE_DAYS = 7;

/** ימים שעברו מתאריך הרישום (yyyy-mm-dd) עד היום, לפי שעון מקומי */
export function pendingDaysWaiting(transferDate: string): number {
  const [y, m, d] = transferDate.slice(0, 10).split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.max(0, Math.round((today.getTime() - start.getTime()) / 86400000));
}

/** "סגירת יולי 2026" מתוך ההערה של הסגירה, אחרת התאריך (23.7) */
export function pendingSourceLabel(notes: string | null, transferDate: string): string {
  const m = (notes || '').match(/סגירת \S+ \d{4}/);
  if (m) return m[0];
  const [, mm, dd] = transferDate.slice(0, 10).split('-').map(Number);
  return `מ-${dd}.${mm}`;
}

/** "מחכה היום" / "מחכה יום אחד" / "מחכה 72 ימים" */
export function pendingWaitingText(days: number): string {
  if (days === 0) return 'נרשם היום';
  if (days === 1) return 'מחכה יום אחד';
  return `מחכה ${days} ימים`;
}

export function isPendingStale(days: number): boolean {
  return days > PENDING_STALE_DAYS;
}
