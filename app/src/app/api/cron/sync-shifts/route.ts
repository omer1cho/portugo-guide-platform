/**
 * Cron sync — מושך את כל הסיורים מ-portugo.co.il/tours-calendar
 * ויוצר/מעדכן shifts בהתאם.
 *
 * רץ פעם ביום (מוגדר ב-vercel.json). מאומת דרך CRON_SECRET.
 *
 * לוגיקה:
 *   • לכל (תאריך, שעה, סוג סיור, עיר) באתר → אם לא קיים, יוצר shift חדש (status='draft')
 *   • shifts שכבר קיימים — לא נוגעים (אם המשתמש ערך ידנית, manually_edited=true שומר אותם)
 *   • shifts שקיימים אבל **לא** באתר יותר (= בוטל/שונה באתר):
 *       - אם status='published' → סמן status='cancelled' + הערה
 *       - אם status='draft' ויש guide_id (טנטטיבי משובץ) → השאר + הערה
 *       - אם status='draft' ובלי guide_id → מחיקה
 *
 * הגבלה: רק 180 יום קדימה (6 חודשים). שיבוצים ישנים לא נוגעים.
 *   (האתר עצמו לרוב מפרסם עד סוף 4 חודשים; 180 נותן buffer.)
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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

type WebsiteShift = {
  shift_date: string;          // YYYY-MM-DD
  shift_time: string;          // HH:MM:SS
  tour_type: string;
  city: 'lisbon' | 'porto';
  website_tour_id: string;
};

type ExistingShift = {
  id: string;
  shift_date: string;
  shift_time: string;
  tour_type: string;
  city: 'lisbon' | 'porto';
  status: 'draft' | 'published' | 'cancelled';
  guide_id: string | null;
  source: string | null;
};

function shiftKey(s: { shift_date: string; shift_time: string; tour_type: string; city: string }): string {
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
async function fetchWebsiteShifts(maxDaysAhead: number): Promise<WebsiteShift[]> {
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

export async function GET(req: NextRequest) {
  // אימות
  const auth = req.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json(
      { error: 'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
      { status: 500 },
    );
  }

  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const result = {
    fetched_from_website: 0,
    created: 0,
    cancelled: 0,
    kept_with_note: 0,
    deleted: 0,
    errors: [] as string[],
  };

  try {
    // 1. Fetch from website (180 days = 6 months ahead — covers full publishing horizon)
    const websiteShifts = await fetchWebsiteShifts(180);
    result.fetched_from_website = websiteShifts.length;

    // בלם בטיחות 1: פיד ריק = כמעט בוודאות תקלה/שינוי באתר, לא ביטול אמיתי של הכל.
    // עוצרים הכל לפני שנוגעים בשיבוצים. (הלקח מ-11.8.26: שינוי מבנה באתר רוקן את
    // הפיד והסנכרון ביטל 35 שיבוצים מפורסמים.)
    if (websiteShifts.length === 0) {
      throw new Error('Slots feed returned 0 shifts — aborting sync (site change/outage suspected)');
    }

    // 2. Get ALL existing shifts today or future — מכל המקורות!
    //    גם משמרת שעומר יצרה ידנית חוסמת יצירת כפילות מהאתר (באג נופר 10.7.26)
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing, error: existErr } = await supabase
      .from('shifts')
      .select('id, shift_date, shift_time, tour_type, city, status, guide_id, source')
      .gte('shift_date', today);
    if (existErr) throw existErr;
    const existingShifts = (existing || []) as ExistingShift[];

    // 3. Build maps
    const existingMap = new Map<string, ExistingShift>();
    for (const e of existingShifts) existingMap.set(shiftKey(e), e);

    const seenKeys = new Set<string>();
    const toInsert: Array<{
      shift_date: string;
      shift_time: string;
      tour_type: string;
      city: string;
      source: string;
      website_tour_id: string;
      status: string;
      guide_id?: string;
    }> = [];

    // סיור יהדות: עד להודעה חדשה רונה תמיד משובצת (הנחיית עומר 19.7.26).
    // לא נכנס למנגנוני שכר — רק שיבוץ בלוח.
    const RONA_GUIDE_ID = 'ba095472-99a6-4da6-8fa4-e8892001f808';

    for (const ws of websiteShifts) {
      const key = shiftKey(ws);
      seenKeys.add(key);
      if (!existingMap.has(key)) {
        toInsert.push({
          shift_date: ws.shift_date,
          shift_time: ws.shift_time,
          tour_type: ws.tour_type,
          city: ws.city,
          source: 'website',
          website_tour_id: ws.website_tour_id,
          status: 'draft',
          ...(ws.tour_type === 'יהדות' ? { guide_id: RONA_GUIDE_ID } : {}),
        });
      }
    }

    // 4. Insert new
    if (toInsert.length > 0) {
      // batch insert
      const { error: insErr } = await supabase.from('shifts').insert(toInsert);
      if (insErr) {
        result.errors.push(`insert fail: ${insErr.message}`);
      } else {
        result.created = toInsert.length;
      }
    }

    // 5. Handle missing-from-website (cancelled/changed at source)
    // בלם בטיחות 2: אם מספר המועמדים לביטול חריג (יותר מ-10), משהו כנראה השתבש
    // בפיד — מדלגים על שלב הביטולים כולו ומדווחים, במקום למחוק את הלוח.
    const missingCandidates = [...existingMap.entries()].filter(
      ([key, ex]) => !seenKeys.has(key) && ex.source === 'website',
    );
    const MASS_CANCEL_THRESHOLD = 10;
    if (missingCandidates.length > MASS_CANCEL_THRESHOLD) {
      result.errors.push(
        `mass-cancel guard: ${missingCandidates.length} shifts missing from feed (threshold ${MASS_CANCEL_THRESHOLD}) — skipped cancel phase`,
      );
      return NextResponse.json({ success: false, guard_triggered: true, ...result }, { status: 200 });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    for (const [key, exShift] of existingMap.entries()) {
      if (seenKeys.has(key)) continue;
      // לוגיקת "נעלם מהאתר" חלה רק על משמרות שמקורן באתר — ידניות של עומר לא נוגעים
      if (exShift.source !== 'website') continue;

      const noteSuffix = `(סנכרון ${todayStr})`;

      if (exShift.status === 'published') {
        // פורסם → סמן בוטל
        const { error } = await supabase
          .from('shifts')
          .update({
            status: 'cancelled',
            notes: `בוטל באתר ${noteSuffix}`,
          })
          .eq('id', exShift.id);
        if (error) result.errors.push(`cancel fail ${exShift.id}: ${error.message}`);
        else result.cancelled++;
      } else if (exShift.guide_id) {
        // טנטטיבי משובץ → השאר עם הערה
        const { error } = await supabase
          .from('shifts')
          .update({
            notes: `בוטל באתר — שיבוץ טנטטיבי, בדקי ${noteSuffix}`,
          })
          .eq('id', exShift.id);
        if (error) result.errors.push(`note fail ${exShift.id}: ${error.message}`);
        else result.kept_with_note++;
      } else {
        // טנטטיבי בלי מדריך → מחיקה
        const { error } = await supabase.from('shifts').delete().eq('id', exShift.id);
        if (error) result.errors.push(`delete fail ${exShift.id}: ${error.message}`);
        else result.deleted++;
      }
    }

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg, ...result }, { status: 500 });
  }
}
