/**
 * POST /api/shifts/notify-publish
 *
 * נשלח אחרי שעומר מפרסמת (או מפרסמת מחדש) שבוע שיבוצים ב-/admin/shifts.
 * שולח מייל אישי לכל מדריך שיש לו לפחות שיבוץ אחד מפורסם באותו שבוע (ובעיר
 * שסוננה, אם סוננה), עם לינק לעמוד המשמרות שלו (/my-shifts).
 *
 * best-effort: אם GMAIL_USER/GMAIL_APP_PASSWORD לא מוגדרים, או אם שליחה
 * נכשלת למדריך מסוים — לא מפיל את הבקשה, רק מדלג ומדווח כמה נשלחו בפועל.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const FROM_NAME = 'פורטוגו';

type City = 'all' | 'lisbon' | 'porto';

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function addDaysIso(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

/** "7–13.6" אם אותו חודש, אחרת "29.6–5.7" */
function formatWeekRange(startIso: string): string {
  const [, sm, sd] = startIso.split('-').map(Number);
  const endIso = addDaysIso(startIso, 6);
  const [, em, ed] = endIso.split('-').map(Number);
  if (sm === em) return `${sd}–${ed}.${em}`;
  return `${sd}.${sm}–${ed}.${em}`;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'בקשה לא תקינה' }, { status: 400 });
  }

  const weekStart = String(body.weekStart || '').trim();
  const cityRaw = String(body.city || 'all').trim();
  const city: City = cityRaw === 'lisbon' || cityRaw === 'porto' ? cityRaw : 'all';
  const baseUrlRaw = String(body.baseUrl || '').trim();
  // אופציונלי: שליחה רק למדריכים שהשתנו (פרסום מחדש אחרי תיקון נקודתי)
  const onlyGuideIds: string[] | null = Array.isArray(body.onlyGuideIds)
    ? (body.onlyGuideIds as unknown[]).filter((x): x is string => typeof x === 'string')
    : null;

  if (!ISO_DATE.test(weekStart)) {
    return NextResponse.json({ ok: false, error: 'weekStart לא תקין' }, { status: 400 });
  }
  // baseUrl מגיע מהדפדפן (window.location.origin) — חייב להיות http(s) כדי שהלינק יעבוד
  const baseUrl = /^https?:\/\//.test(baseUrlRaw) ? baseUrlRaw.replace(/\/+$/, '') : '';
  if (!baseUrl) {
    return NextResponse.json({ ok: false, error: 'baseUrl לא תקין' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('[notify-publish] Supabase env vars missing');
    return NextResponse.json({ ok: false, error: 'שגיאה זמנית' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- מי קיבל שיבוץ מפורסם השבוע? ---
  const start = weekStart;
  const end = addDaysIso(weekStart, 6);

  let q = supabase
    .from('shifts')
    .select('guide_id')
    .eq('status', 'published')
    .gte('shift_date', start)
    .lte('shift_date', end)
    .not('guide_id', 'is', null);

  if (city !== 'all') q = q.eq('city', city);

  const { data: shiftRows, error: shiftErr } = await q;
  if (shiftErr) {
    console.error('[notify-publish] shifts query failed:', shiftErr);
    return NextResponse.json({ ok: false, error: 'שגיאה בטעינת שיבוצים' }, { status: 500 });
  }

  let guideIds = Array.from(
    new Set((shiftRows || []).map((r) => (r as { guide_id: string | null }).guide_id).filter(Boolean) as string[]),
  );

  // סינון לנמענים שביקש הלקוח — רק מי שגם משובץ בשבוע וגם ברשימת השינויים
  if (onlyGuideIds) {
    const allow = new Set(onlyGuideIds);
    guideIds = guideIds.filter((id) => allow.has(id));
  }

  if (guideIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, note: 'אין מדריכים משובצים השבוע' });
  }

  const { data: guideRows, error: guideErr } = await supabase
    .from('guides')
    .select('id, name, email')
    .in('id', guideIds);

  if (guideErr) {
    console.error('[notify-publish] guides query failed:', guideErr);
    return NextResponse.json({ ok: false, error: 'שגיאה בטעינת מדריכים' }, { status: 500 });
  }

  const recipients = (guideRows || [])
    .map((g) => g as { id: string; name: string | null; email: string | null })
    .filter((g) => g.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(g.email));

  // --- שליחה ---
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
    console.warn('[notify-publish] GMAIL creds not set — skipping emails');
    return NextResponse.json({ ok: true, sent: 0, note: 'מיילים לא מוגדרים בשרת' });
  }

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });

  const range = formatWeekRange(weekStart);
  const subject = `הסידור לשבוע הבא מוכן · ${range}`;
  const myShiftsUrl = `${baseUrl}/my-shifts`;

  const results = await Promise.allSettled(
    recipients.map((g) =>
      transporter.sendMail({
        from: { name: FROM_NAME, address: gmailUser },
        to: g.email as string,
        subject,
        html: buildEmailHtml(g.name || '', myShiftsUrl, range),
      }),
    ),
  );

  const sent = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.length - sent;
  if (failed > 0) {
    console.error(`[notify-publish] ${failed} emails failed`,
      results.filter((r) => r.status === 'rejected').map((r) => (r as PromiseRejectedResult).reason));
  }

  return NextResponse.json({ ok: true, sent, failed });
}

// ============================================================================
// בניית HTML למייל
// ============================================================================

function buildEmailHtml(name: string, myShiftsUrl: string, range: string): string {
  const greeting = name ? `היי ${escapeHtml(name)} 💚` : 'היי 💚';

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>הסידור פורסם</title>
</head>
<body style="margin:0; padding:24px; background:#f9fafb; font-family:'Heebo','Arial Hebrew','Arial',sans-serif; color:#111827; direction:rtl;">
  <table align="center" style="max-width:520px; width:100%; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,0.06);">
    <tr>
      <td style="background:#0d4d25; color:#ffffff; padding:26px 28px; text-align:center;">
        <div style="font-size:22px; font-weight:700;">🗓️ הסידור לשבוע הבא מוכן</div>
        <div style="font-size:14px; color:#cfe9d8; margin-top:6px;">${escapeHtml(range)}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:30px 28px; text-align:center;">
        <div style="font-size:17px; font-weight:600; margin-bottom:10px;">${greeting}</div>
        <div style="font-size:16px; line-height:1.7; color:#374151; margin-bottom:26px;">
          הסידור החדש פורסם!
        </div>
        <a href="${escapeHtml(myShiftsUrl)}"
           style="display:inline-block; background:#0d4d25; color:#ffffff; text-decoration:none; font-size:16px; font-weight:700; padding:14px 30px; border-radius:999px;">
          👈 לצפייה במשמרות שלי
        </a>
        <div style="font-size:15px; color:#1a7a3d; margin-top:28px;">
          שיהיה שבוע מקסים 🌿
        </div>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
