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
  /** מה שהמדריך באמת הזין/בחר (טקסט מקורי בעברית) */
  item: string;
  amount: number;
  notes: string | null;
  receipt_url: string | null;
  supplier_name: string | null;
  /** ניחוש מהמערכת לפי טקסט הפריט/הערות — להצגה כברירת מחדל אם supplier_name ריק */
  suggested_supplier: string | null;
  receipt_number: string | null;
  cashflow_category: 'regular' | 'multibanco' | 'excluded';
  is_admin_added: boolean;
  tour_type: string | null;
  /** סימן חשד למולטיבנקו (heuristic) — כשהמדריך לא סימן ידנית */
  multibanco_suspect: boolean;
  /** האם פריט זה דורש קבלה לפי הקטלוג. null = פריט שלא מהקטלוג (free text) */
  catalog_requires_receipt: boolean | null;
  /** שם פריט הקטלוג (אם נבחר מקטלוג) */
  catalog_item_name: string | null;
};

/** הפקדה לבנק (transfer מסוג to_portugo). pending unsettled מוחרגות מהקשפלו. */
export type CashflowDeposit = {
  id: string;
  /** תאריך השורה ב-DB (יום הסגירה / יום הזנת ההעברה) */
  transfer_date: string;
  /** תאריך הפקדה בפועל לבנק (אם מולא ידנית). חזר מ-COALESCE(settled_at, transfer_date) לחישוב חודש קשפלו */
  settled_at: string | null;
  /** התאריך שקובע באיזה חודש קשפלו ההפקדה תופיע */
  effective_date: string;
  guide_id: string;
  guide_name: string;
  guide_first_name_lc: string;
  amount: number;
  notes: string | null;
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
  /** קבלות מס שתאריך הוצאת החשבונית שלהן בחודש זה */
  salaryInvoices: CashflowSalaryInvoice[];
  /** קבלות מס שעדיין אין להן תאריך הוצאת חשבונית (כל החודשים) — דורשות שיוך */
  unscheduledInvoices: CashflowSalaryInvoice[];
  /** הפקדות שעדיין ממתינות (is_pending_deposit=true) — לא נכללות בקשפלו */
  pendingDeposits: CashflowDeposit[];
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

/**
 * מיפוי מילות מפתח → "Entity" בקשפלו (כפי שעומר רושמת ידנית באקסל cashflow piro).
 * כל הערכים באנגלית קטנה (lowercase) כדי להתאים למוסכמות הגיליון.
 * הסדר חשוב: מילים ייחודיות (Belém) לפני כלליות (קלאסי).
 */
const SUPPLIER_KEYWORDS: { keywords: string[]; supplier: string }[] = [
  // ספקי בלם — לרוב מופיעים לפי שם
  { keywords: ['belém', 'belem', 'בלם', 'פסטל', 'pastel', 'pastéis', 'pasteis'], supplier: 'pasteis de belem' },
  // ספקי יין
  { keywords: ['fonseca', 'jmf', 'פונסקה', 'אזיטאו', 'azeitão', 'azeitao'], supplier: 'jose maria da fonseca' },
  { keywords: ['quinta do beijo', 'beijo', 'קינטה דו ביז'], supplier: 'quinta do beijo' },
  { keywords: ['quinta do bom dia', 'bom dia'], supplier: 'quinta do bom dia' },
  // אוכל ומשקאות בליסבון
  { keywords: ['bacalhau', 'בקלאו', 'בקאלאו', 'rei do', 'santos ramalho'], supplier: 'rei do bacalhau' },
  { keywords: ['camões', 'camoes', 'קמואש', 'קמואס'], supplier: 'mercado do camoes' },
  { keywords: ['horacio', 'horácio', 'אסטבס', 'esteves'], supplier: 'horacio esteves e justo' },
  { keywords: ['croque', 'קרוקט'], supplier: 'croqueteria' },
  { keywords: ['padaria', 'פדריה', 'פדאריה'], supplier: 'padaria portuguesa' },
  { keywords: ['pingo', 'פינגו'], supplier: 'pingo doce' },
  { keywords: ['decathlon', 'דקתלון', 'דיקטלון'], supplier: 'decathlon' },
  { keywords: ['arcadia', 'ארקדיה', 'ubbo'], supplier: 'arcadia' },
  { keywords: ['botequim', 'בוטקים', 'brasileira'], supplier: 'botequim a brasileira' },
  // מונומנטים / כניסות
  { keywords: ['cristo rei', 'כריסטו', 'cristo', 'אלמדה', 'almada'], supplier: 'cristo rei' },
  { keywords: ['parques de sintra', 'pena', 'פנה', 'פינה', 'מאורית', 'mourish'], supplier: 'parques de sintra' },
  // פורטו
  { keywords: ['teleférico', 'teleferico', 'gaia', 'רכבל'], supplier: 'teleferico de gaia' },
  // תחבורה
  { keywords: ['navegante', 'נווגנטה', 'מטרו', 'cp ', 'רכבת', 'metro'], supplier: 'transportation' },
  { keywords: ['transportation', 'תחבורה', 'אוטובוס', 'taxi', 'uber', 'bolt'], supplier: 'transportation' },
];

/**
 * מיפוי tour_type → Entity ברירת מחדל (כשאין התאמה לספק ספציפי).
 * הערכים מבוססים על המוסכמות בקשפלו האמיתי (כמו "food tour lisbon", "tasting tour porto").
 */
const TOUR_TYPE_TO_ENTITY: Record<string, string> = {
  'קלאסי_1': 'food tour lisbon',
  'בלם_1': 'belem tour',
  'סינטרה': 'sintra tour',
  'אראבידה': 'arrabida tour',
  'אובידוש': 'obidos tour',
  'קולינרי': 'culinary tour lisbon',
  'פרטי_1': 'private tour lisbon',
  'פורטו_1': 'porto classic',
  'טעימות': 'tasting tour porto',
  'דורו': 'douro tour',
  'פרטי_2': 'private tour porto',
};

/** ממפה שם מדריך עברי → first name באנגלית קטנה (לעמודת Description בקשפלו) */
const GUIDE_NAME_LC: Record<string, string> = {
  'אביב': 'aviv',
  'יניב': 'yaniv',
  'מאיה': 'maya',
  'מני': 'meni',
  'תום': 'tom',
  'דותן': 'dotan',
  'עומר הבן': 'omer',
  'ניר': 'nir',
  'רונה': 'rona',
};

/** מחזיר first name באנגלית קטנה לפי שם מלא בעברית (או תרגום best-effort) */
export function guideFirstNameLc(fullName: string): string {
  if (!fullName) return '';
  // קודם — האם השם המלא מתחיל באחד השמות הידועים?
  for (const [he, en] of Object.entries(GUIDE_NAME_LC)) {
    if (fullName.startsWith(he)) return en;
  }
  // fallback — מילה ראשונה lowercase
  return (fullName.split(/\s+/)[0] || fullName).toLowerCase().trim();
}

/**
 * מחזיר את ה-Entity הצפוי בקשפלו לפי הפריט/הערות/סוג סיור.
 * עדיפויות:
 *   1. התאמת keyword לספק ספציפי (Pastéis, JMF, וכו') — הכי בטוח
 *   2. tour_type כידוע (food tour lisbon, sintra tour, וכו')
 *   3. null — לא הצלחנו לקבוע ↔ אומר fallback ל-item raw
 */
export function deriveEntity(item: string | null, notes: string | null, tourType: string | null): string | null {
  const blob = `${item || ''} ${notes || ''}`.toLowerCase();
  if (blob.trim()) {
    for (const m of SUPPLIER_KEYWORDS) {
      if (m.keywords.some((k) => blob.includes(k.toLowerCase()))) {
        return m.supplier;
      }
    }
  }
  if (tourType && TOUR_TYPE_TO_ENTITY[tourType]) {
    return TOUR_TYPE_TO_ENTITY[tourType];
  }
  return null;
}

/** Alias לשם הישן — נותר לתמיכה לאחור (קוד אחר עשוי לקרוא לזה) */
export function guessSupplier(item: string | null, notes: string | null): string | null {
  return deriveEntity(item, notes, null);
}

/** אצוות עדכון: מילוי אוטומטי של supplier_name להוצאות שיש להן ניחוש בטוח. */
async function autoFillGuessedSuppliers(
  rows: { id: string; supplier_name: string | null; suggested: string | null }[]
): Promise<Map<string, string>> {
  const applied = new Map<string, string>();
  const toUpdate = rows.filter((r) => !r.supplier_name && r.suggested);
  if (toUpdate.length === 0) return applied;
  // עדכון פר-שורה (במקום .in() שלא תומך בערכים שונים)
  await Promise.all(
    toUpdate.map(async (r) => {
      const { error } = await supabase
        .from('expenses')
        .update({ supplier_name: r.suggested })
        .eq('id', r.id);
      if (!error && r.suggested) applied.set(r.id, r.suggested);
    })
  );
  return applied;
}

/** שם פרטי באנגלית קטנה לעמודת Description בהפקדות (= מה שיופיע בקשפלו האמיתי) */
function depositFirstNameLc(name: string): string {
  return guideFirstNameLc(name);
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

    // הוצאות בכל החודש (כולל is_admin_added) + הצטרפות לקטלוג לקבלת requires_receipt
    (async () => {
      const primary = await supabase
        .from('expenses')
        .select('id, guide_id, expense_date, item, amount, notes, receipt_url, tour_type, supplier_name, receipt_number, cashflow_category, is_admin_added, catalog_item_id, expense_catalog(item_name, requires_receipt)')
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

    // הפקדות לבנק שתאריך ההפקדה בפועל בחודש זה.
    // effective_date = COALESCE(settled_at, transfer_date).
    // OR: (settled_at NULL AND transfer_date in month) OR (settled_at in month).
    // pending unsettled (is_pending_deposit=true) → לא נכלל בקשפלו (הכסף עוד לא בבנק).
    (async () => {
      const primary = await supabase
        .from('transfers')
        .select('id, transfer_date, settled_at, guide_id, amount, notes, is_pending_deposit')
        .eq('transfer_type', 'to_portugo')
        .or(`and(settled_at.is.null,transfer_date.gte.${start},transfer_date.lte.${end}),and(settled_at.gte.${start},settled_at.lte.${end})`)
        .order('transfer_date');
      if (!primary.error) return primary;
      // עמודת settled_at עוד לא קיימת → fallback לפי transfer_date בלבד
      return supabase
        .from('transfers')
        .select('id, transfer_date, guide_id, amount, notes, is_pending_deposit')
        .eq('transfer_type', 'to_portugo')
        .gte('transfer_date', start)
        .lte('transfer_date', end)
        .order('transfer_date');
    })(),

    // קבלות מס — STRICT: רק קבלות עם invoice_date בחודש הקשפלו הזה.
    // קבלות עם invoice_date NULL נטענות בנפרד (unscheduledInvoicesRes).
    (async () => {
      const primary = await supabase
        .from('receipt_acknowledgements')
        .select('id, guide_id, year, month, acknowledged_at, receipt_url, invoice_date')
        .gte('invoice_date', start)
        .lte('invoice_date', end);
      if (!primary.error) return primary;
      // אם invoice_date עוד לא קיים בכלל → אין מה להציג בחודש הזה
      return { data: [], error: null };
    })(),

    // משכורות (לחישוב הסכום של כל Fatura-Recibo) — חלון רחב כדי לתפוס
    // קבלות שהוצאו בחודש הקשפלו עבור חודשי עבודה קודמים.
    (async () => {
      const back = new Date(year, month - 4, 1);
      const fwd = new Date(year, month, 0); // סוף חודש הקשפלו
      const wideStart = `${back.getFullYear()}-${String(back.getMonth() + 1).padStart(2, '0')}-01`;
      const wideEnd = `${fwd.getFullYear()}-${String(fwd.getMonth() + 1).padStart(2, '0')}-${String(fwd.getDate()).padStart(2, '0')}`;
      return supabase
        .from('transfers')
        .select('guide_id, transfer_date, amount')
        .eq('transfer_type', 'salary_withdrawal')
        .gte('transfer_date', wideStart)
        .lte('transfer_date', wideEnd);
    })(),
  ]);

  // קבלות מס ללא תאריך הוצאת חשבונית — מכל החודשים (Omer צריכה לשייך אותן)
  const unscheduledInvoicesRes = await supabase
    .from('receipt_acknowledgements')
    .select('id, guide_id, year, month, acknowledged_at, receipt_url, invoice_date')
    .is('invoice_date', null);

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
    catalog_item_id?: string | null;
    expense_catalog?: { item_name: string | null; requires_receipt: boolean | null } | null;
  };
  // שלב א': עיבוד ראשוני וניחוש Entity (ספק / סוג סיור / לפי מילות מפתח)
  const rawExpenses = ((expensesRes.data || []) as RawExpense[]).map((e) => ({
    raw: e,
    suggested: e.supplier_name ? null : deriveEntity(e.item, e.notes, e.tour_type ?? null),
  }));

  // שלב ב': מילוי אוטומטי של ניחושים ב-DB (silently — בלי שעומר תאשר)
  const autoApplied = await autoFillGuessedSuppliers(
    rawExpenses.map(({ raw, suggested }) => ({
      id: raw.id,
      supplier_name: raw.supplier_name ?? null,
      suggested,
    }))
  );

  // שלב ג': מיפוי לטיפוס הסופי — הספק שנשמר עכשיו הוא ה"שמור" החדש
  const expenses: CashflowExpense[] = rawExpenses.map(({ raw: e, suggested }) => {
    const cat = (e.cashflow_category as 'regular' | 'multibanco' | 'excluded') || 'regular';
    const isAdmin = !!e.is_admin_added;
    const guideName = isAdmin ? 'אדמין' : guideById.get(e.guide_id || '')?.name || '—';
    const supplier = e.supplier_name ?? autoApplied.get(e.id) ?? null;
    const suspectMb = cat === 'regular' && looksLikeMultibanco(e.item, e.notes, supplier);
    const catalogReq = e.expense_catalog?.requires_receipt ?? null;
    const catalogItemName = e.expense_catalog?.item_name ?? null;
    return {
      id: e.id,
      expense_date: e.expense_date,
      guide_id: e.guide_id,
      guide_name: guideName,
      item: e.item || '',
      amount: Number(e.amount),
      notes: e.notes,
      receipt_url: e.receipt_url,
      supplier_name: supplier,
      suggested_supplier: supplier ? null : suggested,
      receipt_number: e.receipt_number ?? null,
      cashflow_category: cat,
      is_admin_added: isAdmin,
      tour_type: e.tour_type,
      multibanco_suspect: suspectMb,
      catalog_requires_receipt: catalogReq,
      catalog_item_name: catalogItemName,
    };
  });

  // --- deposits — נפרדים ל-pending (לא בקשפלו) ולשאר (בקשפלו)
  type RawTransfer = {
    id: string;
    transfer_date: string;
    settled_at?: string | null;
    guide_id: string;
    amount: number;
    notes: string | null;
    is_pending_deposit: boolean | null;
  };
  const depositsAll = (depositsRes.data || []) as RawTransfer[];
  const deposits: CashflowDeposit[] = [];
  const pendingDeposits: CashflowDeposit[] = [];
  for (const t of depositsAll) {
    const gName = guideById.get(t.guide_id)?.name || '—';
    const settled = t.settled_at ?? null;
    const effective = settled || t.transfer_date;
    const row: CashflowDeposit = {
      id: t.id,
      transfer_date: t.transfer_date,
      settled_at: settled,
      effective_date: effective,
      guide_id: t.guide_id,
      guide_name: gName,
      guide_first_name_lc: depositFirstNameLc(gName),
      amount: Number(t.amount),
      notes: t.notes,
    };
    if (t.is_pending_deposit) {
      pendingDeposits.push(row);
    } else {
      deposits.push(row);
    }
  }
  deposits.sort((a, b) => a.effective_date.localeCompare(b.effective_date));

  // --- salary invoices
  // ממפה: guide_id+year+month → amount של salary_withdrawal של אותו חודש עבודה
  const salaryByGuideMonth = new Map<string, number>();
  for (const s of (salaryTransfersRes.data || []) as { guide_id: string; transfer_date: string; amount: number }[]) {
    const dt = new Date(s.transfer_date);
    const key = `${s.guide_id}_${dt.getFullYear()}_${dt.getMonth() + 1}`;
    if (!salaryByGuideMonth.has(key)) {
      salaryByGuideMonth.set(key, Number(s.amount));
    }
  }

  type RawAck = { id: string; guide_id: string; year: number; month: number; acknowledged_at: string; receipt_url: string | null; invoice_date?: string | null };

  function mapInvoice(a: RawAck): CashflowSalaryInvoice {
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
  }

  const salaryInvoices: CashflowSalaryInvoice[] = ((ackRes.data || []) as RawAck[]).map(mapInvoice);
  const unscheduledInvoices: CashflowSalaryInvoice[] = unscheduledInvoicesRes.error
    ? []
    : ((unscheduledInvoicesRes.data || []) as RawAck[]).map(mapInvoice);

  // --- summaries
  const totalRegularOutflow = expenses
    .filter((e) => e.cashflow_category === 'regular')
    .reduce((s, e) => s + e.amount, 0);
  const totalDeposits = deposits.reduce((s, d) => s + d.amount, 0);
  const totalSalaries = salaryInvoices.reduce((s, i) => s + (i.amount || 0), 0);

  // flagged: חשד מולטיבנקו, חסרה תמונת קבלה (להוצאות לא is_admin_added),
  // קבלות ללא תאריך הוצאת חשבונית, הפקדות ממתינות שעדיין לא הופקדו
  // "חסרה קבלה" רק אם הקטלוג דורש קבלה (catalog_requires_receipt !== false).
  // פריטי free-text (catalog_requires_receipt = null) — דורשים קבלה כברירת מחדל.
  const flaggedCount = expenses.filter((e) => e.multibanco_suspect).length
    + expenses.filter((e) => !e.is_admin_added && !e.receipt_url && e.catalog_requires_receipt !== false).length
    + unscheduledInvoices.length
    + pendingDeposits.length
    + salaryInvoices.filter((i) => i.amount === null).length;

  return {
    year,
    month,
    expenses,
    pendingDeposits,
    unscheduledInvoices,
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

/** עדכון תאריך הפקדה בפועל של transfer (לעקוף את transfer_date כשההפקדה הייתה אחר כך) */
export async function updateTransferSettledAt(transferId: string, settledAt: string | null): Promise<void> {
  const { error } = await supabase
    .from('transfers')
    .update({ settled_at: settledAt })
    .eq('id', transferId);
  if (error) throw error;
}

/** מחזיר את היתרה הסוגרת של חודש קודם (= I12 בגליון של החודש הזה) — אם קיימת. */
export async function loadPreviousFinalBalance(year: number, month: number): Promise<number | null> {
  // מחפש את הרצת הקשפלו האחרונה לחודש ה-(month-1) של אותה שנה
  let prevYear = year;
  let prevMonth = month - 1;
  if (prevMonth === 0) {
    prevMonth = 12;
    prevYear -= 1;
  }
  const { data, error } = await supabase
    .from('cashflow_runs')
    .select('final_balance')
    .eq('year', prevYear)
    .eq('month', prevMonth)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    if (error.message?.toLowerCase().includes('cashflow_runs')) return null;
    return null;
  }
  return (data?.final_balance ?? null) as number | null;
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
