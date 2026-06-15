/**
 * POST /api/quotes/respond
 *
 * מקבל את תגובת הלקוח מעמוד ההצעה /quote/[uuid]: אילו סיורים סימן, תאריך לכל
 * אחד, וטקסט חופשי. שומר על שורת ההצעה (response jsonb + responded_at + status),
 * ושולח מייל התראה לעומר ולרונה דרך Gmail SMTP.
 *
 * ציבורי (הלקוח לא מחובר) — בדיוק כמו /api/consultations. הגישה לטבלה דרך
 * service role key (server-side בלבד), RLS חוסם anon.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';
import type { QuoteResponse, QuoteResponseTour } from '@/lib/quote-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

// נמענים להתראה. רונה תתווסף כשעומר תמסור את המייל שלה.
const NOTIFY_EMAILS = ['info.portugo@gmail.com'];
const FROM_NAME = 'פורטוגו — תגובת לקוח להצעה';

type QuoteRow = {
  id: string;
  slug: string | null;
  customer_name: string;
};

export async function POST(req: NextRequest) {
  let body: { idOrSlug?: string; response?: QuoteResponse };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'בקשה לא תקינה' }, { status: 400 });
  }

  const idOrSlug = String(body.idOrSlug || '').trim().slice(0, 100);
  const resp = body.response;
  if (!idOrSlug) {
    return NextResponse.json({ ok: false, error: 'חסר מזהה הצעה' }, { status: 400 });
  }
  if (!resp || !Array.isArray(resp.tours)) {
    return NextResponse.json({ ok: false, error: 'אין בחירות לשליחה' }, { status: 400 });
  }

  // ניקוי + הגבלת התגובה (whitelist שדות, חיתוך אורך)
  const cleanTours: QuoteResponseTour[] = resp.tours
    .slice(0, 50)
    .map((t) => ({
      card: String(t?.card || '').slice(0, 100),
      name: String(t?.name || '').slice(0, 200),
      date: t?.date ? String(t.date).slice(0, 20) : undefined,
    }))
    .filter((t) => t.name);
  const cleanResponse: QuoteResponse = {
    tours: cleanTours,
    notes: resp.notes ? String(resp.notes).trim().slice(0, 5000) : undefined,
    submittedAt: new Date().toISOString(),
  };

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('[quotes/respond] Supabase env vars missing');
    return NextResponse.json({ ok: false, error: 'שגיאה זמנית, נסו שוב' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // איתור ההצעה (slug תחילה, ואז uuid לתאימות לאחור)
  const cols = 'id, slug, customer_name';
  let quote: QuoteRow | null = null;
  const bySlug = await supabase.from('quotes').select(cols).eq('slug', idOrSlug).maybeSingle();
  if (bySlug.data) {
    quote = bySlug.data as QuoteRow;
  } else if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(idOrSlug)) {
    const byId = await supabase.from('quotes').select(cols).eq('id', idOrSlug).maybeSingle();
    if (byId.data) quote = byId.data as QuoteRow;
  }
  if (!quote) {
    return NextResponse.json({ ok: false, error: 'ההצעה לא נמצאה' }, { status: 404 });
  }

  // שמירת התגובה. אם עמודות response/responded_at עוד לא קיימות (ה-SQL טרם הורץ) —
  // נופלים לעדכון status בלבד, והמייל למטה עדיין יוצא (התגובה לא נעלמת).
  const full = await supabase
    .from('quotes')
    .update({ response: cleanResponse, responded_at: cleanResponse.submittedAt, status: 'responded' })
    .eq('id', quote.id);
  if (full.error) {
    console.error('[quotes/respond] full update failed, falling back to status only:', full.error);
    await supabase.from('quotes').update({ status: 'responded' }).eq('id', quote.id);
  }

  // מייל התראה (best-effort — לא מפיל את הבקשה)
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (gmailUser && gmailPass) {
    try {
      const link = buildQuoteLink(req, quote.slug || quote.id);
      const html = buildEmailHtml(quote.customer_name, cleanResponse, link);
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass },
      });
      await transporter.sendMail({
        from: { name: FROM_NAME, address: gmailUser },
        to: NOTIFY_EMAILS,
        subject: `🧾 ${quote.customer_name} הגיב/ה להצעת המחיר`,
        html,
      });
    } catch (e) {
      console.error('[quotes/respond] email send error:', e);
    }
  } else {
    console.warn('[quotes/respond] GMAIL creds missing — skipping email');
  }

  return NextResponse.json({ ok: true });
}

// ============================================================================

function buildQuoteLink(req: NextRequest, idOrSlug: string): string {
  const origin = req.headers.get('origin') || new URL(req.url).origin;
  return `${origin}/quote/${idOrSlug}`;
}

function isoToHe(iso?: string): string {
  if (!iso) return '';
  const p = iso.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

function buildEmailHtml(customerName: string, resp: QuoteResponse, link: string): string {
  const tourRows = resp.tours.length
    ? resp.tours
        .map(
          (t) => `
      <tr>
        <td style="padding:10px 14px; background:#f0fdf4; color:#0d4d25; font-weight:600; width:60%; vertical-align:top; border-bottom:1px solid #e0f2e7;">
          ${escapeHtml(t.name)}
        </td>
        <td style="padding:10px 14px; color:#111827; border-bottom:1px solid #e0f2e7;">
          ${t.date ? '📅 ' + escapeHtml(isoToHe(t.date)) : '<span style="color:#9ca3af;">ללא תאריך</span>'}
        </td>
      </tr>`,
        )
        .join('')
    : `<tr><td style="padding:10px 14px; color:#6b7280;" colspan="2">הלקוח לא סימן סיורים ספציפיים.</td></tr>`;

  const notesBlock = resp.notes
    ? `<tr>
        <td style="padding:14px; background:#fff7ed; color:#9a3412; font-weight:600; vertical-align:top;">הערות הלקוח</td>
        <td style="padding:14px; color:#111827; line-height:1.6;">${escapeHtml(resp.notes).replace(/\n/g, '<br>')}</td>
      </tr>`
    : '';

  const submittedAt = new Date(resp.submittedAt).toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  return `<!doctype html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><title>תגובת לקוח להצעה</title></head>
<body style="margin:0; padding:24px; background:#f9fafb; font-family:'Heebo','Arial Hebrew','Arial',sans-serif; color:#111827; direction:rtl;">
  <table align="center" style="max-width:680px; width:100%; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
    <tr>
      <td style="background:#0d4d25; color:#ffffff; padding:24px 28px;">
        <div style="font-size:22px; font-weight:700; margin-bottom:4px;">🧾 ${escapeHtml(customerName)} הגיב/ה להצעה</div>
        <div style="font-size:13px; color:#cfe9d8;">${escapeHtml(submittedAt)}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 28px 6px; font-size:15px; color:#374151; font-weight:600;">הסיורים שסימן/ה:</td>
    </tr>
    <tr>
      <td style="padding:0 16px;">
        <table style="width:100%; border-collapse:collapse;">${tourRows}${notesBlock}</table>
      </td>
    </tr>
    <tr>
      <td style="padding:22px 28px;">
        <a href="${escapeHtml(link)}" style="display:inline-block; background:#c4602f; color:#fff; text-decoration:none; padding:12px 24px; border-radius:8px; font-weight:700; font-size:15px;">צפייה בהצעה המלאה ←</a>
      </td>
    </tr>
    <tr>
      <td style="padding:14px 28px; background:#f0fdf4; color:#6b7280; font-size:13px;">
        זוהי בקשה לבדיקת זמינות, לא אישור סופי. כדאי לחזור ללקוח לתיאום.
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
