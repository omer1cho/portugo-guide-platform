/**
 * Admin theme tokens — מבוסס על portugo-dashboard-designer SKILL.md
 *
 * הסיידבר ירוק כהה, התוכן ירקרק-בהיר, אקצנט אדום, תזכורות צהובות.
 * Tailwind נשמר לרכיבים פנימיים, אבל הצבעים העיקריים פה כדי שלא נצטרך
 * להמציא אותם מחדש בכל קומפוננטה.
 */

export const ADMIN_COLORS = {
  // Greens
  green900: '#0d4d25',
  green800: '#145c2e',
  green700: '#1a7a3d',
  green600: '#2e8b4d',
  green50: '#e0f2e7',
  green25: '#f0fdf4',

  // Accents
  red: '#d4351c',
  yellow: '#f5c518',
  blue: '#1e6091', // לעיתים נדירות — לא מוביל

  // Neutrals
  gray900: '#111827',
  gray700: '#374151',
  gray500: '#6b7280',
  gray300: '#d1d5db',
  gray100: '#f3f4f6',
  gray50: '#f9fafb',
  white: '#ffffff',

  // Status colors (for guide cards)
  statusOpen: '#1a7a3d', // פתוח / אקטיבי
  statusClosed: '#6b7280', // סגרה
  statusDeposit: '#f5c518', // מחכה להפקדה
  statusEmpty: '#d1d5db', // אין סיורים
} as const;

export const ADMIN_SPACING = {
  sidebarWidth: 250,
  contentPadding: 32,
  cardRadius: 12,
  cardPadding: 20,
} as const;

/** Helper: עברית לעיר */
export function cityLabel(city: 'lisbon' | 'porto'): string {
  return city === 'lisbon' ? 'ליסבון' : 'פורטו';
}

/** Helper: כסף — תמיד אירו, ללא עשרוניים אלא אם צריך */
export function fmtEuro(n: number, withDecimals = false): string {
  if (!isFinite(n)) return '0€';
  const rounded = withDecimals ? n.toFixed(2) : Math.round(n).toString();
  return `${Number(rounded).toLocaleString('he-IL')}€`;
}

/** Helper: שם חודש בעברית */
export function monthName(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString('he-IL', {
    month: 'long',
    year: 'numeric',
  });
}
