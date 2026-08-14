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

// =============================================================================
// GET /api/tips-events?k=gogo-stats-2026
// ברירת מחדל: מפנה לדשבורד הנתונים (/tips/stats.html).
// עם &format=json: מחזיר אגרגציה יומית לדשבורד - בלי שום פרט אישי.
// =============================================================================

const STATS_KEY = 'gogo-stats-2026';
const PAGE_LABELS: Record<string, string> = { lisbon: 'ליסבון', porto: 'פורטו' };

type EventRow = {
  created_at: string;
  page: string;
  session_id: string;
  event_type: string;
  target: string | null;
  meta: { max_scroll?: number; seconds?: number; mobile?: boolean; ref?: string } | null;
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get('k');
  if (key !== STATS_KEY) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  // הכתובת ששמורה אצל עומר מפנה לדשבורד עצמו
  if (url.searchParams.get('format') !== 'json') {
    return NextResponse.redirect(new URL(`/tips/stats.html?k=${STATS_KEY}`, url.origin), 302);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ ok: false }, { status: 500 });

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Supabase חותך כל תשובה ל-1,000 שורות (Max Rows) בלי קשר ל-limit שמבקשים.
  // עם מיון עולה זה גרם לדשבורד "לקפוא" על 1,000 האירועים הישנים (הבאג של 1.8.26).
  // לכן קוראים בדפים של 1,000 עד שנגמר.
  const PAGE_SIZE = 1000;
  const rows: EventRow[] = [];
  for (let fromIdx = 0; fromIdx <= 60000; fromIdx += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('tips_events')
      .select('created_at, page, session_id, event_type, target, meta')
      .not('session_id', 'like', 'gogo-%')
      .gte('created_at', since)
      .order('created_at', { ascending: true })
      .range(fromIdx, fromIdx + PAGE_SIZE - 1);

    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
    rows.push(...((data ?? []) as EventRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  // אגרגציה יומית לפי שעון פורטוגל - שם הסיורים קורים
  const dayOf = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' });

  type DayAgg = {
    d: string; page: string;
    views: number; visitors: Set<string>; engaged: Set<string>;
    scrollSum: number; scrollN: number; secSum: number; secN: number;
    mobile: number; direct: number;
  };
  const dayAggs = new Map<string, DayAgg>();
  const clickAggs = new Map<string, { d: string; page: string; target: string; n: number }>();

  const dayAgg = (d: string, page: string): DayAgg => {
    const k2 = `${d}|${page}`;
    let a = dayAggs.get(k2);
    if (!a) {
      a = { d, page, views: 0, visitors: new Set(), engaged: new Set(), scrollSum: 0, scrollN: 0, secSum: 0, secN: 0, mobile: 0, direct: 0 };
      dayAggs.set(k2, a);
    }
    return a;
  };

  for (const r of rows) {
    const d = dayOf(r.created_at);
    const a = dayAgg(d, r.page);
    if (r.event_type === 'page_view') {
      a.views++;
      a.visitors.add(r.session_id);
      if (r.meta?.mobile) a.mobile++;
      if (!r.meta?.ref) a.direct++;
    } else if (r.event_type === 'click' && r.target) {
      a.engaged.add(r.session_id);
      const ck = `${d}|${r.page}|${r.target}`;
      const c = clickAggs.get(ck) ?? { d, page: r.page, target: r.target, n: 0 };
      c.n++;
      clickAggs.set(ck, c);
    } else if (r.event_type === 'page_leave' && r.meta) {
      if (typeof r.meta.max_scroll === 'number') { a.scrollSum += r.meta.max_scroll; a.scrollN++; }
      if (typeof r.meta.seconds === 'number' && r.meta.seconds < 3600) { a.secSum += r.meta.seconds; a.secN++; }
    }
  }

  return NextResponse.json({
    ok: true,
    today: new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' }),
    pages: PAGE_LABELS,
    days: [...dayAggs.values()].map(a => ({
      d: a.d, page: a.page, views: a.views,
      visitors: a.visitors.size, engaged: a.engaged.size,
      scrollSum: a.scrollSum, scrollN: a.scrollN, secSum: a.secSum, secN: a.secN,
      mobile: a.mobile, direct: a.direct,
    })),
    clicks: [...clickAggs.values()],
  });
}
