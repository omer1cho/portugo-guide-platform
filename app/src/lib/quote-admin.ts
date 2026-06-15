/**
 * עזר שרת לפעולות אדמין על הצעות מחיר (list / get / update / delete).
 *
 * טבלת quotes חסומה לקריאה/כתיבה מבחוץ (RLS, service key בלבד), לכן הפעולות
 * עוברות דרך השרת עם service key — אבל קודם מאמתים שהקורא אדמין מחובר
 * (Authorization: Bearer <access_token>).
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export type AdminResult =
  | { supabase: SupabaseClient; email: string }
  | { error: NextResponse };

export async function requireAdminSupabase(req: NextRequest): Promise<AdminResult> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return { error: NextResponse.json({ ok: false, error: 'שגיאה זמנית' }, { status: 500 }) };
  }

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) {
    return { error: NextResponse.json({ ok: false, error: 'נדרשת התחברות' }, { status: 401 }) };
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await supabase.auth.getUser(token);
  if (userErr || !userData.user?.email) {
    return { error: NextResponse.json({ ok: false, error: 'התחברות לא תקפה' }, { status: 401 }) };
  }

  const { data: guide } = await supabase
    .from('guides')
    .select('is_admin')
    .ilike('email', userData.user.email)
    .single();
  if (!guide?.is_admin) {
    return { error: NextResponse.json({ ok: false, error: 'אין הרשאה' }, { status: 403 }) };
  }

  return { supabase, email: userData.user.email };
}
