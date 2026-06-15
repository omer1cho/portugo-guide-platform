/**
 * בניית נתוני תצוגה להצעת מחיר — ממיר QuoteColumn[] לתצוגה (כותרת + תוצאת חישוב),
 * משותף למסך ההזנה (תצוגה מקדימה) ולעמוד הלקוח. טהור (ללא state).
 */
import { computeScenario, getPrivateTour, type ScenarioResult } from './quote-pricing';
import type { QuoteColumn, QuoteTourSel } from './quote-types';

export function eur(n: number): string {
  return `${n.toLocaleString('en-US')}€`;
}

/** "8 מבוגרים, 2 ילדים בגילאי 7 ו-9 ופעוט" — פעוט=עד 2, ילד=3-12 (מציינים גיל), 13+ כמבוגר. */
export function compositionLabel(adults: number, childrenAges: number[]): string {
  const adultsTotal = adults + childrenAges.filter((a) => a >= 13).length;
  const kids = childrenAges.filter((a) => a >= 3 && a <= 12).sort((x, y) => x - y);
  const toddlers = childrenAges.filter((a) => a < 3).length;
  const joinAges = (ages: number[]): string =>
    ages.length === 1 ? `${ages[0]}` : `${ages.slice(0, -1).join(', ')} ו-${ages[ages.length - 1]}`;
  const parts: string[] = [];
  if (adultsTotal > 0) parts.push(adultsTotal === 1 ? 'מבוגר אחד' : `${adultsTotal} מבוגרים`);
  if (kids.length === 1) parts.push(`ילד בן ${kids[0]}`);
  else if (kids.length > 1) parts.push(`${kids.length} ילדים בגילאי ${joinAges(kids)}`);
  let s = parts.join(', ');
  if (toddlers === 1) s += s ? ' ופעוט' : 'פעוט';
  else if (toddlers > 1) s += s ? ` ו-${toddlers} פעוטות` : `${toddlers} פעוטות`;
  return s;
}

export type DisplayColumn = {
  headLabel: string;       // כותרת העמודה
  subLabel?: string;       // שורת הרכב (אם יש ילדים)
  result: ScenarioResult;
  showTotal: boolean;      // band = false, exact = true
};

/** בונה את עמודות התצוגה לסיור נתון לפי העמודות שהוגדרו בהצעה. */
export function buildColumns(tour: QuoteTourSel, columns: QuoteColumn[]): DisplayColumn[] {
  // טבלת הרכב של פורטו שונה מליסבון — נקבע לפי כרטיס פורטו הקלאסית.
  const city: 'lisbon' | 'porto' = tour.card === 'porto-classic' ? 'porto' : 'lisbon';
  return columns.map((col) => {
    if (col.type === 'band') {
      const result = computeScenario({
        tourSlug: tour.tourSlug,
        variant: tour.variant,
        comboSlug: tour.comboSlug,
        car: tour.car,
        city,
        adultPriceOverride: tour.priceOverride,
        composition: { adults: col.minSize, childrenAges: [] },
      });
      return {
        headLabel: `בקבוצה של ${col.minSize} עד ${col.maxSize} משתתפים`,
        result,
        showTotal: false,
      };
    }
    const totalPeople = col.adults + col.childrenAges.length;
    const hasChildren = col.childrenAges.length > 0;
    const result = computeScenario({
      tourSlug: tour.tourSlug,
      variant: tour.variant,
      comboSlug: tour.comboSlug,
      car: tour.car,
      city,
      adultPriceOverride: tour.priceOverride,
      composition: { adults: col.adults, childrenAges: col.childrenAges },
    });
    return {
      headLabel: `בקבוצה של ${totalPeople} משתתפים`,
      subLabel: hasChildren ? compositionLabel(col.adults, col.childrenAges) : undefined,
      result,
      showTotal: true,
    };
  });
}

/** שמות תצוגה לפי כרטיס (מבחין קולינרי↔טעימות, סינטרה↔אראבידה, ליסבון↔פורטו). */
const CARD_NAMES: Record<string, string> = {
  'classic-lisbon': 'ליסבון הקלאסית',
  'porto-classic': 'פורטו הקלאסית',
  'belem': 'בלם',
  'culinary': 'קולינרי',
  'porto-tastings': 'טעימות פורטו',
  'sintra': 'סינטרה',
  'arrabida': 'אראבידה',
  'obidos': 'אובידוש',
  'douro': 'דורו',
};

/** שם תצוגה לסיור (כולל שילוב). */
export function tourDisplayName(tour: QuoteTourSel): string {
  if (tour.comboSlug) {
    const t = getPrivateTour(tour.tourSlug);
    const combo = t?.combos?.find((c) => c.slug === tour.comboSlug);
    if (combo) return combo.name.replace(/^שילוב [א-ד]:?\s*/, '').replace(/^שילוב [א-ד]-מקוצר:?\s*/, '');
  }
  if (tour.card && CARD_NAMES[tour.card]) return CARD_NAMES[tour.card];
  const t = getPrivateTour(tour.tourSlug);
  if (!t) return tour.tourSlug;
  return t.name.replace(/\s*\(.*\)\s*/, '').trim();
}
