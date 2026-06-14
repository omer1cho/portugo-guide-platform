/**
 * בניית נתוני תצוגה להצעת מחיר — ממיר QuoteColumn[] לתצוגה (כותרת + תוצאת חישוב),
 * משותף למסך ההזנה (תצוגה מקדימה) ולעמוד הלקוח. טהור (ללא state).
 */
import { computeScenario, getPrivateTour, type ScenarioResult } from './quote-pricing';
import type { QuoteColumn, QuoteTourSel } from './quote-types';

export function eur(n: number): string {
  return `${n.toLocaleString('en-US')}€`;
}

/** "8 מבוגרים, 2 ילדים ופעוט" — לפי הרכב מדויק (13+ נספרים כמבוגרים). */
export function compositionLabel(adults: number, childrenAges: number[]): string {
  const adultsTotal = adults + childrenAges.filter((a) => a >= 13).length;
  const kids = childrenAges.filter((a) => a >= 7 && a <= 12).length;
  const toddlers = childrenAges.filter((a) => a < 7).length;
  const parts: string[] = [];
  if (adultsTotal > 0) parts.push(`${adultsTotal} מבוגרים`);
  if (kids > 0) parts.push(kids === 1 ? 'ילד אחד' : `${kids} ילדים`);
  if (toddlers > 0) parts.push(toddlers === 1 ? 'ופעוט' : `ו-${toddlers} פעוטות`);
  if (parts.length <= 1) return parts.join('');
  // אם השורה האחרונה כבר מתחילה ב-ו' (פעוטות) — לא להוסיף עוד "ו"
  const last = parts[parts.length - 1];
  const head = parts.slice(0, -1).join(', ');
  return last.startsWith('ו') ? `${head}${last}` : `${head} ו${last}`;
}

export type DisplayColumn = {
  headLabel: string;       // כותרת העמודה
  subLabel?: string;       // שורת הרכב (אם יש ילדים)
  result: ScenarioResult;
  showTotal: boolean;      // band = false, exact = true
};

/** בונה את עמודות התצוגה לסיור נתון לפי העמודות שהוגדרו בהצעה. */
export function buildColumns(tour: QuoteTourSel, columns: QuoteColumn[]): DisplayColumn[] {
  return columns.map((col) => {
    if (col.type === 'band') {
      const result = computeScenario({
        tourSlug: tour.tourSlug,
        variant: tour.variant,
        comboSlug: tour.comboSlug,
        car: tour.car,
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

/** שם תצוגה לסיור (כולל שילוב). */
export function tourDisplayName(tour: QuoteTourSel): string {
  const t = getPrivateTour(tour.tourSlug);
  if (!t) return tour.tourSlug;
  if (tour.comboSlug) {
    const combo = t.combos?.find((c) => c.slug === tour.comboSlug);
    if (combo) return combo.name.replace(/^שילוב [א-ד]:?\s*/, '').replace(/^שילוב [א-ד]-מקוצר:?\s*/, '');
  }
  return t.name.replace(/\s*\(.*\)\s*/, '').trim();
}
