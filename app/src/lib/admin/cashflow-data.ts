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

// ===========================================================================
// שלב 2 — דף הכנת קשפלו (/admin/cashflow/[year]/[month]/prepare)
// ===========================================================================

/** הוצאה שעולה לסקירה בקשפלו (מ-`expenses` של מדריכים, או הוצאה שנוספה ע"י אדמין) */
export type CashflowExpense = {
  id: string;
  expense_date: string;
  guide_id: string | null;
  guide_name: string;          // 'אדמין' אם is_admin_added
  item: string;
  amount: number;
  notes: string | null;
  receipt_url: string | null;
  supplier_name: string | null;
  receipt_number: string | null;
  cashflow_category: 'regular' | 'multibanco' | 'excluded';
  is_admin_added: boolean;
  tour_type: string | null;
  /** סימן חשד למולטיבנקו (heuristic) — כשהמדריך לא סימן ידנית */
  multibanco_suspect: boolean;
};

/** הפקדה לבנק (transfer מסוג to_portugo, כולל pending) */
export type CashflowDeposit = {
  id: string;
  transfer_date: string;
  guide_id: string;
  guide_name: string;
  guide_first_name_lc: string; // לקשפלו: עמודת Description בעברית קטנה
  amount: number;
  notes: string | null;
  is_pending_deposit: boolean;
};

/** קבלת משכורת (Fatura-Recibo) ממדריך */
export type CashflowSalaryInvoice = {
  ack_id: string;
  guide_id: string;
  guide_name: string;
  guide_full_name_lc: string;  // 'sallary <full lowercase name>' לקשפלו
  /** תאריך הוצאת החשבונית — קובע באיזה חודש מופיע בקשפלו */
  invoice_date: string | null;
  acknowledged_at: string;
  receipt_url: string | null;
  /** סכום הקבלה = amount של ה-salary_withdrawal transfer של אותו חודש עבודה */
  amount: number | null;
  /** חודש העבודה שאליו הקבלה מתייחסת */
  service_year: number;
  service_month: number;
};

export type CashflowPrepareData = {
  year: number;
  month: number;
  expenses: CashflowExpense[];
  deposits: CashflowDeposit[];
  salaryInvoices: CashflowSalaryInvoice[];
  /** סך outflow צפוי (regular + multibanco-confirmed לא נכלל) */
  totalRegularOutflow: number;
  totalDeposits: number;
  totalSalaries: number;
  /** מקרים שדורשים תשומת לב (חשד מולטיבנקו, חסרה קבלה, חסר סכום, חסר תאריך חשבונית) */
  flaggedCount: number;
};

const MULTIBANCO_KEYWORDS = ['multibanco', 'mb ', 'visa', 'mastercard', 'card', 'כרטיס', 'אשראי', 'mbway'];

function looksLikeMultibanco(item: string | null, notes: string | null, supplier: string | null): boolean {
  const blob = `${item || ''} ${notes || ''} ${supplier || ''}`.toLowerCase();
  return MULTIBANCO_KEYWORDS.some((k) => blob.includes(k));
}

/** שם פרטי בעברית קטנה לעמודת Description בהפקדות */
function depositFirstNameLc(name: string): string {
  // לוקח את המילה הראשונה (השם הפרטי בעברית), משאיר תווים בשם.
  // לקשפלו עצמו (Excel) שם המדריך באנגלית — נטפל בזה בשלב 3 לפי טבלה במסמך הידע.
  return (name.split(/\s+/)[0] || name).toLowerCase().trim();
}

/**
 * טוען את כל הנתונים שצריכים לדף ההכנה.
 * אסטרטגיה: 4 שאילתות מקבילות + מיפויים בצד הקליינט.
 */
export async function loadCashflowPrepareData(year: number, month: number): Promise<CashflowPrepareData> {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

  // לקבלות מס (Fatura-Recibo): מחפשים לפי invoice_date אם קיים — ולחזרה אחורה
  // לפי year+month של חודש העבודה (אם invoice_date עדיין null).
  const [guidesRes, expensesRes, depositsRes, ackRes, salaryTransfersRes] = await Promise.all([
    supabase
      .from('guides')
      .select('id, name')
      .order('name'),

    // הוצאות בכל החודש (כולל is_admin_added)
    (async () => {
      const primary = await supabase
        .from('expenses')
        .select('id, guide_id, expense_date, item, amount, notes, receipt_url, tour_type, supplier_name, receipt_number, cashflow_category, is_admin_added')
        .gte('expense_date', start)
        .lte('expense_date', end)
        .order('expense_date');
      if (!primary.error) return primary;
      // מיגרציה עוד לא רצה → fallback בלי השדות החדשים
      return supabase
        .from('expenses')
        .select('id, guide_id, expense_date, item, amount, notes, receipt_url, tour_type')
        .gte('expense_date', start)
        .lte('expense_date', end)
        .order('expense_date');
    })(),

    // הפקדות לבנק בחודש (transfer_type='to_portugo')
    supabase
      .from('transfers')
      .select('id, transfer_date, guide_id, amount, notes, is_pending_deposit')
      .eq('transfer_type', 'to_portugo')
      .gte('transfer_date', start)
      .lte('transfer_date', end)
      .order('transfer_date'),

    // קבלות מס — נטען את כל הקבלות עם invoice_date בחודש זה
    // וגם, fallback, את הקבלות של חודש העבודה year+month שעדיין אין להם invoice_date
    (async () => {
      const primary = await supabase
        .from('receipt_acknowledgements')
        .select('id, guide_id, year, month, acknowledged_at, receipt_url, invoice_date')
        .or(`and(invoice_date.gte.${start},invoice_date.lte.${end}),and(invoice_date.is.null,year.eq.${year},month.eq.${month})`);
      if (!primary.error) return primary;
      // אם invoice_date עוד לא קיים בכלל
      return supabase
        .from('receipt_acknowledgements')
        .select('id, guide_id, year, month, acknowledged_at, receipt_url')
        .eq('year', year)
        .eq('month', month);
    })(),

    // משכורות (לחישוב הסכום של כל Fatura-Recibo) — לפי חודש העבודה
    supabase
      .from('transfers')
      .select('guide_id, transfer_date, amount')
      .eq('transfer_type', 'salary_withdrawal')
      .gte('transfer_date', start)
      .lte('transfer_date', end),
  ]);

  if (guidesRes.error) throw guidesRes.error;
  if (expensesRes.error) throw expensesRes.error;
  if (depositsRes.error) throw depositsRes.error;
  if (ackRes.error) throw ackRes.error;
  if (salaryTransfersRes.error) throw salaryTransfersRes.error;

  const guideById = new Map<string, { id: string; name: string }>();
  for (const g of (guidesRes.data || []) as { id: string; name: string }[]) {
    guideById.set(g.id, g);
  }

  // --- expenses
  type RawExpense = {
    id: string;
    guide_id: string | null;
    expense_date: string;
    item: string | null;
    amount: number;
    notes: string | null;
    receipt_url: string | null;
    tour_type: string | null;
    supplier_name?: string | null;
    receipt_number?: string | null;
    cashflow_category?: string | null;
    is_admin_added?: boolean | null;
  };
  const expenses: CashflowExpense[] = ((expensesRes.data || []) as RawExpense[]).map((e) => {
    const cat = (e.cashflow_category as 'regular' | 'multibanco' | 'excluded') || 'regular';
    const isAdmin = !!e.is_admin_added;
    const guideName = isAdmin ? 'אדמין' : guideById.get(e.guide_id || '')?.name || '—';
    const suspectMb = cat === 'regular' && looksLikeMultibanco(e.item, e.notes, e.supplier_name ?? null);
    return {
      id: e.id,
      expense_date: e.expense_date,
      guide_id: e.guide_id,
      guide_name: guideName,
      item: e.item || '',
      amount: Number(e.amount),
      notes: e.notes,
      receipt_url: e.receipt_url,
      supplier_name: e.supplier_name ?? null,
      receipt_number: e.receipt_number ?? null,
      cashflow_category: cat,
      is_admin_added: isAdmin,
      tour_type: e.tour_type,
      multibanco_suspect: suspectMb,
    };
  });

  // --- deposits
  const deposits: CashflowDeposit[] = ((depositsRes.data || []) as {
    id: string;
    transfer_date: string;
    guide_id: string;
    amount: number;
    notes: string | null;
    is_pending_deposit: boolean | null;
  }[]).map((t) => {
    const gName = guideById.get(t.guide_id)?.name || '—';
    return {
      id: t.id,
      transfer_date: t.transfer_date,
      guide_id: t.guide_id,
      guide_name: gName,
      guide_first_name_lc: depositFirstNameLc(gName),
      amount: Number(t.amount),
      notes: t.notes,
      is_pending_deposit: !!t.is_pending_deposit,
    };
  });

  // --- salary invoices
  // ממפה: guide_id → amount של salary_withdrawal של אותו חודש עבודה
  const salaryByGuideMonth = new Map<string, number>();
  for (const s of (salaryTransfersRes.data || []) as { guide_id: string; transfer_date: string; amount: number }[]) {
    const dt = new Date(s.transfer_date);
    const key = `${s.guide_id}_${dt.getFullYear()}_${dt.getMonth() + 1}`;
    if (!salaryByGuideMonth.has(key)) {
      salaryByGuideMonth.set(key, Number(s.amount));
    }
  }

  type RawAck = { id: string; guide_id: string; year: number; month: number; acknowledged_at: string; receipt_url: string | null; invoice_date?: string | null };
  const salaryInvoices: CashflowSalaryInvoice[] = ((ackRes.data || []) as RawAck[]).map((a) => {
    const gName = guideById.get(a.guide_id)?.name || '—';
    const key = `${a.guide_id}_${a.year}_${a.month}`;
    const amount = salaryByGuideMonth.get(key) ?? null;
    return {
      ack_id: a.id,
      guide_id: a.guide_id,
      guide_name: gName,
      guide_full_name_lc: gName.toLowerCase(),
      invoice_date: a.invoice_date ?? null,
      acknowledged_at: a.acknowledged_at,
      receipt_url: a.receipt_url,
      amount,
      service_year: a.year,
      service_month: a.month,
    };
  });

  // --- summaries
  const totalRegularOutflow = expenses
    .filter((e) => e.cashflow_category === 'regular')
    .reduce((s, e) => s + e.amount, 0);
  const totalDeposits = deposits.reduce((s, d) => s + d.amount, 0);
  const totalSalaries = salaryInvoices.reduce((s, i) => s + (i.amount || 0), 0);

  // flagged: חשד מולטיבנקו, חסרה תמונת קבלה (להוצאות לא is_admin_added),
  // חסר סכום ב-Fatura-Recibo, חסר invoice_date
  const flaggedCount = expenses.filter((e) => e.multibanco_suspect).length
    + expenses.filter((e) => !e.is_admin_added && !e.receipt_url).length
    + salaryInvoices.filter((i) => i.amount === null).length
    + salaryInvoices.filter((i) => !i.invoice_date).length;

  return {
    year,
    month,
    expenses,
    deposits,
    salaryInvoices,
    totalRegularOutflow,
    totalDeposits,
    totalSalaries,
    flaggedCount,
  };
}

/** עדכון סיווג הוצאה (ספק / מספר קבלה / קטגוריה). מחזיר את השורה המעודכנת. */
export async function updateExpenseClassification(opts: {
  expenseId: string;
  supplier_name?: string | null;
  receipt_number?: string | null;
  cashflow_category?: 'regular' | 'multibanco' | 'excluded';
}): Promise<void> {
  const patch: Record<string, unknown> = {};
  if (opts.supplier_name !== undefined) patch.supplier_name = opts.supplier_name || null;
  if (opts.receipt_number !== undefined) patch.receipt_number = opts.receipt_number || null;
  if (opts.cashflow_category !== undefined) patch.cashflow_category = opts.cashflow_category;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from('expenses').update(patch).eq('id', opts.expenseId);
  if (error) throw error;
}

/** הוספת הוצאת אדמין (קבלה שעומר מוסיפה ידנית — שכ"ד, ספק חיצוני, קבלת משכורת). */
export async function addAdminExpense(opts: {
  expense_date: string;
  supplier_name: string;
  amount: number;
  receipt_number?: string | null;
  notes?: string | null;
  cashflow_category?: 'regular' | 'multibanco' | 'excluded';
}): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      guide_id: null,
      expense_date: opts.expense_date,
      item: opts.supplier_name,
      amount: opts.amount,
      notes: opts.notes || '',
      supplier_name: opts.supplier_name,
      receipt_number: opts.receipt_number || null,
      cashflow_category: opts.cashflow_category || 'regular',
      is_admin_added: true,
    })
    .select('id')
    .single();
  if (error) throw error;
  return { id: (data as { id: string }).id };
}

/** קישור URL של קבלה להוצאת אדמין שנוצרה זה עתה */
export async function setExpenseReceiptUrl(expenseId: string, url: string): Promise<void> {
  const { error } = await supabase.from('expenses').update({ receipt_url: url }).eq('id', expenseId);
  if (error) throw error;
}

/** עדכון תאריך הוצאת חשבונית מס למדריך */
export async function updateInvoiceDate(ackId: string, invoiceDate: string | null): Promise<void> {
  const { error } = await supabase
    .from('receipt_acknowledgements')
    .update({ invoice_date: invoiceDate })
    .eq('id', ackId);
  if (error) throw error;
}

/** מחיקת הוצאת אדמין (להחלפה במקרה של טעות) */
export async function deleteAdminExpense(expenseId: string): Promise<void> {
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', expenseId)
    .eq('is_admin_added', true);
  if (error) throw error;
}
