/**
 * POST /api/quotes/create
 *
 * יוצר הצעת מחיר חדשה ושומר אותה בטבלת quotes. מחזיר את ה-id (ה-uuid),
 * שממנו נבנה הלינק ללקוח: /quote/[id].
 *
 * משתמש ב-service role key (server-side בלבד) כדי לעקוף RLS — בטוח כי הקוד
 * רץ רק על השרת. הגישה לטבלה חסומה ל-anon (RLS מופעל, אין מדיניות ציבורית).
 *
 * "נוצר ע\"י" נקבע כאן בשרת לפי חשבון ההתחברות שבטוקן, ולא לפי מה שהדפדפן
 * שולח. זה מה שמבטיח שהשדה תמיד יחזיק את מי שבאמת יצרה (עומר/רונה),
 * ולא את המדריך שמתג התצוגה באדמין היה עליו (התקלה של 4.9.26).
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAdminSupabase } from '@/lib/quote-admin';
import type { QuoteSelection } from '@/lib/quote-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const auth = await requireAdminSupabase(req);
  if ('error' in auth) return auth.error;
  const { supabase, name: createdBy } = auth;

  let body: { customerName?: string; selection?: QuoteSelection };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'בקשה לא תקינה' }, { status: 400 });
  }

  const customerName = String(body.customerName || '').trim().slice(0, 200);
  const selection = body.selection;

  if (!customerName) {
    return NextResponse.json({ ok: false, error: 'חסר שם מקבל' }, { status: 400 });
  }
  if (!selection || !Array.isArray(selection.tours) || selection.tours.length === 0) {
    return NextResponse.json({ ok: false, error: 'לא נבחרו סיורים' }, { status: 400 });
  }
  if (!Array.isArray(selection.columns) || selection.columns.length === 0) {
    return NextResponse.json({ ok: false, error: 'חסר הרכב קבוצה' }, { status: 400 });
  }

  const row = {
    created_by: createdBy,
    customer_name: customerName,
    selection,
    language: 'he',
    status: 'sent',
  };

  // מנסים לקבל גם slug (קוד קצר ללינק). אם עמודת slug עוד לא קיימת — נופלים חזרה ל-id בלבד.
  let id: string;
  let slug: string | null = null;
  const withSlug = await supabase.from('quotes').insert(row).select('id, slug').single();
  if (!withSlug.error) {
    id = withSlug.data.id;
    slug = (withSlug.data as { slug?: string | null }).slug ?? null;
  } else {
    const idOnly = await supabase.from('quotes').insert(row).select('id').single();
    if (idOnly.error) {
      console.error('[quotes/create] insert failed:', idOnly.error);
      return NextResponse.json({ ok: false, error: 'שגיאה בשמירה, נסו שוב' }, { status: 500 });
    }
    id = idOnly.data.id;
  }

  return NextResponse.json({ ok: true, id, slug });
}
