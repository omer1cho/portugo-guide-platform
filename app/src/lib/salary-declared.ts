/**
 * הטבלאות **כפי שהוצהרו למדריכים** בקבצים שבתיקיות שלהם:
 *   Desktop/הכוונות קלוד פורטוגו/משכורת עבור סיורים פרטיים ליסבון 2026.docx
 *   Desktop/הכוונות קלוד פורטוגו/משכורת עבור סיורים פרטיים פורטו 2026.docx
 *   (נערכו לאחרונה 3.12.2025, הופצו כ-PDF ב-4.12.2025)
 *
 * ⚠️ למה הקובץ הזה נראה כמו שהוא נראה:
 * הטעות המקורית (31.3.2026) נולדה בדיוק מזה שמישהו לקח את המסמך, שבו יש
 * **שורה לכל מספר אנשים**, ודחס אותו לטווחים — ופספס את הגבולות. לכן כאן
 * אין שום דחיסה: כל מספר אנשים כתוב במפורש, בדיוק כמו במסמך, כדי שאפשר
 * יהיה להשוות שורה מול שורה מול המסמך המודפס בלי לפרש כלום.
 *
 * הקובץ הזה הוא **קריאה בלבד** — הוא לא משמש לתשלום, רק לבדיקת הפער מול
 * מחשבון השכר החי (`salary.ts`) בעמוד /admin/salary-audit.
 */

/** מפה של מספר אנשים → שכר. המפתחות הם בדיוק השורות שבמסמך. */
export type DeclaredTable = Record<number, number>;

/** ליסבון + פורטו הקלאסית — עמודת "שכר רגיל". */
export const DECLARED_CLASSIC: DeclaredTable = {
  2: 50, 3: 55, 4: 55, 5: 60, 6: 60, 7: 65, 8: 70, 9: 75, 10: 80,
  11: 80, 12: 80, 13: 85, 14: 85, 15: 90, 16: 90, 17: 95, 18: 95,
  19: 95, 20: 100, 21: 100, 22: 100, 23: 105, 24: 105, 25: 105,
  26: 110, 27: 110, 28: 110, 29: 115, 30: 115, 31: 115, 32: 115,
  33: 120, 34: 120, 35: 120,
};

/** ליסבון + פורטו הקלאסית — עמודת "סיור מקוצר". לא ממומשת היום במחשבון. */
export const DECLARED_CLASSIC_SHORT: DeclaredTable = {
  2: 35, 3: 40, 4: 40, 5: 45, 6: 45, 7: 50, 8: 50, 9: 55, 10: 55,
  11: 60, 12: 60, 13: 65, 14: 65, 15: 65, 16: 70, 17: 70, 18: 70,
  19: 75, 20: 75, 21: 75, 22: 80, 23: 80, 24: 80, 25: 80, 26: 85,
  27: 85, 28: 85, 29: 90, 30: 90, 31: 90, 32: 90, 33: 95, 34: 95,
  35: 95,
};

export const DECLARED_BELEM: DeclaredTable = {
  2: 40, 3: 40, 4: 40, 5: 45, 6: 45, 7: 50, 8: 50, 9: 50, 10: 55,
  11: 55, 12: 55, 13: 55, 14: 60, 15: 60, 16: 60, 17: 60, 18: 65,
  19: 65, 20: 65, 21: 65, 22: 70, 23: 70, 24: 70, 25: 70, 26: 75,
  27: 75, 28: 75, 29: 75, 30: 80, 31: 80, 32: 80, 33: 80, 34: 85,
  35: 85,
};

export const DECLARED_CULINARY: DeclaredTable = {
  2: 45, 3: 45, 4: 45, 5: 50, 6: 50, 7: 55, 8: 55, 9: 55, 10: 60,
  11: 60, 12: 60, 13: 65, 14: 65, 15: 70, 16: 70, 17: 75, 18: 75,
};

/** טעימות פורטו — במסמך של פורטו הטבלה זהה לקולינרי של ליסבון. */
export const DECLARED_TASTINGS: DeclaredTable = { ...DECLARED_CULINARY };

/** סינטרה / אראבידה / אובידוש — "סיור יומי" במסמך של ליסבון. */
export const DECLARED_DAY_LISBON: DeclaredTable = {
  2: 80, 3: 80, 4: 80, 5: 85, 6: 85, 7: 90, 8: 95, 9: 95, 10: 100,
  11: 100, 12: 100, 13: 105, 14: 105, 15: 110, 16: 110, 17: 115,
  18: 115, 19: 115, 20: 120, 21: 120, 22: 120, 23: 125, 24: 125,
  25: 125, 26: 130, 27: 130, 28: 135, 29: 135, 30: 135, 31: 140,
  32: 140, 33: 140, 34: 145, 35: 145,
};

export const DECLARED_DOURO: DeclaredTable = {
  2: 90, 3: 90, 4: 90, 5: 95, 6: 95, 7: 100, 8: 110, 9: 110, 10: 110,
  11: 115, 12: 115, 13: 115, 14: 120, 15: 120, 16: 120, 17: 125,
  18: 125, 19: 125, 20: 130, 21: 130, 22: 130, 23: 135, 24: 135,
  25: 135,
};

/**
 * סיור יהדות פרטי — אין לו טבלה משלו במסמכים (הסיור נולד ב-7/26,
 * אחרי שהמסמכים הופצו). ההחלטה שתועדה: שכר זהה לבלם פרטי.
 */
export const DECLARED_JEWISH: DeclaredTable = { ...DECLARED_BELEM };

/** אותן מילות מפתח שהמחשבון החי מזהה בהערות הסיור, באותו סדר. */
export const DECLARED_TABLES: Array<[string, DeclaredTable]> = [
  ['קלאסי', DECLARED_CLASSIC],
  ['בלם', DECLARED_BELEM],
  ['קולינרי', DECLARED_CULINARY],
  ['סינטרה', DECLARED_DAY_LISBON],
  ['אראבידה', DECLARED_DAY_LISBON],
  ['אובידוש', DECLARED_DAY_LISBON],
  ['טעימות', DECLARED_TASTINGS],
  ['דורו', DECLARED_DOURO],
  ['יהדות', DECLARED_JEWISH],
];

/**
 * חיפוש במפה המוצהרת. מתחת לטווח → השורה הראשונה; מעל הטווח → האחרונה
 * (המסמך פשוט נגמר שם, בדיוק כמו שהמחשבון החי נוהג).
 */
export function declaredLookup(table: DeclaredTable, people: number): number {
  const sizes = Object.keys(table).map(Number).sort((a, b) => a - b);
  const n = Math.ceil(people);
  if (n <= sizes[0]) return table[sizes[0]];
  if (n >= sizes[sizes.length - 1]) return table[sizes[sizes.length - 1]];
  return table[n];
}

/** האם מספר האנשים חורג מהטווח שהמסמך בכלל מכסה (ואז ההשוואה לא אמינה). */
export function isOutsideDeclaredRange(table: DeclaredTable, people: number): boolean {
  const sizes = Object.keys(table).map(Number).sort((a, b) => a - b);
  const n = Math.ceil(people);
  return n < sizes[0] || n > sizes[sizes.length - 1];
}

export type DeclaredMatch = { keyword: string; table: DeclaredTable };

/**
 * זיהוי תתי-הסיורים מתוך ההערות — מקביל ל-matchPrivateTables במחשבון החי,
 * כולל אותה רשימת מילים מתעלמות, כדי שההשוואה תהיה תפוחים מול תפוחים.
 */
export function matchDeclaredTables(notes: string = ''): DeclaredMatch[] {
  const ignoreWords = ['פרטי', 'ישולם', 'לאביב', 'ליניב', 'לתום', 'למאיה', 'למני', 'לדותן', 'לעומר'];
  let cleaned = (notes || '').trim();
  for (const w of ignoreWords) {
    cleaned = cleaned.split(w).join('');
  }

  // "מקוצר" מחליף את עמודת הקלאסי בעמודת הסיור המקוצר שבאותו מסמך.
  const short = (notes || '').includes('מקוצר');

  const matched: DeclaredMatch[] = [];
  for (const [keyword, table] of DECLARED_TABLES) {
    if (!cleaned.includes(keyword)) continue;
    matched.push({
      keyword: short && keyword === 'קלאסי' ? 'קלאסי מקוצר' : keyword,
      table: short && keyword === 'קלאסי' ? DECLARED_CLASSIC_SHORT : table,
    });
  }
  return matched;
}

/** השכר לפי המסמכים שהמדריכים מחזיקים. null = לא זוהה סוג סיור בהערות. */
export function declaredPrivateSalary(
  people: number,
  notes: string = '',
): { amount: number | null; keywords: string[]; outsideRange: boolean } {
  const matched = matchDeclaredTables(notes);
  if (matched.length === 0) {
    return { amount: null, keywords: [], outsideRange: false };
  }
  const amount = matched.reduce((sum, m) => sum + declaredLookup(m.table, people), 0);
  const outsideRange = matched.some((m) => isOutsideDeclaredRange(m.table, people));
  return { amount, keywords: matched.map((m) => m.keyword), outsideRange };
}
