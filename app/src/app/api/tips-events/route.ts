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
// דף סטטיסטיקות פשוט בעברית לעומר - כניסות, הקלקות, גלילה וזמן בדף.
// מוגן במפתח בכתובת. הנתונים אנונימיים לחלוטין (אין שום פרט אישי בטבלה).
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
  if (url.searchParams.get('k') !== STATS_KEY) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ ok: false }, { status: 500 });

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('tips_events')
    .select('created_at, page, session_id, event_type, target, meta')
    .neq('session_id', 'gogo-test')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(20000);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const rows = (data ?? []) as EventRow[];
  // "היום" לפי שעון פורטוגל - שם הסיורים קורים
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' });
  const isToday = (r: EventRow) =>
    new Date(r.created_at).toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' }) === todayStr;

  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  function summarize(subset: EventRow[]) {
    const perPage: Record<string, { views: number; visitors: Set<string>; scrolls: number[]; seconds: number[] }> = {};
    const clicks: Record<string, number> = {};
    for (const r of subset) {
      const p = (perPage[r.page] ??= { views: 0, visitors: new Set(), scrolls: [], seconds: [] });
      if (r.event_type === 'page_view') { p.views++; p.visitors.add(r.session_id); }
      if (r.event_type === 'click' && r.target) clicks[r.target] = (clicks[r.target] ?? 0) + 1;
      if (r.event_type === 'page_leave' && r.meta) {
        if (typeof r.meta.max_scroll === 'number') p.scrolls.push(r.meta.max_scroll);
        if (typeof r.meta.seconds === 'number' && r.meta.seconds < 3600) p.seconds.push(r.meta.seconds);
      }
    }
    return { perPage, clicks };
  }

  const avg = (a: number[]) => (a.length ? Math.round(a.reduce((x, y) => x + y, 0) / a.length) : null);

  function sectionHtml(title: string, subset: EventRow[]) {
    const { perPage, clicks } = summarize(subset);
    const pagesHtml = Object.entries(perPage)
      .map(([page, s]) => {
        const scroll = avg(s.scrolls);
        const secs = avg(s.seconds);
        return `<tr><td>${esc(PAGE_LABELS[page] ?? page)}</td><td>${s.visitors.size}</td><td>${s.views}</td><td>${scroll === null ? '-' : scroll + '%'}</td><td>${secs === null ? '-' : Math.floor(secs / 60) + ':' + String(secs % 60).padStart(2, '0')}</td></tr>`;
      })
      .join('') || '<tr><td colspan="5" class="empty">אין נתונים עדיין</td></tr>';
    const clicksHtml = Object.entries(clicks)
      .sort((a, b) => b[1] - a[1])
      .map(([t, n]) => `<tr><td>${esc(t)}</td><td>${n}</td></tr>`)
      .join('') || '<tr><td colspan="2" class="empty">אין הקלקות עדיין</td></tr>';
    return `
    <h2>${esc(title)}</h2>
    <table><thead><tr><th>דף</th><th>מבקרים</th><th>כניסות</th><th>גלילה ממוצעת</th><th>זמן ממוצע</th></tr></thead><tbody>${pagesHtml}</tbody></table>
    <h3>על מה הקליקו</h3>
    <table><thead><tr><th>מה</th><th>הקלקות</th></tr></thead><tbody>${clicksHtml}</tbody></table>`;
  }

  const html = `<!DOCTYPE html><html lang="he" dir="rtl"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="robots" content="noindex">
<title>סטטיסטיקות דפי הטיפים - פורטוגו</title>
<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@400;600;700;800&display=swap" rel="stylesheet">
<style>
  * { box-sizing: border-box; margin: 0; }
  body { font-family: 'Assistant', sans-serif; background: #faf6ee; color: #23281f; padding: 28px 16px 60px; }
  .wrap { max-width: 640px; margin: 0 auto; }
  h1 { color: #0a3d22; font-size: 26px; margin-bottom: 4px; }
  .sub { color: #5b5f54; font-size: 14px; margin-bottom: 24px; }
  h2 { color: #c4602f; font-size: 20px; margin: 28px 0 10px; }
  h3 { color: #0a3d22; font-size: 16px; margin: 18px 0 8px; }
  table { width: 100%; border-collapse: collapse; background: #fffdf8; border: 1px solid #e3ddcf; border-radius: 12px; overflow: hidden; }
  th, td { padding: 9px 12px; text-align: right; font-size: 14.5px; border-bottom: 1px solid #efe9dc; }
  th { background: #f3ecd9; color: #0a3d22; font-weight: 700; }
  tr:last-child td { border-bottom: none; }
  .empty { color: #8a8d82; }
</style></head><body><div class="wrap">
<h1>סטטיסטיקות דפי הטיפים</h1>
<div class="sub">מתעדכן אוטומטית בכל רענון · הזמנים לפי שעון פורטוגל</div>
${sectionHtml('היום (' + todayStr.split('-').reverse().join('.') + ')', rows.filter(isToday))}
${sectionHtml('30 הימים האחרונים', rows)}
</div></body></html>`;

  return new NextResponse(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
