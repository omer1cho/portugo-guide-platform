/**
 * GET /api/quotes/get?id=<uuid> — שליפת הצעה בודדת לעריכה (אדמין).
 * מחזיר את ה-selection המלא כדי למלא מחדש את מסך ההזנה.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSupabase } from '@/lib/quote-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdminSupabase(req);
  if ('error' in auth) return auth.error;
  const { supabase } = auth;

  const id = new URL(req.url).searchParams.get('id') || '';
  if (!id) return NextResponse.json({ ok: false, error: 'חסר מזהה' }, { status: 400 });

  const { data, error } = await supabase
    .from('quotes')
    .select('id, slug, customer_name, selection, status')
    .eq('id', id)
    .maybeSingle();
  if (error) {
    console.error('[quotes/get] failed:', error);
    return NextResponse.json({ ok: false, error: 'שגיאה בטעינה' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ ok: false, error: 'ההצעה לא נמצאה' }, { status: 404 });

  return NextResponse.json({ ok: true, quote: data });
}
