/**
 * POST /api/tips-events
 *
 * קולט אירועי אנליטיקה מדפי הטיפים (lisbon/porto): כניסה לדף, הקלקות,
 * ועזיבת דף (עומק גלילה + זמן שהייה). נשמר לטבלת tips_events ב-Supabase.
 *
 * פרטיות: בלי עוגיות ובלי מידע אישי. session_id הוא מזהה אקראי שנוצר
 * בדפדפן לכל ביקור ולא ניתן לקשר אותו לאדם.
 *
 * הערה: הדפדפן שולח לרוב דרך navigator.sendBeacon, שמגיע כ-Blob בלי
 * Content-Type של JSON - לכן קוראים את הגוף כטקסט ומפרסרים ידנית.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 10;

const ALLOWED_PAGES = new Set(['lisbon', 'porto']);
const ALLOWED_TYPES = new Set(['page_view', 'click', 'page_leave']);
// שדות meta מותרים בלבד - מונע הזרקת ג'אנק לטבלה
const ALLOWED_META_KEYS = new Set(['ref', 'lang', 'mobile', 'href', 'max_scroll', 'seconds']);

type IncomingEvent = { type?: unknown; target?: unknown; meta?: unknown };

export async function POST(req: NextRequest) {
  let body: { page?: unknown; session_id?: unknown; events?: unknown };
  try {
    body = JSON.parse(await req.text());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const page = String(body.page ?? '');
  const sessionId = String(body.session_id ?? '').slice(0, 64);
  const events = Array.isArray(body.events) ? (body.events as IncomingEvent[]).slice(0, 20) : [];

  if (!ALLOWED_PAGES.has(page) || !sessionId || events.length === 0) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const rows: {
    page: string;
    session_id: string;
    event_type: string;
    target: string | null;
    meta: Record<string, string | number | boolean> | null;
  }[] = [];

  for (const ev of events) {
    const type = String(ev?.type ?? '');
    if (!ALLOWED_TYPES.has(type)) continue;

    const target = ev?.target != null ? String(ev.target).slice(0, 200) : null;

    let meta: Record<string, string | number | boolean> | null = null;
    if (ev?.meta && typeof ev.meta === 'object') {
      meta = {};
      for (const [key, value] of Object.entries(ev.meta as Record<string, unknown>)) {
        if (!ALLOWED_META_KEYS.has(key)) continue;
        if (typeof value === 'number' && Number.isFinite(value)) meta[key] = Math.round(value);
        else if (typeof value === 'boolean') meta[key] = value;
        else if (typeof value === 'string') meta[key] = value.slice(0, 300);
      }
      if (Object.keys(meta).length === 0) meta = null;
    }

    rows.push({ page, session_id: sessionId, event_type: type, target, meta });
  }

  if (rows.length === 0) return NextResponse.json({ ok: false }, { status: 400 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('[tips-events] Supabase env vars missing');
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await supabase.from('tips_events').insert(rows);
  if (error) {
    console.error('[tips-events] insert failed:', error.message);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
