/**
 * POST /api/close-requests/decide
 *
 * החלטת עומר על בקשת סגירת חודש (אישור/דחייה) + מייל אוטומטי למדריך.ה.
 * נקרא מכרטיס "בקשות סגירת חודש" בדשבורד האדמין. העדכון נעשה כאן (בשרת)
 * כדי שאפשר יהיה לשלוח את המייל באותה פעולה.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MONTH_NAMES = ['ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני', 'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'];

export async function POST(req: NextRequest) {
  let body: { request_id?: unknown; status?: unknown; admin_note?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const requestId = String(body.request_id ?? '');
  const status = String(body.status ?? '');
  const adminNote = body.admin_note ? String(body.admin_note).slice(0, 500) : null;

  if (!requestId || !['approved', 'rejected'].includes(status)) {
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

  const { data: updated, error } = await supabase
    .from('close_requests')
    .update({ status, admin_note: adminNote, decided_at: new Date().toISOString() })
    .eq('id', requestId)
    .eq('status', 'pending')
    .select('*')
    .single();
  if (error || !updated) {
    return NextResponse.json({ ok: false, error: error?.message || 'request not found or already decided' }, { status: 400 });
  }

  // מייל למדריך.ה — best effort
  const { data: guide } = await supabase.from('guides').select('name, email').eq('id', updated.guide_id).single();
  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (guide?.email && gmailUser && gmailPass) {
    try {
      const monthLabel = `${MONTH_NAMES[updated.month - 1]} ${updated.year}`;
      const approved = status === 'approved';
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: gmailUser, pass: gmailPass },
      });
      await transporter.sendMail({
        from: { name: 'פורטוגו', address: gmailUser },
        to: guide.email,
        subject: approved
          ? `עומר אישרה את סגירת ${monthLabel} 🎉`
          : `סגירת ${monthLabel} — עומר ביקשה להמתין`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:15px;line-height:1.8;">
          <p>היי ${guide.name},</p>
          ${approved
            ? `<p>עומר אישרה את סגירת <strong>${monthLabel}</strong>. אפשר להיכנס לאפליקציה ולהשלים את הסגירה.</p>`
            : `<p>עומר ביקשה להמתין רגע עם סגירת <strong>${monthLabel}</strong>.</p>`}
          ${adminNote ? `<p>הערה מעומר: "${adminNote}"</p>` : ''}
          <p><a href="https://portugo-guide-platform.vercel.app/close-month">למסך סגירת החודש</a></p>
          <p>פורטוגו 💚</p>
        </div>`,
      });
    } catch (e) {
      console.error('[close-requests/decide] email send error:', e);
    }
  }

  return NextResponse.json({ ok: true, request: updated });
}
