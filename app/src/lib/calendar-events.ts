/**
 * אירועי לוח שנה — חגים, ימי זיכרון ומעברי שעון.
 *
 * מציג ברכה מותאמת בעמוד הבית של המדריך לפי תאריך היום.
 * אירוע אחד = שורת ברכה אחת. ביום עם כמה אירועים — כולם מוצגים,
 * בסדר עדיפות: ישראל → פורטוגל → מעבר שעון → בינלאומי.
 *
 * ⚠️ עדכון שנתי נדרש ⚠️
 * חגים יהודיים, חגים נוצריים נעים (פסחא, שישי הקדוש, קרנבל, קורפוס כריסטי)
 * ומעברי שעון משתנים מדי שנה. הרשימה הנוכחית מכוונת ל-2026 בלבד.
 * לקראת 2027 — להוסיף שנה חדשה לקובץ.
 */

export type EventCategory = 'israel' | 'portugal' | 'clock' | 'intl';

export type CalendarEvent = {
  /** תאריך בפורמט YYYY-MM-DD */
  date: string;
  /** טקסט הברכה כפי שיוצג למשתמש */
  text: string;
  category: EventCategory;
};

/** סדר עדיפות לתצוגה כשיש כמה אירועים באותו יום */
const CATEGORY_PRIORITY: Record<EventCategory, number> = {
  israel: 1,
  portugal: 2,
  clock: 3,
  intl: 4,
};

export const CALENDAR_EVENTS: CalendarEvent[] = [
  // ───────────────────────────────────────────
  // 🇮🇱 חגי ישראל — 2026 (לוח עברי תשפ"ו / תשפ"ז)
  // ───────────────────────────────────────────
  { date: '2026-02-01', text: '🌳 ערב ט"ו בשבט', category: 'israel' },
  { date: '2026-02-02', text: '🌳 ט"ו בשבט שמח', category: 'israel' },
  { date: '2026-03-02', text: '✨ תענית אסתר', category: 'israel' },
  { date: '2026-03-03', text: '🎭 פורים שמח!', category: 'israel' },
  { date: '2026-04-01', text: '🍷 ערב פסח — חג כשר ושמח', category: 'israel' },
  { date: '2026-04-02', text: '🍷 חג פסח שמח', category: 'israel' },
  { date: '2026-04-03', text: '🌷 חול המועד פסח', category: 'israel' },
  { date: '2026-04-04', text: '🌷 חול המועד פסח', category: 'israel' },
  { date: '2026-04-05', text: '🌷 חול המועד פסח', category: 'israel' },
  { date: '2026-04-06', text: '🌷 חול המועד פסח', category: 'israel' },
  { date: '2026-04-07', text: '🌷 חול המועד פסח', category: 'israel' },
  { date: '2026-04-08', text: '🍷 שביעי של פסח', category: 'israel' },
  { date: '2026-04-13', text: '🕯️ ערב יום השואה', category: 'israel' },
  { date: '2026-04-14', text: '🕯️ יום הזיכרון לשואה ולגבורה', category: 'israel' },
  { date: '2026-04-20', text: '🕯️ ערב יום הזיכרון', category: 'israel' },
  { date: '2026-04-21', text: '🕯️ יום הזיכרון לחללי מערכות ישראל ונפגעי פעולות האיבה', category: 'israel' },
  { date: '2026-04-22', text: '🇮🇱 חג עצמאות שמח!', category: 'israel' },
  { date: '2026-05-05', text: '🔥 ערב ל"ג בעומר', category: 'israel' },
  { date: '2026-05-06', text: '🔥 ל"ג בעומר שמח', category: 'israel' },
  { date: '2026-05-21', text: '🌾 ערב שבועות', category: 'israel' },
  { date: '2026-05-22', text: '🌾 חג שבועות שמח', category: 'israel' },
  { date: '2026-07-22', text: '🕯️ ערב תשעה באב', category: 'israel' },
  { date: '2026-07-23', text: '🕯️ תשעה באב — צום קל', category: 'israel' },
  { date: '2026-09-11', text: '🍎 ערב ראש השנה — שנה טובה ומבורכת', category: 'israel' },
  { date: '2026-09-12', text: '🍎 שנה טובה ומתוקה!', category: 'israel' },
  { date: '2026-09-13', text: '🍎 ראש השנה, יום שני — חג שמח', category: 'israel' },
  { date: '2026-09-20', text: '✡️ ערב יום כיפור — גמר חתימה טובה', category: 'israel' },
  { date: '2026-09-21', text: '✡️ יום כיפור — צום קל', category: 'israel' },
  { date: '2026-09-25', text: '🌿 ערב סוכות', category: 'israel' },
  { date: '2026-09-26', text: '🌿 חג סוכות שמח', category: 'israel' },
  { date: '2026-09-27', text: '🌿 חול המועד סוכות', category: 'israel' },
  { date: '2026-09-28', text: '🌿 חול המועד סוכות', category: 'israel' },
  { date: '2026-09-29', text: '🌿 חול המועד סוכות', category: 'israel' },
  { date: '2026-09-30', text: '🌿 חול המועד סוכות', category: 'israel' },
  { date: '2026-10-01', text: '🌿 חול המועד סוכות', category: 'israel' },
  { date: '2026-10-02', text: '🌿 הושענא רבה', category: 'israel' },
  { date: '2026-10-03', text: '🌿 שמיני עצרת — חג שמח', category: 'israel' },
  { date: '2026-10-04', text: '🌿 שמחת תורה שמחה!', category: 'israel' },
  { date: '2026-12-04', text: '🕎 ערב חנוכה — נר ראשון בערב', category: 'israel' },
  { date: '2026-12-05', text: '🕎 חנוכה שמח! נר ראשון', category: 'israel' },
  { date: '2026-12-06', text: '🕎 חנוכה שמח! נר שני', category: 'israel' },
  { date: '2026-12-07', text: '🕎 חנוכה שמח! נר שלישי', category: 'israel' },
  { date: '2026-12-08', text: '🕎 חנוכה שמח! נר רביעי', category: 'israel' },
  { date: '2026-12-09', text: '🕎 חנוכה שמח! נר חמישי', category: 'israel' },
  { date: '2026-12-10', text: '🕎 חנוכה שמח! נר שישי', category: 'israel' },
  { date: '2026-12-11', text: '🕎 חנוכה שמח! נר שביעי', category: 'israel' },
  { date: '2026-12-12', text: '🕎 חנוכה שמח! נר שמיני 🌟', category: 'israel' },

  // ───────────────────────────────────────────
  // 🇵🇹 חגי פורטוגל — 2026
  // ───────────────────────────────────────────
  { date: '2025-12-31', text: '🎆 ערב Ano Novo — ערב ראש השנה האזרחי', category: 'portugal' },
  { date: '2026-01-01', text: '🎆 Feliz Ano Novo!', category: 'portugal' },
  { date: '2026-02-17', text: '🎭 Carnaval בפורטוגל', category: 'portugal' },
  { date: '2026-04-03', text: '✝️ Sexta-feira Santa — שישי הקדוש', category: 'portugal' },
  { date: '2026-04-05', text: '🐣 Feliz Páscoa! פסחא שמח', category: 'portugal' },
  { date: '2026-04-25', text: '🌷 Dia da Liberdade — יום החירות', category: 'portugal' },
  { date: '2026-05-01', text: '🌹 Dia do Trabalhador — יום העובדים', category: 'portugal' },
  { date: '2026-06-04', text: '✝️ Corpus Christi', category: 'portugal' },
  { date: '2026-06-10', text: '🇵🇹 Dia de Portugal!', category: 'portugal' },
  { date: '2026-06-12', text: '🎺 ערב Santo António — Marchas Populares בליסבון', category: 'portugal' },
  { date: '2026-06-13', text: '🎺 חג ליסבון! Santo António', category: 'portugal' },
  { date: '2026-06-23', text: '🎉 ערב São João — Noite de São João בפורטו', category: 'portugal' },
  { date: '2026-06-24', text: '🎉 חג פורטו! São João', category: 'portugal' },
  { date: '2026-08-15', text: '⛪ Assunção de Nossa Senhora', category: 'portugal' },
  { date: '2026-10-05', text: '🇵🇹 יום הרפובליקה הפורטוגלית', category: 'portugal' },
  { date: '2026-11-01', text: '⛪ Todos os Santos', category: 'portugal' },
  { date: '2026-12-01', text: '🇵🇹 חג שיקום העצמאות', category: 'portugal' },
  { date: '2026-12-08', text: '⛪ Imaculada Conceição', category: 'portugal' },
  { date: '2026-12-24', text: '🎄 Véspera de Natal — ערב חג המולד', category: 'portugal' },
  { date: '2026-12-25', text: '🎄 Feliz Natal!', category: 'portugal' },

  // ───────────────────────────────────────────
  // 🕐 מעברי שעון — 2026
  // התאריך הוא היום הראשון בשעון החדש (אחרי שהמעבר התרחש בלילה הקודם).
  // ───────────────────────────────────────────
  { date: '2026-03-28', text: '🕐 ישראל מהיום בשעון קיץ — הפרש מפורטוגל היום: 3 שעות', category: 'clock' },
  { date: '2026-03-29', text: '🕐 פורטוגל מהיום בשעון קיץ — ההפרש מישראל חזר ל-2 שעות', category: 'clock' },
  { date: '2026-09-20', text: '🕐 ישראל מהיום בשעון חורף — הפרש מפורטוגל היום: שעה אחת', category: 'clock' },
  { date: '2026-10-25', text: '🕐 פורטוגל מהיום בשעון חורף — ההפרש מישראל חזר ל-2 שעות', category: 'clock' },

  // ───────────────────────────────────────────
  // 🌍 חגים בינלאומיים — תאריכים קבועים
  // ───────────────────────────────────────────
  { date: '2026-02-14', text: '❤️ Dia dos Namorados — יום האהבה', category: 'intl' },
  { date: '2026-10-31', text: '🎃 Happy Halloween!', category: 'intl' },
];

/**
 * מחזירה את אירועי הלוח של תאריך נתון, ממוינים לפי עדיפות.
 * @param dateStr פורמט YYYY-MM-DD (לרוב מתקבל מ-toISOString או מ-`${y}-${m}-${d}`)
 */
export function getCalendarEventsForDate(dateStr: string): CalendarEvent[] {
  return CALENDAR_EVENTS
    .filter((e) => e.date === dateStr)
    .sort((a, b) => CATEGORY_PRIORITY[a.category] - CATEGORY_PRIORITY[b.category]);
}

/**
 * תאריך היום בפורמט YYYY-MM-DD (לפי שעון מקומי, לא UTC).
 * חשוב להשתמש בפורמט מקומי כדי שמדריכים בפורטוגל יראו את הברכה
 * של היום שלהם, גם אם UTC כבר ביום הבא.
 */
export function todayLocalISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** MM-DD של היום (לחיפוש ימי הולדת) */
export function todayMonthDay(): string {
  const d = new Date();
  return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
