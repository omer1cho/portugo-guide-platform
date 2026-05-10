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
};

function shiftKey(s: { shift_date: string; shift_time: string; tour_type: string; city: string }): string {
  // נורמליזציה לpostgres TIME format (HH:MM:SS)
  const t = s.shift_time.length === 5 ? `${s.shift_time}:00` : s.shift_time;
  return `${s.shift_date}_${t}_${s.tour_type}_${s.city}`;
}

async function fetchWebsiteShifts(maxDaysAhead: number): Promise<WebsiteShift[]> {
  const res = await fetch('https://portugo.co.il/tours-calendar', {
    headers: { 'User-Agent': 'PortugoSync/1.0' },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Website fetch failed: ${res.status}`);
  const html = await res.text();

  const match = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
  if (!match) throw new Error('__NEXT_DATA__ not found in HTML');

  const blob = JSON.parse(match[1]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tours = (blob?.props?.pageProps?.tours?.nodes || []) as any[];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + maxDaysAhead);

  const out: WebsiteShift[] = [];
  for (const tour of tours) {
    const mapping = TOUR_TYPE_MAP[tour.title];
    if (!mapping) continue;

    const cdRaw = tour?.tour_availability?.computedDates;
    if (!cdRaw) continue;
    let dates: Record<string, Record<string, unknown>>;
    try {
      dates = JSON.parse(cdRaw);
    } catch {
      continue;
    }

    for (const [dateStr, times] of Object.entries(dates)) {
      // MM/DD/YYYY → YYYY-MM-DD
      const [m, d, y] = dateStr.split('/');
      if (!m || !d || !y) continue;
      const dt = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`);
      if (isNaN(dt.getTime())) continue;
      if (dt < today || dt > cutoff) continue;

      const shift_date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
      for (const time of Object.keys(times)) {
        out.push({
          shift_date,
          shift_time: time.length === 5 ? `${time}:00` : time,
          tour_type: mapping.tour_type,
          city: mapping.city,
          website_tour_id: String(tour.id),
        });
      }
    }
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

    // 2. Get all existing website-source shifts that are today or future
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing, error: existErr } = await supabase
      .from('shifts')
      .select('id, shift_date, shift_time, tour_type, city, status, guide_id')
      .eq('source', 'website')
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
    }> = [];

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
    const todayStr = new Date().toISOString().slice(0, 10);
    for (const [key, exShift] of existingMap.entries()) {
      if (seenKeys.has(key)) continue;

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
