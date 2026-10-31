/**
 * GET /api/shifts/sync-status
 *
 * ההתראה בלוח השיבוצים: בודק מול האתר אם בלם הסנכרון פעיל, כלומר יותר מדי סיורים
 * מפורסמים/משובצים נעלמו מהאתר והקרון לא נוגע בהם עד שמישהו יבדוק.
 * רץ עם service role בצד שרת, ולכן מוודאים קודם שהקורא הוא אדמין.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  fetchWebsiteShifts,
  shiftKey,
  classifyMissingShifts,
  type ExistingShift,
} from '@/lib/shifts-sync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: 'נדרשת התחברות' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: 'שגיאה זמנית, נסו שוב' }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const email = userData?.user?.email;
  if (userErr || !email) {
    return NextResponse.json({ ok: false, error: 'נדרשת התחברות' }, { status: 401 });
  }

  const { data: caller } = await admin
    .from('guides')
    .select('is_admin')
    .ilike('email', email)
    .maybeSingle();

  if (!caller?.is_admin) {
    return NextResponse.json({ ok: false, error: 'העמוד הזה למנהלים בלבד' }, { status: 403 });
  }

  try {
    const websiteShifts = await fetchWebsiteShifts(180);
    if (websiteShifts.length === 0) {
      return NextResponse.json({ ok: true, feedEmpty: true, guardActive: false, blocked: [] });
    }

    const today = new Date().toISOString().slice(0, 10);
    const { data: existing, error } = await admin
      .from('shifts')
      .select('id, shift_date, shift_time, tour_type, city, status, guide_id, source, notes')
      .gte('shift_date', today);
    if (error) throw error;

    const seenKeys = new Set(websiteShifts.map(shiftKey));
    const { needsAttention, guardActive } = classifyMissingShifts((existing || []) as ExistingShift[], seenKeys);

    const blocked = guardActive
      ? needsAttention
          .map((s) => ({ shift_date: s.shift_date, shift_time: s.shift_time, tour_type: s.tour_type }))
          .sort((a, b) => (a.shift_date + a.shift_time).localeCompare(b.shift_date + b.shift_time))
      : [];
    return NextResponse.json({ ok: true, feedEmpty: false, guardActive, blocked });
  } catch (e) {
    console.error('[sync-status]', e);
    return NextResponse.json({ ok: false, error: 'לא הצלחנו לבדוק מול האתר' }, { status: 200 });
  }
}
