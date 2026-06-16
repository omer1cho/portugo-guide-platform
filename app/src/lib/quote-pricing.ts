/**
 * Quote pricing engine — מנוע חישוב מחירים להצעות מחיר.
 *
 * מקור אמת יחיד: pricing-validation-private-data.ts (הטבלאות המאושרות).
 * הפונקציה computeScenario מקבלת סיור + הרכב קבוצה (מבוגרים + גילאי ילדים) + רכב,
 * ומחזירה פירוט מלא (שורות מחיר + סה"כ) — בדיוק כמו בלוקי המחיר במוקאפ.
 *
 * כללים נעולים (ראה project_quotation_system_vision):
 *  - ספירת קטגוריה = מבוגרים + ילדים בני 7+ (ילדים עד 6 שקופים).
 *  - גודל רכב לפי מספר הגופים הפיזי (כולל פעוטות).
 *  - חלוקת עלות הרכב = עלות ÷ ספירת הקטגוריה (משלמים בלבד). פעוט/ילד עד 6 לא משלמים רכב.
 *  - ילד 7-12 = חצי מהמחיר (מעוגל) + חלק רכב מלא. ילד 13+ = מחיר מלא (כמו מבוגר).
 *  - מחיר תמיד מספר שלם.
 */
import {
  PRIVATE_TOURS,
  type PrivateTour,
  type PrivateTierRow,
  type ComboTierRow,
  type CarTierRow,
} from './pricing-validation-private-data';

export type Composition = {
  adults: number;
  /** גילאי הילדים (כולל פעוטות). מבוגרים לא נספרים כאן. */
  childrenAges: number[];
};

export type LineItem = {
  label: 'מבוגר' | 'ילד' | 'פעוט';
  count: number;
  unitPrice: number;   // €/אדם (כולל תוספת רכב אם רלוונטי)
  subtotal: number;    // unitPrice × count
  free: boolean;
  ageText?: string;    // לשורות ילד: "גיל 5" / "גילאי 7-9" (כדי להבדיל בין קטגוריות מחיר)
};

export type ScenarioResult = {
  categorySize: number;  // מבוגרים + ילדים 7+ (קובע את מדרגת המחיר)
  bodies: number;        // כל הגופים הפיזיים (לגודל הרכב)
  lines: LineItem[];     // שורות מחיר מקובצות (מבוגר / ילד / פעוט)
  carPerPerson: number;  // תוספת רכב לאדם משלם (0 אם אין רכב)
  total: number;         // סה"כ לקבוצה
  warning?: string;      // אזהרה מהסיור (למשל דורו 8-10)
  error?: string;        // הודעת שגיאה (מעל מקסימום / אין מחיר)
};

export type ScenarioInput = {
  tourSlug: string;
  variant?: 'regular' | 'short';  // קלאסי בלבד
  comboSlug?: string;             // אם זו הצעת שילוב
  car?: 'half' | 'full' | null;   // רכב צמוד (רק קלאסי/בלם)
  city?: 'lisbon' | 'porto';      // קובע איזו טבלת רכב (ליסבון=פרדאוטו / פורטו=ז'ורז')
  /** מחיר מיוחד ידני לאדם (€). דורס את המחיר מהטבלה ומבטל תוספת רכב נפרדת —
   *  זהו המחיר הסופי למבוגר. ילדים/פעוטות מחושבים ממנו לפי הכללים הרגילים. */
  adultPriceOverride?: number;
  composition: Composition;
};

// ─── עזרי פענוח טווחים ───
function parseAgeLabel(label: string): { min: number; max: number } {
  const upTo = label.match(/עד\s*(\d+)/);
  if (upTo) return { min: 0, max: Number(upTo[1]) };
  const plus = label.match(/^(\d+)\s*\+/);
  if (plus) return { min: Number(plus[1]), max: Infinity };
  const range = label.match(/(\d+)\s*-\s*(\d+)/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  return { min: 0, max: Infinity };
}

function parseCarLabel(label: string): { min: number; max: number } {
  const plus = label.match(/^(\d+)\s*\+/);
  if (plus) return { min: Number(plus[1]), max: Infinity };
  const range = label.match(/(\d+)\s*-\s*(\d+)/);
  if (range) return { min: Number(range[1]), max: Number(range[2]) };
  const single = label.match(/^(\d+)$/);
  if (single) return { min: Number(single[1]), max: Number(single[1]) };
  return { min: 0, max: Infinity };
}

export function getPrivateTour(slug: string): PrivateTour | undefined {
  return PRIVATE_TOURS.find((t) => t.slug === slug);
}

/** ספירת קטגוריה: מבוגרים + ילדים בני 7+ (ילדים עד 6 שקופים לתמחור).
 *  הגיל מעוגל כלפי מטה לשנים שלמות — ילד בן 6.5 הוא בן 6 (עדיין לא 7). */
export function categorySize(comp: Composition): number {
  return comp.adults + comp.childrenAges.filter((a) => Math.floor(a) >= 7).length;
}

/** מספר גופים פיזי (לבחירת גודל הרכב): כולם, כולל פעוטות. */
export function bodyCount(comp: Composition): number {
  return comp.adults + comp.childrenAges.length;
}

function tierPrice(rows: PrivateTierRow[], size: number): number | null {
  const row = rows.find((r) => size >= r.minSize && size <= r.maxSize);
  return row ? row.pricePerPerson : null;
}

function comboTierPrice(rows: ComboTierRow[], size: number): number | null {
  const row = rows.find((r) => size >= r.minSize && size <= r.maxSize);
  return row ? row.totalPerPerson : null;
}

function carCost(rows: CarTierRow[], bodies: number): number | null {
  const row = rows.find((r) => {
    const { min, max } = parseCarLabel(r.groupSizeLabel);
    return bodies >= min && bodies <= max;
  });
  return row ? row.cost : null;
}

/** מחיר הסיור לילד לפי גילו (לפני תוספת רכב). */
function childTourPrice(tour: PrivateTour, age: number, adultBase: number): number {
  const rules = tour.children.perTier;
  if (!rules) return adultBase;
  const match = rules.find((r) => {
    const { min, max } = parseAgeLabel(r.ageLabel);
    return age >= min && age <= max;
  });
  if (!match) return adultBase;
  switch (match.rule.kind) {
    case 'free':
      return 0;
    case 'fullPrice':
      return adultBase;
    case 'halfOfRegular':
      return Math.round(adultBase / 2); // חצי, מעוגל (X.5 מעוגל למעלה)
    case 'fixedPrice':
      return match.rule.price;
  }
}

/**
 * מחשב תרחיש בודד (הרכב קבוצה ספציפי) לסיור נתון.
 * זהו ה-API המרכזי — מסך ההזנה ועמוד הלקוח קוראים לזה פר-תרחיש.
 */
export function computeScenario(input: ScenarioInput): ScenarioResult {
  const tour = getPrivateTour(input.tourSlug);
  const empty = { categorySize: 0, bodies: 0, lines: [], carPerPerson: 0, total: 0 };
  if (!tour) return { ...empty, error: 'סיור לא נמצא' };

  const comp = input.composition;
  const size = categorySize(comp);
  const bodies = bodyCount(comp);

  // מחיר מבוגר בסיס (לפי מדרגת גודל)
  let adultBase: number | null;
  let maxParticipants = tour.maxParticipants;
  if (input.comboSlug) {
    const combo = tour.combos?.find((c) => c.slug === input.comboSlug);
    if (!combo) return { ...empty, categorySize: size, bodies, error: 'שילוב לא נמצא' };
    maxParticipants = combo.maxParticipants;
    adultBase = comboTierPrice(combo.rows, size);
  } else {
    const table = input.variant === 'short' && tour.shortPrice ? tour.shortPrice : tour.regularPrice;
    adultBase = tierPrice(table.rows, size);
  }
  if (size > maxParticipants) {
    return { ...empty, categorySize: size, bodies, error: `מעל המקסימום (${maxParticipants} משתתפים)` };
  }

  // מחיר מיוחד ידני (אופציונלי): דורס את מחיר המבוגר מהטבלה. זהו המחיר הסופי לאדם,
  // ולכן גם מבטל תוספת רכב נפרדת. ילדים/פעוטות מחושבים ממנו לפי הכללים הרגילים
  // (חצי לילד 7-12 בסיורי עיר, מחיר קבוע בקולינרי/טעימות, חינם לפעוט/עד 6 בעיר).
  const override = input.adultPriceOverride;
  const hasOverride = override != null && override >= 0;
  if (hasOverride) {
    adultBase = Math.round(override);
  } else if (adultBase == null) {
    return { ...empty, categorySize: size, bodies, error: 'אין מחיר למספר המשתתפים הזה' };
  }

  // תוספת רכב (רק אם נבחר, אין מחיר מיוחד, ויש לסיור טבלת רכב)
  // פורטו משתמש בטבלת ז'ורז' (carAddonsPorto), ליסבון בטבלת פרדאוטו (carAddons).
  let carPerPerson = 0;
  const carTables =
    input.city === 'porto' && tour.carAddonsPorto?.length ? tour.carAddonsPorto : tour.carAddons;
  if (!hasOverride && input.car && carTables?.length) {
    const carTable =
      carTables.find((t) =>
        input.car === 'full' ? t.label.includes('יום מלא') : t.label.includes('חצי'),
      ) ?? carTables[0];
    const cost = carCost(carTable.rows, bodies);
    if (cost != null && size > 0) {
      carPerPerson = Math.ceil(cost / size); // חלוקה לפי המשלמים (ספירת הקטגוריה)
    }
  }

  const adultUnit = adultBase + carPerPerson;

  // קיבוץ שורות לפי (תווית + מחיר), עם מעקב גילאים לשורות ילד (להבחנה בין קטגוריות)
  type Grp = { label: LineItem['label']; unit: number; count: number; ages: number[] };
  const groups = new Map<string, Grp>();
  const addPerson = (label: LineItem['label'], unit: number, age?: number) => {
    const key = `${label}|${unit}`;
    let g = groups.get(key);
    if (!g) { g = { label, unit, count: 0, ages: [] }; groups.set(key, g); }
    g.count += 1;
    if (age !== undefined) g.ages.push(age);
  };

  for (let i = 0; i < comp.adults; i++) addPerson('מבוגר', adultUnit);

  for (const rawAge of comp.childrenAges) {
    // הגיל מעוגל כלפי מטה לשנים שלמות (6.5 → 6) כדי שלא ייפול בין מדרגות הגיל.
    const age = Math.floor(rawAge);
    const tourPart = childTourPrice(tour, age, adultBase);
    const paysCar = age >= 7; // ילד 7+ משלם חלק רכב מלא; פעוט/3-6 לא
    const unit = tourPart + (paysCar ? carPerPerson : 0);
    // תווית: פעוט = עד גיל שנתיים, ילד = 3-12, מבוגר = 13+ (המחיר עצמו לפי מדרגות הגיל בטבלאות).
    if (age >= 13) { addPerson('מבוגר', unit); continue; }
    const label: LineItem['label'] = age >= 3 ? 'ילד' : 'פעוט';
    addPerson(label, unit, label === 'ילד' ? age : undefined);
  }

  const lines: LineItem[] = Array.from(groups.values()).map((g) => {
    let ageText: string | undefined;
    if (g.label === 'ילד' && g.ages.length) {
      const mn = Math.min(...g.ages);
      const mx = Math.max(...g.ages);
      ageText = mn === mx ? `בגיל ${mn}` : `בגילאי ${mn}-${mx}`;
    }
    return { label: g.label, count: g.count, unitPrice: g.unit, subtotal: g.unit * g.count, free: g.unit === 0, ageText };
  });
  const total = lines.reduce((s, l) => s + l.subtotal, 0);
  return { categorySize: size, bodies, lines, carPerPerson, total, warning: tour.warning };
}
