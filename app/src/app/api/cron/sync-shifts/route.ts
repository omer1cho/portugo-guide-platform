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
 *       - סיור יהדות בטיוטה → מחיקה גם אם רונה משובצת (הנחיית עומר 31.10.26)
 *       - אם status='draft' ויש guide_id (טנטטיבי משובץ) → השאר + הערה
 *       - אם status='draft' ובלי guide_id → מחיקה
 *   • בלם: אם יותר מדי סיורים מפורסמים/משובצים נעלמו בבת אחת, לא נוגעים בהם
 *     (רואים אותם בהתראה בלוח השיבוצים). טיוטות בלי מדריך נמחקות בכל מקרה.
 *
 * הגבלה: רק 180 יום קדימה (6 חודשים). שיבוצים ישנים לא נוגעים.
 *   (האתר עצמו לרוב מפרסם עד סוף 4 חודשים; 180 נותן buffer.)
 */

import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import {
  fetchWebsiteShifts,
  shiftKey,
  classifyMissingShifts,
  type ExistingShift,
} from '@/lib/shifts-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
      .select('id, shift_date, shift_time, tour_type, city, status, guide_id, source, notes')
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
    // בלם בטיחות 2: אם מספר המפורסמים/המשובצים שנעלמו חריג, משהו כנראה השתבש בפיד —
    // לא נוגעים בהם ומדווחים. טיוטות בלי מדריך נמחקות בכל מקרה: אם זו הייתה טעות
    // הן ייווצרו מחדש בסנכרון הבא, ושום שיבוץ לא הולך לאיבוד. (הלקח מ-29.10.26:
    // הבלם עצר את כל המחיקות, וסיורי 9:20 נשארו בלוח ליד 9:00 החדשים.)
    const { safeToRemove, needsAttention, guardActive } = classifyMissingShifts(existingShifts, seenKeys);

    const todayStr = new Date().toISOString().slice(0, 10);
    const noteSuffix = `(סנכרון ${todayStr})`;

    for (const exShift of safeToRemove) {
      const { error } = await supabase.from('shifts').delete().eq('id', exShift.id);
      if (error) result.errors.push(`delete fail ${exShift.id}: ${error.message}`);
      else result.deleted++;
    }

    if (guardActive) {
      result.errors.push(
        `mass-cancel guard: ${needsAttention.length} published/assigned shifts missing from feed — left untouched`,
      );
      return NextResponse.json({ success: false, guard_triggered: true, ...result }, { status: 200 });
    }

    for (const exShift of needsAttention) {
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
      } else {
        // טנטטיבי משובץ → השאר עם הערה
        const { error } = await supabase
          .from('shifts')
          .update({
            notes: `בוטל באתר — שיבוץ טנטטיבי, בדקי ${noteSuffix}`,
          })
          .eq('id', exShift.id);
        if (error) result.errors.push(`note fail ${exShift.id}: ${error.message}`);
        else result.kept_with_note++;
      }
    }

    return NextResponse.json({ success: true, ...result });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg, ...result }, { status: 500 });
  }
}
