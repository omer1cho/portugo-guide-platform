/**
 * GET /api/admin/salary-audit
 *
 * משווה, לכל סיור פרטי שנרשם אי פעם, בין מה שמחשבון השכר החי משלם
 * (`calcPrivateSalary`) לבין מה שכתוב במסמכים שהמדריכים מחזיקים
 * (`salary-declared.ts`), ומחזיר את רשימת הפערים.
 *
 * רץ עם service role key בצד שרת בלבד (הנתונים חוצי-מדריכים ו-RLS חוסם
 * anon), ולכן **חובה** לוודא שהקורא הוא אדמין לפני שמחזירים משהו.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { calcPrivateSalary } from '@/lib/salary';
import { declaredPrivateSalary } from '@/lib/salary-declared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BookingRow = { people: number | null };
type TourRow = {
  id: string;
  tour_date: string;
  tour_type: string | null;
  notes: string | null;
  guide_id: string | null;
  bookings: BookingRow[] | null;
};

export type AuditRow = {
  tour_id: string;
  tour_date: string;
  guide: string;
  notes: string;
  people: number;
  matched: string[];
  system: number;
  declared: number | null;
  diff: number | null;
  /** אין התאמה לשום טבלה — המחשבון נופל לברירת מחדל (טבלת הקלאסי). */
  unmatched: boolean;
  /** גודל הקבוצה מחוץ לטווח שהמסמך מכסה — ההשוואה לא מובהקת. */
  outsideRange: boolean;
};

export async function GET(req: NextRequest) {
  // ─── אימות אדמין (לפני כל דבר אחר) ───
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim();
  if (!token) {
    return NextResponse.json({ ok: false, error: 'נדרשת התחברות' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    console.error('[salary-audit] Supabase env vars missing');
    return NextResponse.json({ ok: false, error: 'שגיאה זמנית, נסו שוב' }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  const email = userData?.user?.email;
  if (userErr || !email) {
    return NextResponse.json({ ok: false, error: 'נדרשת התחברות' }, { status: 401 });
  }

  const { data: caller } = await admin
    .from('guides')
    .select('is_admin')
    .ilike('email', email)
    .maybeSingle();

  if (!caller?.is_admin) {
    return NextResponse.json({ ok: false, error: 'העמוד הזה למנהלים בלבד' }, { status: 403 });
  }

  // ─── שליפת כל הסיורים הפרטיים ───
  const { data: guides } = await admin.from('guides').select('id, name');
  const guideName = new Map((guides || []).map((g) => [g.id as string, g.name as string]));

  const { data: tours, error: toursErr } = await admin
    .from('tours')
    .select('id, tour_date, tour_type, notes, guide_id, bookings(people)')
    .eq('category', 'private')
    .order('tour_date', { ascending: true });

  if (toursErr) {
    console.error('[salary-audit] tours query failed:', toursErr.message);
    return NextResponse.json({ ok: false, error: 'שליפת הסיורים נכשלה' }, { status: 500 });
  }

  const rows: AuditRow[] = [];
  for (const t of (tours || []) as TourRow[]) {
    const people = (t.bookings || []).reduce((s, b) => s + (b.people || 0), 0);
    if (people <= 0) continue;

    const notes = t.notes || '';
    const system = calcPrivateSalary(people, notes, t.tour_date);
    const { amount: declared, keywords, outsideRange } = declaredPrivateSalary(people, notes);

    rows.push({
      tour_id: t.id,
      tour_date: t.tour_date,
      guide: guideName.get(t.guide_id || '') || 'לא ידוע',
      notes,
      people,
      matched: keywords,
      system,
      declared,
      diff: declared === null ? null : system - declared,
      unmatched: keywords.length === 0,
      outsideRange,
    });
  }

  const gaps = rows.filter((r) => r.diff !== null && r.diff !== 0);
  const overpaid = gaps.filter((r) => (r.diff as number) > 0);
  const underpaid = gaps.filter((r) => (r.diff as number) < 0);

  return NextResponse.json({
    ok: true,
    summary: {
      total_private_tours: rows.length,
      tours_with_gap: gaps.length,
      unmatched: rows.filter((r) => r.unmatched).length,
      overpaid_count: overpaid.length,
      overpaid_total: overpaid.reduce((s, r) => s + (r.diff as number), 0),
      underpaid_count: underpaid.length,
      underpaid_total: underpaid.reduce((s, r) => s + (r.diff as number), 0),
      net_total: gaps.reduce((s, r) => s + (r.diff as number), 0),
    },
    rows: gaps,
    unmatchedRows: rows.filter((r) => r.unmatched),
  });
}
