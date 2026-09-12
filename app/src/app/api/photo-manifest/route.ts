/**
 * GET /api/photo-manifest?k=gogo-photos-2026
 *
 * מחזיר רשימה של כל תמונות הסיורים שהמדריכים העלו: תאריך, סוג סיור,
 * וכתובת התמונה. משמש את סקריפט הסנכרון שמעתיק את התמונות לדרייב של
 * פורטוגו (scripts/sync_photos_to_drive.py).
 *
 * למה ראוט ולא שאילתה: טבלת הסיורים חסומה (RLS), ולכן סקריפט שרץ על
 * המחשב של עומר לא יכול לקרוא אותה בלי מפתח שרת. הראוט קורא עם מפתח
 * השרת ומחזיר רק את המידע הדרוש.
 *
 * המידע כאן אינו רגיש: כתובות התמונות ממילא ציבוריות (באקט tour-photos),
 * ואין כאן שמות לקוחות, סכומים או פרטי מדריכים. אותו דפוס מפתח כמו
 * /api/tips-events.
 *
 * פרמטר אופציונלי: from=YYYY-MM-DD (ברירת מחדל: הכל).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PHOTOS_KEY = 'gogo-photos-2026';
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('k') !== PHOTOS_KEY) {
    return NextResponse.json({ ok: false, error: 'לא נמצא' }, { status: 404 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('[photo-manifest] Supabase env vars missing');
    return NextResponse.json({ ok: false, error: 'שגיאה זמנית' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const from = url.searchParams.get('from') || '';
  let q = supabase
    .from('tours')
    .select('id, tour_date, tour_type, category, notes, photo_url')
    .not('photo_url', 'is', null)
    .order('tour_date', { ascending: true });
  if (ISO_DATE.test(from)) q = q.gte('tour_date', from);

  // עמודים של 1000 — מגבלת ברירת המחדל של Supabase
  const rows: Record<string, unknown>[] = [];
  for (let page = 0; page < 20; page++) {
    const { data, error } = await q.range(page * 1000, page * 1000 + 999);
    if (error) {
      console.error('[photo-manifest] query failed:', error.message);
      return NextResponse.json({ ok: false, error: 'שגיאה בשליפה' }, { status: 500 });
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < 1000) break;
  }

  return NextResponse.json({
    ok: true,
    count: rows.length,
    photos: rows.map((r) => ({
      id: r.id,
      date: r.tour_date,
      tour_type: r.tour_type,
      category: r.category,
      // ההערות נחוצות כדי לנתב סיור פרטי לתיקייה לפי סוג הסיור שבו
      notes: typeof r.notes === 'string' ? r.notes.slice(0, 120) : '',
      url: r.photo_url,
    })),
  });
}
