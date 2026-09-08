/**
 * POST /api/shifts/publish-log — מתעד כל פעולת פרסום של סידור עבודה, ומאמת אותה.
 *
 * למה זה קיים: ב-4.9.26 עומר פרסמה את שבוע 6-12.9, קיבלה הודעה שנראתה רגילה,
 * והשיבוצים נשארו טיוטה (published_at ריק). לא הייתה שום דרך לדעת בדיעבד
 * מה באמת קרה — מי לחצה, על מה, וכמה שורות באמת השתנו.
 *
 * הראוט עושה שני דברים:
 *   1. סופר בעצמו, עם מפתח השרת (בלי RLS), כמה שיבוצים בשבוע הזה נשארו
 *      טיוטה וכמה מפורסמים אחרי הפעולה. זו בדיקה בלתי תלויה בדפדפן.
 *   2. רושם שורה בטבלת shift_publish_log.
 *
 * הלקוח משתמש בספירה שחוזרת כדי להתריע בקול אם הפרסום לא באמת קרה.
 * אם הטבלה עדיין לא קיימת — הראוט עדיין מחזיר את הספירה, רק בלי לרשום.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ACTIONS = ['publish', 'republish', 'unpublish'] as const;
type Action = (typeof ACTIONS)[number];

function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'גוף בקשה לא תקין' }, { status: 400 });
  }

  const action = String(body.action || '') as Action;
  const weekStart = String(body.weekStart || '');
  const city = body.city === 'lisbon' || body.city === 'porto' ? body.city : 'all';
  const rowsAffected = typeof body.rowsAffected === 'number' ? body.rowsAffected : null;
  const emailsSent = typeof body.emailsSent === 'number' ? body.emailsSent : null;
  const actorEmail = typeof body.actorEmail === 'string' ? body.actorEmail.slice(0, 200) : null;

  if (!ACTIONS.includes(action)) {
    return NextResponse.json({ ok: false, error: 'פעולה לא מוכרת' }, { status: 400 });
  }
  if (!ISO_DATE.test(weekStart)) {
    return NextResponse.json({ ok: false, error: 'weekStart לא תקין' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('[publish-log] Supabase env vars missing');
    return NextResponse.json({ ok: false, error: 'שגיאה זמנית' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── ספירה בלתי תלויה: מה המצב בפועל בשבוע הזה, אחרי הפעולה ──
  const start = weekStart;
  const end = addDaysIso(weekStart, 6);

  let q = supabase
    .from('shifts')
    .select('status, published_at')
    .gte('shift_date', start)
    .lte('shift_date', end)
    .neq('status', 'cancelled');
  if (city !== 'all') q = q.eq('city', city);

  const { data: rows, error: countErr } = await q;
  if (countErr) {
    console.error('[publish-log] shifts count failed:', countErr);
    return NextResponse.json({ ok: false, error: 'שגיאה בספירת שיבוצים' }, { status: 500 });
  }

  const all = (rows || []) as { status: string; published_at: string | null }[];
  const draftAfter = all.filter((r) => r.status === 'draft').length;
  const publishedAfter = all.filter((r) => r.status === 'published').length;
  // שיבוץ מפורסם בלי published_at = בדיוק התקלה של 4.9
  const publishedWithoutStamp = all.filter((r) => r.status === 'published' && !r.published_at).length;

  const { error: logErr } = await supabase.from('shift_publish_log').insert({
    actor_email: actorEmail,
    action,
    week_start: weekStart,
    city,
    rows_affected: rowsAffected,
    emails_sent: emailsSent,
    draft_after: draftAfter,
    published_after: publishedAfter,
    published_without_stamp: publishedWithoutStamp,
  });
  // הטבלה עוד לא קיימת (או תקלה זמנית) — לא מפילים את הפעולה, רק מדווחים
  const logged = !logErr;
  if (logErr) console.error('[publish-log] insert failed:', logErr.message);

  return NextResponse.json({
    ok: true,
    logged,
    draftAfter,
    publishedAfter,
    publishedWithoutStamp,
  });
}
