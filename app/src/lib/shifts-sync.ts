/**
 * לוגיקה משותפת לסנכרון הסיורים מהאתר: מה יש באתר, ומה לעשות בסיורים שנעלמו ממנו.
 * משמש את הקרון היומי (/api/cron/sync-shifts) ואת ההתראה בלוח (/api/shifts/sync-status),
 * כדי ששניהם יגיעו לאותה מסקנה.
 */

// מיפוי שם הסיור באתר → tour_type שמשמש בשאר המערכת + עיר
// (שמות הtour_type נלקחים מ-TOUR_TYPES ב-lib/supabase.ts לעקביות)
const TOUR_TYPE_MAP: Record<string, { tour_type: string; city: 'lisbon' | 'porto' }> = {
  'סיור יהדות בליסבון': { tour_type: 'יהדות', city: 'lisbon' },
  'ליסבון הקלאסית': { tour_type: 'קלאסי_1', city: 'lisbon' },
  'פורטו הקלאסית': { tour_type: 'פורטו_1', city: 'porto' },
  'סינטרה והסביבה': { tour_type: 'סינטרה', city: 'lisbon' },
  'עמק הדורו והסביבה': { tour_type: 'דורו', city: 'porto' },
  'סיור קולינרי בליסבון': { tour_type: 'קולינרי', city: 'lisbon' },
  'סיור טעימות בפורטו': { tour_type: 'טעימות', city: 'porto' },
  'סיור ממוקד באזור בלם': { tour_type: 'בלם_1', city: 'lisbon' },
  'אראבידה והסביבה': { tour_type: 'אראבידה', city: 'lisbon' },
  'אובידוש והסביבה': { tour_type: 'אובידוש', city: 'lisbon' },
};

export type WebsiteShift = {
  shift_date: string;          // YYYY-MM-DD
  shift_time: string;          // HH:MM:SS
  tour_type: string;
  city: 'lisbon' | 'porto';
  website_tour_id: string;
};

export type ExistingShift = {
  id: string;
  shift_date: string;
  shift_time: string;
  tour_type: string;
  city: 'lisbon' | 'porto';
  status: 'draft' | 'published' | 'cancelled';
  guide_id: string | null;
  source: string | null;
  notes: string | null;
};

export function shiftKey(s: { shift_date: string; shift_time: string; tour_type: string; city: string }): string {
  // נורמליזציה לpostgres TIME format (HH:MM:SS)
  const t = s.shift_time.length === 5 ? `${s.shift_time}:00` : s.shift_time;
  return `${s.shift_date}_${t}_${s.tour_type}_${s.city}`;
}

// מזהי הסיורים באתר (portugo-back) — אותה רשימה שהאתר עצמו שולח ל-API הסלוטים
const WEBSITE_TOUR_IDS = ['1297', '49354', '150', '1616', '1609', '117', '1611', '1295', '146', '1618'];

/**
 * מאז עדכון האתר (8/2026) התאריכים כבר לא מוטמעים ב-__NEXT_DATA__ אלא נמשכים
 * ב-runtime מ-API הסלוטים של portugo-back. מושכים מאותו מקור בדיוק כמו האתר.
 * sold_out נכלל בכוונה — סיור שאזל עדיין יוצא וצריך מדריך.
 */
export async function fetchWebsiteShifts(maxDaysAhead: number): Promise<WebsiteShift[]> {
  const today = new Date();
  const from = today.toISOString().slice(0, 10);
  const cutoff = new Date(today.getTime() + maxDaysAhead * 86400000);
  const to = cutoff.toISOString().slice(0, 10);

  // ⚠️ 31.8.26: האתר עבר ל-cms.portugo.co.il. הכתובת הישנה (portugo-back.ussl.co.il)
  // עדיין עונה אבל מגישה נתונים ישנים — סלוטים שנמחקו ממשיכים להופיע בה!
  // (כך נוצר סיור רפאים: אראבידה 7.9). תמיד לאמת מול הבקשה שהאתר עצמו שולח.
  const url =
    `https://cms.portugo.co.il/api/v1/slots?tourId=${WEBSITE_TOUR_IDS.join('%2C')}` +
    `&from=${from}&to=${to}&status=available%2Clast_places%2Csold_out`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PortugoSync/1.0' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Slots API fetch failed: ${res.status}`);
  const body = await res.json();
  const slots = body?.data?.slots;
  if (!Array.isArray(slots)) throw new Error('Slots API: unexpected shape (data.slots missing)');

  const out: WebsiteShift[] = [];
  for (const slot of slots) {
    const title = slot?.tour?.title as string | undefined;
    const mapping = title ? TOUR_TYPE_MAP[title] : undefined;
    if (!mapping) continue;

    // displayDate: DD.MM.YYYY, displayTime: HH:MM — שעה מקומית (ליסבון), כמו במבנה הישן
    const dd = String(slot.displayDate || '');
    const [d, m, y] = dd.split('.');
    if (!d || !m || !y) continue;
    const shift_date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    const time = String(slot.displayTime || '');
    if (!/^\d{2}:\d{2}/.test(time)) continue;

    out.push({
      shift_date,
      shift_time: time.length === 5 ? `${time}:00` : time,
      tour_type: mapping.tour_type,
      city: mapping.city,
      website_tour_id: String(slot?.tour?.id ?? slot?.tourId ?? ''),
    });
  }
  return out;
}

/** מעל כמה סיורים מפורסמים/משובצים שנעלמו בבת אחת עוצרים ולא נוגעים בהם */
export const MASS_CANCEL_THRESHOLD = 10;

/** הערה שהסנכרון משאיר על שיבוץ טנטטיבי שנעלם מהאתר (כבר טופל, לא נספר שוב לבלם) */
const ALREADY_NOTED_PREFIX = 'בוטל באתר';

/**
 * מחלק את הסיורים שנעלמו מהאתר:
 *   safeToRemove — טיוטות בלי מדריך, וטיוטות של סיור יהדות (רונה משובצת שם אוטומטית,
 *     והשיבוץ חוזר לבד אם הסיור יחזור לאתר). בטוח למחוק תמיד.
 *   needsAttention — מפורסמים או טיוטות עם מדריך. אם יש יותר מדי חדשים, guardActive.
 * סיורים ידניים וסיורים שכבר בוטלו לא נכנסים לחלוקה.
 */
export function classifyMissingShifts(existing: ExistingShift[], seenKeys: Set<string>) {
  const missing = existing.filter(
    (e) => !seenKeys.has(shiftKey(e)) && e.source === 'website' && e.status !== 'cancelled',
  );
  const isSafe = (e: ExistingShift) =>
    e.status !== 'published' && (!e.guide_id || e.tour_type === 'יהדות');
  const safeToRemove = missing.filter(isSafe);
  const needsAttention = missing.filter((e) => !isSafe(e));
  const newlyMissing = needsAttention.filter((e) => !(e.notes || '').startsWith(ALREADY_NOTED_PREFIX));
  return { safeToRemove, needsAttention, guardActive: newlyMissing.length > MASS_CANCEL_THRESHOLD };
}
