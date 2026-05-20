/**
 * POST /api/consultations
 *
 * מקבל שאלון ייעוץ מסלול מ-/consultation, שומר ל-Supabase, ושולח מייל
 * התראה לעומר (info.portugo@gmail.com) דרך Brevo.
 *
 * אם BREVO_API_KEY לא מוגדר ב-env — הדאטה עדיין נשמרת, רק המייל לא יישלח.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import {
  ConsultationSubmission,
  FIELD_LABELS,
  FIELD_ORDER,
} from '@/lib/consultation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ADMIN_EMAIL = 'info.portugo@gmail.com';
const FROM_EMAIL = 'info.portugo@gmail.com';
const FROM_NAME = 'פורטוגו — שאלון ייעוץ';

// כל השדות שמותרים להגיע מבחוץ (whitelist) — מונע injection של עמודות אקראיות
const ALLOWED_FIELDS = new Set<keyof ConsultationSubmission>(FIELD_ORDER);

const ARRAY_FIELDS = new Set<keyof ConsultationSubmission>([
  'style_types',
  'transport',
  'interests',
  'lodging_level',
  'lodging_type',
  'avoid_list',
  'service_focus',
]);

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'בקשה לא תקינה' }, { status: 400 });
  }

  // --- ולידציה של שדות חובה ---
  const fullName = String(body.full_name || '').trim();
  const phone = String(body.phone || '').trim();
  const email = String(body.email || '').trim();

  if (!fullName) return NextResponse.json({ ok: false, error: 'שם מלא הוא שדה חובה' }, { status: 400 });
  if (!phone) return NextResponse.json({ ok: false, error: 'טלפון/וואטסאפ הוא שדה חובה' }, { status: 400 });
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ ok: false, error: 'אנא הזינו אימייל תקין' }, { status: 400 });
  }

  // --- בניית רשומה לשמירה (רק שדות מותרים) ---
  const row: Record<string, unknown> = {
    full_name: fullName,
    phone,
    email,
    user_agent: req.headers.get('user-agent')?.slice(0, 500) ?? null,
  };

  for (const key of FIELD_ORDER) {
    if (key === 'full_name' || key === 'phone' || key === 'email') continue;
    if (!ALLOWED_FIELDS.has(key)) continue;

    const value = body[key];
    if (value === undefined || value === null) continue;

    if (ARRAY_FIELDS.has(key)) {
      if (Array.isArray(value)) {
        const arr = value.map(v => String(v)).filter(Boolean).slice(0, 100);
        if (arr.length > 0) row[key] = arr;
      }
    } else {
      const str = String(value).trim().slice(0, 5000);
      if (str) row[key] = str;
    }
  }

  // --- שמירה ל-Supabase ---
  // משתמשים ב-service role key (server-side only) כדי לעקוף RLS — בטוח כי הקוד
  // הזה רץ רק על השרת ולא נחשף לדפדפן. ה-anon key לא מספיק כי ה-publishable
  // key החדש של Supabase לא מקבל אוטומטית GRANT INSERT על טבלאות חדשות.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('[consultations] Supabase env vars missing');
    return NextResponse.json({ ok: false, error: 'שגיאה זמנית, נסו שוב מעט מאוחר יותר' }, { status: 500 });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: inserted, error } = await supabase
    .from('consultations')
    .insert(row)
    .select('id, created_at')
    .single();

  if (error) {
    console.error('[consultations] insert failed:', error);
    return NextResponse.json({ ok: false, error: 'שגיאה בשמירה, נסו שוב' }, { status: 500 });
  }

  // --- שליחת מייל התראה דרך Brevo (best-effort, לא מפיל את הבקשה) ---
  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) {
    try {
      const html = buildEmailHtml(row, inserted.id);
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': brevoKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          sender: { name: FROM_NAME, email: FROM_EMAIL },
          to: [{ email: ADMIN_EMAIL, name: 'עומר' }],
          replyTo: { email: email, name: fullName },
          subject: `🌸 שאלון ייעוץ חדש — ${fullName}`,
          htmlContent: html,
        }),
      });
      if (!res.ok) {
        const text = await res.text();
        console.error('[consultations] Brevo failed:', res.status, text.slice(0, 500));
      }
    } catch (e) {
      console.error('[consultations] email send error:', e);
    }
  } else {
    console.warn('[consultations] BREVO_API_KEY not set — skipping email notification');
  }

  return NextResponse.json({ ok: true, id: inserted.id });
}

// ============================================================================
// בניית HTML למייל ההתראה
// ============================================================================

function buildEmailHtml(row: Record<string, unknown>, id: string): string {
  const rows: string[] = [];

  for (const key of FIELD_ORDER) {
    const value = row[key];
    if (value === undefined || value === null || value === '') continue;

    const label = FIELD_LABELS[key];
    let displayValue: string;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      displayValue = value.map(v => `• ${escapeHtml(String(v))}`).join('<br>');
    } else {
      displayValue = escapeHtml(String(value)).replace(/\n/g, '<br>');
    }

    rows.push(`
      <tr>
        <td style="padding:10px 14px; background:#f0fdf4; color:#0d4d25; font-weight:600; width:35%; vertical-align:top; border-bottom:1px solid #e0f2e7;">
          ${escapeHtml(label)}
        </td>
        <td style="padding:10px 14px; color:#111827; line-height:1.6; border-bottom:1px solid #e0f2e7;">
          ${displayValue}
        </td>
      </tr>
    `);
  }

  const submittedAt = new Date().toLocaleString('he-IL', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
<meta charset="utf-8">
<title>שאלון ייעוץ חדש</title>
</head>
<body style="margin:0; padding:24px; background:#f9fafb; font-family:'Heebo','Arial Hebrew','Arial',sans-serif; color:#111827; direction:rtl;">
  <table align="center" style="max-width:680px; width:100%; background:#ffffff; border-radius:14px; overflow:hidden; box-shadow:0 2px 10px rgba(0,0,0,0.05);">
    <tr>
      <td style="background:#0d4d25; color:#ffffff; padding:24px 28px;">
        <div style="font-size:22px; font-weight:700; margin-bottom:4px;">🌸 שאלון ייעוץ חדש</div>
        <div style="font-size:13px; color:#cfe9d8;">${escapeHtml(submittedAt)}</div>
      </td>
    </tr>
    <tr>
      <td style="padding:0;">
        <table style="width:100%; border-collapse:collapse;">
          ${rows.join('')}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 28px; background:#f0fdf4; color:#1a7a3d; font-size:13px;">
        אפשר להגיב ישירות למייל זה כדי לחזור ללקוח (Reply-To מוגדר על המייל שלו).<br>
        <span style="color:#6b7280;">מזהה פנייה: ${escapeHtml(id)}</span>
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
