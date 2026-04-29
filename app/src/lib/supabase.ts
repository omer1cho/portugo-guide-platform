import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// הגדרות auth מפורשות:
// - persistSession: שומר את הסשן ב-localStorage בין רענונים/סגירות דפדפן
// - autoRefreshToken: מחדש את ה-JWT אוטומטית לפני שתוקפו פג (סשן ל-90 יום)
// - detectSessionInUrl: ה-SDK שולף tokens אוטומטית מ-URL hash (זרימת implicit)
// - flowType=implicit: הזרימה הקלאסית, tokens מועברים ב-#hash. עובד **בין דפדפנים** —
//   זה קריטי כשמדריכים פותחים את הקישור באפליקציית Gmail/מייל בנייד, שמשגרת אותם
//   לדפדפן פנימי שונה מהדפדפן המקורי שבו הזינו את המייל. PKCE היה שובר את זה כי
//   ה-code_verifier נשמר ב-localStorage של הדפדפן המקורי בלבד.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: 'implicit',
  },
});

// Types matching our DB schema
export type Guide = {
  id: string;
  name: string;
  city: 'lisbon' | 'porto';
  travel_type: 'monthly' | 'daily';
  has_vat: boolean;
  has_mgmt_bonus: boolean;
  mgmt_bonus_amount: number;
  is_admin: boolean;
  /** ההפרשה לפורטוגו לראש משלם בסיורי קלאסי. ותיקים: 10€, מדריכים חדשים מאמצע 2026: 11€ */
  classic_transfer_per_person: number;
  /** יתרת פתיחה במעטפת עודף — הכסף שהמדריך נכנס איתו למערכת. ברירת מחדל 0. */
  opening_change_balance?: number;
  /** יתרת פתיחה במעטפת הוצאות — הכסף שהמדריך נכנס איתו למערכת. ברירת מחדל 0. */
  opening_expenses_balance?: number;
};

export type Tour = {
  id: string;
  guide_id: string;
  tour_date: string;
  tour_type: string;
  category: 'classic' | 'fixed' | 'private' | 'other';
  notes: string;
  /** קישור לתמונת הסיור ב-Supabase Storage (באקט tour-photos) */
  photo_url?: string | null;
  /** True אם המדריך בחר במפורש לא לצרף תמונה (לדוח חודשי) */
  photo_skipped?: boolean | null;
};

export type Expense = {
  id: string;
  guide_id: string;
  expense_date: string;
  item: string;
  amount: number;
  notes: string;
  /** קישור לקבלה ב-Supabase Storage (באקט expense-receipts) */
  receipt_url?: string | null;
  /** סוג הסיור שאליו ההוצאה שייכת — לארגון תיקיית הקבלות */
  tour_type?: string | null;
  /** מקושר לפריט בקטלוג (null = "אחר" או הוצאה ישנה) */
  catalog_item_id?: string | null;
  /** כמות (יחידות / אנשים) — רק לפריטים מקטגוריה unit/per_person */
  quantity?: number | null;
  /** הסכום הצפוי לפי הקטלוג (quantity × unit_price) */
  expected_amount?: number | null;
  /** דגל: הסכום בפועל לא תאם את הצפוי — דורש בדיקה */
  price_mismatch?: boolean | null;
};

/** סוג חישוב להוצאה בקטלוג */
export type ExpenseCalcType = 'unit' | 'per_person' | 'manual_amount';

export type ExpenseCatalogItem = {
  id: string;
  tour_type: string;
  item_name: string;
  /** unit = כפול כמות, per_person = כפול מס' אנשים, manual_amount = ידני */
  calc_type: ExpenseCalcType;
  unit_price: number | null;
  sort_order: number;
  is_active: boolean;
};

/** סוגי הסיורים שיש להם קטלוג הוצאות (השאר ילכו רק ל"אחר") */
export const TOURS_WITH_EXPENSE_CATALOG = new Set([
  'בלם_1',
  'קולינרי',
  'אובידוש',
  'אראבידה',
  'טעימות',
  'דורו',
]);

export type Booking = {
  id: string;
  tour_id: string;
  people: number;
  kids: number;
  price: number;
  tip: number;
  customer_type: string;
  source: string;
  notes: string;
};

// Tour types available in dropdowns
export const TOUR_TYPES = {
  lisbon: [
    { value: 'קלאסי_1', label: 'ליסבון הקלאסית', category: 'classic' as const },
    { value: 'בלם_1', label: 'בלם', category: 'fixed' as const },
    { value: 'סינטרה', label: 'סינטרה', category: 'fixed' as const },
    { value: 'אראבידה', label: 'אראבידה', category: 'fixed' as const },
    { value: 'אובידוש', label: 'אובידוש', category: 'fixed' as const },
    { value: 'קולינרי', label: 'קולינרי', category: 'fixed' as const },
    { value: 'פרטי_1', label: 'סיור פרטי (ליסבון)', category: 'private' as const },
  ],
  porto: [
    { value: 'פורטו_1', label: 'פורטו הקלאסית', category: 'classic' as const },
    { value: 'טעימות', label: 'סיור טעימות', category: 'fixed' as const },
    { value: 'דורו', label: 'עמק הדורו', category: 'fixed' as const },
    { value: 'פרטי_2', label: 'סיור פרטי (פורטו)', category: 'private' as const },
  ],
};

export const CUSTOMER_TYPES = [
  'זוג מבוגר',
  'זוג צעיר',
  'משפחה',
  'חברים/חברות',
  'בודד/ה',
  'אחר',
];

export const SOURCES = [
  'מזדמן',
  'גוגל',
  'לקוח חוזר',
  'המלצה מחבר',
  'בינה מלאכותית',
  'שדה תעופה',
  'פלייר במלון',
  'אינסטגרם',
  'פייסבוק',
  'סוכנות בארץ',
  'חב"ד',
  'נתקלו בנו בכיכר',
  'אחר',
];

// =============================================================================
// "העברתי הכשרה" — שכר על הכשרות מצד מדריך בכיר
// =============================================================================

/** רשימת מדריכים בכירים שיכולים להעביר הכשרות (תצפות / נסיון דפים) */
export const SENIOR_TRAINING_GUIDES = ['אביב', 'מאיה', 'תום', 'דותן'];

/** סוג ההכשרה שהמדריך הבכיר מעביר */
export type TrainingLeadKind = 'paper' | 'observation';

/** קבוצות סיורים לצורך תעריף ההכשרה */
export type TrainingLeadTour =
  | 'classic'    // ליסבון הקלאסית / פורטו הקלאסית
  | 'culinary'   // קולינרי
  | 'tastings'   // טעימות
  | 'belem'      // בלם
  | 'sintra'     // סינטרה / אובידוש / אראבידה
  | 'douro';     // דורו

export const TRAINING_LEAD_TOUR_OPTIONS: { value: TrainingLeadTour; label: string }[] = [
  { value: 'classic',  label: 'ליסבון / פורטו הקלאסית' },
  { value: 'culinary', label: 'קולינרי' },
  { value: 'tastings', label: 'טעימות' },
  { value: 'belem',    label: 'בלם' },
  { value: 'sintra',   label: 'סינטרה / אראבידה / אובידוש' },
  { value: 'douro',    label: 'דורו' },
];

/** רשימת סיורים להכשרה — מסוננת לפי עיר המדריך */
export const TRAINING_LEAD_TOUR_OPTIONS_BY_CITY: Record<
  'lisbon' | 'porto',
  { value: TrainingLeadTour; label: string }[]
> = {
  lisbon: [
    { value: 'classic',  label: 'ליסבון הקלאסית' },
    { value: 'belem',    label: 'בלם' },
    { value: 'culinary', label: 'קולינרי' },
    { value: 'sintra',   label: 'סינטרה / אראבידה / אובידוש' },
  ],
  porto: [
    { value: 'classic',  label: 'פורטו הקלאסית' },
    { value: 'tastings', label: 'טעימות' },
    { value: 'douro',    label: 'דורו' },
  ],
};

/** סיורים שהם יום עבודה מלא (זכאים לאשל) */
const TRAINING_LEAD_FULL_DAY: Set<TrainingLeadTour> = new Set(['sintra', 'douro']);

/** טבלת תעריפים — בסיס בלבד, לפני אשל. אשל מתווסף בנפרד למי שעובד יום מלא. */
const TRAINING_LEAD_BASE: Record<TrainingLeadKind, Record<TrainingLeadTour, number>> = {
  paper: {
    classic: 45,
    culinary: 45,
    tastings: 45,
    belem: 40,
    sintra: 55,
    douro: 60,
  },
  observation: {
    classic: 70,
    culinary: 70,
    tastings: 70,
    belem: 60,
    sintra: 95,
    douro: 95,
  },
};

/** מחזיר את שכר הבסיס של הכשרה שהמדריך העביר (לא כולל אשל). */
export function trainingLeadBase(kind: TrainingLeadKind, tour: TrainingLeadTour): number {
  return TRAINING_LEAD_BASE[kind][tour];
}

/** האם הסיור נחשב יום עבודה מלא (זכאי לאשל)? */
export function trainingLeadIsFullDay(tour: TrainingLeadTour): boolean {
  return TRAINING_LEAD_FULL_DAY.has(tour);
}

/** תווית קצרה בעברית לסוג ההכשרה */
export function trainingLeadKindLabel(kind: TrainingLeadKind): string {
  return kind === 'paper' ? 'נסיון דפים' : 'תצפות';
}
