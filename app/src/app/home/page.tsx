'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, type Guide, SYSTEM_START_DATE } from '@/lib/supabase';
import {
  calculateMonthlySalary,
  calculatePerTourBreakdown,
  type SalaryBreakdown,
  type SalaryTour,
  type SalaryActivity,
  type PerTourSalary,
} from '@/lib/salary';
import { useAuthGuard, logout } from '@/lib/auth';
import AdminGuideSwitcher from '@/components/AdminGuideSwitcher';
import PhotoPicker from '@/components/PhotoPicker';
import { uploadMonthlyReceipt } from '@/lib/storage';
import {
  getCalendarEventsForDate,
  todayLocalISO,
  todayMonthDay,
  type CalendarEvent,
} from '@/lib/calendar-events';
import {
  canEditMonth,
  getMonthEditExplanation,
  getGracePeriodNotice,
  formatYearMonthParam,
} from '@/lib/month-policy';
import {
  loadPublishedShiftsForGuide,
  getLatestPublishTimestampForGuide,
  tourTypeLabel,
  shortTime,
  type Shift,
} from '@/lib/admin/shifts-data';

type Summary = {
  tours: number;
  people: number;
  collected: number;           // sum of all booking prices (all categories)
  change_given: number;        // sum of change given across all bookings
  cash_refill: number;         // self-refill from main → change envelope
  expenses_refill: number;     // self-refill from main → expenses envelope
  salary_withdrawn: number;    // salary the guide withdrew from the main box at month-close
  opening_change: number;      // יתרת פתיחה במעטפת עודף
  opening_expenses: number;    // יתרת פתיחה במעטפת הוצאות
  admin_topup_change: number;  // תוספת אדמין למעטפת עודף (לא מהקופה הראשית)
  admin_topup_expenses: number; // תוספת אדמין למעטפת הוצאות (לא מהקופה הראשית)
  pending_total: number;       // סה"כ ממתין להפקדה — חוצה חודשים
  // יתרות מצטברות (עד סוף החודש הנבחר) — מעטפות עוברות מחודש לחודש
  cum_change_refill: number;
  cum_change_given: number;
  cum_expenses_refill: number;
  cum_expenses: number;
  cum_admin_topup_change: number;
  cum_admin_topup_expenses: number;
  external: { description: string; amount: number; date: string }[];
  expenses: number;
  transfers: number;
  salary: SalaryBreakdown;
  travel_type: 'monthly' | 'daily' | null;
};

const EMPTY_SALARY: SalaryBreakdown = {
  classic_base: 0, classic_transfer: 0, classic_tips: 0, classic_income: 0,
  fixed_salaries: 0, private_salaries: 0, non_classic_tips: 0,
  eshel: 0, eshel_days: 0, habraza: 0, training: 0, training_lead: 0, external: 0,
  travel: 0, management: 0,
  total_with_tips: 0, transfer_amount: 0,
  receipt_amount: 0, vat_amount: 0, receipt_with_vat: 0,
  cash_to_withdraw: 0,
  work_days: 0, classic_people: 0, classic_collected: 0,
  total_cash_collected: 0, cash_based_salary: 0,
};

function getTimeGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return { text: 'בוקר טוב', emoji: '☀️' };
  if (h >= 12 && h < 17) return { text: 'שלום', emoji: '👋' };
  if (h >= 17 && h < 22) return { text: 'ערב טוב', emoji: '🌙' };
  return { text: 'היי', emoji: '✨' };
}

// === Shift display helpers (משותף עם /my-shifts) ===
const PRIVATE_TOUR_TYPES = new Set(['פרטי_1', 'פרטי_2']);
const TRAINING_TOUR_TYPES = new Set(['תצפות', 'נסיון_דפים']);
const TEAM_TOUR_TYPES = new Set(['פעילות_צוות']);
const TENTATIVE_PREFIX = '[כנראה] ';
const TOUR_TYPE_ICONS: Record<string, string> = {
  'תצפות': '👁️', 'נסיון_דפים': '📋', 'פעילות_צוות': '🤝',
};
const TOUR_TYPE_SHORT_LABELS: Record<string, string> = {
  'תצפות': 'תצפות', 'נסיון_דפים': 'ניסיון דפים', 'פעילות_צוות': 'פעילות צוות',
};

function shiftDisplayName(shift: Shift): string {
  const isPrivate = PRIVATE_TOUR_TYPES.has(shift.tour_type);
  const isTraining = TRAINING_TOUR_TYPES.has(shift.tour_type);
  const isTeam = TEAM_TOUR_TYPES.has(shift.tour_type);
  let detailFromNotes: string | null = null;
  if ((isPrivate || isTraining) && shift.notes) {
    let raw = shift.notes;
    if (raw.startsWith(TENTATIVE_PREFIX)) raw = raw.slice(TENTATIVE_PREFIX.length).trim();
    const splitter = raw.includes(' · ') ? ' · ' : raw.includes(' - ') ? ' - ' : raw.includes(' / ') ? ' / ' : null;
    detailFromNotes = splitter ? (raw.split(splitter)[0]?.trim() || null) : raw.trim() || null;
  }
  if (isPrivate) return detailFromNotes ? `${detailFromNotes} פרטי` : tourTypeLabel(shift.tour_type);
  if (isTraining) {
    const icon = TOUR_TYPE_ICONS[shift.tour_type] || '';
    const label = TOUR_TYPE_SHORT_LABELS[shift.tour_type] || tourTypeLabel(shift.tour_type);
    return detailFromNotes ? `${icon} ${label}: ${detailFromNotes}` : `${icon} ${label}`;
  }
  if (isTeam) {
    const icon = TOUR_TYPE_ICONS[shift.tour_type] || '';
    const label = TOUR_TYPE_SHORT_LABELS[shift.tour_type] || tourTypeLabel(shift.tour_type);
    return `${icon} ${label}`;
  }
  return tourTypeLabel(shift.tour_type);
}

/** "ראשון, 12/5" / "היום" / "מחר" */
function shiftDayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diff = Math.round((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'היום';
  if (diff === 1) return 'מחר';
  const dayNames = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return `${dayNames[date.getDay()]}, ${d}/${m}`;
}

function formatMonthLabel(year: number, month: number) {
  const d = new Date(year, month, 1);
  return d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
}

function isCurrentMonth(year: number, month: number) {
  const now = new Date();
  return now.getFullYear() === year && now.getMonth() === month;
}

function HomeContent() {
  useAuthGuard();
  const router = useRouter();
  const searchParams = useSearchParams();
  const justSaved = searchParams.get('saved') === '1';
  const [guideName, setGuideName] = useState('');
  const [summary, setSummary] = useState<Summary>({
    tours: 0, people: 0, collected: 0,
    change_given: 0, cash_refill: 0, expenses_refill: 0, salary_withdrawn: 0,
    opening_change: 0, opening_expenses: 0,
    admin_topup_change: 0, admin_topup_expenses: 0,
    pending_total: 0,
    cum_change_refill: 0, cum_change_given: 0,
    cum_expenses_refill: 0, cum_expenses: 0,
    cum_admin_topup_change: 0, cum_admin_topup_expenses: 0,
    external: [],
    expenses: 0, transfers: 0,
    salary: EMPTY_SALARY,
    travel_type: null,
  });
  const [loading, setLoading] = useState(true);
  const [showToast, setShowToast] = useState(justSaved);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  // תזכורות הוצאת קבלה — חודשים שבהם הייתה משכורת לקבלה ולא נלחץ "הוצאתי".
  // נצברות עד שלוחצים אישור לכל חודש — אם יש כמה חודשים פתוחים, יוצגו כמה באנרים.
  type PendingReceipt = { year: number; month: number; receipt_amount: number };
  const [pendingReceipts, setPendingReceipts] = useState<PendingReceipt[]>([]);
  // מודאל העלאת אסמכתא לקבלה החודשית — נפתח כשלוחצים על באנר תזכורת
  const [receiptUploadModal, setReceiptUploadModal] = useState<PendingReceipt | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptUploading, setReceiptUploading] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  // פירוט שכר פר-סיור — נטען עם שאר הסיכום, מוצג בדרופדאון "פירוט סיורים"
  const [perTourBreakdown, setPerTourBreakdown] = useState<PerTourSalary[]>([]);
  const [showTourBreakdown, setShowTourBreakdown] = useState(false);
  // ברכות יומיות — אירועי לוח (חגים/שעון) + ימי הולדת של היום
  const [todayEvents, setTodayEvents] = useState<CalendarEvent[]>([]);
  type TeamBirthday = { id: string; name: string; birthday: string };
  const [todayBirthdays, setTodayBirthdays] = useState<TeamBirthday[]>([]);
  const [currentGuideId, setCurrentGuideId] = useState<string | null>(null);
  // המשמרת הקרובה ביותר של המדריך (היום והלאה). null = אין.
  const [nextShift, setNextShift] = useState<Shift | null>(null);
  // האם יש פרסום חדש שעדיין לא נראה (להצגת הבאנר "הסידור פורסם")
  const [hasNewPublish, setHasNewPublish] = useState(false);
  // ה-published_at העדכני ביותר — נסמן כ"נראה" כשהמדריך לוחץ על הבאנר
  const [latestPublishedAt, setLatestPublishedAt] = useState<string | null>(null);

  // Month navigation — read initial from URL, default to current month
  const now = new Date();
  const urlYear = searchParams.get('year');
  const urlMonth = searchParams.get('month');
  const [year, setYear] = useState(urlYear ? parseInt(urlYear) : now.getFullYear());
  const [month, setMonth] = useState(urlMonth ? parseInt(urlMonth) - 1 : now.getMonth()); // 0-indexed

  useEffect(() => {
    const id = localStorage.getItem('portugo_guide_id');
    const name = localStorage.getItem('portugo_guide_name');
    if (!id) {
      router.push('/');
      return;
    }
    setGuideName(name || '');
    setCurrentGuideId(id);

    // ברכות יומיות — אירועי לוח לפי תאריך היום, וכל ימי ההולדת של הצוות
    setTodayEvents(getCalendarEventsForDate(todayLocalISO()));
    (async () => {
      const { data } = await supabase.rpc('public_team_birthdays');
      const today = todayMonthDay();
      const todayBdays = ((data as TeamBirthday[]) || []).filter((b) => b.birthday === today);
      setTodayBirthdays(todayBdays);
    })();

    // המשמרת הקרובה + סטטוס פרסום
    (async () => {
      try {
        const upcoming = await loadPublishedShiftsForGuide(id, 14);
        setNextShift(upcoming[0] ?? null);

        const latest = await getLatestPublishTimestampForGuide(id);
        setLatestPublishedAt(latest);
        if (latest) {
          const seen = localStorage.getItem(`portugo_seen_publish_${id}`);
          // הבאנר יופיע אם המדריך עוד לא ראה את הפרסום הזה
          setHasNewPublish(seen !== latest);
        } else {
          setHasNewPublish(false);
        }
      } catch (e) {
        // בלי להפיל את העמוד — רק לוג. הבאנר/המשמרת פשוט לא יופיעו.
        console.error('Failed to load shifts info:', e);
      }
    })();

    async function loadSummary() {
      setLoading(true);
      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const [guideRes, toursRes, actRes, expRes, trRes, pendingRes, cumTrRes, cumChangeGivenRes, cumExpRes] = await Promise.all([
        supabase.from('guides').select('name, travel_type, has_mgmt_bonus, mgmt_bonus_amount, has_vat, classic_transfer_per_person, opening_change_balance, opening_expenses_balance').eq('id', id).single(),
        supabase.from('tours').select('id, tour_date, tour_type, category, notes, bookings(people, kids, price, tip, change_given)')
          .eq('guide_id', id).gte('tour_date', start).lte('tour_date', end),
        supabase.from('activities').select('amount, activity_type, activity_date, notes')
          .eq('guide_id', id).gte('activity_date', start).lte('activity_date', end),
        supabase.from('expenses').select('amount')
          .eq('guide_id', id).gte('expense_date', start).lte('expense_date', end),
        supabase.from('transfers').select('amount, transfer_type')
          .eq('guide_id', id).gte('transfer_date', start).lte('transfer_date', end),
        // Pending deposits — לא תלוי בחודש, מצטבר על פני זמן
        supabase.from('transfers').select('amount')
          .eq('guide_id', id).eq('transfer_type', 'to_portugo').eq('is_pending_deposit', true),
        // יתרות מעטפות מצטברות — מ-SYSTEM_START_DATE עד סוף החודש הנבחר
        // (נתונים מלפני התאריך הם ארכיון, יתרת הפתיחה כבר מייצגת אותם)
        supabase.from('transfers').select('amount, transfer_type')
          .eq('guide_id', id).gte('transfer_date', SYSTEM_START_DATE).lte('transfer_date', end),
        supabase.from('tours').select('bookings(change_given)')
          .eq('guide_id', id).gte('tour_date', SYSTEM_START_DATE).lte('tour_date', end),
        supabase.from('expenses').select('amount')
          .eq('guide_id', id).gte('expense_date', SYSTEM_START_DATE).lte('expense_date', end),
      ]);

      const guide = (guideRes.data as Pick<Guide, 'name' | 'travel_type' | 'has_mgmt_bonus' | 'mgmt_bonus_amount' | 'has_vat' | 'classic_transfer_per_person' | 'opening_change_balance' | 'opening_expenses_balance'> | null) || null;

      let totalPeople = 0;
      let totalCollected = 0;
      let changeGiven = 0;

      type RawTour = {
        tour_date: string;
        tour_type: string;
        category: 'classic' | 'fixed' | 'private' | 'other';
        notes: string | null;
        bookings: { people: number; kids: number; price: number; tip: number; change_given: number }[] | null;
      };

      const salaryTours: SalaryTour[] = [];
      (toursRes.data as RawTour[] || []).forEach((t) => {
        const bks = t.bookings || [];
        bks.forEach((b) => {
          totalPeople += b.people || 0;
          totalCollected += b.price || 0;
          changeGiven += b.change_given || 0;
        });
        salaryTours.push({
          tour_date: t.tour_date,
          tour_type: t.tour_type,
          category: t.category,
          notes: t.notes || '',
          bookings: bks.map((b) => ({
            people: b.people || 0,
            kids: b.kids || 0,
            price: b.price || 0,
            tip: b.tip || 0,
          })),
        });
      });

      // Collect external activities for the review banner (display only)
      const externalActivities: { description: string; amount: number; date: string }[] = [];
      const salaryActivities: SalaryActivity[] = [];
      (actRes.data || []).forEach((a: { activity_type: string; activity_date: string; amount: number; notes: string }) => {
        salaryActivities.push({
          activity_date: a.activity_date,
          activity_type: a.activity_type,
          amount: a.amount || 0,
          notes: a.notes || '',
        });
        if (a.activity_type === 'external') {
          externalActivities.push({
            description: a.notes || 'ללא תיאור',
            amount: a.amount || 0,
            date: a.activity_date,
          });
        }
      });

      const salary = calculateMonthlySalary(guide, salaryTours, salaryActivities);
      // פירוט פר-סיור לדרופדאון
      setPerTourBreakdown(
        calculatePerTourBreakdown(salaryTours, guide?.classic_transfer_per_person ?? 10),
      );

      const expensesTotal = (expRes.data || []).reduce((s, e: { amount: number }) => s + (e.amount || 0), 0);
      let transfersTotal = 0;
      let cashRefill = 0;
      let expensesRefill = 0;
      let salaryWithdrawn = 0;
      let adminTopupChange = 0;
      let adminTopupExpenses = 0;
      (trRes.data || []).forEach((t: { amount: number; transfer_type: string }) => {
        const amt = t.amount || 0;
        if (t.transfer_type === 'cash_refill') cashRefill += amt;
        else if (t.transfer_type === 'expenses_refill') expensesRefill += amt;
        else if (t.transfer_type === 'salary_withdrawal') salaryWithdrawn += amt;
        else if (t.transfer_type === 'admin_topup_change') adminTopupChange += amt;
        else if (t.transfer_type === 'admin_topup_expenses') adminTopupExpenses += amt;
        else transfersTotal += amt;
      });

      const pendingTotal = (pendingRes.data || []).reduce(
        (s: number, p: { amount: number }) => s + (p.amount || 0),
        0,
      );

      // ─── יתרות מצטברות (חוצות חודשים) — עד סוף החודש הנבחר ───
      let cumChangeRefill = 0, cumExpensesRefill = 0, cumAdminTopupChange = 0, cumAdminTopupExpenses = 0;
      (cumTrRes.data || []).forEach((t: { amount: number; transfer_type: string }) => {
        const a = t.amount || 0;
        if (t.transfer_type === 'cash_refill') cumChangeRefill += a;
        else if (t.transfer_type === 'expenses_refill') cumExpensesRefill += a;
        else if (t.transfer_type === 'admin_topup_change') cumAdminTopupChange += a;
        else if (t.transfer_type === 'admin_topup_expenses') cumAdminTopupExpenses += a;
      });
      let cumChangeGiven = 0;
      ((cumChangeGivenRes.data as { bookings: { change_given: number }[] | null }[]) || []).forEach((t) => {
        (t.bookings || []).forEach((b) => { cumChangeGiven += b.change_given || 0; });
      });
      const cumExpenses = (cumExpRes.data || []).reduce(
        (s: number, e: { amount: number }) => s + (e.amount || 0),
        0,
      );

      setSummary({
        tours: toursRes.data?.length || 0,
        people: totalPeople,
        collected: totalCollected,
        change_given: changeGiven,
        cash_refill: cashRefill,
        expenses_refill: expensesRefill,
        salary_withdrawn: salaryWithdrawn,
        opening_change: guide?.opening_change_balance || 0,
        opening_expenses: guide?.opening_expenses_balance || 0,
        admin_topup_change: adminTopupChange,
        admin_topup_expenses: adminTopupExpenses,
        pending_total: pendingTotal,
        cum_change_refill: cumChangeRefill,
        cum_change_given: cumChangeGiven,
        cum_expenses_refill: cumExpensesRefill,
        cum_expenses: cumExpenses,
        cum_admin_topup_change: cumAdminTopupChange,
        cum_admin_topup_expenses: cumAdminTopupExpenses,
        external: externalActivities,
        expenses: expensesTotal,
        transfers: transfersTotal,
        salary,
        travel_type: guide?.travel_type || null,
      });
      setLoading(false);
    }
    loadSummary();
  }, [router, year, month]);

  useEffect(() => {
    if (showToast) {
      const t = setTimeout(() => setShowToast(false), 3500);
      return () => clearTimeout(t);
    }
  }, [showToast]);

  // טעינת תזכורות הוצאת קבלה — סורק חודשים מ-SYSTEM_START_DATE עד החודש שלפני הנוכחי.
  // לכל חודש שלא אושר ויש בו receipt_amount > 0 → מוסיפים לרשימה.
  useEffect(() => {
    async function loadPendingReceipts() {
      const id = localStorage.getItem('portugo_guide_id');
      if (!id) return;

      const { data: acks } = await supabase
        .from('receipt_acknowledgements')
        .select('year, month')
        .eq('guide_id', id);
      const ackSet = new Set(
        (acks || []).map((a: { year: number; month: number }) => `${a.year}-${a.month}`),
      );

      // בונים רשימת חודשים מ-SYSTEM_START_DATE ועד (לא כולל) החודש הנוכחי
      const startDate = new Date(SYSTEM_START_DATE);
      const today = new Date();
      const currentFirst = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthsToCheck: { year: number; month: number }[] = [];
      const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      while (cursor < currentFirst) {
        monthsToCheck.push({ year: cursor.getFullYear(), month: cursor.getMonth() + 1 });
        cursor.setMonth(cursor.getMonth() + 1);
      }
      const unacknowledged = monthsToCheck.filter(
        (m) => !ackSet.has(`${m.year}-${m.month}`),
      );
      if (unacknowledged.length === 0) {
        setPendingReceipts([]);
        return;
      }

      const guideRes = await supabase
        .from('guides')
        .select(
          'name, travel_type, has_mgmt_bonus, mgmt_bonus_amount, has_vat, classic_transfer_per_person',
        )
        .eq('id', id)
        .single();
      const g = (guideRes.data as Pick<
        Guide,
        'name' | 'travel_type' | 'has_mgmt_bonus' | 'mgmt_bonus_amount' | 'has_vat' | 'classic_transfer_per_person'
      > | null) || null;
      if (!g) return;

      type RawTour = {
        tour_date: string;
        tour_type: string;
        category: 'classic' | 'fixed' | 'private' | 'other';
        notes: string | null;
        bookings: { people: number; kids: number; price: number; tip: number }[] | null;
      };

      const results: PendingReceipt[] = [];
      for (const m of unacknowledged) {
        const start = `${m.year}-${String(m.month).padStart(2, '0')}-01`;
        const lastDay = new Date(m.year, m.month, 0).getDate();
        const end = `${m.year}-${String(m.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
        const [toursRes, actRes] = await Promise.all([
          supabase
            .from('tours')
            .select('tour_date, tour_type, category, notes, bookings(people, kids, price, tip)')
            .eq('guide_id', id)
            .gte('tour_date', start)
            .lte('tour_date', end),
          supabase
            .from('activities')
            .select('amount, activity_type, activity_date, notes')
            .eq('guide_id', id)
            .gte('activity_date', start)
            .lte('activity_date', end),
        ]);
        const sTours: SalaryTour[] = ((toursRes.data as RawTour[]) || []).map((t) => ({
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
        const sActs: SalaryActivity[] = (actRes.data || []).map(
          (a: { activity_type: string; activity_date: string; amount: number; notes: string }) => ({
            activity_date: a.activity_date,
            activity_type: a.activity_type,
            amount: a.amount || 0,
            notes: a.notes || '',
          }),
        );
        const s = calculateMonthlySalary(g, sTours, sActs);
        if (s.receipt_amount > 0) {
          results.push({ year: m.year, month: m.month, receipt_amount: s.receipt_amount });
        }
      }
      setPendingReceipts(results);
    }
    loadPendingReceipts();
  }, []);

  // לחיצה על "אישור — שלחתי קבלה" בתוך המודאל:
  // 1. מעלה את התמונה ל-Storage (bucket monthly-receipts)
  // 2. שומר שורה ב-receipt_acknowledgements עם receipt_url
  // 3. סוגר את המודאל ומסיר את הבאנר
  async function handleReceiptUpload() {
    if (!receiptUploadModal || !receiptFile) {
      setReceiptError('צריך לצרף תמונה של הקבלה');
      return;
    }
    const id = localStorage.getItem('portugo_guide_id');
    if (!id) return;

    setReceiptError('');
    setReceiptUploading(true);

    let receiptUrl: string;
    try {
      receiptUrl = await uploadMonthlyReceipt({
        file: receiptFile,
        guideId: id,
        receiptYear: receiptUploadModal.year,
        receiptMonth: receiptUploadModal.month,
      });
    } catch (uploadErr) {
      setReceiptUploading(false);
      const msg = uploadErr instanceof Error ? uploadErr.message : 'משהו השתבש';
      setReceiptError(`העלאת האסמכתא נכשלה: ${msg}`);
      return;
    }

    const { error } = await supabase.from('receipt_acknowledgements').insert({
      guide_id: id,
      year: receiptUploadModal.year,
      month: receiptUploadModal.month,
      receipt_url: receiptUrl,
    });

    setReceiptUploading(false);
    if (error) {
      setReceiptError('משהו השתבש בשמירה: ' + error.message);
      return;
    }
    const closed = receiptUploadModal;
    setPendingReceipts((prev) =>
      prev.filter((r) => !(r.year === closed.year && r.month === closed.month)),
    );
    setReceiptUploadModal(null);
    setReceiptFile(null);
  }

  const handleLogout = () => {
    setShowLogoutModal(true);
  };

  const confirmLogout = async () => {
    await logout();
    router.push('/');
  };

  // Sync selected month to URL so browser back works correctly
  const updateUrl = (y: number, m: number) => {
    const params = new URLSearchParams();
    params.set('year', String(y));
    params.set('month', String(m + 1));
    router.replace(`/home?${params.toString()}`, { scroll: false });
  };

  const prevMonth = () => {
    const ny = month === 0 ? year - 1 : year;
    const nm = month === 0 ? 11 : month - 1;
    setYear(ny);
    setMonth(nm);
    updateUrl(ny, nm);
  };

  const nextMonth = () => {
    if (isCurrentMonth(year, month)) return; // can't go into future
    const ny = month === 11 ? year + 1 : year;
    const nm = month === 11 ? 0 : month + 1;
    setYear(ny);
    setMonth(nm);
    updateUrl(ny, nm);
  };

  const goToCurrent = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    router.replace('/home', { scroll: false });
  };

  /**
   * נקרא כשהמדריך לוחץ על באנר "הסידור פורסם" — סוגר את הבאנר ומסמן
   * ב-localStorage את ה-published_at העדכני כ"נראה". הבאנר לא יופיע שוב
   * עד שיהיה published_at חדש יותר (כלומר עד הפרסום הבא).
   */
  const dismissPublishBanner = () => {
    if (currentGuideId && latestPublishedAt) {
      localStorage.setItem(`portugo_seen_publish_${currentGuideId}`, latestPublishedAt);
    }
    setHasNewPublish(false);
  };

  const greeting = getTimeGreeting();
  const monthLabel = formatMonthLabel(year, month);
  const isCurrent = isCurrentMonth(year, month);

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* Success toast */}
      {showToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-700 text-white px-6 py-3 rounded-2xl shadow-lg font-semibold text-center animate-[toastIn_400ms_ease-out]">
          <div>נשמר! 🎉</div>
          <div className="text-sm font-medium opacity-90">עבודה נהדרת</div>
        </div>
      )}
      <style jsx global>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translate(-50%, -20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Header */}
      <header className="bg-green-800 text-white p-4 shadow-md">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div>
            <p className="text-sm opacity-80">{greeting.text} {greeting.emoji}</p>
            <h1 className="text-xl font-bold">{guideName}</h1>
          </div>
          <button
            onClick={handleLogout}
            className="text-sm bg-green-900 hover:bg-green-950 active:scale-95 transition-transform px-3 py-2 rounded-md"
          >
            יציאה
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* Admin: switch which guide we're viewing */}
        <AdminGuideSwitcher />

        {/* באנר "הסידור החדש פורסם" — מופיע רק אם פורסם משהו חדש שעוד לא ראית.
            לחיצה לוקחת ל-/my-shifts (שגם מסמנת אותו כ"נראה") ועוצרת את הבאנר עד הפרסום הבא. */}
        {hasNewPublish && (
          <Link
            href="/my-shifts"
            onClick={dismissPublishBanner}
            className="block bg-gradient-to-l from-green-700 to-green-600 text-white rounded-2xl p-4 shadow-lg active:scale-98 transition-transform"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="font-bold text-base">🗓️ הסידור לשבוע הבא פורסם</div>
                <div className="text-xs opacity-90 mt-0.5">לחצ.י לצפייה במשמרות שלך</div>
              </div>
              <div className="text-2xl">←</div>
            </div>
          </Link>
        )}

        {/* ברכות יומיות — חגים, ימי הולדת, ומעברי שעון. סדר תצוגה:
            1. יום הולדת של החוגג עצמו (אם יש) — תמיד למעלה
            2. אירועי לוח לפי עדיפות (ישראל → פורטוגל → שעון → בינלאומי)
            3. ימי הולדת של אחרים בצוות */}
        {(() => {
          const myBirthday = todayBirthdays.find((b) => b.id === currentGuideId);
          const othersBirthdays = todayBirthdays.filter((b) => b.id !== currentGuideId);
          const hasContent =
            todayEvents.length > 0 || !!myBirthday || othersBirthdays.length > 0;
          if (!hasContent) return null;
          return (
            <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-4 shadow-sm space-y-2">
              {myBirthday && (
                <div className="text-amber-900 text-base font-semibold leading-relaxed">
                  🎂 {myBirthday.name}, מזל טוב! שמחים לחגוג איתך יום הולדת במשפחת פורטוגו :)
                </div>
              )}
              {todayEvents.map((e, i) => (
                <div
                  key={`event-${i}`}
                  className="text-amber-900 text-sm leading-relaxed"
                >
                  {e.text}
                </div>
              ))}
              {othersBirthdays.length > 0 && (
                <div className="text-amber-900 text-sm leading-relaxed">
                  🎂 היום {myBirthday ? 'גם ' : ''}יום ההולדת של{' '}
                  <strong>
                    {othersBirthdays.length === 1
                      ? othersBirthdays[0].name
                      : othersBirthdays.length === 2
                      ? `${othersBirthdays[0].name} ו${othersBirthdays[1].name}`
                      : `${othersBirthdays
                          .slice(0, -1)
                          .map((b) => b.name)
                          .join(', ')} ו${othersBirthdays[othersBirthdays.length - 1].name}`}
                  </strong>{' '}
                  — אל תשכח.י לאחל מזל טוב!
                </div>
              )}
            </div>
          );
        })()}

        {/* "המשמרת הקרובה שלי" — קלף בולט עם המשמרת הבאה. מופיע רק אם יש משמרת ב-14 הימים הקרובים. */}
        {nextShift && (
          <Link
            href="/my-shifts"
            className="block bg-white rounded-2xl shadow-md p-4 border-r-4 border-green-600 active:scale-98 transition-transform"
          >
            <div className="text-xs text-gray-500 font-semibold mb-1">
              🗓️ המשמרת הקרובה שלך
            </div>
            <div className="flex justify-between items-baseline mb-1">
              <div className="text-lg font-bold text-green-800">
                {shiftDayLabel(nextShift.shift_date)}
              </div>
              <div className="text-xl font-bold text-green-900">
                {shortTime(nextShift.shift_time)}
              </div>
            </div>
            <div className="text-base font-semibold text-gray-900">
              {shiftDisplayName(nextShift)}
            </div>
            {nextShift.notes && !PRIVATE_TOUR_TYPES.has(nextShift.tour_type) && !TRAINING_TOUR_TYPES.has(nextShift.tour_type) && (
              <div className="text-sm text-amber-700 italic mt-1">
                {nextShift.notes}
              </div>
            )}
            <div className="text-xs text-gray-500 mt-2">
              {nextShift.city === 'lisbon' ? 'ליסבון' : 'פורטו'} · לחצ.י לכל המשמרות ←
            </div>
          </Link>
        )}

        {/* תזכורת אדומה — קופת המתנה. מופיעה גבוה מעל סיכום החודש כדי שלא תפוספס. */}
        {summary.pending_total > 0 && (
          <Link
            href={`/cash-boxes?year=${year}&month=${month + 1}`}
            className="block bg-red-50 border-2 border-red-400 rounded-2xl p-4 hover:bg-red-100 active:scale-98 transition-all shadow"
          >
            <div className="flex justify-between items-center">
              <div>
                <div className="font-bold text-red-700 text-base">💰 ממתין להפקדה</div>
                <div className="text-xs text-red-700 mt-0.5">לחצ.י כאן ברגע שהפקדת</div>
              </div>
              <div className="text-3xl font-bold text-red-700">
                {summary.pending_total.toFixed(0)}€
              </div>
            </div>
          </Link>
        )}

        {/* תזכורות הוצאת קבלה — באנר אחד לכל חודש פתוח. נשארות עד שלוחצים אישור. */}
        {pendingReceipts.map((r) => (
          <div
            key={`${r.year}-${r.month}`}
            className="bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 shadow"
          >
            <div className="flex items-start gap-3 mb-3">
              <span className="text-2xl">🧾</span>
              <div className="flex-1">
                <div className="font-bold text-amber-900 text-base">
                  תזכורת: יש להוציא קבלה על {formatMonthLabel(r.year, r.month - 1)}
                </div>
                <div className="text-xs text-amber-800 mt-1">
                  סכום הקבלה: {r.receipt_amount.toFixed(2)}€
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                setReceiptUploadModal(r);
                setReceiptFile(null);
                setReceiptError('');
              }}
              className="w-full bg-amber-600 hover:bg-amber-700 active:scale-98 transition-all text-white rounded-lg py-2.5 font-semibold text-sm"
            >
              שלחתי קבלה — צירוף אסמכתא 🧾
            </button>
          </div>
        ))}

        {/* Month summary with navigation */}
        <section className="bg-white rounded-2xl shadow p-5">
          {/* Month navigator */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={prevMonth}
              className="bg-gray-100 hover:bg-gray-200 active:scale-90 transition-transform w-10 h-10 rounded-full flex items-center justify-center text-xl"
              aria-label="חודש קודם"
            >
              →
            </button>
            <div className="text-center">
              <p className="text-sm text-gray-500">📅</p>
              <h3 className="font-bold text-lg">{monthLabel}</h3>
              {!isCurrent && (
                <button
                  onClick={goToCurrent}
                  className="text-xs text-green-700 underline mt-1"
                >
                  חזרה לחודש הנוכחי
                </button>
              )}
            </div>
            <button
              onClick={nextMonth}
              disabled={isCurrent}
              className="bg-gray-100 hover:bg-gray-200 active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed transition-transform w-10 h-10 rounded-full flex items-center justify-center text-xl"
              aria-label="חודש הבא"
            >
              ←
            </button>
          </div>

          <h2 className="text-lg font-semibold mb-3">
            {isCurrent ? 'הסיכום שלך החודש' : 'סיכום החודש'}
          </h2>

          {loading ? (
            <div className="text-gray-400 text-center py-6">רגע, מושך נתונים...</div>
          ) : summary.tours === 0 && summary.salary.total_with_tips === 0 ? (
            // empty state: אין סיורים ואין פעילות שכר (אשל / הכשרה / חיצונית)
            <div className="text-center py-6 text-gray-500">
              {isCurrent
                ? 'עוד לא הוספת סיור או פעילות החודש — בוא.י נתחיל! 👇'
                : 'לא נרשמה פעילות בחודש זה.'}
            </div>
          ) : (
            <>
              {(() => {
                const s = summary.salary;
                const mainBalance = s.total_cash_collected + summary.change_given - summary.transfers - summary.cash_refill - summary.expenses_refill - summary.salary_withdrawn;
                // יתרת מעטפות מצטברת — כסף פיזי שעובר מחודש לחודש
                const changeBalance = summary.opening_change + summary.cum_change_refill + summary.cum_admin_topup_change - summary.cum_change_given;
                const expensesBalance = summary.opening_expenses + summary.cum_expenses_refill + summary.cum_admin_topup_expenses - summary.cum_expenses;
                return (
                  <>
                    {/* KPIs — tours, people */}
                    <div className="grid grid-cols-2 gap-3 text-center mb-3">
                      <div className="bg-green-50 rounded-xl p-3">
                        <div className="text-2xl font-bold text-green-800">{summary.tours}</div>
                        <div className="text-xs text-gray-600 mt-1">סיורים</div>
                      </div>
                      <div className="bg-green-50 rounded-xl p-3">
                        <div className="text-2xl font-bold text-green-800">{summary.people}</div>
                        <div className="text-xs text-gray-600 mt-1">משתתפים</div>
                      </div>
                    </div>

                    {/* Cash boxes snapshot */}
                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      <Link
                        href={`/cash-boxes?year=${year}&month=${month + 1}`}
                        className="bg-white border border-gray-200 rounded-xl p-2 hover:bg-gray-50 active:scale-95 transition-transform"
                      >
                        <div className="text-lg font-bold text-green-800">
                          {mainBalance.toFixed(0)}€
                        </div>
                        <div className="text-[11px] text-gray-600 mt-0.5 leading-tight">קופה ראשית</div>
                      </Link>
                      <Link
                        href={`/cash-boxes?year=${year}&month=${month + 1}`}
                        className="bg-white border border-gray-200 rounded-xl p-2 hover:bg-gray-50 active:scale-95 transition-transform"
                      >
                        <div className="text-lg font-bold text-blue-800">
                          {changeBalance.toFixed(0)}€
                        </div>
                        <div className="text-[11px] text-gray-600 mt-0.5 leading-tight">מעטפת עודף</div>
                      </Link>
                      <Link
                        href={`/cash-boxes?year=${year}&month=${month + 1}`}
                        className="bg-white border border-gray-200 rounded-xl p-2 hover:bg-gray-50 active:scale-95 transition-transform"
                      >
                        <div className="text-lg font-bold text-amber-700">
                          {expensesBalance.toFixed(0)}€
                        </div>
                        <div className="text-[11px] text-gray-600 mt-0.5 leading-tight">מעטפת הוצאות</div>
                      </Link>
                    </div>
                  </>
                );
              })()}

              {/* Salary components */}
              <div className="border-t pt-3 mt-3">
                <div className="text-xs text-gray-500 mb-2 font-semibold">רכיבי השכר החודש</div>
                <div className="space-y-1 text-sm">
                  {summary.salary.classic_income !== 0 && (
                    <div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">שכר מקלאסי:</span>
                        <span className="font-semibold">{summary.salary.classic_income.toFixed(2)}€</span>
                      </div>
                      <div className="text-xs text-gray-500 pr-3 mt-0.5">
                        בסיס {summary.salary.classic_base.toFixed(2)}€ + טיפים {(summary.salary.classic_income - summary.salary.classic_base).toFixed(2)}€
                      </div>
                    </div>
                  )}
                  {summary.salary.fixed_salaries > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">שכר סיורים קבועים:</span>
                      <span className="font-semibold">{summary.salary.fixed_salaries.toFixed(2)}€</span>
                    </div>
                  )}
                  {summary.salary.private_salaries > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">שכר סיורים פרטיים:</span>
                      <span className="font-semibold">{summary.salary.private_salaries.toFixed(2)}€</span>
                    </div>
                  )}
                  {summary.salary.non_classic_tips > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">טיפים (לא קלאסי):</span>
                      <span className="font-semibold">{summary.salary.non_classic_tips.toFixed(2)}€</span>
                    </div>
                  )}
                  {summary.salary.eshel > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">אשל יומי ({summary.salary.eshel_days} ימים):</span>
                      <span className="font-semibold">{summary.salary.eshel.toFixed(2)}€</span>
                    </div>
                  )}
                  {summary.salary.habraza > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">הברזה בכיכר:</span>
                      <span className="font-semibold">{summary.salary.habraza.toFixed(2)}€</span>
                    </div>
                  )}
                  {summary.salary.training > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">פעילות הכשרה:</span>
                      <span className="font-semibold">{summary.salary.training.toFixed(2)}€</span>
                    </div>
                  )}
                  {summary.salary.training_lead > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">הכשרות שהעברתי:</span>
                      <span className="font-semibold">{summary.salary.training_lead.toFixed(2)}€</span>
                    </div>
                  )}
                  {summary.external.map((ext, i) => (
                    <div key={`ext-${i}`} className="flex justify-between">
                      <span className="text-gray-600">{ext.description || 'פעילות מיוחדת'}:</span>
                      <span className="font-semibold">{ext.amount.toFixed(2)}€</span>
                    </div>
                  ))}
                  {summary.salary.travel > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">
                        {summary.travel_type === 'monthly' ? 'חופשי חודשי:' : 'החזר נסיעות:'}
                      </span>
                      <span className="font-semibold">{summary.salary.travel.toFixed(2)}€</span>
                    </div>
                  )}
                  {summary.salary.management > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">רכיב ניהול:</span>
                      <span className="font-semibold">{summary.salary.management.toFixed(2)}€</span>
                    </div>
                  )}
                </div>

                {/* פירוט שכר פר-סיור — דרופדאון מתקפל. מציג רק אם יש סיורים */}
                {perTourBreakdown.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <button
                      onClick={() => setShowTourBreakdown(!showTourBreakdown)}
                      className="w-full text-sm text-green-800 hover:text-green-900 font-medium flex items-center justify-center gap-1"
                    >
                      {showTourBreakdown
                        ? '▲ הסתר.י פירוט שכר לפי סיור'
                        : '▼ פירוט שכר לפי סיור'}
                    </button>
                    {showTourBreakdown && (
                      <ul className="space-y-1.5 text-sm pt-2">
                        {[...perTourBreakdown]
                          .sort((a, b) => a.tour_date.localeCompare(b.tour_date))
                          .map((t, idx) => {
                            const dt = new Date(t.tour_date);
                            const dateLabel = dt.toLocaleDateString('he-IL', {
                              day: '2-digit',
                              month: '2-digit',
                            });
                            // הצגת משתתפים: אם יש ילדים — ציון מפורש (קריטי לקלאסי
                            // כי ילדים לא משלמים → לא נכנסים ל-transfer ול-base tier)
                            const peopleLabel =
                              t.kids > 0
                                ? `${t.people} משתתפים (כולל ${t.kids === 1 ? 'ילד' : `${t.kids} ילדים`})`
                                : `${t.people} משתתפים`;
                            const isClassic = t.category === 'classic';
                            // בקלאסי: גם "נאסף + הופרש" וגם "בסיס + טיפ נטו"
                            // בשאר: רק "בסיס + טיפ" (אם יש)
                            const collected = isClassic ? t.tips + t.transfer : 0; // = totalPrice
                            return (
                              <li
                                key={idx}
                                className="flex justify-between items-start gap-2"
                              >
                                <span className="text-xs text-gray-500 font-mono shrink-0 w-12 pt-0.5">
                                  {dateLabel}
                                </span>
                                <span className="flex-1 min-w-0">
                                  <div className="text-gray-700 truncate">{t.tour_type}</div>
                                  <div className="text-[11px] text-gray-500 leading-snug">
                                    {peopleLabel}
                                  </div>
                                  {isClassic ? (
                                    <>
                                      <div className="text-[11px] text-gray-500 leading-snug">
                                        נאסף {collected.toFixed(0)}€ · הופרש {t.transfer.toFixed(0)}€ לפורטוגו
                                      </div>
                                      <div className="text-[11px] text-gray-500 leading-snug">
                                        בסיס {t.base.toFixed(0)}€ + טיפ נטו {t.tips.toFixed(0)}€
                                      </div>
                                    </>
                                  ) : (
                                    <div className="text-[11px] text-gray-500 leading-snug">
                                      {t.tips > 0
                                        ? `בסיס ${t.base.toFixed(0)}€ + טיפ ${t.tips.toFixed(0)}€`
                                        : `בסיס ${t.base.toFixed(0)}€`}
                                    </div>
                                  )}
                                </span>
                                <span className="font-semibold text-green-800 shrink-0 pt-0.5">
                                  {t.salary.toFixed(0)}€
                                </span>
                              </li>
                            );
                          })}
                      </ul>
                    )}
                  </div>
                )}

                {summary.salary.total_with_tips > 0 && (
                  <div className="mt-3 pt-3 border-t border-green-200 bg-green-50 -mx-2 px-3 py-2 rounded-lg space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-green-900">סיכום שכר מלא</span>
                      <span className="font-bold text-green-900 text-lg">{summary.salary.total_with_tips.toFixed(2)}€</span>
                    </div>
                    <div className="text-[11px] text-green-800 leading-tight pr-1">
                      כולל טיפים מסיורים רגילים
                    </div>
                    {(summary.salary.non_classic_tips > 0 || summary.salary.vat_amount > 0.01) && (
                      <>
                        <div className="flex justify-between items-center pt-2 mt-1 border-t border-green-300">
                          <span className="font-semibold text-green-900 text-sm">סה&quot;כ למשוך מהקופה</span>
                          <span className="font-bold text-green-900">
                            {summary.salary.cash_to_withdraw}€
                          </span>
                        </div>
                        <div className="text-[11px] text-green-800 leading-tight pr-1">
                          {summary.salary.non_classic_tips > 0 && summary.salary.vat_amount > 0.01
                            ? 'משכורת + מע"מ, ללא הטיפים מהסיורים הרגילים'
                            : summary.salary.vat_amount > 0.01
                              ? 'משכורת + מע"מ'
                              : 'ללא הטיפים מהסיורים הרגילים'}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Receipt summary */}
                {summary.salary.receipt_amount > 0 && (
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-blue-900 font-semibold">סכום לקבלה</span>
                      <span className="font-bold text-blue-900">{summary.salary.receipt_amount.toFixed(2)}€</span>
                    </div>
                    {summary.salary.vat_amount > 0 && (
                      <>
                        <div className="flex justify-between text-xs text-blue-800">
                          <span>מע"מ (23%):</span>
                          <span className="font-semibold">{summary.salary.vat_amount.toFixed(2)}€</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-blue-200">
                          <span className="text-blue-900 font-semibold">קבלה כולל מע"מ</span>
                          <span className="font-bold text-blue-900">{summary.salary.receipt_with_vat.toFixed(2)}€</span>
                        </div>
                      </>
                    )}
                    <div className="text-[11px] text-blue-700 mt-1 leading-tight">
                      כולל בסיס קלאסי, סיורים קבועים ופרטיים, אשל, הברזה, הכשרה, נסיעות וניהול. לא כולל טיפים.
                    </div>
                  </div>
                )}

                {/* Close month action */}
                {summary.salary.total_with_tips > 0 && (
                  <Link
                    href={`/close-month?year=${year}&month=${month + 1}`}
                    className="mt-3 block w-full bg-amber-500 hover:bg-amber-600 active:scale-98 transition-all text-white rounded-xl py-3 text-center font-bold shadow"
                  >
                    💰 חישוב שכר סופי ואיפוס קופה
                  </Link>
                )}
              </div>
            </>
          )}
        </section>

        {/* External activities — prominent for review */}
        {summary.external.length > 0 && (
          <section className="bg-amber-50 border-2 border-amber-300 rounded-2xl shadow p-5">
            <div className="flex items-start gap-2 mb-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <h3 className="font-bold text-amber-900">פעילות מיוחדת לבדיקה</h3>
                <p className="text-xs text-amber-800">נדרש אישור מפורטוגו לפני הסגירה החודשית</p>
              </div>
            </div>
            <div className="space-y-2">
              {summary.external.map((ext, i) => (
                <div key={i} className="bg-white rounded-lg p-3 flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-sm">{ext.description}</div>
                    <div className="text-xs text-gray-500">
                      {new Date(ext.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}
                    </div>
                  </div>
                  <span className="font-bold text-amber-900">{ext.amount.toFixed(2)}€</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Main action — current month, או חודש קודם בתקופת השלמה (5 ימים, לפני סגירת משכורת). */}
        {(() => {
          const monthClosed = summary.salary_withdrawn > 0.01;
          const editable = canEditMonth(year, month, monthClosed);
          const graceNotice = getGracePeriodNotice(year, month, monthClosed);
          const lockReason = getMonthEditExplanation(year, month, monthClosed);
          const addTourHref = isCurrent
            ? '/add-tour'
            : `/add-tour?for=${formatYearMonthParam(year, month)}`;

          return (
            <>
              {graceNotice && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-xl p-3 text-sm text-amber-900 font-medium text-center">
                  ⏳ {graceNotice}
                </div>
              )}
              {editable && (
                <Link
                  href={addTourHref}
                  className="block bg-red-600 hover:bg-red-700 active:scale-98 text-white rounded-2xl shadow-lg p-6 text-center text-xl font-bold transition-all"
                >
                  הוסף.י סיור / פעילות +
                </Link>
              )}
              {!editable && lockReason && (
                <div className="bg-gray-100 border border-gray-300 rounded-xl p-3 text-sm text-gray-700 text-center">
                  🔒 {lockReason}
                </div>
              )}
            </>
          );
        })()}

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href="/my-shifts"
            className="bg-white rounded-xl shadow p-4 text-center hover:bg-gray-50 active:scale-95 transition-transform col-span-2 border border-green-200"
          >
            <div className="text-lg font-semibold text-green-800">🗓️ המשמרות שלי</div>
            <div className="text-xs text-gray-500 mt-1">השבוע הקרוב</div>
          </Link>
          <Link
            href={`/my-tours?year=${year}&month=${month + 1}`}
            className="bg-white rounded-xl shadow p-4 text-center hover:bg-gray-50 active:scale-95 transition-transform"
          >
            <div className="text-lg font-semibold text-green-800">הסיורים שלי</div>
            <div className="text-xs text-gray-500 mt-1">רשימה ועריכה</div>
          </Link>
          <Link
            href={`/cash-boxes?year=${year}&month=${month + 1}`}
            className="bg-white rounded-xl shadow p-4 text-center hover:bg-gray-50 active:scale-95 transition-transform"
          >
            <div className="text-lg font-semibold text-green-800">הקופות שלי</div>
            <div className="text-xs text-gray-500 mt-1">יתרות והעברות</div>
          </Link>
          <Link
            href={`/transfers?year=${year}&month=${month + 1}`}
            className="bg-white rounded-xl shadow p-4 text-center hover:bg-gray-50 active:scale-95 transition-transform"
          >
            <div className="text-lg font-semibold text-green-800">העברות שלי</div>
            <div className="text-xs text-gray-500 mt-1">לפורטוגו</div>
          </Link>
          <Link
            href={`/expenses?year=${year}&month=${month + 1}`}
            className="bg-white rounded-xl shadow p-4 text-center hover:bg-gray-50 active:scale-95 transition-transform"
          >
            <div className="text-lg font-semibold text-green-800">הוצאות שלי</div>
            <div className="text-xs text-gray-500 mt-1">מקופת הוצאות</div>
          </Link>
        </div>
      </main>

      {/* Receipt upload modal — צירוף אסמכתא לקבלה החודשית */}
      {receiptUploadModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 animate-[fadeIn_200ms_ease-out]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-[slideUp_300ms_ease-out] max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              צירוף אסמכתא לקבלה
            </h3>
            <p className="text-sm text-gray-600 mb-1">
              קבלה על {formatMonthLabel(receiptUploadModal.year, receiptUploadModal.month - 1)}
            </p>
            <p className="text-xs text-gray-500 mb-4">
              סכום הקבלה: {receiptUploadModal.receipt_amount.toFixed(2)}€
            </p>

            <div className="mb-4">
              <label className="block text-sm font-semibold mb-2">
                צרף.י קבלה <span className="text-red-600">*</span>
              </label>
              <PhotoPicker value={receiptFile} onChange={setReceiptFile} label="" emoji="" acceptPdf />
            </div>

            {receiptError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-3">
                {receiptError}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={handleReceiptUpload}
                disabled={receiptUploading || !receiptFile}
                className="w-full bg-amber-600 hover:bg-amber-700 active:scale-98 disabled:bg-gray-400 transition-all text-white rounded-xl py-3 font-bold"
              >
                {receiptUploading ? 'שולח...' : 'אפשר לשלוח את הקבלה, תודה!'}
              </button>
              <button
                onClick={() => {
                  setReceiptUploadModal(null);
                  setReceiptFile(null);
                  setReceiptError('');
                }}
                disabled={receiptUploading}
                className="w-full bg-gray-100 hover:bg-gray-200 active:scale-98 transition-all text-gray-700 rounded-xl py-3 font-medium text-sm"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout confirm modal — replaces native window.confirm */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 animate-[fadeIn_200ms_ease-out]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-[slideUp_300ms_ease-out]">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              להתנתק מהמערכת?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              תצטרכ.י להיכנס שוב בפעם הבאה.
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={confirmLogout}
                className="w-full bg-red-600 hover:bg-red-700 active:scale-98 transition-all text-white rounded-xl py-3 font-bold"
              >
                כן, התנתק.י
              </button>
              <button
                onClick={() => setShowLogoutModal(false)}
                className="w-full bg-gray-100 hover:bg-gray-200 active:scale-98 transition-all text-gray-700 rounded-xl py-3 font-medium text-sm"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">טוען...</div>}>
      <HomeContent />
    </Suspense>
  );
}
