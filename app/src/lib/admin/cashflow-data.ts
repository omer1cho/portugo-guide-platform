/**
 * Cashflow data layer — שכבת data לדף /admin/cashflow.
 *
 * אחראית על:
 *   - טעינת סטטוס סגירת חודש לכל המדריכים בחודש נתון
 *   - טעינת היסטוריית הרצות קשפלו
 *   - בעתיד (round 2): טעינת קבלות + ייצור Excel + שמירה ב-Storage
 */

import { supabase } from '@/lib/supabase';

export type CashflowGuideStatus = {
  guide_id: string;
  guide_name: string;
  city: 'lisbon' | 'porto';
  is_closed: boolean;
  closed_at: string | null;       // תאריך מתי "נמשכה משכורת" (= סגירת חודש)
  has_receipt: boolean;            // האם המדריך הוציא קבלה החודש (Fatura-Recibo) ב-/home
  salary_withdrawn: number | null; // סכום שהמדריך משך לעצמו (transfer salary_withdrawal)
};

export type CashflowRun = {
  id: string;
  year: number;
  month: number;
  tours_income: number;
  total_outflow: number;
  previous_balance: number;
  final_balance: number | null;
  transactions_count: number;
  excel_file_url: string | null;
  generated_at: string;
};

/**
 * מחזיר את סטטוס סגירת החודש לכל המדריכים הפעילים שמדריכים בפועל (is_guide=true).
 *
 * "סגירת חודש" של מדריך = יש לו רשומה ב-`transfers` עם `transfer_type='salary_withdrawal'`
 * בחודש הזה. זה נוצר אוטומטית כשהמדריך לוחץ "סגרי חודש" ב-/close-month וקובע את
 * המשכורת שמשך לעצמו מהקופה.
 *
 * "הוצאת קבלה" = רשומה ב-`receipt_acknowledgements` (המדריך אישר ב-/home שהוציא קבלת
 * Fatura-Recibo, אופציונלית עם תמונה).
 */
export async function loadGuidesCashflowStatus(year: number, month: number): Promise<CashflowGuideStatus[]> {
  // טווח התאריכים של החודש
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // טעינה במקביל של 3 מקורות
  const [guidesRes, salaryRes, ackRes] = await Promise.all([
    // הגנה: ננסה עם is_guide; אם העמודה לא קיימת — נופלים ל-is_admin=false (התנהגות ישנה)
    (async () => {
      const primary = await supabase
        .from('guides')
        .select('id, name, city, is_guide')
        .eq('is_active', true)
        .eq('is_guide', true)
        .order('name');
      if (!primary.error) return primary;
      if (primary.error.message?.toLowerCase().includes('is_guide')) {
        return supabase
          .from('guides')
          .select('id, name, city')
          .eq('is_active', true)
          .eq('is_admin', false)
          .order('name');
      }
      return primary;
    })(),
    // המקור האמיתי לסגירת חודש — salary_withdrawal ב-transfers
    supabase
      .from('transfers')
      .select('guide_id, transfer_date, amount')
      .eq('transfer_type', 'salary_withdrawal')
      .gte('transfer_date', start)
      .lte('transfer_date', end),
    // קבלות חודשיות שהמדריך הוציא לפורטוגו
    supabase
      .from('receipt_acknowledgements')
      .select('guide_id, acknowledged_at')
      .eq('year', year)
      .eq('month', month),
  ]);

  if (guidesRes.error) throw guidesRes.error;
  if (salaryRes.error) throw salaryRes.error;
  if (ackRes.error) throw ackRes.error;

  // אם מדריך משך כמה פעמים באותו חודש — ניקח את הראשון (לא נורמלי, אבל לא להפיל)
  const salaryMap = new Map<string, { transfer_date: string; amount: number }>();
  for (const t of (salaryRes.data || []) as { guide_id: string; transfer_date: string; amount: number }[]) {
    if (!salaryMap.has(t.guide_id)) {
      salaryMap.set(t.guide_id, { transfer_date: t.transfer_date, amount: t.amount });
    }
  }
  const ackSet = new Set(((ackRes.data || []) as { guide_id: string }[]).map((a) => a.guide_id));

  return ((guidesRes.data || []) as { id: string; name: string; city: 'lisbon' | 'porto' }[]).map((g) => {
    const salary = salaryMap.get(g.id);
    return {
      guide_id: g.id,
      guide_name: g.name,
      city: g.city,
      is_closed: !!salary,
      closed_at: salary?.transfer_date ?? null,
      has_receipt: ackSet.has(g.id),
      salary_withdrawn: salary?.amount ?? null,
    };
  });
}

/** מחזיר את היסטוריית הרצות הקשפלו של חודש מסוים (אחרון ראשון) */
export async function loadCashflowRunsForMonth(year: number, month: number): Promise<CashflowRun[]> {
  const { data, error } = await supabase
    .from('cashflow_runs')
    .select('id, year, month, tours_income, total_outflow, previous_balance, final_balance, transactions_count, excel_file_url, generated_at')
    .eq('year', year)
    .eq('month', month)
    .order('generated_at', { ascending: false });
  if (error) {
    // אם הטבלה עוד לא קיימת ב-DB — מחזירים [] במקום להפיל את הדף
    if (error.message?.toLowerCase().includes('cashflow_runs')) return [];
    throw error;
  }
  return (data || []) as CashflowRun[];
}

/** מחזיר את כל הרצות הקשפלו (לחיווי היסטורי כללי) */
export async function loadRecentCashflowRuns(limit: number = 12): Promise<CashflowRun[]> {
  const { data, error } = await supabase
    .from('cashflow_runs')
    .select('id, year, month, tours_income, total_outflow, previous_balance, final_balance, transactions_count, excel_file_url, generated_at')
    .order('generated_at', { ascending: false })
    .limit(limit);
  if (error) {
    if (error.message?.toLowerCase().includes('cashflow_runs')) return [];
    throw error;
  }
  return (data || []) as CashflowRun[];
}

/** עוזר — שם החודש בעברית (אפריל / מרץ / וכו') */
export function monthNameHe(month: number): string {
  const names = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];
  return names[month - 1] || '';
}

/** עוזר — שם החודש באנגלית (April / March / וכו') לקשפלו (sheet name = lowercase + 2-digit year) */
export function monthSheetName(year: number, month: number): string {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const yy = String(year).slice(-2);
  // לפי הקובץ: Jan26 / Feb26 גדול, mar26 / apr26 קטן. נשמור על הדפוס הקיים — קטן.
  return `${names[month - 1].toLowerCase()}${yy}`;
}
