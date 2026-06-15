/**
 * Pricing validation — סיורים פרטיים
 * מקור: project_pricing_private_tables.md (אושר 12-15/5/26)
 *
 * הקובץ מכיל את כל הטבלאות המאושרות לסיורים הפרטיים:
 *   1. מחיר רגיל (לפי קטגוריות גודל קבוצה)
 *   2. אופציה מקוצרת (רק קלאסי)
 *   3. תוספת רכב (פרדאוטו worst case — רק קלאסי/בלם)
 *   4. שילובים (4 רגילים + 3 מקוצרים — רק בכרטיס הראשי)
 *   5. תמחור ילדים (לכל סוג סיור)
 *
 * המבנה data-only כדי שגם דף הצפייה (סקציה רביעית ב-/admin/pricing-validation)
 * וגם מערכת הצעות המחיר העתידית (שלב 2) יוכלו לקרוא ממנו.
 */

// ─── טבלת מחיר פרטי לפי קטגוריות ───
export type PrivateTierRow = {
  minSize: number;
  maxSize: number;
  pricePerPerson: number;        // €/אדם
};

export type PrivatePriceTable = {
  label: string;                 // "מחיר רגיל" / "מחיר מקוצר"
  rows: PrivateTierRow[];
};

// ─── תוספת רכב ───
// מחיר רכב קבוע (לפי גודל קבוצה). חלוקה לאדם נעשית דינמית (cost ÷ N בפועל).
export type CarTierRow = {
  groupSizeLabel: string;        // "2" / "3-7" / "8" / "35+"
  vehicleLabel: string;          // "Classe E" / "16 מקומות"
  cost: number | null;           // null = "הצעה נפרדת" (35+)
};

export type CarAddonTable = {
  label: string;                 // "חצי יום (סיור בודד)" / "יום מלא (קלאסי + בלם)"
  rows: CarTierRow[];
};

// ─── שילובים ───
export type ComboTierRow = {
  minSize: number;
  maxSize: number;
  parts: { name: string; price: number }[];  // [{name: "קלאסי", price: 65}, {name: "בלם", price: 35}]
  totalPerPerson: number;        // 100€
};

export type ComboTable = {
  slug: string;
  name: string;                  // "קלאסי + בלם"
  city: string;                  // "ליסבון" / "פורטו"
  maxParticipants: number;
  isShort?: boolean;             // true = קלאסי מקוצר
  rows: ComboTierRow[];
};

// ─── תמחור ילדים ───
// שני מבנים אפשריים:
//   A. לפי קטגוריות גודל (מתאים לקלאסי+בלם פרטי — מחיר ילד = % מהמחיר הרגיל)
//   B. לפי עמודות גמישות (מתאים לסיורים אחרים — מחירים קבועים שונים לפי רגיל/חבילה/פרטי)

// מבנה A — לפי קטגוריות (חדש)
export type ChildrenRule =
  | { kind: 'free'; note?: string }                        // חינם
  | { kind: 'fullPrice'; note?: string }                   // מחיר מלא
  | { kind: 'halfOfRegular'; round?: 'nearest' | 'floor' } // חצי מהמחיר הרגיל באותה קטגוריה
  | { kind: 'fixedPrice'; price: number };                 // מחיר קבוע (כל הקטגוריות)

export type ChildrenAgeRow = {
  ageLabel: string;        // "עד 6"
  rule: ChildrenRule;
};

// מבנה B — עמודות גמישות (קיים)
export type ChildrenPriceColumn = {
  header: string;                // "רגיל" / "חבילה" / "פרטי"
  values: (string | number)[];   // עבור כל age range, או "חינם" או מחיר €
};

export type ChildrenPriceTable = {
  // אופציה A: לפי קטגוריה של המחיר הרגיל
  perTier?: ChildrenAgeRow[];

  // אופציה B: עמודות גמישות
  ageLabels?: string[];
  columns?: ChildrenPriceColumn[];

  note?: string;
};

// ─── הכרטיס המלא ───
export type PrivateTour = {
  slug: string;
  name: string;                  // "קלאסי (ליסבון = פורטו)"
  priceInfo: string;
  priceInfoExtra?: string;
  maxParticipants: number;

  // 1. מחיר רגיל — חובה
  regularPrice: PrivatePriceTable;

  // 2. אופציה מקוצרת — אופציונלי (רק קלאסי)
  shortPrice?: PrivatePriceTable;

  // 3. תוספת רכב — אופציונלי (רק קלאסי, בלם). carAddons = ליסבון (פרדאוטו).
  carAddons?: CarAddonTable[];
  carAddonsPorto?: CarAddonTable[]; // רכב לפורטו הקלאסית (ספק ז'ורז', שונה מליסבון)
  carNote?: string;              // אזהרה/הסבר על worst case

  // 4. שילובים — אופציונלי (רק בכרטיס הראשי)
  combos?: ComboTable[];

  // 5. תמחור ילדים — חובה
  children: ChildrenPriceTable;

  // 6. הערות מיוחדות (למשל אזהרת ספק בדורו)
  warning?: string;
};

// ═══════════════════════════════════════════════════════════════════════════
// כרטיס 1: קלאסי פרטי (ליסבון = פורטו)
// ═══════════════════════════════════════════════════════════════════════════

const CLASSIC_REGULAR_ROWS: PrivateTierRow[] = [
  { minSize: 2, maxSize: 2, pricePerPerson: 65 },
  { minSize: 3, maxSize: 4, pricePerPerson: 55 },
  { minSize: 5, maxSize: 7, pricePerPerson: 45 },
  { minSize: 8, maxSize: 11, pricePerPerson: 40 },
  { minSize: 12, maxSize: 15, pricePerPerson: 35 },
  { minSize: 16, maxSize: 22, pricePerPerson: 30 },
  { minSize: 23, maxSize: 27, pricePerPerson: 25 },
  { minSize: 28, maxSize: 30, pricePerPerson: 20 },
  { minSize: 31, maxSize: 35, pricePerPerson: 18 },
  { minSize: 36, maxSize: 45, pricePerPerson: 15 },
];

const CLASSIC_SHORT_ROWS: PrivateTierRow[] = [
  { minSize: 2, maxSize: 2, pricePerPerson: 45 },
  { minSize: 3, maxSize: 4, pricePerPerson: 35 },
  { minSize: 5, maxSize: 7, pricePerPerson: 30 },
  { minSize: 8, maxSize: 11, pricePerPerson: 25 },
  { minSize: 12, maxSize: 15, pricePerPerson: 22 },
  { minSize: 16, maxSize: 22, pricePerPerson: 20 },
  { minSize: 23, maxSize: 27, pricePerPerson: 15 },
  { minSize: 28, maxSize: 30, pricePerPerson: 14 },
  { minSize: 31, maxSize: 35, pricePerPerson: 12 },
  { minSize: 36, maxSize: 45, pricePerPerson: 10 },
];

// תוספת רכב לסיור בעיר — חצי יום (סיור בודד: קלאסי או בלם)
const CAR_HALF_DAY_ROWS: CarTierRow[] = [
  { groupSizeLabel: '2', vehicleLabel: 'Classe E (סדאן פרטי)', cost: 194 },
  { groupSizeLabel: '3-7', vehicleLabel: 'רכב 6/7 (ואן)', cost: 252 },
  { groupSizeLabel: '8', vehicleLabel: 'ספרינטר 8', cost: 284 },
  { groupSizeLabel: '9-15', vehicleLabel: '16 מקומות', cost: 315 },
  { groupSizeLabel: '16-25', vehicleLabel: '19/25 מקומות', cost: 331 },
  { groupSizeLabel: '26-34', vehicleLabel: '34 מקומות', cost: 362 },
  { groupSizeLabel: '35+', vehicleLabel: 'שני רכבים — הצעה נפרדת', cost: null },
];

// תוספת רכב לשילוב קלאסי+בלם — יום מלא
const CAR_FULL_DAY_ROWS: CarTierRow[] = [
  { groupSizeLabel: '2', vehicleLabel: 'Classe E (סדאן פרטי)', cost: 252 },
  { groupSizeLabel: '3-7', vehicleLabel: 'רכב 6/7 (ואן)', cost: 315 },
  { groupSizeLabel: '8', vehicleLabel: 'ספרינטר 8', cost: 357 },
  { groupSizeLabel: '9-15', vehicleLabel: '16 מקומות', cost: 378 },
  { groupSizeLabel: '16-25', vehicleLabel: '19/25 מקומות', cost: 399 },
  { groupSizeLabel: '26-34', vehicleLabel: '34 מקומות', cost: 473 },
  { groupSizeLabel: '35+', vehicleLabel: 'שני רכבים — הצעה נפרדת', cost: null },
];

// תוספת רכב לפורטו הקלאסית — חצי יום (ספק ז'ורז', worst case)
// מקור: ספקי רכבים פורטו.docx. מעל 7 אין מחיר חצי-יום בפורטו — חסום (הצעה נפרדת).
const CAR_HALF_DAY_PORTO_ROWS: CarTierRow[] = [
  { groupSizeLabel: '2', vehicleLabel: 'רכב פרטי', cost: 150 },
  { groupSizeLabel: '3-7', vehicleLabel: 'וואן (עד 7)', cost: 190 },
  { groupSizeLabel: '8+', vehicleLabel: 'אין מחיר חצי-יום בפורטו — הצעה נפרדת', cost: null },
];

// שילוב א: קלאסי + בלם
const COMBO_CLASSIC_BELEM_REGULAR: ComboTierRow[] = [
  { minSize: 2, maxSize: 2, parts: [{ name: 'קלאסי', price: 65 }, { name: 'בלם', price: 35 }], totalPerPerson: 100 },
  { minSize: 3, maxSize: 4, parts: [{ name: 'קלאסי', price: 55 }, { name: 'בלם', price: 32 }], totalPerPerson: 87 },
  { minSize: 5, maxSize: 7, parts: [{ name: 'קלאסי', price: 45 }, { name: 'בלם', price: 28 }], totalPerPerson: 73 },
  { minSize: 8, maxSize: 11, parts: [{ name: 'קלאסי', price: 40 }, { name: 'בלם', price: 25 }], totalPerPerson: 65 },
  { minSize: 12, maxSize: 15, parts: [{ name: 'קלאסי', price: 35 }, { name: 'בלם', price: 22 }], totalPerPerson: 57 },
  { minSize: 16, maxSize: 22, parts: [{ name: 'קלאסי', price: 30 }, { name: 'בלם', price: 20 }], totalPerPerson: 50 },
  { minSize: 23, maxSize: 27, parts: [{ name: 'קלאסי', price: 25 }, { name: 'בלם', price: 18 }], totalPerPerson: 43 },
  { minSize: 28, maxSize: 30, parts: [{ name: 'קלאסי', price: 20 }, { name: 'בלם', price: 18 }], totalPerPerson: 38 },
  { minSize: 31, maxSize: 35, parts: [{ name: 'קלאסי', price: 18 }, { name: 'בלם', price: 16 }], totalPerPerson: 34 },
];

const COMBO_CLASSIC_BELEM_SHORT: ComboTierRow[] = [
  { minSize: 2, maxSize: 2, parts: [{ name: 'קלאסי מקוצר', price: 45 }, { name: 'בלם', price: 35 }], totalPerPerson: 80 },
  { minSize: 3, maxSize: 4, parts: [{ name: 'קלאסי מקוצר', price: 35 }, { name: 'בלם', price: 32 }], totalPerPerson: 67 },
  { minSize: 5, maxSize: 7, parts: [{ name: 'קלאסי מקוצר', price: 30 }, { name: 'בלם', price: 28 }], totalPerPerson: 58 },
  { minSize: 8, maxSize: 11, parts: [{ name: 'קלאסי מקוצר', price: 25 }, { name: 'בלם', price: 25 }], totalPerPerson: 50 },
  { minSize: 12, maxSize: 15, parts: [{ name: 'קלאסי מקוצר', price: 22 }, { name: 'בלם', price: 22 }], totalPerPerson: 44 },
  { minSize: 16, maxSize: 22, parts: [{ name: 'קלאסי מקוצר', price: 20 }, { name: 'בלם', price: 20 }], totalPerPerson: 40 },
  { minSize: 23, maxSize: 27, parts: [{ name: 'קלאסי מקוצר', price: 15 }, { name: 'בלם', price: 18 }], totalPerPerson: 33 },
  { minSize: 28, maxSize: 30, parts: [{ name: 'קלאסי מקוצר', price: 14 }, { name: 'בלם', price: 18 }], totalPerPerson: 32 },
  { minSize: 31, maxSize: 35, parts: [{ name: 'קלאסי מקוצר', price: 12 }, { name: 'בלם', price: 16 }], totalPerPerson: 28 },
];

// שילוב ב: קלאסי + קולינרי
const COMBO_CLASSIC_CULINARY_REGULAR: ComboTierRow[] = [
  { minSize: 2, maxSize: 2, parts: [{ name: 'קלאסי', price: 65 }, { name: 'קולינרי', price: 85 }], totalPerPerson: 150 },
  { minSize: 3, maxSize: 4, parts: [{ name: 'קלאסי', price: 55 }, { name: 'קולינרי', price: 80 }], totalPerPerson: 135 },
  { minSize: 5, maxSize: 7, parts: [{ name: 'קלאסי', price: 45 }, { name: 'קולינרי', price: 75 }], totalPerPerson: 120 },
  { minSize: 8, maxSize: 11, parts: [{ name: 'קלאסי', price: 40 }, { name: 'קולינרי', price: 72 }], totalPerPerson: 112 },
  { minSize: 12, maxSize: 15, parts: [{ name: 'קלאסי', price: 35 }, { name: 'קולינרי', price: 70 }], totalPerPerson: 105 },
  { minSize: 16, maxSize: 18, parts: [{ name: 'קלאסי', price: 30 }, { name: 'קולינרי', price: 67 }], totalPerPerson: 97 },
];

const COMBO_CLASSIC_CULINARY_SHORT: ComboTierRow[] = [
  { minSize: 2, maxSize: 2, parts: [{ name: 'קלאסי מקוצר', price: 45 }, { name: 'קולינרי', price: 85 }], totalPerPerson: 130 },
  { minSize: 3, maxSize: 4, parts: [{ name: 'קלאסי מקוצר', price: 35 }, { name: 'קולינרי', price: 80 }], totalPerPerson: 115 },
  { minSize: 5, maxSize: 7, parts: [{ name: 'קלאסי מקוצר', price: 30 }, { name: 'קולינרי', price: 75 }], totalPerPerson: 105 },
  { minSize: 8, maxSize: 11, parts: [{ name: 'קלאסי מקוצר', price: 25 }, { name: 'קולינרי', price: 72 }], totalPerPerson: 97 },
  { minSize: 12, maxSize: 15, parts: [{ name: 'קלאסי מקוצר', price: 22 }, { name: 'קולינרי', price: 70 }], totalPerPerson: 92 },
  { minSize: 16, maxSize: 18, parts: [{ name: 'קלאסי מקוצר', price: 20 }, { name: 'קולינרי', price: 67 }], totalPerPerson: 87 },
];

// שילוב ד: קלאסי + טעימות פורטו (זהה מספרית לשילוב ב')
const COMBO_CLASSIC_TASTINGS_REGULAR: ComboTierRow[] = [
  { minSize: 2, maxSize: 2, parts: [{ name: 'קלאסי', price: 65 }, { name: 'טעימות', price: 85 }], totalPerPerson: 150 },
  { minSize: 3, maxSize: 4, parts: [{ name: 'קלאסי', price: 55 }, { name: 'טעימות', price: 80 }], totalPerPerson: 135 },
  { minSize: 5, maxSize: 7, parts: [{ name: 'קלאסי', price: 45 }, { name: 'טעימות', price: 75 }], totalPerPerson: 120 },
  { minSize: 8, maxSize: 11, parts: [{ name: 'קלאסי', price: 40 }, { name: 'טעימות', price: 72 }], totalPerPerson: 112 },
  { minSize: 12, maxSize: 15, parts: [{ name: 'קלאסי', price: 35 }, { name: 'טעימות', price: 70 }], totalPerPerson: 105 },
  { minSize: 16, maxSize: 18, parts: [{ name: 'קלאסי', price: 30 }, { name: 'טעימות', price: 67 }], totalPerPerson: 97 },
];

const COMBO_CLASSIC_TASTINGS_SHORT: ComboTierRow[] = [
  { minSize: 2, maxSize: 2, parts: [{ name: 'קלאסי מקוצר', price: 45 }, { name: 'טעימות', price: 85 }], totalPerPerson: 130 },
  { minSize: 3, maxSize: 4, parts: [{ name: 'קלאסי מקוצר', price: 35 }, { name: 'טעימות', price: 80 }], totalPerPerson: 115 },
  { minSize: 5, maxSize: 7, parts: [{ name: 'קלאסי מקוצר', price: 30 }, { name: 'טעימות', price: 75 }], totalPerPerson: 105 },
  { minSize: 8, maxSize: 11, parts: [{ name: 'קלאסי מקוצר', price: 25 }, { name: 'טעימות', price: 72 }], totalPerPerson: 97 },
  { minSize: 12, maxSize: 15, parts: [{ name: 'קלאסי מקוצר', price: 22 }, { name: 'טעימות', price: 70 }], totalPerPerson: 92 },
  { minSize: 16, maxSize: 18, parts: [{ name: 'קלאסי מקוצר', price: 20 }, { name: 'טעימות', price: 67 }], totalPerPerson: 87 },
];

const CLASSIC_PRIVATE: PrivateTour = {
  slug: 'classic-private',
  name: 'קלאסי פרטי (ליסבון = פורטו)',
  priceInfo: 'אותה טבלה לליסבון ופורטו · טווח 2-45 משתתפים · במחיר רגיל ובגרסה מקוצרת',
  priceInfoExtra: 'הסיור הקלאסי בגרסה הפרטית — לא free tour אלא תמחור פר-אדם לפי קטגוריות גודל. גרסת "מקוצר" ≈ 2/3 מהמלא ביחס ממוצע (67%).',
  maxParticipants: 45,
  regularPrice: {
    label: 'מחיר רגיל',
    rows: CLASSIC_REGULAR_ROWS,
  },
  shortPrice: {
    label: 'מחיר מקוצר (≈ 2/3 מהמלא)',
    rows: CLASSIC_SHORT_ROWS,
  },
  carAddons: [
    { label: 'חצי יום — סיור בודד (קלאסי בלבד)', rows: CAR_HALF_DAY_ROWS },
    { label: 'יום מלא — שילוב קלאסי + בלם', rows: CAR_FULL_DAY_ROWS },
  ],
  carAddonsPorto: [
    { label: 'חצי יום — פורטו הקלאסית', rows: CAR_HALF_DAY_PORTO_ROWS },
  ],
  carNote: 'ספק = פרדאוטו תמיד (worst case — מגן עלינו אם מורטה לא זמין באותו יום). מורטה זול ב-50-100€ בפועל, אז כשסוגרים מורטה — הפער הופך לרווח נוסף. הרכב נבחר כזול ביותר בפרדאוטו שמכיל את הקבוצה. חלוקה לאדם דינמית: עלות רכב ÷ מספר אנשים בפועל. בכל המחירים: +5% תוספת דלק פרדאוטו (תקף כל עוד דלק מעל 2€/ליטר).',
  combos: [
    {
      slug: 'combo-classic-belem',
      name: 'שילוב א: קלאסי + בלם',
      city: 'ליסבון',
      maxParticipants: 35,
      rows: COMBO_CLASSIC_BELEM_REGULAR,
    },
    {
      slug: 'combo-classic-belem-short',
      name: 'שילוב א-מקוצר: קלאסי מקוצר + בלם',
      city: 'ליסבון',
      maxParticipants: 35,
      isShort: true,
      rows: COMBO_CLASSIC_BELEM_SHORT,
    },
    {
      slug: 'combo-classic-culinary',
      name: 'שילוב ב: קלאסי + קולינרי',
      city: 'ליסבון',
      maxParticipants: 18,
      rows: COMBO_CLASSIC_CULINARY_REGULAR,
    },
    {
      slug: 'combo-classic-culinary-short',
      name: 'שילוב ב-מקוצר: קלאסי מקוצר + קולינרי',
      city: 'ליסבון',
      maxParticipants: 18,
      isShort: true,
      rows: COMBO_CLASSIC_CULINARY_SHORT,
    },
    {
      slug: 'combo-classic-tastings',
      name: 'שילוב ד: קלאסי + טעימות פורטו',
      city: 'פורטו',
      maxParticipants: 18,
      rows: COMBO_CLASSIC_TASTINGS_REGULAR,
    },
    {
      slug: 'combo-classic-tastings-short',
      name: 'שילוב ד-מקוצר: קלאסי מקוצר + טעימות פורטו',
      city: 'פורטו',
      maxParticipants: 18,
      isShort: true,
      rows: COMBO_CLASSIC_TASTINGS_SHORT,
    },
  ],
  children: {
    perTier: [
      { ageLabel: 'עד 6', rule: { kind: 'free', note: 'שקוף בקבוצה' } },
      { ageLabel: '7-12', rule: { kind: 'halfOfRegular', round: 'nearest' } },
      { ageLabel: '13+', rule: { kind: 'fullPrice' } },
    ],
    note: 'ילד עד 6 שקוף בקבוצה — לא משפיע על קטגוריית גודל (זוג + 2 ילדים עד 6 = משלמים כזוג). ילד 7-12 נספר ומשלם חצי מהמחיר/אדם של אותה קטגוריה. בקלאסי free tour הרגיל (לא פרטי) — אין מחיר ילד, רק טיפים.',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// כרטיס 2: בלם פרטי (ליסבון)
// ═══════════════════════════════════════════════════════════════════════════

const BELEM_REGULAR_ROWS: PrivateTierRow[] = [
  { minSize: 2, maxSize: 2, pricePerPerson: 35 },
  { minSize: 3, maxSize: 4, pricePerPerson: 32 },
  { minSize: 5, maxSize: 7, pricePerPerson: 28 },
  { minSize: 8, maxSize: 11, pricePerPerson: 25 },
  { minSize: 12, maxSize: 15, pricePerPerson: 22 },
  { minSize: 16, maxSize: 22, pricePerPerson: 20 },
  { minSize: 23, maxSize: 30, pricePerPerson: 18 },
  { minSize: 31, maxSize: 35, pricePerPerson: 16 },
];

const BELEM_PRIVATE: PrivateTour = {
  slug: 'belem-private',
  name: 'בלם פרטי (ליסבון)',
  priceInfo: 'מחיר רגיל בלבד (אין גרסה מקוצרת) · טווח 2-35 משתתפים',
  priceInfoExtra: 'מחיר רגיל 20€/אדם, חבילה 15€/אדם. הפרטי מתחיל ב-35€ בקבוצה קטנה ויורד עד 16€ בקבוצה הגדולה (~חבילה).',
  maxParticipants: 35,
  regularPrice: {
    label: 'מחיר רגיל',
    rows: BELEM_REGULAR_ROWS,
  },
  carAddons: [
    { label: 'חצי יום — סיור בודד (בלם בלבד)', rows: CAR_HALF_DAY_ROWS },
  ],
  carNote: 'אותו לוגיקה כמו הקלאסי הפרטי: פרדאוטו worst case, חלוקה לאדם דינמית (עלות רכב ÷ אנשים בפועל). שילוב קלאסי+בלם (יום מלא) מופיע בכרטיס הקלאסי.',
  children: {
    perTier: [
      { ageLabel: 'עד 6', rule: { kind: 'free', note: 'שקוף בקבוצה' } },
      { ageLabel: '7-12', rule: { kind: 'halfOfRegular', round: 'nearest' } },
      { ageLabel: '13+', rule: { kind: 'fullPrice' } },
    ],
    note: 'ילד עד 6 שקוף בקבוצה — לא משפיע על קטגוריית גודל. ילד 7-12 נספר ומשלם חצי מהמחיר/אדם של אותה קטגוריה.',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// כרטיס 3: קולינרי פרטי (ליסבון) + טעימות פרטי (פורטו) — אותה טבלה
// ═══════════════════════════════════════════════════════════════════════════

const CULINARY_TASTINGS_REGULAR_ROWS: PrivateTierRow[] = [
  { minSize: 2, maxSize: 2, pricePerPerson: 85 },
  { minSize: 3, maxSize: 4, pricePerPerson: 80 },
  { minSize: 5, maxSize: 7, pricePerPerson: 75 },
  { minSize: 8, maxSize: 11, pricePerPerson: 72 },
  { minSize: 12, maxSize: 15, pricePerPerson: 70 },
  { minSize: 16, maxSize: 18, pricePerPerson: 67 },
];

const CULINARY_TASTINGS_PRIVATE: PrivateTour = {
  slug: 'culinary-tastings-private',
  name: 'קולינרי פרטי (ליסבון) = טעימות פרטי (פורטו)',
  priceInfo: 'אותה טבלה לשני הסיורים · טווח 2-18 משתתפים',
  priceInfoExtra: 'מחיר רגיל 65€/אדם זהה לשניהם. הפרטי תמיד רווחי יותר מהרגיל (כל קטגוריה +19€ עד +68€ תוספת רווח). אין גליטשים — כל מעבר חיובי.',
  maxParticipants: 18,
  regularPrice: {
    label: 'מחיר רגיל',
    rows: CULINARY_TASTINGS_REGULAR_ROWS,
  },
  children: {
    perTier: [
      { ageLabel: 'עד 2', rule: { kind: 'free' } },
      { ageLabel: '3-6', rule: { kind: 'fixedPrice', price: 20 } },
      { ageLabel: '7-12', rule: { kind: 'fixedPrice', price: 40 } },
      { ageLabel: '13+', rule: { kind: 'fullPrice' } },
    ],
    note: 'מחיר ילד קבוע — לא תלוי בקטגוריית גודל (כי עלות המזון פר-ילד דומה תמיד). בחבילה: 3-6 = 15€, 7-12 = 35€.',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// כרטיס 4: סינטרה + אראבידה פרטי — אותה טבלה ללקוח
// ═══════════════════════════════════════════════════════════════════════════

const SINTRA_ARRABIDA_REGULAR_ROWS: PrivateTierRow[] = [
  { minSize: 2, maxSize: 2, pricePerPerson: 275 },
  { minSize: 3, maxSize: 3, pricePerPerson: 200 },
  { minSize: 4, maxSize: 4, pricePerPerson: 160 },
  { minSize: 5, maxSize: 6, pricePerPerson: 130 },
  { minSize: 7, maxSize: 9, pricePerPerson: 115 },
  { minSize: 10, maxSize: 15, pricePerPerson: 105 },
  { minSize: 16, maxSize: 25, pricePerPerson: 100 },
  { minSize: 26, maxSize: 35, pricePerPerson: 95 },
  { minSize: 36, maxSize: 50, pricePerPerson: 92 },
];

const SINTRA_ARRABIDA_PRIVATE: PrivateTour = {
  slug: 'sintra-arrabida-private',
  name: 'סינטרה פרטי = אראבידה פרטי',
  priceInfo: 'אותה טבלה ללקוח · טווח 2-50 משתתפים · המחיר כולל רכב וכניסות',
  priceInfoExtra: 'אראבידה רווחית יותר (כניסות יקב 10.2€ מול ארמון פנה 20€), אבל מחיר זהה ללקוח. אפקט הפוך מסיורי העיר: בקבוצה קטנה הרכב הוא 80% מהעלות → מחיר/אדם דרסטי (275€ לזוג). בקבוצה גדולה הרכב מתפזר → מתקרב למחיר רגיל. יולי+ מחיר רגיל עולה ל-95€/אדם.',
  maxParticipants: 50,
  regularPrice: {
    label: 'מחיר רגיל',
    rows: SINTRA_ARRABIDA_REGULAR_ROWS,
  },
  children: {
    perTier: [
      { ageLabel: 'עד 6', rule: { kind: 'free' } },
      { ageLabel: '7-12', rule: { kind: 'halfOfRegular', round: 'nearest' } },
      { ageLabel: '13+', rule: { kind: 'fullPrice' } },
    ],
    note: 'בפרטי הרכב כבר משולם ע"י הקבוצה — אז ילדים עד 6 חינם לגמרי. ילד 7-12 משלם חצי מהמחיר/אדם. ארמון פנה — חינם עד גיל 16. שאר הכניסות (יקב אראבידה) — בינתיים מחיר מבוגר מלא עד שנברר עם הספקים.',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// כרטיס 5: אובידוש פרטי
// ═══════════════════════════════════════════════════════════════════════════

const OBIDOS_REGULAR_ROWS: PrivateTierRow[] = [
  { minSize: 2, maxSize: 2, pricePerPerson: 320 },
  { minSize: 3, maxSize: 3, pricePerPerson: 230 },
  { minSize: 4, maxSize: 4, pricePerPerson: 180 },
  { minSize: 5, maxSize: 6, pricePerPerson: 145 },
  { minSize: 7, maxSize: 9, pricePerPerson: 130 },
  { minSize: 10, maxSize: 15, pricePerPerson: 120 },
  { minSize: 16, maxSize: 25, pricePerPerson: 115 },
  { minSize: 26, maxSize: 35, pricePerPerson: 110 },
  { minSize: 36, maxSize: 50, pricePerPerson: 107 },
];

const OBIDOS_PRIVATE: PrivateTour = {
  slug: 'obidos-private',
  name: 'אובידוש פרטי',
  priceInfo: 'מחיר רגיל 105€/אדם, חבילה 100€/אדם · טווח 2-50 משתתפים · המחיר כולל רכב וכניסות',
  priceInfoExtra: 'רכב יקר יותר מסינטרה (449-581€ במקום 326-483€) — לכן מחיר/אדם גבוה יותר בכל קטגוריה. כניסות פר-אדם: 15€ אתרים + 2€ תצפית גלישה = 17€.',
  maxParticipants: 50,
  regularPrice: {
    label: 'מחיר רגיל',
    rows: OBIDOS_REGULAR_ROWS,
  },
  children: {
    perTier: [
      { ageLabel: 'עד 6', rule: { kind: 'free' } },
      { ageLabel: '7-12', rule: { kind: 'halfOfRegular', round: 'nearest' } },
      { ageLabel: '13+', rule: { kind: 'fullPrice' } },
    ],
    note: 'בפרטי הרכב כבר משולם ע"י הקבוצה — אז ילדים עד 6 חינם לגמרי. ילד 7-12 משלם חצי מהמחיר/אדם. כניסות (מנזר 15€ + תצפית גלישה 2€) — בינתיים מחיר מבוגר מלא עד שנברר עם הספקים.',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// כרטיס 6: דורו פרטי
// ═══════════════════════════════════════════════════════════════════════════

const DOURO_REGULAR_ROWS: PrivateTierRow[] = [
  { minSize: 2, maxSize: 2, pricePerPerson: 280 },
  { minSize: 3, maxSize: 3, pricePerPerson: 210 },
  { minSize: 4, maxSize: 4, pricePerPerson: 170 },
  { minSize: 5, maxSize: 7, pricePerPerson: 140 },
  { minSize: 8, maxSize: 10, pricePerPerson: 130 },
  { minSize: 11, maxSize: 13, pricePerPerson: 120 },
  { minSize: 14, maxSize: 16, pricePerPerson: 115 },
  { minSize: 17, maxSize: 19, pricePerPerson: 105 },
];

const DOURO_PRIVATE: PrivateTour = {
  slug: 'douro-private',
  name: 'דורו פרטי (פורטו)',
  priceInfo: 'מחיר רגיל 105€/אדם, חבילה 100€/אדם · טווח 2-19 משתתפים · המחיר כולל רכב וכניסות',
  priceInfoExtra: 'מקסימום 19 משתתפים — אין ספק רכב לקבוצות גדולות יותר בפורטו. בקבוצה הגדולה (17-19) מחיר/אדם = מחיר רגיל (0% פרמיה). רכב: ז\'ורז\' וואן 280€ (2-7), קלבר/איבורבס/אנטורס 475-700€ (8-19). כניסות פר-אדם: 15€ יקב + 11€ שייט = 26€.',
  maxParticipants: 19,
  regularPrice: {
    label: 'מחיר רגיל',
    rows: DOURO_REGULAR_ROWS,
  },
  children: {
    perTier: [
      { ageLabel: 'עד 6', rule: { kind: 'free' } },
      { ageLabel: '7-12', rule: { kind: 'halfOfRegular', round: 'nearest' } },
      { ageLabel: '13+', rule: { kind: 'fullPrice' } },
    ],
    note: 'בפרטי הרכב כבר משולם ע"י הקבוצה — אז ילדים עד 6 חינם לגמרי. ילד 7-12 משלם חצי מהמחיר/אדם. כניסות (יקב 15€ + שייט 11€) — בינתיים מחיר מבוגר מלא עד שנברר עם הספקים.',
  },
  warning: 'קבוצה של 8-10 אנשים: התמחור (130€/אדם) מבוסס על קלבר (635€). אם הספק הזמין הוא אנטורס (700€) — הרווח בקבוצה של 8 יורד ל-7€ בלבד (גבולי). לוודא לפני סגירה שהספק הוא איבורבס (475€) או קלבר.',
};

// ═══════════════════════════════════════════════════════════════════════════
// כל הסיורים הפרטיים
// ═══════════════════════════════════════════════════════════════════════════

export const PRIVATE_TOURS: PrivateTour[] = [
  CLASSIC_PRIVATE,
  BELEM_PRIVATE,
  CULINARY_TASTINGS_PRIVATE,
  SINTRA_ARRABIDA_PRIVATE,
  OBIDOS_PRIVATE,
  DOURO_PRIVATE,
];

export const PRIVATE_VERSION = 2;
export const PRIVATE_UPDATED = '24 במאי 2026';
