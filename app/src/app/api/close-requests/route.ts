/**
 * POST /api/close-requests
 *
 * שער האישור לסגירת חודש (הנחיית עומר 14.8.26): מדריך.ה שרוצה לסגור חודש
 * שולח.ת בקשה שממתינה לאישור עומר. הראוט יוצר רשומה ב-close_requests
 * ושולח מייל לעומר עם המספרים וקישור לדף החודש באדמין.
 *
 * אם כבר קיימת בקשה ממתינה לאותו מדריך+חודש — מחזירים אותה בלי מייל כפול.
 * expected_total = המשכורת הצפויה ברגע הבקשה; האישור נצמד אליה, ומסך
 * הסגירה מפקיע אותו אם המספר השתנה.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const OMER_EMAIL = 'info.portugo@gmail.com';
const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export async function POST(req: NextRequest) {
  let body: { guide_id?: unknown; year?: unknown; month?: unknown; expected_total?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const guideId = String(body.guide_id ?? '');
  const year = Number(body.year);
  const month = Number(body.month); // 1-12
  const expectedTotal = Number(body.expected_total);

  if (!guideId || !Number.isInteger(year) || !Number.isInteger(month) || month < 1 || month > 12 || !Number.isFinite(expectedTotal)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ok: false, error: 'env missing' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // מדריך.ה אמיתי.ת בלבד
  const { data: guide } = await supabase.from('guides').select('id, name').eq('id', guideId).single();
  if (!guide) return NextResponse.json({ ok: false }, { status: 400 });

  // בקשה ממתינה קיימת? מחזירים אותה (בלי מייל נוסף)
  const { data: existing } = await supabase
    .from('close_requests')
    .select('*')
    .eq('guide_id', guideId)
    .eq('year', year)
    .eq('month', month)
    .eq('status', 'pending')
    .maybeSingle();
  if (existing) return NextResponse.json({ ok: true, request: existing, duplicate: true });

  const { data: created, error } = await supabase
    .from('close_requests')
    .insert({ guide_id: guideId, year, month, expected_total: expectedTotal })
    .select('*')
    .single();
  if (error || !created) {
    return NextResponse.json({ ok: false, error: error?.message }, { status: 500 });
  }

  // מייל לעומר — best effort, לא מפיל את הבקשה
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (gmailUser && gmailPass) {
    try {
      const monthLabel = `${MONTH_NAMES[month - 1]} ${year}`;
      const link = `https://portugo-guide-platform.vercel.app/admin/guides/${guideId}/months/${year}/${month}`;
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass },
      });
      await transporter.sendMail({
        from: { name: 'פורטוגו — בקשות סגירה', address: gmailUser },
        to: OMER_EMAIL,
        subject: `בקשת סגירת חודש: ${guide.name} — ${monthLabel}`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.7;">
          <p><strong>${guide.name}</strong> מבקש.ת לסגור את <strong>${monthLabel}</strong>.</p>
          <p>משכורת צפויה למשיכה: <strong>${expectedTotal.toLocaleString('he-IL', { minimumFractionDigits: 2 })}€</strong></p>
          <p><a href="${link}">לפרטי החודש המלאים באדמין</a></p>
          <p>האישור עצמו נעשה בכרטיס "בקשות סגירת חודש" בדשבורד האדמין.</p>
        </div>`,
      });
    } catch (e) {
      console.error('[close-requests] email send error:', e);
    }
  }

  return NextResponse.json({ ok: true, request: created });
}
