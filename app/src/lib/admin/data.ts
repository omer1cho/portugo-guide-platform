/**
 * Admin data layer — שאיבת נתונים מצרפיים לכל המדריכים
 *
 * הפונקציה הראשית: `loadMonthSnapshot` — שואבת בקובץ אחד את כל
 * המדריכים הפעילים + הסיורים + הפעילויות + ההוצאות + ההעברות שלהם
 * לחודש מסוים, ומריצה את `calculateMonthlySalary` על כל מדריך.
 *
 * החזרה: GuideMonthSummary[] — מערך עם כל מה שצריך לעמוד הראשי של אדמין.
 */

import { supabase, type Guide } from '@/lib/supabase';
import {
  calculateMonthlySalary,
  type SalaryBreakdown,
  type SalaryTour,
  type SalaryActivity,
} from '@/lib/salary';

export type GuideStatus = 'empty' | 'open' | 'closed' | 'awaiting_deposit';

export type GuideMonthSummary = {
  guide: Pick<
    Guide,
    | 'id'
    | 'name'
    | 'city'
    | 'travel_type'
    | 'has_mgmt_bonus'
    | 'mgmt_bonus_amount'
    | 'has_vat'
    | 'classic_transfer_per_person'
    | 'is_admin'
  >;
  tours_count: number;
  people_count: number;
  cash_collected: number;
  expenses_total: number;
  transfers_total: number; // סה"כ כסף שהמדריך העביר לבנק (to_portugo)
  salary_withdrawn: number; // משכורת שהמדריך משך מהקופה
  status: GuideStatus;
  closed_at: string | null; // תאריך סגירת החודש (אם נסגר)
  salary: SalaryBreakdown;
  /** סיורים בלי תמונה (ולא photo_skipped=true) — דוח חודשי */
  missing_photos: number;
  /** רשימת הסיורים החסרים תמונה — לתצוגה מפורטת */
  missing_photos_list: { id: string; tour_date: string; tour_type: string }[];
  /** סה"כ ממתין להפקדה (חוצה חודשים — נצבר עד שהמדריך מפקיד פיזית) */
  pending_total: number;
};

export type MonthSnapshot = {
  year: number;
  month: number; // 0-indexed
  guides: GuideMonthSummary[];
  totals: {
    tours: number;
    people: number;
    cash_collected: number;
    expenses: number;
    salary_total_with_tips: number;
    salary_to_pay: number; // total transfer_amount + vat_amount (מה שפורטוגו מעבירה, כולל מע"מ למי שיש)
    closed_count: number;
    open_count: number;
    pending_total: number; // סה"כ כסף שממתין להפקדה אצל כל המדריכים
    missing_photos_total: number; // סה"כ סיורים בלי תמונה
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function monthBounds(year: number, month: number) {
  const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  return { start, end };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

/**
 * שואב snapshot חודשי לכל המדריכים הפעילים (לא אדמינים).
 * אם רוצים גם אדמינים בתצוגה — שלחי includeAdmins=true.
 */
export async function loadMonthSnapshot(
  year: number,
  month: number,
  options: { includeAdmins?: boolean; cityFilter?: 'lisbon' | 'porto' | 'all' } = {},
): Promise<MonthSnapshot> {
  const { includeAdmins = false, cityFilter = 'all' } = options;
  const { start, end } = monthBounds(year, month);

  // ─── שלב 1: כל המדריכים הפעילים ─────────────────────────────────────────
  let guidesQ = supabase
    .from('guides')
    .select(
      'id, name, city, travel_type, has_mgmt_bonus, mgmt_bonus_amount, has_vat, classic_transfer_per_person, is_admin, is_active',
    )
    .eq('is_active', true)
    .order('name');

  if (cityFilter !== 'all') {
    guidesQ = guidesQ.eq('city', cityFilter);
  }
  if (!includeAdmins) {
    guidesQ = guidesQ.eq('is_admin', false);
  }

  const { data: guidesRaw, error: guidesErr } = await guidesQ;
  if (guidesErr) throw guidesErr;
  const guides = (guidesRaw || []) as (GuideMonthSummary['guide'] & { is_active: boolean })[];

  if (guides.length === 0) {
    return {
      year,
      month,
      guides: [],
      totals: {
        tours: 0,
        people: 0,
        cash_collected: 0,
        expenses: 0,
        salary_total_with_tips: 0,
        salary_to_pay: 0,
        closed_count: 0,
        open_count: 0,
        pending_total: 0,
        missing_photos_total: 0,
      },
    };
  }

  const guideIds = guides.map((g) => g.id);

  // ─── שלב 2: סיורים + הזמנות, פעילויות, הוצאות, העברות — בקריאות מקבילות ─
  const [toursRes, actsRes, expsRes, trsRes, pendingRes] = await Promise.all([
    supabase
      .from('tours')
      .select(
        'id, guide_id, tour_date, tour_type, category, notes, photo_url, photo_skipped, bookings(people, kids, price, tip)',
      )
      .in('guide_id', guideIds)
      .gte('tour_date', start)
      .lte('tour_date', end),
    supabase
      .from('activities')
      .select('guide_id, activity_date, activity_type, amount, notes')
      .in('guide_id', guideIds)
      .gte('activity_date', start)
      .lte('activity_date', end),
    supabase
      .from('expenses')
      .select('guide_id, amount')
      .in('guide_id', guideIds)
      .gte('expense_date', start)
      .lte('expense_date', end),
    supabase
      .from('transfers')
      .select('guide_id, amount, transfer_type, transfer_date, notes')
      .in('guide_id', guideIds)
      .gte('transfer_date', start)
      .lte('transfer_date', end),
    // Pending deposits — חוצה חודשים, לא תלוי בחודש הנבחר
    supabase
      .from('transfers')
      .select('guide_id, amount')
      .in('guide_id', guideIds)
      .eq('transfer_type', 'to_portugo')
      .eq('is_pending_deposit', true),
  ]);

  if (toursRes.error) throw toursRes.error;
  if (actsRes.error) throw actsRes.error;
  if (expsRes.error) throw expsRes.error;
  if (trsRes.error) throw trsRes.error;
  if (pendingRes.error) throw pendingRes.error;

  type RawTour = {
    id: string;
    guide_id: string;
    tour_date: string;
    tour_type: string;
    category: 'classic' | 'fixed' | 'private' | 'other';
    notes: string | null;
    photo_url: string | null;
    photo_skipped: boolean | null;
    bookings: { people: number; kids: number; price: number; tip: number }[] | null;
  };

  const tours = (toursRes.data || []) as RawTour[];
  const acts = (actsRes.data || []) as {
    guide_id: string;
    activity_date: string;
    activity_type: string;
    amount: number;
    notes: string | null;
  }[];
  const exps = (expsRes.data || []) as { guide_id: string; amount: number }[];
  const trs = (trsRes.data || []) as {
    guide_id: string;
    amount: number;
    transfer_type: string;
    transfer_date: string;
    notes: string | null;
  }[];
  const pendings = (pendingRes.data || []) as { guide_id: string; amount: number }[];

  // ─── שלב 3: עיבוד לכל מדריך ─────────────────────────────────────────────
  const summaries: GuideMonthSummary[] = guides.map((g) => {
    const myTours = tours.filter((t) => t.guide_id === g.id);
    const myActs = acts.filter((a) => a.guide_id === g.id);
    const myExps = exps.filter((e) => e.guide_id === g.id);
    const myTrs = trs.filter((t) => t.guide_id === g.id);
    const myPendings = pendings.filter((p) => p.guide_id === g.id);
    const pending_total = myPendings.reduce((s, p) => s + (p.amount || 0), 0);

    // מבני נתונים לחישוב משכורת
    const salaryTours: SalaryTour[] = myTours.map((t) => ({
      tour_date: t.tour_date,
      tour_type: t.tour_type,
      category: t.category,
      notes: t.notes || '',
      bookings: (t.bookings || []).map((b) => ({
        people: b.people || 0,
        kids: b.kids || 0,
        price: b.price || 0,
        tip: b.tip || 0,
      })),
    }));
    const salaryActs: SalaryActivity[] = myActs.map((a) => ({
      activity_date: a.activity_date,
      activity_type: a.activity_type,
      amount: a.amount || 0,
      notes: a.notes || '',
    }));

    const salary = calculateMonthlySalary(g, salaryTours, salaryActs);

    // ספירות
    const tours_count = myTours.length;
    const people_count = myTours.reduce(
      (sum, t) => sum + (t.bookings || []).reduce((s, b) => s + (b.people || 0), 0),
      0,
    );
    const cash_collected = myTours.reduce(
      (sum, t) => sum + (t.bookings || []).reduce((s, b) => s + (b.price || 0), 0),
      0,
    );
    const expenses_total = myExps.reduce((s, e) => s + (e.amount || 0), 0);

    // העברות לפי סוג
    let transfers_total = 0; // to_portugo
    let salary_withdrawn = 0;
    let closed_at: string | null = null;
    for (const tr of myTrs) {
      if (tr.transfer_type === 'to_portugo') transfers_total += tr.amount || 0;
      else if (tr.transfer_type === 'salary_withdrawal') {
        salary_withdrawn += tr.amount || 0;
        // הקדומה ביותר היא תאריך הסגירה
        if (!closed_at || tr.transfer_date < closed_at) {
          closed_at = tr.transfer_date;
        }
      }
    }

    // סטטוס:
    //  - אין סיורים ואין פעילות → empty
    //  - יש סגירה (salary_withdrawal) ועדיין כסף לפורטוגו → awaiting_deposit
    //  - יש סגירה והכסף הועבר → closed
    //  - יש סיורים אבל אין סגירה → open
    let status: GuideStatus = 'empty';
    if (tours_count === 0 && myActs.length === 0) {
      status = 'empty';
    } else if (closed_at) {
      // הסגירה קרתה. האם יש עוד כסף שצריך להעביר?
      // הכסף שצריך להעביר = transfer_amount (מהמשכורת) — מה שכבר עבר ל-to_portugo
      // אבל יותר פשוט: אם יש עדיין כסף בקופה הראשית, זה מצב awaiting_deposit.
      // לחישוב מדויק נצטרך את total_cash_collected - cash_based_salary - cash_refill - expenses_refill - to_portugo
      // לעכשיו: רק נסמן closed כי הסגירה בוצעה
      status = 'closed';
    } else {
      status = 'open';
    }

    // תמונות חסרות: סיורים שאין להם photo_url ולא photo_skipped
    const missingPhotosTours = myTours.filter(
      (t) => !t.photo_url && !t.photo_skipped,
    );
    const missing_photos = missingPhotosTours.length;
    const missing_photos_list = missingPhotosTours
      .sort((a, b) => a.tour_date.localeCompare(b.tour_date))
      .map((t) => ({ id: t.id, tour_date: t.tour_date, tour_type: t.tour_type }));

    return {
      guide: g,
      tours_count,
      people_count,
      cash_collected,
      expenses_total,
      transfers_total,
      salary_withdrawn,
      status,
      closed_at,
      salary,
      missing_photos,
      missing_photos_list,
      pending_total,
    };
  });

  // ─── שלב 4: סה"כ ─────────────────────────────────────────────────────────
  const totals = {
    tours: summaries.reduce((s, x) => s + x.tours_count, 0),
    people: summaries.reduce((s, x) => s + x.people_count, 0),
    cash_collected: summaries.reduce((s, x) => s + x.cash_collected, 0),
    expenses: summaries.reduce((s, x) => s + x.expenses_total, 0),
    salary_total_with_tips: summaries.reduce(
      (s, x) => s + (x.salary.total_with_tips || 0),
      0,
    ),
    // למדריכים עם מע"מ: סה"כ להעברה כולל את המע"מ (Portugo משלמת receipt_with_vat)
    salary_to_pay: summaries.reduce(
      (s, x) => s + (x.salary.transfer_amount || 0) + (x.salary.vat_amount || 0),
      0,
    ),
    closed_count: summaries.filter((x) => x.status === 'closed').length,
    open_count: summaries.filter((x) => x.status === 'open').length,
    pending_total: summaries.reduce((s, x) => s + (x.pending_total || 0), 0),
    missing_photos_total: summaries.reduce((s, x) => s + (x.missing_photos || 0), 0),
  };

  return { year, month, guides: summaries, totals };
}
