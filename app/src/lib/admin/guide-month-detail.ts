/**
 * Guide-month detail — שכבת data לדף /admin/guides/[id]/months/[year]/[month].
 *
 * הדף ההיסטורי מציג "סיפור" מלא של חודש מסוים אצל מדריך מסוים — אחרי הסגירה.
 * המטרה: לאפשר לעומר לתפוס באגי סגירה (כמו מקרה מני אפריל-2026 שבו has_vat
 * שינוי רטרואקטיבית יצר פער של 39€ בסגירה).
 *
 * הפונקציה משלבת שלוש שכבות:
 *   1. חישוב משכורת רגיל (calculateMonthlySalary) — לפי קונפיגורציית המדריך **הנוכחית**
 *   2. הרצת לוגיקת "מה אמור להיות בסגירה" (זהה לזו שב-/close-month) — מספרים צפויים
 *   3. שליפת הפעולות **בפועל** מ-DB (transfers + expenses) ומיפוין לקטגוריות
 *
 * הדף משווה (2) מול (3) ומדגיש פערים. אם has_vat / opening_balance / classic_transfer
 * שונה ממה שהיה בעת הסגירה — הפער יצוץ אוטומטית.
 */

import { supabase, SYSTEM_START_DATE, type Guide } from '@/lib/supabase';
import {
  calculateMonthlySalary,
  calculatePerTourBreakdown,
  type SalaryBreakdown,
  type SalaryTour,
  type SalaryActivity,
  type PerTourSalary,
} from '@/lib/salary';

// ===========================================================================
// Types
// ===========================================================================

export type TransferRow = {
  id: string;
  transfer_date: string;
  amount: number;
  transfer_type: string;
  notes: string | null;
  is_pending_deposit: boolean | null;
};

export type ExpenseRow = {
  id: string;
  expense_date: string;
  item: string;
  amount: number;
  notes: string | null;
  receipt_url: string | null;
  supplier_name: string | null;
  cashflow_category: string | null;
  tour_type: string | null;
  is_admin_added: boolean | null;
};

export type EnvelopeBalances = {
  change_start: number;
  change_end: number;
  expenses_start: number;
  expenses_end: number;
};

/** מה אמור היה להיות בסגירה לפי הלוגיקה הנוכחית */
export type ExpectedClosing = {
  cash_to_withdraw: number;       // משכורת מלאה שצריכה להימשך (כולל מע"מ, מעוגל מעלה)
  take_from_box: number;          // כמה מהקופה הראשית
  from_portugo: number;           // השלמה מפורטוגו (כסף בקופה לא הספיק)
  expenses_refill: number;        // חיזוק מעטפת הוצאות (כולל coin_extra)
  change_refill: number;          // חיזוק מעטפת עודף
  coin_extra: number;             // עודף קטן (<5€) שנדחף למעטפת הוצאות
  deposit_to_portugo: number;     // הפקדה לפורטוגו (יתרת קופה לאחר עיגול)
};

/** מה קרה בפועל לפי transfers ב-DB */
export type ActualClosing = {
  salary_withdrawn: number;
  expenses_refill: number;
  change_refill: number;
  to_portugo: number;             // הפקדות לפורטוגו (לא כולל pending)
  pending_deposit: number;        // מעטפת המתנה (to_portugo עם is_pending_deposit=true)
  from_portugo: number;
  admin_topup_change: number;
  admin_topup_expenses: number;
};

export type GuideMonthDetail = {
  guide: Guide;
  year: number;
  month: number;                  // 0-indexed (ינואר=0)

  is_closed: boolean;             // יש salary_withdrawal בחודש
  closed_at: string | null;       // תאריך הסגירה (transfer_date של salary_withdrawal הראשון)
  has_data: boolean;              // יש בכלל סיורים/פעילויות בחודש

  salary: SalaryBreakdown;
  per_tour: PerTourSalary[];
  external_activities: { date: string; description: string; amount: number }[];

  transfers: TransferRow[];       // כל ה-transfers של החודש
  expenses: ExpenseRow[];         // כל ה-expenses של החודש

  envelope_balances: EnvelopeBalances;
  main_box_end: number;           // יתרת הקופה הראשית בסוף החודש (אחרי כל הפעולות)

  expected: ExpectedClosing;
  actual: ActualClosing;

  change_given_in_month: number;
  expenses_total: number;
};

// ===========================================================================
// Helpers
// ===========================================================================

function monthBounds(year: number, month: number) {
  const m1 = String(month + 1).padStart(2, '0');
  const lastDay = new Date(year, month + 1, 0).getDate();
  const start = `${year}-${m1}-01`;
  const end = `${year}-${m1}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

// ===========================================================================
// Main loader
// ===========================================================================

export async function loadGuideMonthDetail(
  guideId: string,
  year: number,
  month: number, // 0-indexed
): Promise<GuideMonthDetail | null> {
  const { start, end } = monthBounds(year, month);

  // ─── שלב 1: מדריך מלא ────────────────────────────────────────────
  const guideRes = await supabase
    .from('guides')
    .select('*')
    .eq('id', guideId)
    .single();
  if (guideRes.error || !guideRes.data) return null;
  const guide = guideRes.data as Guide;

  // ─── שלב 2: שאילתות מקבילות ──────────────────────────────────────
  // נטען cumulative (מתחילת המערכת עד סוף החודש) — נסנן ב-JS לחודש או לפני
  const [toursRes, actsRes, expsCumRes, trsCumRes] = await Promise.all([
    // סיורים של החודש בלבד
    supabase
      .from('tours')
      .select('id, tour_date, tour_type, category, notes, bookings(people, kids, price, tip, change_given)')
      .eq('guide_id', guideId)
      .gte('tour_date', start)
      .lte('tour_date', end)
      .order('tour_date'),
    // פעילויות של החודש בלבד
    supabase
      .from('activities')
      .select('activity_date, activity_type, amount, notes')
      .eq('guide_id', guideId)
      .gte('activity_date', start)
      .lte('activity_date', end)
      .order('activity_date'),
    // הוצאות מ-SYSTEM_START_DATE עד סוף החודש (לחישוב cum + של החודש)
    // try/fallback אם השדות החדשים עוד לא רצו ב-DB
    (async () => {
      const primary = await supabase
        .from('expenses')
        .select('id, expense_date, item, amount, notes, receipt_url, supplier_name, cashflow_category, tour_type, is_admin_added')
        .eq('guide_id', guideId)
        .gte('expense_date', SYSTEM_START_DATE)
        .lte('expense_date', end)
        .order('expense_date');
      if (!primary.error) return primary;
      // השדות החדשים (supplier_name וכו') עדיין לא ב-DB
      const fb = await supabase
        .from('expenses')
        .select('id, expense_date, item, amount, notes, receipt_url, tour_type')
        .eq('guide_id', guideId)
        .gte('expense_date', SYSTEM_START_DATE)
        .lte('expense_date', end)
        .order('expense_date');
      return fb;
    })(),
    // העברות מ-SYSTEM_START_DATE עד סוף החודש
    supabase
      .from('transfers')
      .select('id, transfer_date, amount, transfer_type, notes, is_pending_deposit')
      .eq('guide_id', guideId)
      .gte('transfer_date', SYSTEM_START_DATE)
      .lte('transfer_date', end)
      .order('transfer_date'),
  ]);

  if (toursRes.error) throw toursRes.error;
  if (actsRes.error) throw actsRes.error;
  if (expsCumRes.error) throw expsCumRes.error;
  if (trsCumRes.error) throw trsCumRes.error;

  // ─── שלב 3: חישוב משכורת + per-tour ─────────────────────────────
  type RawTour = {
    id: string;
    tour_date: string;
    tour_type: string;
    category: 'classic' | 'fixed' | 'private' | 'other';
    notes: string | null;
    bookings: { people: number; kids: number; price: number; tip: number; change_given: number }[] | null;
  };
  const tours = (toursRes.data || []) as RawTour[];

  const salaryTours: SalaryTour[] = tours.map((t) => ({
    tour_date: t.tour_date,
    tour_type: t.tour_type,
    category: t.category,
    notes: t.notes || '',
    bookings: (t.bookings || []).map((b) => ({
      people: b.people || 0,
      kids: b.kids || 0,
      price: b.price || 0,
      tip: b.tip || 0,
    })),
  }));

  const acts = (actsRes.data || []) as {
    activity_date: string;
    activity_type: string;
    amount: number;
    notes: string | null;
  }[];

  const salaryActivities: SalaryActivity[] = acts.map((a) => ({
    activity_date: a.activity_date,
    activity_type: a.activity_type,
    amount: a.amount || 0,
    notes: a.notes || '',
  }));

  const salary = calculateMonthlySalary(guide, salaryTours, salaryActivities);
  const per_tour = calculatePerTourBreakdown(salaryTours, guide.classic_transfer_per_person ?? 10);

  const external_activities = acts
    .filter((a) => a.activity_type === 'external')
    .map((a) => ({
      date: a.activity_date,
      description: a.notes || 'ללא תיאור',
      amount: a.amount || 0,
    }));

  // ─── שלב 4: Transfers + expenses — split לפי תאריך ─────────────
  const allTrs = (trsCumRes.data || []) as TransferRow[];
  const trsInMonth = allTrs.filter((t) => t.transfer_date >= start && t.transfer_date <= end);
  const trsBeforeMonth = allTrs.filter((t) => t.transfer_date < start);

  const allExps = (expsCumRes.data || []) as ExpenseRow[];
  const expsInMonth = allExps.filter((e) => e.expense_date >= start && e.expense_date <= end);
  const expsBeforeMonth = allExps.filter((e) => e.expense_date < start);

  // change_given במהלך החודש (סכום ה-change_given מכל ה-bookings בחודש)
  let change_given_in_month = 0;
  for (const t of tours) {
    for (const b of t.bookings || []) {
      change_given_in_month += b.change_given || 0;
    }
  }

  // change_given לפני החודש — צריך טעינה נפרדת (לא טענו tours לפני החודש)
  const changeGivenBeforeRes = await supabase
    .from('tours')
    .select('bookings(change_given)')
    .eq('guide_id', guideId)
    .gte('tour_date', SYSTEM_START_DATE)
    .lt('tour_date', start);
  if (changeGivenBeforeRes.error) throw changeGivenBeforeRes.error;
  let change_given_before = 0;
  for (const t of (changeGivenBeforeRes.data || []) as { bookings: { change_given: number }[] | null }[]) {
    for (const b of t.bookings || []) {
      change_given_before += b.change_given || 0;
    }
  }

  // ─── שלב 5: Aggregations של פעולות בפועל ───────────────────────
  const actual: ActualClosing = {
    salary_withdrawn: 0,
    expenses_refill: 0,
    change_refill: 0,
    to_portugo: 0,
    pending_deposit: 0,
    from_portugo: 0,
    admin_topup_change: 0,
    admin_topup_expenses: 0,
  };

  let closed_at: string | null = null;

  for (const t of trsInMonth) {
    const a = t.amount || 0;
    if (t.transfer_type === 'salary_withdrawal') {
      actual.salary_withdrawn += a;
      if (!closed_at || t.transfer_date < closed_at) closed_at = t.transfer_date;
    } else if (t.transfer_type === 'expenses_refill') {
      actual.expenses_refill += a;
    } else if (t.transfer_type === 'cash_refill') {
      actual.change_refill += a;
    } else if (t.transfer_type === 'to_portugo') {
      if (t.is_pending_deposit) actual.pending_deposit += a;
      else actual.to_portugo += a;
    } else if (t.transfer_type === 'from_portugo') {
      actual.from_portugo += a;
    } else if (t.transfer_type === 'admin_topup_change') {
      actual.admin_topup_change += a;
    } else if (t.transfer_type === 'admin_topup_expenses') {
      actual.admin_topup_expenses += a;
    }
  }

  // ─── שלב 6: יתרות מעטפות start/end ─────────────────────────────
  const opening_change = guide.opening_change_balance ?? 0;
  const opening_expenses = guide.opening_expenses_balance ?? 0;

  // start = opening + cumulative refills/topups לפני החודש - cumulative change_given/expenses לפני החודש
  let cum_change_refill_before = 0;
  let cum_expenses_refill_before = 0;
  let cum_admin_topup_change_before = 0;
  let cum_admin_topup_expenses_before = 0;
  for (const t of trsBeforeMonth) {
    const a = t.amount || 0;
    if (t.transfer_type === 'cash_refill') cum_change_refill_before += a;
    else if (t.transfer_type === 'expenses_refill') cum_expenses_refill_before += a;
    else if (t.transfer_type === 'admin_topup_change') cum_admin_topup_change_before += a;
    else if (t.transfer_type === 'admin_topup_expenses') cum_admin_topup_expenses_before += a;
  }
  const cum_expenses_before = expsBeforeMonth.reduce((s, e) => s + (e.amount || 0), 0);

  const change_start = opening_change + cum_change_refill_before + cum_admin_topup_change_before - change_given_before;
  const expenses_start = opening_expenses + cum_expenses_refill_before + cum_admin_topup_expenses_before - cum_expenses_before;

  // end = start + (refills/topups בחודש) - (change_given/expenses בחודש)
  const expenses_total = expsInMonth.reduce((s, e) => s + (e.amount || 0), 0);
  const change_end = change_start + actual.change_refill + actual.admin_topup_change - change_given_in_month;
  const expenses_end = expenses_start + actual.expenses_refill + actual.admin_topup_expenses - expenses_total;

  const envelope_balances: EnvelopeBalances = {
    change_start,
    change_end,
    expenses_start,
    expenses_end,
  };

  // ─── שלב 7: Main box at end of month ────────────────────────────
  // נוסחה זהה ל-/close-month — total_cash_collected של החודש + change_given - כל ה-transfers הרלוונטיים בחודש
  // (סכום to_portugo + from_portugo, לא כולל refills/admin_topup/salary_withdrawal — אלה כבר מטופלים בנפרד)
  let trs_total_other = 0;
  for (const t of trsInMonth) {
    const a = t.amount || 0;
    if (
      t.transfer_type !== 'cash_refill' &&
      t.transfer_type !== 'expenses_refill' &&
      t.transfer_type !== 'salary_withdrawal' &&
      t.transfer_type !== 'admin_topup_change' &&
      t.transfer_type !== 'admin_topup_expenses'
    ) {
      // to_portugo (כולל pending), from_portugo (אם קיים)
      // from_portugo בעצם **מוסיף** לקופה — אבל בנוסחה המקורית של /close-month הוא נכלל ב-transfersTotal עם סימן +
      // (כי הקוד עושה `transfersTotal += amt` לכל מה שלא ברשימה הראשונה).
      // נשמר על אותה התנהגות כדי שזה יתאים למה שהמדריך רואה ב-/close-month.
      trs_total_other += a;
    }
  }
  const main_box_end =
    salary.total_cash_collected +
    change_given_in_month -
    trs_total_other -
    actual.change_refill -
    actual.expenses_refill -
    actual.salary_withdrawn;

  // ─── שלב 8: Expected closing — להריץ את הלוגיקה של /close-month ─
  // המצב "לפני סגירה" = main_box + salary_withdrawn + refills_in_closing
  // לפשטות, ניקח את main_box "ברגע הסגירה" כ:
  //   total_cash_collected + change_given - to_portugo_in_month
  // (לפני הסגירה אין refills/salary_withdrawal — או שיש מעט מאוד שלא בסגירה)
  const main_box_at_close = salary.total_cash_collected + change_given_in_month - actual.to_portugo - actual.pending_deposit;

  const EXPENSES_TARGET = guide.target_expenses_balance ?? 150;
  const CHANGE_TARGET = guide.target_change_balance ?? 100;
  const DEPOSIT_STEP = 5;
  const skipAllRefills = EXPENSES_TARGET === 0 && CHANGE_TARGET === 0;

  const cash_to_withdraw = salary.cash_to_withdraw;
  const take_from_box = Math.max(0, Math.min(main_box_at_close, cash_to_withdraw));
  const from_portugo_expected = Math.max(0, cash_to_withdraw - main_box_at_close);
  let remaining = Math.max(0, main_box_at_close - take_from_box);

  // יתרות מעטפות בעת הסגירה — לפני חיזוקי הסגירה
  // = start + change_given/expenses + non-closing refills (לא כולל הסגירה)
  // כדי לפשט: ניקח את change_balance/expenses_balance הנוכחיים כפי שהיו אילו לא היו refills סגירה
  const change_before_closing = change_start + actual.admin_topup_change - change_given_in_month;
  const expenses_before_closing = expenses_start + actual.admin_topup_expenses - expenses_total;

  const expensesNeed = Math.max(0, EXPENSES_TARGET - expenses_before_closing);
  let expenses_refill_expected = Math.min(expensesNeed, remaining);
  remaining -= expenses_refill_expected;

  const changeNeed = Math.max(0, CHANGE_TARGET - change_before_closing);
  const change_refill_expected = Math.min(changeNeed, remaining);
  remaining -= change_refill_expected;

  const deposit_rounded = skipAllRefills
    ? remaining
    : Math.floor(remaining / DEPOSIT_STEP) * DEPOSIT_STEP;
  const coin_extra = remaining - deposit_rounded;
  if (!skipAllRefills) {
    expenses_refill_expected += coin_extra;
  }

  const expected: ExpectedClosing = {
    cash_to_withdraw,
    take_from_box,
    from_portugo: from_portugo_expected,
    expenses_refill: expenses_refill_expected,
    change_refill: change_refill_expected,
    coin_extra,
    deposit_to_portugo: deposit_rounded,
  };

  // ─── שלב 9: סטטוס + has_data ────────────────────────────────────
  const has_data = tours.length > 0 || acts.length > 0 || trsInMonth.length > 0 || expsInMonth.length > 0;
  const is_closed = actual.salary_withdrawn > 0.01;

  return {
    guide,
    year,
    month,
    is_closed,
    closed_at,
    has_data,
    salary,
    per_tour,
    external_activities,
    transfers: trsInMonth,
    expenses: expsInMonth,
    envelope_balances,
    main_box_end,
    expected,
    actual,
    change_given_in_month,
    expenses_total,
  };
}

// ===========================================================================
// תיוגי תצוגה ל-transfer_type
// ===========================================================================

export const TRANSFER_TYPE_LABELS: Record<string, { label: string; icon: string; group: string }> = {
  salary_withdrawal:    { label: 'משיכת משכורת',     icon: '💰', group: 'closing' },
  expenses_refill:      { label: 'חיזוק מעטפת הוצאות', icon: '📩', group: 'closing' },
  cash_refill:          { label: 'חיזוק מעטפת עודף',  icon: '🪙', group: 'closing' },
  to_portugo:           { label: 'הפקדה לפורטוגו',    icon: '🏦', group: 'deposit' },
  from_portugo:         { label: 'העברה מפורטוגו',    icon: '💚', group: 'deposit' },
  admin_topup_change:   { label: 'שיפוי ידני (עודף)',  icon: '🔧', group: 'admin' },
  admin_topup_expenses: { label: 'שיפוי ידני (הוצאות)', icon: '🔧', group: 'admin' },
};

export function transferTypeLabel(type: string): { label: string; icon: string } {
  const m = TRANSFER_TYPE_LABELS[type];
  if (m) return m;
  return { label: type, icon: '•' };
}
