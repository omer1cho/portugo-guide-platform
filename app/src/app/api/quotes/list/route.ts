/**
 * GET /api/quotes/list
 *
 * מחזיר את כל ההצעות לדף הניהול /admin/quotes. טבלת quotes חסומה לקריאה
 * (RLS, service key בלבד), לכן הקריאה עוברת דרך השרת עם service key — אבל קודם
 * מאמתים שהקורא הוא אדמין מחובר (Authorization: Bearer <access_token>).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('[quotes/list] Supabase env vars missing');
    return NextResponse.json({ ok: false, error: 'שגיאה זמנית' }, { status: 500 });
  }

  // ─── אימות: יש access token תקין של משתמש מחובר? ───
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return NextResponse.json({ ok: false, error: 'נדרשת התחברות' }, { status: 401 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user?.email) {
    return NextResponse.json({ ok: false, error: 'התחברות לא תקפה' }, { status: 401 });
  }

  // ─── הרשאה: המשתמש אדמין? ───
  const { data: guide } = await admin
    .from('guides')
    .select('is_admin')
    .ilike('email', userData.user.email)
    .single();
  if (!guide?.is_admin) {
    return NextResponse.json({ ok: false, error: 'אין הרשאה' }, { status: 403 });
  }

  // ─── שליפת ההצעות. אם עמודות response/responded_at עוד לא קיימות (SQL טרם הורץ) —
  //     נופלים לשליפה בלעדיהן כדי שהדף עדיין יעבוד. ───
  const fullCols = 'id, slug, customer_name, created_by, status, created_at, responded_at, response';
  const baseCols = 'id, slug, customer_name, created_by, status, created_at';
  let quotes: unknown[] = [];
  const full = await admin.from('quotes').select(fullCols).order('created_at', { ascending: false }).limit(500);
  if (full.error) {
    const base = await admin.from('quotes').select(baseCols).order('created_at', { ascending: false }).limit(500);
    if (base.error) {
      console.error('[quotes/list] select failed:', base.error);
      return NextResponse.json({ ok: false, error: 'שגיאה בטעינה' }, { status: 500 });
    }
    quotes = base.data || [];
  } else {
    quotes = full.data || [];
  }

  return NextResponse.json({ ok: true, quotes });
}
