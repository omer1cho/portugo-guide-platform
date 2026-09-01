/**
 * Cron יומי (7:00 שעון ליסבון) — מיילי יום הולדת לצוות.
 *
 * בודק אם למישהו.מישהי מהצוות הפעיל יש היום יום הולדת (guides.birthday,
 * פורמט MM-DD) ושולח מייל חגיגי לכל הצוות (BCC לכל המדריכים הפעילים עם
 * מייל). הוראת עומר 1.9.26. מאומת עם CRON_SECRET כמו הסנכרון.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import nodemailer from 'nodemailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  const expected = `Bearer ${process.env.CRON_SECRET}`;
  if (!process.env.CRON_SECRET || auth !== expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    return NextResponse.json({ error: 'env missing' }, { status: 500 });
  }
  const supabase = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // היום לפי שעון ליסבון (שם הצוות חי) → MM-DD
  const todayMmDd = new Date()
    .toLocaleDateString('en-CA', { timeZone: 'Europe/Lisbon' })
    .slice(5);

  const { data: guides, error } = await supabase
    .from('guides')
    .select('id, name, email, birthday, is_active')
    .eq('is_active', true);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const all = guides || [];
  const celebrants = all.filter((g) => (g.birthday || '') === todayMmDd);
  if (celebrants.length === 0) {
    return NextResponse.json({ ok: true, today: todayMmDd, celebrants: 0 });
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
    return NextResponse.json({ ok: false, error: 'gmail env missing' }, { status: 500 });
  }
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });

  let sent = 0;
  for (const c of celebrants) {
    // 1. ברכה אישית חמודה לחוגג.ת, מאיתנו
    if (c.email) {
      try {
        await transporter.sendMail({
          from: { name: 'עומר וכל צוות פורטוגו', address: gmailUser },
          to: c.email,
          subject: `🎂 מזל טוב ${c.name}! יום הולדת שמח מכולנו`,
          html: `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.9;text-align:center;padding:24px;background:#f0fdf4;border-radius:16px;">
            <div style="font-size:44px;">🎉🎂🎈</div>
            <h2 style="margin:12px 0;color:#166534;">מזל טוב ${c.name}!</h2>
            <p>שיהיה לך יום מתוק כמו פסטל דה נאטה טרי,<br>
            שנה של סיורים מלאים באנשים טובים,<br>
            טיפים נדיבים, ושמש ליסבונית גם בימים האפורים.</p>
            <p style="font-weight:bold;">איזה כיף שיש אותך בצוות 💚</p>
            <p style="color:#666;">באהבה,<br>עומר וכל צוות פורטוגו</p>
          </div>`,
        });
        sent++;
      } catch (e) {
        console.error('[birthday-greetings] personal greeting failed for', c.name, e);
      }
    }

    // 2. הכרזה לשאר הצוות (בלי החוגג.ת - הברכה האישית שלו.ה כבר בדרך)
    const bcc = all
      .filter((g) => g.id !== c.id)
      .map((g) => g.email)
      .filter((e): e is string => !!e);
    try {
      await transporter.sendMail({
        from: { name: 'פורטוגו', address: gmailUser },
        to: gmailUser,
        bcc,
        subject: `🎂 היום יום ההולדת של ${c.name}!`,
        html: `<div dir="rtl" style="font-family:Arial,sans-serif;font-size:16px;line-height:1.8;text-align:center;padding:20px;">
          <div style="font-size:40px;">🎉🎂🎈</div>
          <h2 style="margin:10px 0;">היום יום ההולדת של ${c.name}!</h2>
          <p>כל צוות פורטוגו מאחל.ת מזל טוב, שנה של סיורים מלאים, טיפים נדיבים והמון נחת 💚</p>
          <p style="color:#888;font-size:13px;">אל תשכחו לפרגן בקבוצה 😉</p>
        </div>`,
      });
      sent++;
    } catch (e) {
      console.error('[birthday-greetings] team announcement failed for', c.name, e);
    }
  }

  return NextResponse.json({ ok: true, today: todayMmDd, celebrants: celebrants.map((c) => c.name), sent });
}
