/**
 * Portugo Salary Calculator — TypeScript port of parse_excels.py
 *
 * Shared library for computing guide monthly salary components.
 * Used by the guide home screen and (in the future) the admin dashboard.
 *
 * Source of truth: .claude/skills/portugo-salary-calculator/SKILL.md
 */

import type { Guide } from './supabase';

// ============================================================================
// Types
// ============================================================================

export type SalaryBooking = {
  people: number;
  kids: number;
  price: number;   // tips collected for classic; fixed price for others
  tip: number;     // tips for non-classic tours (goes directly to guide)
};

export type SalaryTour = {
  tour_date: string;
  tour_type: string;
  category: 'classic' | 'fixed' | 'private' | 'other';
  notes?: string;
  bookings: SalaryBooking[];
};

export type SalaryActivity = {
  activity_date: string;
  activity_type: string; // 'eshel' | 'habraza' | 'training' | 'training_lead' | 'external'
  amount: number;
  notes?: string;
};

export type SalaryBreakdown = {
  // Core salary components
  classic_base: number;        // base paid by Portugo for classic tours
  classic_transfer: number;    // transfer owed from classic (10€ × paying people)
  classic_tips: number;        // all money collected in classic tours
  classic_income: number;      // = classic_tips - classic_transfer + classic_base
  fixed_salaries: number;      // sum of fixed tour salaries
  private_salaries: number;    // sum of private tour salaries
  non_classic_tips: number;    // tips from non-classic tours
  // Additional components
  eshel: number;               // 15€ × full work days
  eshel_days: number;
  habraza: number;             // 8€ × times
  training: number;            // 10€ × times (trainee side)
  training_lead: number;       // sum of trainings the senior guide led (trainer side) — included in receipt
  external: number;            // external activities (manually set amounts)
  travel: number;              // 30€/month or 3€/work day
  management: number;          // Maya only: 200€
  // Totals
  total_with_tips: number;     // full monthly earnings
  transfer_amount: number;     // what Portugo transfers at end of month
  // Receipt (קבלה)
  receipt_amount: number;      // official income for the receipt
  vat_amount: number;          // 23% VAT on receipt (Maya/Meni only)
  receipt_with_vat: number;    // receipt_amount + vat_amount
  // Cash withdrawal (משיכת משכורת בסגירת חודש)
  // הסכום שהמדריך מושך מהקופה הראשית. = transfer_amount + vat_amount, מעוגל מעלה
  // ליורו שלם — תמיד לטובת המדריך, כדי לא להתעסק במטבעות עשרוניים.
  cash_to_withdraw: number;
  // Raw counters (useful for display / KPIs)
  work_days: number;
  classic_people: number;
  classic_collected: number;        // classic tips only (for KPI "avg per classic person")
  total_cash_collected: number;     // sum of ALL bookings.price across all tour categories — goes to main cash box
  cash_based_salary: number;        // classic_income + fixed_salaries + private_salaries (paid from the main box)
};

// ============================================================================
// Per-tour breakdown — לפירוט שכר פר-סיור (לתצוגה בעמוד המדריך)
// ============================================================================

export type PerTourSalary = {
  tour_date: string;
  tour_type: string;
  category: 'classic' | 'fixed' | 'private' | 'other';
  people: number;
  /** שכר בסיס: לקלאסי = base לפי tier; לאחרים = שכר קבוע מהנוסחה */
  base: number;
  /** קלאסי בלבד: כסף שעובר לפורטוגו (paying × rate). 0 בשאר */
  transfer: number;
  /** קלאסי: price - transfer; אחרים: סכום ה-tip */
  tips: number;
  /** השכר שהמדריך מקבל סופית מהסיור הזה: base + tips */
  salary: number;
};

/**
 * מפרק את הסיורים לרשימה עם חישוב השכר לכל סיור בנפרד.
 * שימוש: עמוד הבית של המדריך — דרופדאון "פירוט סיורים".
 */
export function calculatePerTourBreakdown(
  tours: SalaryTour[],
  transferPerPerson: number = 10,
): PerTourSalary[] {
  return tours.map((tour) => {
    const totalPeople = (tour.bookings || []).reduce((s, b) => s + (b.people || 0), 0);
    const totalKids = (tour.bookings || []).reduce((s, b) => s + (b.kids || 0), 0);
    const totalPrice = (tour.bookings || []).reduce((s, b) => s + (b.price || 0), 0);
    const totalTip = (tour.bookings || []).reduce((s, b) => s + (b.tip || 0), 0);

    if (tour.category === 'classic') {
      const { base, transfer } = calcClassicSalary(totalPeople, totalKids, transferPerPerson);
      const tips = totalPrice - transfer; // הטיפים נטו של המדריך
      return {
        tour_date: tour.tour_date,
        tour_type: tour.tour_type,
        category: 'classic',
        people: totalPeople,
        base,
        transfer,
        tips,
        salary: base + tips,
      };
    }
    if (tour.category === 'private') {
      const base = calcPrivateSalary(totalPeople, tour.notes || '');
      return {
        tour_date: tour.tour_date,
        tour_type: tour.tour_type,
        category: 'private',
        people: totalPeople,
        base,
        transfer: 0,
        tips: totalTip,
        salary: base + totalTip,
      };
    }
    // fixed או other — שניהם משתמשים בנוסחת fixed
    const base = calcFixedSalary(tour.tour_type, totalPeople);
    return {
      tour_date: tour.tour_date,
      tour_type: tour.tour_type,
      category: tour.category === 'fixed' ? 'fixed' : 'other',
      people: totalPeople,
      base,
      transfer: 0,
      tips: totalTip,
      salary: base + totalTip,
    };
  });
}

// ============================================================================
// Classic tour formula
// ============================================================================

/**
 * Returns { base, transfer } for a single classic booking.
 *
 * @param people    Total people in the sub-group (kids included).
 *                  Yכול להיות עשרוני בחצאים (1.5, 2.5...) — מדיניות פורטוגו:
 *                  אם משתתף פורש באמצע סיור (אחרי נקודה מסוימת) הוא נספר כחצי.
 * @param kids      Kids in the group (kids don't pay → don't count toward transfer or base).
 *                  ילדים תמיד שלמים (לא חצאים).
 * @param transferPerPerson  Per-guide rate for "transfer to Portugo" per paying head.
 *                           Veterans = 10€. New guides starting mid-2026 = 11€.
 *                           Defaults to 10 to keep old call sites working.
 *
 * חישוב:
 *   - paying = max(0, people - kids) — יכול להיות עשרוני (למשל 1.5).
 *   - transfer = paying × transferPerPerson — עשרוני כפי שהוא (1.5 × 10€ = 15€).
 *   - base = lookup לפי tier, עם **עיגול למעלה** של מספר המשלמים
 *     (1.5 → tier של 2 = 10€, 12.5 → tier של 13-22 = 20€).
 */
export function calcClassicSalary(people: number, kids: number = 0, transferPerPerson: number = 10) {
  const paying = Math.max(0, people - kids);
  const transfer = paying * transferPerPerson;
  // עיגול למעלה לחישוב ה-base
  const payingForBase = Math.ceil(paying);
  let base: number;
  if (payingForBase <= 1) base = 5;
  else if (payingForBase <= 2) base = 10;
  else if (payingForBase <= 12) base = 15;
  else if (payingForBase <= 22) base = 20;
  else if (payingForBase <= 32) base = 25;
  else base = 30;
  return { base, transfer };
}

// ============================================================================
// Fixed tour formula
// ============================================================================

export function calcFixedSalary(tourType: string, people: number): number {
  // בלם + בלם רגלי (all variants)
  if (tourType.startsWith('בלם')) {
    return people <= 3 ? 30 : 30 + people;
  }
  if (tourType === 'סינטרה' || tourType === 'אראבידה' || tourType === 'אובידוש') {
    return people <= 7 ? 75 : 75 + people;
  }
  if (tourType === 'קולינרי') {
    if (people <= 2) return 35;
    if (people <= 5) return 40;
    return 40 + people;
  }
  if (tourType === 'יינות') {
    return people <= 3 ? 30 : 35 + people;
  }
  if (tourType === 'טעימות') {
    return people <= 3 ? 30 : 30 + people;
  }
  if (tourType === 'דורו') {
    if (people <= 6) return 80;
    if (people === 7) return 90;
    return 90 + people;
  }
  if (tourType === 'הברזה_בכיכר') return 8;
  return 0;
}

// ============================================================================
// Private tour lookup tables
// ============================================================================

type Tier = [number, number]; // [maxPeople, salary]

const PRIVATE_CLASSIC: Tier[] = [
  [2, 50], [4, 55], [6, 60], [7, 65], [8, 70], [9, 75], [10, 80],
  [12, 80], [14, 85], [16, 90], [19, 95], [22, 100], [25, 105],
  [28, 110], [30, 115], [35, 120],
];
const PRIVATE_BELEM: Tier[] = [
  [4, 40], [6, 45], [8, 50], [10, 55], [13, 55], [16, 60],
  [20, 65], [25, 70], [30, 75], [35, 85],
];
const PRIVATE_CULINARY: Tier[] = [
  [4, 45], [6, 50], [8, 55], [10, 60], [12, 60], [14, 65],
  [16, 70], [18, 75],
];
const PRIVATE_DAY_LISBON: Tier[] = [
  [4, 80], [6, 85], [7, 90], [9, 95], [12, 100], [14, 105],
  [16, 110], [18, 115], [20, 120], [22, 125], [25, 125],
  [28, 135], [35, 145],
];
const PRIVATE_TASTINGS: Tier[] = [
  [4, 45], [6, 50], [8, 55], [10, 60], [12, 60], [14, 65],
  [16, 70], [18, 75],
];
const PRIVATE_DOURO: Tier[] = [
  [4, 90], [6, 95], [7, 100], [10, 110], [13, 115], [16, 120],
  [19, 125], [22, 130], [25, 135],
];

const PRIVATE_TABLES: Array<[string, Tier[]]> = [
  ['קלאסי', PRIVATE_CLASSIC],
  ['בלם', PRIVATE_BELEM],
  ['קולינרי', PRIVATE_CULINARY],
  ['סינטרה', PRIVATE_DAY_LISBON],
  ['אראבידה', PRIVATE_DAY_LISBON],
  ['אובידוש', PRIVATE_DAY_LISBON],
  ['טעימות', PRIVATE_TASTINGS],
  ['דורו', PRIVATE_DOURO],
];

function lookupTier(table: Tier[], people: number): number {
  for (const [maxP, sal] of table) {
    if (people <= maxP) return sal;
  }
  return table[table.length - 1][1];
}

/** Private salary from notes sub-type(s); sums multiple keywords. */
export function calcPrivateSalary(people: number, notes: string = ''): number {
  const ignoreWords = ['פרטי', 'ישולם', 'לאביב', 'ליניב', 'לתום', 'למאיה', 'למני', 'לדותן', 'לעומר'];
  let cleaned = (notes || '').trim();
  for (const w of ignoreWords) {
    cleaned = cleaned.split(w).join('');
  }

  const matched: Tier[][] = [];
  for (const [keyword, table] of PRIVATE_TABLES) {
    if (cleaned.includes(keyword)) {
      matched.push(table);
    }
  }

  if (matched.length >= 2) {
    return matched.reduce((sum, t) => sum + lookupTier(t, people), 0);
  }
  if (matched.length === 1) {
    return lookupTier(matched[0], people);
  }
  // Fallback: classic private table
  return lookupTier(PRIVATE_CLASSIC, people);
}

// ============================================================================
// אשל (daily allowance) detection
// ============================================================================

const FULL_DAY_TOURS = new Set(['סינטרה', 'אראבידה', 'אובידוש', 'דורו']);

function isFullDayPrivate(notes: string = ''): boolean {
  const n = notes || '';
  return n.includes('סינטרה') || n.includes('אראבידה') || n.includes('אובידוש') || n.includes('דורו');
}

// ============================================================================
// Main aggregator
// ============================================================================

export function calculateMonthlySalary(
  guide: Pick<Guide, 'name' | 'travel_type' | 'has_mgmt_bonus' | 'mgmt_bonus_amount' | 'has_vat' | 'classic_transfer_per_person'> | null,
  tours: SalaryTour[],
  activities: SalaryActivity[],
): SalaryBreakdown {
  // ההפרשה לפורטוגו לראש בסיורי קלאסי — לפי המדריך. ברירת מחדל 10€ אם לא מוגדר.
  const transferPerPerson = guide?.classic_transfer_per_person ?? 10;

  let classic_base = 0;
  let classic_transfer = 0;
  let classic_tips = 0;
  let classic_people = 0;
  let classic_collected = 0;
  let total_cash_collected = 0;
  let fixed_salaries = 0;
  let private_salaries = 0;
  let non_classic_tips = 0;

  const toursByDate: Record<string, SalaryTour[]> = {};

  for (const tour of tours) {
    if (!toursByDate[tour.tour_date]) toursByDate[tour.tour_date] = [];
    toursByDate[tour.tour_date].push(tour);

    // All cash paid by tourists (any tour category) ends up in the guide's main cash box
    for (const b of tour.bookings || []) {
      total_cash_collected += b.price || 0;
    }

    if (tour.category === 'classic') {
      // ה-base בקלאסי הוא **לכל הסיור** (לא לכל תת-קבוצה).
      // אגרגציה: סוכמים את כל המשתתפים והילדים מכל תתי-הקבוצות
      // ואז מחילים את הנוסחה פעם אחת.
      // ה-transfer זהה בכל מקרה (paying × rate, חיבורי).
      let tourPeople = 0;
      let tourKids = 0;
      for (const b of tour.bookings || []) {
        tourPeople += b.people || 0;
        tourKids += b.kids || 0;
        classic_tips += b.price || 0;
        classic_collected += b.price || 0;
        classic_people += b.people || 0;
      }
      const { base, transfer } = calcClassicSalary(tourPeople, tourKids, transferPerPerson);
      classic_base += base;
      classic_transfer += transfer;
    } else if (tour.category === 'fixed') {
      const totalPeople = (tour.bookings || []).reduce((s, b) => s + (b.people || 0), 0);
      fixed_salaries += calcFixedSalary(tour.tour_type, totalPeople);
      for (const b of tour.bookings || []) {
        non_classic_tips += b.tip || 0;
      }
    } else if (tour.category === 'private') {
      const totalPeople = (tour.bookings || []).reduce((s, b) => s + (b.people || 0), 0);
      private_salaries += calcPrivateSalary(totalPeople, tour.notes || '');
      for (const b of tour.bookings || []) {
        non_classic_tips += b.tip || 0;
      }
    } else {
      // 'other' — e.g., הברזה בכיכר tour type
      const totalPeople = (tour.bookings || []).reduce((s, b) => s + (b.people || 0), 0);
      fixed_salaries += calcFixedSalary(tour.tour_type, totalPeople);
      for (const b of tour.bookings || []) {
        non_classic_tips += b.tip || 0;
      }
    }
  }

  const classic_income = classic_tips - classic_transfer + classic_base;

  // אשל detection
  const eshelDays = new Set<string>();

  // ספירת פריטי עבודה לפי תאריך (סיורים + פעילויות בתשלום).
  // 2+ פריטים באותו יום = יום מלא → אשל. דגל אשל ידני לא נספר כפריט עבודה.
  const workItemsByDate: Record<string, number> = {};

  for (const [date, dayTours] of Object.entries(toursByDate)) {
    workItemsByDate[date] = dayTours.length;
    const hasFullDay = dayTours.some(
      (t) =>
        FULL_DAY_TOURS.has(t.tour_type) ||
        (t.category === 'private' && isFullDayPrivate(t.notes || '')),
    );
    if (hasFullDay) {
      eshelDays.add(date);
    }
  }

  // Activities
  let habraza = 0;
  let training = 0;
  let training_lead = 0;
  let external = 0;
  for (const a of activities) {
    if (a.activity_type === 'eshel') {
      eshelDays.add(a.activity_date);
      continue; // דגל ידני — לא פריט עבודה
    }
    // כל שאר סוגי הפעילות נספרים כפריט עבודה ליום
    workItemsByDate[a.activity_date] = (workItemsByDate[a.activity_date] || 0) + 1;

    if (a.activity_type === 'habraza') habraza += a.amount || 0;
    else if (a.activity_type === 'training') {
      training += a.amount || 0;
      // הכשרה (כמתלמד) על סיור יום מלא = יום מלא → אשל
      if (isFullDayPrivate(a.notes || '')) eshelDays.add(a.activity_date);
    }
    else if (a.activity_type === 'training_lead') {
      training_lead += a.amount || 0;
      // הכשרה שהמדריך הבכיר העביר על סיור יום מלא = יום מלא → אשל
      if (isFullDayPrivate(a.notes || '')) eshelDays.add(a.activity_date);
    }
    else if (a.activity_type === 'external') external += a.amount || 0;
  }

  // יום עם 2+ פריטי עבודה (סיורים + פעילויות) = יום מלא → אשל
  for (const [date, count] of Object.entries(workItemsByDate)) {
    if (count >= 2) eshelDays.add(date);
  }

  const eshel_days = eshelDays.size;
  const eshel = eshel_days * 15;

  // Work days = union of tour dates + activity dates
  const workDaySet = new Set<string>(Object.keys(toursByDate));
  for (const a of activities) workDaySet.add(a.activity_date);
  const work_days = workDaySet.size;

  // Travel reimbursement
  let travel = 0;
  if (guide && work_days > 0) {
    if (guide.travel_type === 'monthly') travel = 30;
    else if (guide.travel_type === 'daily') travel = 3 * work_days;
  }

  // Management component (Maya)
  const management = guide?.has_mgmt_bonus ? (guide.mgmt_bonus_amount || 0) : 0;

  const total_with_tips =
    classic_income +
    fixed_salaries +
    private_salaries +
    non_classic_tips +
    eshel +
    habraza +
    training +
    training_lead +
    external +
    travel +
    management;

  const transfer_amount = total_with_tips - non_classic_tips;

  // Cash-based salary — the part of salary paid from the guide's main cash box.
  // Rest (eshel / habraza / training / training_lead / external / travel / management) is paid by Portugo separately.
  const cash_based_salary = classic_income + fixed_salaries + private_salaries;

  // Receipt amount (סכום לקבלה) — only the "official" income:
  // classic BASE only (not transfer, not tips), fixed + private salaries, אשל, הברזה,
  // הכשרה (מתלמד), הכשרה שהמדריך העביר (training_lead), travel, management.
  // Excludes non-classic tips, classic tips, and external
  // (external is paid separately by arrangement, not through the receipt).
  const receipt_amount =
    classic_base +
    fixed_salaries +
    private_salaries +
    eshel +
    habraza +
    training +
    training_lead +
    travel +
    management;

  const vat_amount = guide?.has_vat ? receipt_amount * 0.23 : 0;
  const receipt_with_vat = receipt_amount + vat_amount;

  // עיגול למעלה ליורו שלם — תמיד לטובת המדריך, כדי לא להתעסק במטבעות
  const cash_to_withdraw = Math.ceil(transfer_amount + vat_amount);

  return {
    classic_base,
    classic_transfer,
    classic_tips,
    classic_income,
    fixed_salaries,
    private_salaries,
    non_classic_tips,
    eshel,
    eshel_days,
    habraza,
    training,
    training_lead,
    external,
    travel,
    management,
    total_with_tips,
    transfer_amount,
    receipt_amount,
    vat_amount,
    receipt_with_vat,
    cash_to_withdraw,
    work_days,
    classic_people,
    classic_collected,
    total_cash_collected,
    cash_based_salary,
  };
}
