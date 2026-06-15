/**
 * GET /api/quotes/list
 *
 * מחזיר את כל ההצעות לדף הניהול /admin/quotes (service key + אימות אדמין).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSupabase } from '@/lib/quote-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requireAdminSupabase(req);
  if ('error' in auth) return auth.error;
  const { supabase } = auth;

  // אם עמודות response/responded_at עוד לא קיימות — נופלים לשליפה בלעדיהן.
  const fullCols = 'id, slug, customer_name, created_by, status, created_at, responded_at, response';
  const baseCols = 'id, slug, customer_name, created_by, status, created_at';
  let quotes: unknown[] = [];
  const full = await supabase.from('quotes').select(fullCols).order('created_at', { ascending: false }).limit(500);
  if (full.error) {
    const base = await supabase.from('quotes').select(baseCols).order('created_at', { ascending: false }).limit(500);
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
