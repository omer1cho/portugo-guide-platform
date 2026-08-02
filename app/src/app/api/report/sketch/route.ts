/**
 * GET /api/report/sketch?k=gogo-report-2026
 *
 * שולח את סקיצת הדוח הדו-שבועי למייל של פורטוגו (info.portugo@gmail.com)
 * דרך Gmail SMTP — לצורך אישור המבנה ע"י עומר.
 *
 * הנמען והתוכן קבועים בקוד בכוונה: הנקודה הזו לא מקבלת שום קלט חופשי,
 * כך שאי אפשר לנצל אותה לשליחת ספאם. המפתח k באותו סגנון כמו /api/tips-events.
 * כשהדוח האמיתי ייבנה, הראוט הזה יתפתח לראוט הקרון של הדוח.
 */

import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { REPORT_SKETCH_HTML } from '@/lib/report/sketch-html';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ACCESS_KEY = 'gogo-report-2026';
const TO_EMAIL = 'info.portugo@gmail.com';

export async function GET(req: NextRequest) {
  const k = req.nextUrl.searchParams.get('k');
  if (k !== ACCESS_KEY) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
    return NextResponse.json(
      { ok: false, error: 'GMAIL_USER / GMAIL_APP_PASSWORD not configured' },
      { status: 500 },
    );
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
    });
    await transporter.sendMail({
      from: { name: 'פורטוגו — דוח דו-שבועי', address: gmailUser },
      to: TO_EMAIL,
      subject: 'סקיצה לאישור: הדוח הדו-שבועי של פורטוגו',
      html: REPORT_SKETCH_HTML,
    });
    return NextResponse.json({ ok: true, sentTo: TO_EMAIL });
  } catch (e) {
    console.error('[report/sketch] email send error:', e);
    return NextResponse.json({ ok: false, error: 'send failed' }, { status: 500 });
  }
}
