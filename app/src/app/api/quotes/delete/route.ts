/**
 * POST /api/quotes/delete — מחיקת הצעה (אדמין). מוחק לצמיתות לפי id.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSupabase } from '@/lib/quote-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAdminSupabase(req);
  if ('error' in auth) return auth.error;
  const { supabase } = auth;

  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'בקשה לא תקינה' }, { status: 400 });
  }
  const id = String(body.id || '').trim();
  if (!id) return NextResponse.json({ ok: false, error: 'חסר מזהה' }, { status: 400 });

  const { error } = await supabase.from('quotes').delete().eq('id', id);
  if (error) {
    console.error('[quotes/delete] failed:', error);
    return NextResponse.json({ ok: false, error: 'שגיאה במחיקה' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
