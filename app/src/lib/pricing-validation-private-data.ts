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
// טבלת ילדים גמישה — לכל סיור יש עמודות שונות (רגיל/חבילה/פרטי)
export type ChildrenPriceColumn = {
  header: string;                // "רגיל" / "חבילה" / "פרטי"
  values: (string | number)[];   // עבור כל age range, או "חינם" או מחיר €
};

export type ChildrenPriceTable = {
  ageLabels: string[];           // ["עד 2", "3-6", "7-12", "13+"]
  columns: ChildrenPriceColumn[];
  note?: string;                 // הסבר/אזהרה
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

  // 3. תוספת רכב — אופציונלי (רק קלאסי, בלם)
  carAddons?: CarAddonTable[];
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
    ageLabels: ['עד 6', '7-12', '13+'],
    columns: [
      { header: 'מחיר', values: ['חינם — שקוף בקבוצה (לא משפיע על קטגוריית גודל)', 'חצי מחיר/אדם (נספר בקבוצה — משפיע על קטגוריה)', 'מחיר מלא'] },
    ],
    note: 'בקלאסי פרטי: ילד עד 6 שקוף בקבוצה (זוג + 2 ילדים עד 6 = משלמים כזוג). ילד 7-12 נספר ומשלם חצי. בקלאסי free tour הרגיל — אין מחיר ילד (טיפים בלבד).',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// כל הסיורים הפרטיים (נמלא בהמשך)
// ═══════════════════════════════════════════════════════════════════════════

export const PRIVATE_TOURS: PrivateTour[] = [
  CLASSIC_PRIVATE,
  // TODO: בלם, קולינרי+טעימות, סינטרה+אראבידה, אובידוש, דורו — להוסיף אחרי שעומר תאשר את הקלאסי
];

export const PRIVATE_VERSION = 1;
export const PRIVATE_UPDATED = '23 במאי 2026';
