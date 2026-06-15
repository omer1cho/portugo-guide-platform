/**
 * POST /api/quotes/update — עדכון הצעה קיימת (אדמין). שומר את אותו id/slug,
 * כך שלינק שכבר נשלח ללקוח יציג את הגרסה המעודכנת.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSupabase } from '@/lib/quote-admin';
import type { QuoteSelection } from '@/lib/quote-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAdminSupabase(req);
  if ('error' in auth) return auth.error;
  const { supabase } = auth;

  let body: { id?: string; customerName?: string; selection?: QuoteSelection };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'בקשה לא תקינה' }, { status: 400 });
  }

  const id = String(body.id || '').trim();
  const customerName = String(body.customerName || '').trim().slice(0, 200);
  const selection = body.selection;
  if (!id) return NextResponse.json({ ok: false, error: 'חסר מזהה' }, { status: 400 });
  if (!customerName) return NextResponse.json({ ok: false, error: 'חסר שם מקבל' }, { status: 400 });
  if (!selection || !Array.isArray(selection.tours) || selection.tours.length === 0) {
    return NextResponse.json({ ok: false, error: 'לא נבחרו סיורים' }, { status: 400 });
  }

  const { error } = await supabase
    .from('quotes')
    .update({ customer_name: customerName, selection })
    .eq('id', id);
  if (error) {
    console.error('[quotes/update] failed:', error);
    return NextResponse.json({ ok: false, error: 'שגיאה בשמירה' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, id });
}
