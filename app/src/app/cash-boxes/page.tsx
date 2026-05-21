'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, SYSTEM_START_DATE } from '@/lib/supabase';
import { useAuthGuard } from '@/lib/auth';
import { uploadTransferReceipt } from '@/lib/storage';
import PhotoPicker from '@/components/PhotoPicker';
import { canEditMonth } from '@/lib/month-policy';

type Totals = {
  collected: number;        // all cash collected (any tour category)
  changeGiven: number;      // sum of change given to customers
  transferred: number;      // money sent to Portugo
  cashRefill: number;       // guide self-reinforcing: main → change envelope
  expenses: number;         // expenses from expenses envelope (excl. card)
  expensesFromCard: number; // expenses from food-market (Time Out) card
  cardLoad: number;         // money loaded onto food-market card (out of expenses envelope)
  expensesRefill: number;   // guide self-reinforcing: main → expenses envelope
  salaryWithdrawn: number;  // salary withdrawn from main box at month-close
  adminTopupChange: number; // אדמין הוסיף למעטפת עודף (לא מהקופה הראשית)
  adminTopupExpenses: number; // אדמין הוסיף למעטפת הוצאות (לא מהקופה הראשית)
  adminTopupCard: number; // אדמין הוסיף ישירות לכרטיס טיים אאוט (לא מהקופה הראשית)
};

// 'card' = הטענת כרטיס טיים אאוט (מקופת הוצאות → כרטיס)
type RefillKind = 'change' | 'expenses' | 'card';

/** תנועה אחת בקופה — לטיימליין */
type Movement = {
  date: string;
  description: string;
  amount: number;     // חיובי = נכנס, שלילי = יצא
  /** אם מוגדר — תנועה ניתנת לביטול ע"י המדריך (חיזוקי מעטפה בלבד).
   * המחיקה תסיר את שורת ה-transfer מ-DB. תוצג רק אם החודש פתוח לעריכה. */
  cancellable?: { transfer_id: string };
};

function formatShortDate(d: string): string {
  const dt = new Date(d);
  return dt.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
}

/** רכיב טיימליין: שורות עם תאריך, תיאור, סכום (+/-) */
function Timeline({
  movements,
  canCancel,
  onCancel,
}: {
  movements: Movement[];
  /** האם החודש פתוח לעריכה — קובע אם להציג כפתורי ביטול */
  canCancel: boolean;
  /** callback שנקרא בלחיצה על ❌ ליד תנועה ניתנת לביטול */
  onCancel: (transferId: string, description: string) => void;
}) {
  if (movements.length === 0) {
    return (
      <div className="text-center text-xs text-gray-400 py-3">אין תנועות בחודש זה</div>
    );
  }
  return (
    <ul className="space-y-1.5 text-sm pt-2 border-t mt-3">
      {movements.map((m, idx) => {
        const isPositive = m.amount > 0;
        const showCancel = canCancel && m.cancellable;
        return (
          <li key={idx} className="flex justify-between items-center gap-2">
            <span className="text-xs text-gray-500 font-mono shrink-0 w-12">
              {formatShortDate(m.date)}
            </span>
            <span className="flex-1 text-gray-700 truncate">{m.description}</span>
            <span className={`font-semibold shrink-0 ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
              {isPositive ? '+' : ''}{m.amount.toFixed(2)}€
            </span>
            {showCancel && (
              <button
                onClick={() => onCancel(m.cancellable!.transfer_id, m.description)}
                className="shrink-0 text-xs text-red-600 hover:bg-red-50 active:bg-red-100 rounded-full w-6 h-6 flex items-center justify-center transition-colors"
                aria-label="ביטול פעולה"
                title="ביטול הפעולה הזו"
              >
                ❌
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function formatMonthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
}

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function CashBoxesContent() {
  useAuthGuard();
  const router = useRouter();
  const searchParams = useSearchParams();
  const now = new Date();
  const urlYear = searchParams.get('year');
  const urlMonth = searchParams.get('month');
  const year = urlYear ? parseInt(urlYear) : now.getFullYear();
  const month = urlMonth ? parseInt(urlMonth) - 1 : now.getMonth();
  const isCurrent = year === now.getFullYear() && month === now.getMonth();

  const [guideId, setGuideId] = useState<string | null>(null);
  const [openingChange, setOpeningChange] = useState(0);
  const [openingExpenses, setOpeningExpenses] = useState(0);
  // המתנה להפקדה: שורות transfers מסוג to_portugo עם is_pending_deposit=true,
  // מצטברות על פני חודשים, נסגרות פיזית כשהמדריך מסמן "ביצעתי הפקדה".
  type PendingRow = {
    id: string;
    amount: number;
    transfer_date: string;
    notes: string | null;
  };
  const [pendingDeposits, setPendingDeposits] = useState<PendingRow[]>([]);
  const [showSettleModal, setShowSettleModal] = useState<PendingRow | 'all' | null>(null);
  const [settleReceipt, setSettleReceipt] = useState<File | null>(null);
  const [settleNotADeposit, setSettleNotADeposit] = useState(false);
  const [settleSaving, setSettleSaving] = useState(false);
  const [settleError, setSettleError] = useState('');
  const [totals, setTotals] = useState<Totals>({
    collected: 0,
    changeGiven: 0,
    transferred: 0,
    cashRefill: 0,
    expenses: 0,
    expensesFromCard: 0,
    cardLoad: 0,
    expensesRefill: 0,
    salaryWithdrawn: 0,
    adminTopupChange: 0,
    adminTopupExpenses: 0,
    adminTopupCard: 0,
  });

  // האם המדריך הזה מוסמך לסיור קולינרי (לפי guides.qualified_tours, נערך
  // ב-/admin/guides או במודאל המדריכים ב-/admin/shifts). רק אז הוא רואה את
  // תת-קופת "כרטיס טיים אאוט".
  const [hasCulinaryHistory, setHasCulinaryHistory] = useState(false);

  // יתרת תת-קופת כרטיס טיים אאוט — מצטברת על פני זמן (כסף פיזי על כרטיס).
  // sum(card_load + admin_topup_card) − sum(expenses where payment_source='food_market_card'),
  // מ-SYSTEM_START_DATE ועד סוף החודש הנבחר.
  const [cumCardLoad, setCumCardLoad] = useState(0);
  const [cumAdminTopupCard, setCumAdminTopupCard] = useState(0);
  const [cumExpensesFromCard, setCumExpensesFromCard] = useState(0);
  // יתרות מצטברות על פני זמן — מעטפות עוברות מחודש לחודש לפי כסף פיזי
  // שיש בהן בפועל. הסכומים האלו צוברים את כל החיזוקים, ההורדות וה-topups
  // עד סוף החודש הנבחר (לא תלוי בחודש בלבד).
  const [cumChangeRefill, setCumChangeRefill] = useState(0);
  const [cumChangeGiven, setCumChangeGiven] = useState(0);
  const [cumExpensesRefill, setCumExpensesRefill] = useState(0);
  const [cumExpenses, setCumExpenses] = useState(0);
  const [cumAdminTopupChange, setCumAdminTopupChange] = useState(0);
  const [cumAdminTopupExpenses, setCumAdminTopupExpenses] = useState(0);
  const [mainMovements, setMainMovements] = useState<Movement[]>([]);
  const [changeMovements, setChangeMovements] = useState<Movement[]>([]);
  const [expensesMovements, setExpensesMovements] = useState<Movement[]>([]);
  const [cardMovements, setCardMovements] = useState<Movement[]>([]);
  const [showMainTimeline, setShowMainTimeline] = useState(false);
  const [showChangeTimeline, setShowChangeTimeline] = useState(false);
  const [showExpensesTimeline, setShowExpensesTimeline] = useState(false);
  const [showCardTimeline, setShowCardTimeline] = useState(false);
  const [loading, setLoading] = useState(true);

  // Refill modal state
  const [refillModal, setRefillModal] = useState<RefillKind | null>(null);
  const [refillAmount, setRefillAmount] = useState('');
  const [refillSaving, setRefillSaving] = useState(false);
  const [refillError, setRefillError] = useState('');

  // טריגר רענון — מועלה ב-1 אחרי ביטול תנועה כדי לטעון מחדש את הנתונים
  const [reloadTrigger, setReloadTrigger] = useState(0);

  // מודאל אישור ביטול תנועה ("בטוח.ה?")
  const [cancelModal, setCancelModal] = useState<{ transfer_id: string; description: string } | null>(null);
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem('portugo_guide_id');
    if (!id) {
      router.push('/');
      return;
    }
    setGuideId(id);
    loadTotals(id);
  }, [router, year, month, reloadTrigger]);

  /**
   * האם החודש הנבחר פתוח לעריכה — קובע אם להציג כפתורי ❌ בטיימליין.
   * חודש נוכחי תמיד פתוח. חודש קודם פתוח ב-5 הימים הראשונים של החודש העוקב
   * אם המדריך עוד לא סגר משכורת. חודש ישן יותר נעול.
   */
  const canEdit = canEditMonth(year, month, totals.salaryWithdrawn > 0);

  /**
   * מבטל פעולת חיזוק (cash_refill / expenses_refill) — מוחק את שורת ה-transfer
   * מ-DB. המאזנים יחזרו אוטומטית כי הם מחושבים מסכומי השורות הקיימות.
   */
  async function handleCancelRefill() {
    if (!cancelModal) return;
    setCancelling(true);
    const { error } = await supabase
      .from('transfers')
      .delete()
      .eq('id', cancelModal.transfer_id)
      .in('transfer_type', ['cash_refill', 'expenses_refill', 'card_load']); // הגנה: לא למחוק סוגים אחרים בטעות
    setCancelling(false);
    if (error) {
      alert('משהו השתבש במחיקה: ' + error.message);
      return;
    }
    setCancelModal(null);
    setReloadTrigger((n) => n + 1);
  }

  async function loadTotals(id: string) {
    setLoading(true);
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    // Guide opening balances + qualified_tours (לזיהוי "מדריך קולינרי" — מי שמוסמך
    // לסיור קולינרי בעריכת אדמין ב-/admin/guides או ב-/admin/shifts).
    const { data: guideRow } = await supabase
      .from('guides')
      .select('opening_change_balance, opening_expenses_balance, qualified_tours')
      .eq('id', id)
      .single();
    setOpeningChange(guideRow?.opening_change_balance || 0);
    setOpeningExpenses(guideRow?.opening_expenses_balance || 0);
    setHasCulinaryHistory(
      Array.isArray(guideRow?.qualified_tours) &&
        guideRow.qualified_tours.includes('קולינרי'),
    );

    // Tours + bookings (for classic collected + change_given) — כולל תאריך + סוג סיור לטיימליין
    const { data: tours } = await supabase
      .from('tours')
      .select('id, tour_date, tour_type, category, bookings(price, change_given)')
      .eq('guide_id', id)
      .gte('tour_date', start)
      .lte('tour_date', end);

    let collected = 0;
    let changeGiven = 0;
    const mainMov: Movement[] = [];
    const changeMov: Movement[] = [];

    (tours || []).forEach((t) => {
      const bks = (t.bookings as { price: number; change_given: number }[]) || [];
      const tourPrice = bks.reduce((s, b) => s + (b.price || 0), 0);
      const tourChangeGiven = bks.reduce((s, b) => s + (b.change_given || 0), 0);
      collected += tourPrice;
      changeGiven += tourChangeGiven;
      // ─ קופה ראשית: הכסף שנכנס מהסיור
      if (tourPrice > 0) {
        mainMov.push({
          date: (t as { tour_date: string }).tour_date,
          description: `סיור ${(t as { tour_type: string }).tour_type}`,
          amount: tourPrice,
        });
      }
      // ─ עודף שניתן ללקוחות בסיור — יוצא ממעטפת העודף, נכנס לקופה הראשית
      if (tourChangeGiven > 0) {
        mainMov.push({
          date: (t as { tour_date: string }).tour_date,
          description: `עודף שנכנס מהסיור`,
          amount: tourChangeGiven,
        });
        changeMov.push({
          date: (t as { tour_date: string }).tour_date,
          description: `עודף שניתן ללקוחות`,
          amount: -tourChangeGiven,
        });
      }
    });

    // Transfers של החודש הנבחר — לחישוב יתרת קופה ראשית וטיימליין
    const { data: transfers } = await supabase
      .from('transfers')
      .select('id, amount, transfer_type, transfer_date, notes, is_pending_deposit')
      .eq('guide_id', id)
      .gte('transfer_date', start)
      .lte('transfer_date', end)
      .order('transfer_date', { ascending: true });

    // ─── Pending deposits — מצטברים על פני חודשים, לא רק החודש הנבחר ───
    // כי המעטפת הזו נצברת לאורך זמן עד שהמדריך מפקיד פיזית.
    const { data: pendings } = await supabase
      .from('transfers')
      .select('id, amount, transfer_date, notes')
      .eq('guide_id', id)
      .eq('transfer_type', 'to_portugo')
      .eq('is_pending_deposit', true)
      .order('transfer_date', { ascending: true });
    setPendingDeposits((pendings as PendingRow[]) || []);

    // ─── יתרות מעטפות מצטברות — מ-SYSTEM_START_DATE ועד סוף החודש הנבחר ───
    // המעטפות הן כסף פיזי שהמדריך נושא, אז היתרה ממשיכה מחודש לחודש.
    // אבל נתוני ארכיון מלפני SYSTEM_START_DATE לא נספרים — יתרת הפתיחה כבר
    // מייצגת את המצב הפיזי של המעטפות באותו רגע.
    // הוצאות נטענות עם payment_source כדי להפריד בין הוצאות רגילות לבין
    // הוצאות מכרטיס טיים אאוט. נופלים ל-fallback בלי השדה אם המיגרציה
    // עוד לא רצה.
    let cumExpRaw: { amount: number; payment_source?: string | null }[] = [];
    {
      const withPS = await supabase
        .from('expenses')
        .select('amount, payment_source')
        .eq('guide_id', id)
        .gte('expense_date', SYSTEM_START_DATE)
        .lte('expense_date', end);
      if (withPS.error && withPS.error.message?.toLowerCase().includes('payment_source')) {
        const fb = await supabase
          .from('expenses')
          .select('amount')
          .eq('guide_id', id)
          .gte('expense_date', SYSTEM_START_DATE)
          .lte('expense_date', end);
        cumExpRaw = (fb.data || []) as { amount: number }[];
      } else {
        cumExpRaw = (withPS.data || []) as { amount: number; payment_source?: string | null }[];
      }
    }

    const [cumTrRes, cumChangeGivenRes] = await Promise.all([
      supabase
        .from('transfers')
        .select('amount, transfer_type')
        .eq('guide_id', id)
        .gte('transfer_date', SYSTEM_START_DATE)
        .lte('transfer_date', end),
      supabase
        .from('tours')
        .select('tour_date, bookings(change_given)')
        .eq('guide_id', id)
        .gte('tour_date', SYSTEM_START_DATE)
        .lte('tour_date', end),
    ]);

    let _cumChangeRefill = 0;
    let _cumExpensesRefill = 0;
    let _cumAdminTopupChange = 0;
    let _cumAdminTopupExpenses = 0;
    let _cumCardLoad = 0;            // הטענות פנימיות (יוצאות ממעטפת הוצאות)
    let _cumAdminTopupCard = 0;      // הטענות אדמין ישירות מפורטוגו לכרטיס
    (cumTrRes.data || []).forEach((t: { amount: number; transfer_type: string }) => {
      const a = t.amount || 0;
      if (t.transfer_type === 'cash_refill') _cumChangeRefill += a;
      else if (t.transfer_type === 'expenses_refill') _cumExpensesRefill += a;
      else if (t.transfer_type === 'admin_topup_change') _cumAdminTopupChange += a;
      else if (t.transfer_type === 'admin_topup_expenses') _cumAdminTopupExpenses += a;
      else if (t.transfer_type === 'card_load') _cumCardLoad += a;
      else if (t.transfer_type === 'admin_topup_card') _cumAdminTopupCard += a;
    });
    let _cumChangeGiven = 0;
    type RawTour = { bookings: { change_given: number }[] | null };
    ((cumChangeGivenRes.data as RawTour[]) || []).forEach((t) => {
      (t.bookings || []).forEach((b) => {
        _cumChangeGiven += b.change_given || 0;
      });
    });
    // הפרדת הוצאות לפי מקור: ה"רגילות" יורדות מקופת הוצאות, אלו מהכרטיס יורדות מהכרטיס.
    let _cumExpenses = 0;
    let _cumExpensesFromCard = 0;
    cumExpRaw.forEach((e) => {
      const a = e.amount || 0;
      if (e.payment_source === 'food_market_card') _cumExpensesFromCard += a;
      else _cumExpenses += a;
    });

    setCumChangeRefill(_cumChangeRefill);
    setCumExpensesRefill(_cumExpensesRefill);
    setCumAdminTopupChange(_cumAdminTopupChange);
    setCumAdminTopupExpenses(_cumAdminTopupExpenses);
    setCumChangeGiven(_cumChangeGiven);
    setCumExpenses(_cumExpenses);
    setCumCardLoad(_cumCardLoad);
    setCumAdminTopupCard(_cumAdminTopupCard);
    setCumExpensesFromCard(_cumExpensesFromCard);

    // זיהוי "מדריך קולינרי" כבר נקבע למעלה ע"פ guide.qualified_tours.
    let transferred = 0;
    let cashRefill = 0;
    let expensesRefill = 0;
    let salaryWithdrawn = 0;
    let adminTopupChange = 0;
    let adminTopupExpenses = 0;
    let adminTopupCardMonth = 0;
    let cardLoadMonth = 0;
    const expensesMov: Movement[] = [];
    const cardMov: Movement[] = [];

    (transfers || []).forEach(
      (t: { id: string; amount: number; transfer_type: string; transfer_date: string; notes: string | null; is_pending_deposit?: boolean | null }) => {
        const amt = t.amount || 0;
        if (t.transfer_type === 'cash_refill') {
          cashRefill += amt;
          // שתי השורות מסומנות cancellable עם אותו transfer_id — מחיקה מאחת תסיר את שתיהן בריענון
          mainMov.push({ date: t.transfer_date, description: 'חיזוק למעטפת עודף', amount: -amt, cancellable: { transfer_id: t.id } });
          changeMov.push({ date: t.transfer_date, description: 'חיזוק מהקופה הראשית', amount: amt, cancellable: { transfer_id: t.id } });
        } else if (t.transfer_type === 'expenses_refill') {
          expensesRefill += amt;
          mainMov.push({ date: t.transfer_date, description: 'חיזוק למעטפת הוצאות', amount: -amt, cancellable: { transfer_id: t.id } });
          expensesMov.push({ date: t.transfer_date, description: 'חיזוק מהקופה הראשית', amount: amt, cancellable: { transfer_id: t.id } });
        } else if (t.transfer_type === 'card_load') {
          // הטענת כרטיס טיים אאוט: יוצא ממעטפת הוצאות, נכנס לתת-קופה
          cardLoadMonth += amt;
          expensesMov.push({ date: t.transfer_date, description: 'הטענת כרטיס טיים אאוט', amount: -amt, cancellable: { transfer_id: t.id } });
          cardMov.push({ date: t.transfer_date, description: 'הטענה ממעטפת הוצאות', amount: amt, cancellable: { transfer_id: t.id } });
        } else if (t.transfer_type === 'salary_withdrawal') {
          salaryWithdrawn += amt;
          mainMov.push({ date: t.transfer_date, description: 'משיכת משכורת (סגירת חודש)', amount: -amt });
        } else if (t.transfer_type === 'admin_topup_change') {
          adminTopupChange += amt;
          changeMov.push({
            date: t.transfer_date,
            description: t.notes || 'תוספת מפורטוגו',
            amount: amt,
          });
        } else if (t.transfer_type === 'admin_topup_expenses') {
          adminTopupExpenses += amt;
          expensesMov.push({
            date: t.transfer_date,
            description: t.notes || 'תוספת מפורטוגו',
            amount: amt,
          });
        } else if (t.transfer_type === 'admin_topup_card') {
          // הטענת אדמין ישירות לכרטיס — לא יוצאת ממעטפת הוצאות
          adminTopupCardMonth += amt;
          cardMov.push({
            date: t.transfer_date,
            description: t.notes || 'הטענה מפורטוגו',
            amount: amt,
          });
        } else {
          // to_portugo — או הפקדה רגילה, או העברה למעטפת המתנה
          transferred += amt;
          const desc = t.is_pending_deposit
            ? 'הועבר למעטפת המתנה'
            : 'הופקד לפורטוגו';
          mainMov.push({ date: t.transfer_date, description: desc, amount: -amt });
        }
      },
    );

    // Expenses (כולל תאריך, פריט ומקור תשלום לטיימליין)
    // נופלים ל-fallback בלי payment_source אם המיגרציה עוד לא רצה.
    type RawExpense = { amount: number; expense_date: string; item: string; payment_source?: string | null };
    let monthExpenses: RawExpense[] = [];
    {
      const withPS = await supabase
        .from('expenses')
        .select('amount, expense_date, item, payment_source')
        .eq('guide_id', id)
        .gte('expense_date', start)
        .lte('expense_date', end)
        .order('expense_date', { ascending: true });
      if (withPS.error && withPS.error.message?.toLowerCase().includes('payment_source')) {
        const fb = await supabase
          .from('expenses')
          .select('amount, expense_date, item')
          .eq('guide_id', id)
          .gte('expense_date', start)
          .lte('expense_date', end)
          .order('expense_date', { ascending: true });
        monthExpenses = (fb.data || []) as RawExpense[];
      } else {
        monthExpenses = (withPS.data || []) as RawExpense[];
      }
    }

    let expensesTotal = 0;          // הוצאות שיורדות מקופת הוצאות (לא מהכרטיס)
    let expensesFromCardTotal = 0;  // הוצאות שיורדות מהכרטיס

    monthExpenses.forEach((e) => {
      if (!e.amount || e.amount <= 0) return;
      const fromCard = e.payment_source === 'food_market_card';
      if (fromCard) {
        expensesFromCardTotal += e.amount;
        cardMov.push({
          date: e.expense_date,
          description: e.item || 'הוצאה מהכרטיס',
          amount: -e.amount,
        });
      } else {
        expensesTotal += e.amount;
        expensesMov.push({
          date: e.expense_date,
          description: e.item || 'הוצאה',
          amount: -e.amount,
        });
      }
    });

    // יתרה בתחילת החודש הנבחר = יתרה בסוף החודש הקודם.
    // מחשבים מצטבר עד תחילת החודש: opening + (cum_until_end - this_month) על כל הסוגים.
    // בחודש הראשון של המערכת (SYSTEM_START_DATE) זה יוצא בדיוק opening_*_balance —
    // ושם נציג את התווית "יתרת פתיחה". בכל חודש אחר: "יתרה שעברה מחודש קודם".
    // מעטפת הוצאות: הטענת כרטיס יורדת ממנה ולא מוחזרת.
    const changeCarriedOver =
      (guideRow?.opening_change_balance || 0) +
      (_cumChangeRefill - cashRefill) +
      (_cumAdminTopupChange - adminTopupChange) -
      (_cumChangeGiven - changeGiven);
    const expensesCarriedOver =
      (guideRow?.opening_expenses_balance || 0) +
      (_cumExpensesRefill - expensesRefill) +
      (_cumAdminTopupExpenses - adminTopupExpenses) -
      (_cumExpenses - expensesTotal) -
      (_cumCardLoad - cardLoadMonth);
    // יתרת כרטיס שעברה מחודש קודם = sum(הטענות עד תחילת חודש) − sum(הוצאות מכרטיס עד תחילת חודש)
    const cardCarriedOver =
      (_cumCardLoad - cardLoadMonth) - (_cumExpensesFromCard - expensesFromCardTotal);
    const carriedLabel = start === SYSTEM_START_DATE ? 'יתרת פתיחה' : 'יתרה שעברה מחודש קודם';

    if (changeCarriedOver > 0.001) {
      changeMov.unshift({
        date: start,
        description: carriedLabel,
        amount: changeCarriedOver,
      });
    }
    if (expensesCarriedOver > 0.001) {
      expensesMov.unshift({
        date: start,
        description: carriedLabel,
        amount: expensesCarriedOver,
      });
    }
    if (cardCarriedOver > 0.001) {
      cardMov.unshift({
        date: start,
        description: carriedLabel,
        amount: cardCarriedOver,
      });
    }

    // מיון לפי תאריך עולה
    mainMov.sort((a, b) => a.date.localeCompare(b.date));
    changeMov.sort((a, b) => a.date.localeCompare(b.date));
    expensesMov.sort((a, b) => a.date.localeCompare(b.date));
    cardMov.sort((a, b) => a.date.localeCompare(b.date));

    setMainMovements(mainMov);
    setChangeMovements(changeMov);
    setExpensesMovements(expensesMov);
    setCardMovements(cardMov);

    setTotals({
      collected,
      changeGiven,
      transferred,
      cashRefill,
      expenses: expensesTotal,
      expensesFromCard: expensesFromCardTotal,
      cardLoad: cardLoadMonth,
      expensesRefill,
      salaryWithdrawn,
      adminTopupChange,
      adminTopupExpenses,
      adminTopupCard: adminTopupCardMonth,
    });
    setLoading(false);
  }

  // Formulas — self-reinforcement is INTERNAL (main box decreases when reinforcing)
  // Main = all cash collected + change_given - transferred to Portugo - refills to envelopes - salary withdrawn at month-close
  // Change envelope = יתרת פתיחה + refills - change given
  // Expenses envelope = יתרת פתיחה + refills - expenses
  const mainBalance =
    totals.collected +
    totals.changeGiven -
    totals.transferred -
    totals.cashRefill -
    totals.expensesRefill -
    totals.salaryWithdrawn;
  // היתרה במעטפות מצטברת על פני זמן — כסף פיזי שהמדריך נושא, ממשיך מחודש לחודש.
  // יתרת פתיחה (חד-פעמית) + כל החיזוקים + תוספות מאדמין − כל המשיכות, עד סוף החודש הנבחר.
  // מעטפת הוצאות: הטענת כרטיס טיים אאוט יורדת ממנה (העברה פנימית).
  const changeBalance = openingChange + cumChangeRefill + cumAdminTopupChange - cumChangeGiven;
  const expensesBalance =
    openingExpenses + cumExpensesRefill + cumAdminTopupExpenses - cumExpenses - cumCardLoad;
  // יתרת תת-קופת כרטיס טיים אאוט = הטענות (פנימיות + אדמין) − הוצאות מהכרטיס
  const cardBalance = cumCardLoad + cumAdminTopupCard - cumExpensesFromCard;
  // האם להציג את תת-הקופה: רק למדריך קולינרי, או אם יש כרגע יתרה / תנועות
  const showCardBox =
    hasCulinaryHistory || cardBalance > 0.001 || cumCardLoad > 0 || cumAdminTopupCard > 0;
  // קופה רביעית: סך הכל ממתין להפקדה (חוצה חודשים — לא תלוי בחודש הנבחר)
  const pendingTotal = pendingDeposits.reduce((s, p) => s + (p.amount || 0), 0);
  const needsChangeRefill = totals.changeGiven > 0 && changeBalance < 51;

  const refillAmt = parseFloat(refillAmount) || 0;
  // תווית יעד + מקור: הטענת כרטיס יוצאת ממעטפת הוצאות, השאר מהקופה הראשית.
  const refillTargetLabel =
    refillModal === 'change' ? 'מעטפת העודף'
    : refillModal === 'expenses' ? 'מעטפת ההוצאות'
    : 'כרטיס טיים אאוט';
  const refillSourceLabel = refillModal === 'card' ? 'מעטפת ההוצאות' : 'הקופה הראשית';
  const refillSourceBalance = refillModal === 'card' ? expensesBalance : mainBalance;
  const currentEnvelope =
    refillModal === 'change' ? changeBalance
    : refillModal === 'expenses' ? expensesBalance
    : cardBalance;

  async function handleRefill() {
    if (!guideId || !refillModal) return;
    setRefillError('');
    const amt = parseFloat(refillAmount);
    if (!amt || amt <= 0) {
      setRefillError('נשאר להזין סכום');
      return;
    }
    if (amt > refillSourceBalance) {
      setRefillError(`אין מספיק ב${refillSourceLabel} לפעולה הזו`);
      return;
    }
    setRefillSaving(true);
    const transferType =
      refillModal === 'change' ? 'cash_refill'
      : refillModal === 'expenses' ? 'expenses_refill'
      : 'card_load';
    const notes =
      refillModal === 'card'
        ? 'הטענת כרטיס טיים אאוט ממעטפת הוצאות'
        : `חיזוק מהקופה הראשית ל${refillTargetLabel}`;
    const { error } = await supabase.from('transfers').insert({
      guide_id: guideId,
      transfer_date: todayISO(),
      amount: amt,
      transfer_type: transferType,
      notes,
    });
    setRefillSaving(false);
    if (error) {
      setRefillError('משהו השתבש: ' + error.message);
      return;
    }
    setRefillModal(null);
    setRefillAmount('');
    loadTotals(guideId);
  }

  /**
   * סגירת המתנה: המדריך הפקיד פיזית.
   * - אם המודאל פתוח עבור pending ספציפי → סוגרים רק אותו
   * - אם פתוח עבור 'all' → סוגרים את כל ה-pending
   * הסגירה: מורידים את הדגל is_pending_deposit ל-false ומצרפים אסמכתא
   * (אלא אם המדריך סימן "לא הייתה הפקדה").
   */
  async function handleSettlePending() {
    if (!guideId || !showSettleModal) return;
    setSettleError('');
    if (!settleNotADeposit && !settleReceipt) {
      setSettleError('צריך לצרף אסמכתא להפקדה. אם זו לא הייתה הפקדה — סמן.י את התיבה למטה.');
      return;
    }

    const targetIds: string[] =
      showSettleModal === 'all'
        ? pendingDeposits.map((p) => p.id)
        : [showSettleModal.id];

    setSettleSaving(true);
    const today = todayISO();

    // אם יש אסמכתא — מעלים אחת ומקשרים לכל ה-pending שנסגרים יחד
    let receiptUrl: string | null = null;
    if (settleReceipt && targetIds.length > 0) {
      try {
        receiptUrl = await uploadTransferReceipt({
          file: settleReceipt,
          transferId: targetIds[0], // משויך לראשונה — אם יש כמה, כולן יקבלו אותו URL
          transferDate: today,
        });
      } catch (uploadErr) {
        setSettleSaving(false);
        const msg = uploadErr instanceof Error ? uploadErr.message : 'משהו השתבש';
        setSettleError(`העלאת האסמכתא נכשלה: ${msg}`);
        return;
      }
    }

    // עדכון הרשומות: דגל פנדינג=false, אסמכתא, is_deposit.
    // transfer_date נשאר ביום סגירת החודש שיצר את ה-pending (חשוב לחישוב
    // הקופה הראשית של החודש המקורי).
    // settled_at = היום בפועל — קובע באיזה חודש קשפלו ההפקדה תופיע
    // (אם הפקדה ב-3.5 על pending מ-30.4 → תופיע בקשפלו מאי).
    let { error } = await supabase
      .from('transfers')
      .update({
        is_pending_deposit: false,
        is_deposit: !settleNotADeposit,
        receipt_url: receiptUrl,
        settled_at: today,
      })
      .in('id', targetIds);

    // אם עמודת settled_at עדיין לא רצה במיגרציה — ננסה שוב בלעדיה
    if (error && error.message?.toLowerCase().includes('settled_at')) {
      const retry = await supabase
        .from('transfers')
        .update({
          is_pending_deposit: false,
          is_deposit: !settleNotADeposit,
          receipt_url: receiptUrl,
        })
        .in('id', targetIds);
      error = retry.error;
    }

    setSettleSaving(false);
    if (error) {
      setSettleError('משהו השתבש: ' + error.message);
      return;
    }
    setShowSettleModal(null);
    setSettleReceipt(null);
    setSettleNotADeposit(false);
    loadTotals(guideId);
  }

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <header className="bg-green-800 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={() => router.back()}
              className="text-sm bg-green-900 hover:bg-green-950 active:scale-95 transition-transform px-3 py-2 rounded-md"
            >
              ← חזרה
            </button>
            <Link
              href="/home"
              aria-label="מסך הבית"
              className="text-base bg-green-900 hover:bg-green-950 active:scale-95 transition-transform px-3 py-2 rounded-md"
            >
              🏠
            </Link>
          </div>
          <h1 className="text-lg font-bold">הקופות שלי</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        <div className="text-center text-sm text-gray-500">📅 {formatMonthLabel(year, month)}</div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">רגע, מחשב יתרות...</div>
        ) : (
          <>
            {/* קופה רביעית — המתנה להפקדה (מודגשת באדום, נצברת על פני חודשים) */}
            {pendingTotal > 0 && (
              <div className="bg-red-50 border-2 border-red-400 rounded-xl shadow p-5">
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-bold text-red-700">💰 המתנה להפקדה</h3>
                  <span className="text-2xl font-bold text-red-700">{pendingTotal.toFixed(0)}€</span>
                </div>
                <p className="text-xs text-red-700 mb-3">
                  זה הכסף שצבור אצלך וצריך להפקיד לפורטוגו. ברגע שתפקיד.י —
                  סמני &quot;ביצעתי הפקדה&quot; ותצרף.י אסמכתא.
                </p>
                <ul className="space-y-2 mb-3">
                  {pendingDeposits.map((p) => (
                    <li
                      key={p.id}
                      className="flex justify-between items-center text-sm bg-white border border-red-200 rounded-lg p-2"
                    >
                      <div>
                        <div className="font-semibold text-red-800">{p.amount.toFixed(0)}€</div>
                        <div className="text-[11px] text-gray-600">
                          {p.notes || 'ממתין להפקדה'}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setShowSettleModal(p);
                          setSettleReceipt(null);
                          setSettleNotADeposit(false);
                          setSettleError('');
                        }}
                        className="bg-red-600 hover:bg-red-700 active:scale-98 transition-all text-white text-xs font-semibold px-3 py-1.5 rounded-md"
                      >
                        ביצעתי הפקדה ✓
                      </button>
                    </li>
                  ))}
                </ul>
                {pendingDeposits.length > 1 && (
                  <button
                    onClick={() => {
                      setShowSettleModal('all');
                      setSettleReceipt(null);
                      setSettleNotADeposit(false);
                      setSettleError('');
                    }}
                    className="w-full bg-red-600 hover:bg-red-700 active:scale-98 transition-all text-white rounded-lg py-2 font-semibold text-sm"
                  >
                    סגור את כל המעטפה ({pendingTotal.toFixed(0)}€) ✓
                  </button>
                )}
              </div>
            )}

            {/* Main box */}
            <div className="bg-white rounded-xl shadow p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold">קופה ראשית</h3>
                <span className="text-2xl font-bold text-green-800">{mainBalance.toFixed(2)}€</span>
              </div>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">נאסף בסיורים:</span>
                  <span className="font-semibold">+{totals.collected.toFixed(2)}€</span>
                </div>
                {totals.changeGiven > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">עודף שנכנס לקופה:</span>
                    <span className="font-semibold">+{totals.changeGiven.toFixed(2)}€</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">הועבר לפורטוגו:</span>
                  <span className="font-semibold text-red-700">
                    -{totals.transferred.toFixed(2)}€
                  </span>
                </div>
                {totals.cashRefill > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">חיזוק למעטפת עודף:</span>
                    <span className="font-semibold text-red-700">
                      -{totals.cashRefill.toFixed(2)}€
                    </span>
                  </div>
                )}
                {totals.expensesRefill > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">חיזוק למעטפת הוצאות:</span>
                    <span className="font-semibold text-red-700">
                      -{totals.expensesRefill.toFixed(2)}€
                    </span>
                  </div>
                )}
              </div>

              {/* Timeline toggle */}
              <button
                onClick={() => setShowMainTimeline(!showMainTimeline)}
                className="w-full mt-3 text-sm text-green-800 hover:text-green-900 font-medium flex items-center justify-center gap-1"
              >
                {showMainTimeline ? '▲ הסתר.י פירוט תנועות' : '▼ פירוט תנועות לפי תאריך'}
              </button>
              {showMainTimeline && (
                <Timeline
                  movements={mainMovements}
                  canCancel={canEdit}
                  onCancel={(transfer_id, description) => setCancelModal({ transfer_id, description })}
                />
              )}

              <Link
                href={`/transfers?year=${year}&month=${month + 1}`}
                className="block mt-3 text-center bg-green-700 hover:bg-green-800 active:scale-98 transition-all text-white rounded-lg py-2 font-semibold"
              >
                דיווח העברה לפורטוגו
              </Link>
            </div>

            {/* Change envelope */}
            <div
              className={`rounded-xl shadow p-5 ${
                needsChangeRefill ? 'bg-amber-50 border border-amber-300' : 'bg-white'
              }`}
            >
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold">מעטפת עודף</h3>
                <span className="text-2xl font-bold text-blue-800">
                  {changeBalance.toFixed(2)}€
                </span>
              </div>
              <div className="space-y-1 text-sm">
                {/* יתרה שעברה: כסף שכבר היה במעטפה לפני תחילת החודש (כולל יתרת פתיחה + חודשים קודמים) */}
                {(() => {
                  const carriedOver =
                    changeBalance -
                    (totals.cashRefill + totals.adminTopupChange - totals.changeGiven);
                  return carriedOver > 0.001 ? (
                    <div className="flex justify-between">
                      <span className="text-gray-600">יתרה שעברה מחודש קודם:</span>
                      <span className="font-semibold">+{carriedOver.toFixed(2)}€</span>
                    </div>
                  ) : null;
                })()}
                <div className="flex justify-between">
                  <span className="text-gray-600">חיזוק מהקופה הראשית:</span>
                  <span className="font-semibold">+{totals.cashRefill.toFixed(2)}€</span>
                </div>
                {totals.adminTopupChange > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">תוספת מפורטוגו:</span>
                    <span className="font-semibold">+{totals.adminTopupChange.toFixed(2)}€</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">עודף שנתתי ללקוחות:</span>
                  <span className="font-semibold text-red-700">
                    -{totals.changeGiven.toFixed(2)}€
                  </span>
                </div>
              </div>

              {/* Timeline toggle */}
              <button
                onClick={() => setShowChangeTimeline(!showChangeTimeline)}
                className="w-full mt-3 text-sm text-blue-800 hover:text-blue-900 font-medium flex items-center justify-center gap-1"
              >
                {showChangeTimeline ? '▲ הסתר.י פירוט תנועות' : '▼ פירוט תנועות לפי תאריך'}
              </button>
              {showChangeTimeline && (
                <Timeline
                  movements={changeMovements}
                  canCancel={canEdit}
                  onCancel={(transfer_id, description) => setCancelModal({ transfer_id, description })}
                />
              )}

              {needsChangeRefill && (
                <div className="mt-3 p-3 bg-amber-100 border border-amber-300 rounded-lg text-amber-900 text-sm font-medium">
                  ⚠️ המעטפת מתרוקנת — כדאי לחזק אותה מהקופה הראשית.
                </div>
              )}
              {isCurrent && (
                <button
                  onClick={() => {
                    setRefillModal('change');
                    setRefillAmount('');
                    setRefillError('');
                  }}
                  className="w-full mt-3 bg-blue-700 hover:bg-blue-800 active:scale-98 transition-all text-white rounded-lg py-2 font-semibold"
                >
                  חיזוק מהקופה הראשית
                </button>
              )}
            </div>

            {/* Expenses envelope — כולל סקציית כרטיס טיים אאוט בפנים (למדריכי קולינרי) */}
            <div className="bg-white rounded-xl shadow p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold">מעטפת הוצאות</h3>
                <span className="text-2xl font-bold text-amber-700">
                  {expensesBalance.toFixed(2)}€
                </span>
              </div>
              <div className="space-y-1 text-sm">
                {(() => {
                  // יתרה שעברה = כל מה שהיה במעטפת לפני תחילת החודש,
                  // בניכוי הטענות הכרטיס שיצאו ממנה.
                  const carriedOver =
                    expensesBalance -
                    (totals.expensesRefill + totals.adminTopupExpenses - totals.expenses - totals.cardLoad);
                  return carriedOver > 0.001 ? (
                    <div className="flex justify-between">
                      <span className="text-gray-600">יתרה שעברה מחודש קודם:</span>
                      <span className="font-semibold">+{carriedOver.toFixed(2)}€</span>
                    </div>
                  ) : null;
                })()}
                <div className="flex justify-between">
                  <span className="text-gray-600">חיזוק מהקופה הראשית:</span>
                  <span className="font-semibold">+{totals.expensesRefill.toFixed(2)}€</span>
                </div>
                {totals.adminTopupExpenses > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">תוספת מפורטוגו:</span>
                    <span className="font-semibold">+{totals.adminTopupExpenses.toFixed(2)}€</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-600">הוצאות החודש:</span>
                  <span className="font-semibold text-red-700">
                    -{totals.expenses.toFixed(2)}€
                  </span>
                </div>
                {totals.cardLoad > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">הטענת כרטיס טיים אאוט:</span>
                    <span className="font-semibold text-red-700">
                      -{totals.cardLoad.toFixed(2)}€
                    </span>
                  </div>
                )}
              </div>

              {/* Timeline toggle */}
              <button
                onClick={() => setShowExpensesTimeline(!showExpensesTimeline)}
                className="w-full mt-3 text-sm text-amber-800 hover:text-amber-900 font-medium flex items-center justify-center gap-1"
              >
                {showExpensesTimeline ? '▲ הסתר.י פירוט תנועות' : '▼ פירוט תנועות לפי תאריך'}
              </button>
              {showExpensesTimeline && (
                <Timeline
                  movements={expensesMovements}
                  canCancel={canEdit}
                  onCancel={(transfer_id, description) => setCancelModal({ transfer_id, description })}
                />
              )}

              <div className="flex gap-2 mt-3">
                <Link
                  href={`/expenses?year=${year}&month=${month + 1}`}
                  className="flex-1 text-center bg-amber-600 hover:bg-amber-700 active:scale-98 transition-all text-white rounded-lg py-2 font-semibold"
                >
                  הוסף.י הוצאה
                </Link>
                {isCurrent && (
                  <button
                    onClick={() => {
                      setRefillModal('expenses');
                      setRefillAmount('');
                      setRefillError('');
                    }}
                    className="flex-1 bg-blue-700 hover:bg-blue-800 active:scale-98 transition-all text-white rounded-lg py-2 font-semibold"
                  >
                    חיזוק מהראשית
                  </button>
                )}
              </div>

              {/* ─── תת-קופה: כרטיס טיים אאוט ─── */}
              {showCardBox && (
                <div className="mt-4 pt-4 border-t-2 border-dashed border-amber-200">
                  <div className="flex justify-between items-center mb-2">
                    <div>
                      <h4 className="text-base font-bold text-amber-900 flex items-center gap-1">
                        🍴 כרטיס טיים אאוט
                      </h4>
                      <div className="text-[11px] text-gray-500">
                        תת-קופה לסיור קולינרי. הכסף יוצא ממעטפת הוצאות.
                      </div>
                    </div>
                    <span className="text-xl font-bold text-amber-900">
                      {cardBalance.toFixed(2)}€
                    </span>
                  </div>

                  <div className="space-y-1 text-sm">
                    {(() => {
                      const cardCarried =
                        cardBalance -
                        (totals.cardLoad + totals.adminTopupCard - totals.expensesFromCard);
                      return cardCarried > 0.001 ? (
                        <div className="flex justify-between">
                          <span className="text-gray-600">יתרה שעברה מחודש קודם:</span>
                          <span className="font-semibold">+{cardCarried.toFixed(2)}€</span>
                        </div>
                      ) : null;
                    })()}
                    {totals.cardLoad > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">הטענה ממעטפת הוצאות:</span>
                        <span className="font-semibold">+{totals.cardLoad.toFixed(2)}€</span>
                      </div>
                    )}
                    {totals.adminTopupCard > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">הטענה מפורטוגו:</span>
                        <span className="font-semibold">+{totals.adminTopupCard.toFixed(2)}€</span>
                      </div>
                    )}
                    {totals.expensesFromCard > 0 && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">הוצאות מהכרטיס:</span>
                        <span className="font-semibold text-red-700">
                          -{totals.expensesFromCard.toFixed(2)}€
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Card timeline toggle */}
                  <button
                    onClick={() => setShowCardTimeline(!showCardTimeline)}
                    className="w-full mt-2 text-sm text-amber-800 hover:text-amber-900 font-medium flex items-center justify-center gap-1"
                  >
                    {showCardTimeline ? '▲ הסתר.י פירוט תנועות הכרטיס' : '▼ פירוט תנועות הכרטיס'}
                  </button>
                  {showCardTimeline && (
                    <Timeline
                      movements={cardMovements}
                      canCancel={canEdit}
                      onCancel={(transfer_id, description) => setCancelModal({ transfer_id, description })}
                    />
                  )}

                  {isCurrent && (
                    <button
                      onClick={() => {
                        setRefillModal('card');
                        setRefillAmount('');
                        setRefillError('');
                      }}
                      disabled={expensesBalance <= 0}
                      className="w-full mt-3 bg-amber-700 hover:bg-amber-800 active:scale-98 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all text-white rounded-lg py-2 font-semibold text-sm"
                    >
                      הטענת כרטיס טיים אאוט
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-4 text-sm">
              💡 חיזוק = העברת כסף מהקופה הראשית למעטפת עודף או הוצאות, כשהן מתרוקנות.
            </div>
          </>
        )}
      </main>

      {/* Cancel-refill confirmation modal — אישור ביטול תנועת חיזוק */}
      {cancelModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 animate-[fadeIn_200ms_ease-out]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-[slideUp_300ms_ease-out]">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              ביטול הפעולה?
            </h3>
            <p className="text-sm text-gray-700 mb-2">
              את עומדת לבטל את התנועה:
            </p>
            <p className="text-sm font-semibold text-gray-900 mb-2 bg-gray-50 rounded p-2">
              {cancelModal.description}
            </p>
            <p className="text-xs text-gray-500 mb-4 leading-relaxed">
              הפעולה תוסר משתי הקופות (גם מהראשית וגם מהמעטפת), והיתרות יחזרו למצב לפני החיזוק.
              שימי לב — אם הכסף כבר זז פיזית, צריך להחזיר אותו ידנית.
            </p>

            <div className="flex flex-col gap-2">
              <button
                onClick={handleCancelRefill}
                disabled={cancelling}
                className="w-full bg-red-600 hover:bg-red-700 active:scale-98 disabled:bg-gray-400 transition-all text-white rounded-xl py-3 font-bold"
              >
                {cancelling ? 'מבטלת...' : 'כן, בטלי את הפעולה'}
              </button>
              <button
                onClick={() => setCancelModal(null)}
                disabled={cancelling}
                className="w-full bg-gray-100 hover:bg-gray-200 active:scale-98 transition-all text-gray-700 rounded-xl py-3 font-medium text-sm"
              >
                לא, השאירי
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Refill modal — שימושי לחיזוק מעטפות + הטענת כרטיס טיים אאוט */}
      {refillModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 animate-[fadeIn_200ms_ease-out]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-[slideUp_300ms_ease-out]">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              {refillModal === 'card' ? 'הטענת כרטיס טיים אאוט' : `חיזוק ${refillTargetLabel}`}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              כמה להעביר מ{refillSourceLabel} ל{refillTargetLabel}?
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">יש כרגע ב{refillSourceLabel}:</span>
                <span className="font-semibold text-green-800">{refillSourceBalance.toFixed(2)}€</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">יש כרגע ב{refillTargetLabel}:</span>
                <span className="font-semibold">{currentEnvelope.toFixed(2)}€</span>
              </div>
            </div>

            <label className="block text-sm font-semibold mb-1">כמה להעביר? (€)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              autoFocus
              value={refillAmount}
              onChange={(e) => setRefillAmount(e.target.value)}
              placeholder="50"
              className="w-full border border-gray-300 rounded-lg px-3 py-3 text-xl mb-3"
            />

            {refillAmt > 0 && refillAmt <= refillSourceBalance && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm space-y-1">
                <div className="font-semibold text-blue-900 mb-1">
                  אחרי {refillModal === 'card' ? 'ההטענה' : 'החיזוק'}:
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">{refillSourceLabel}:</span>
                  <span className="font-semibold">
                    {refillSourceBalance.toFixed(2)}€ →{' '}
                    <span className="text-green-800">{(refillSourceBalance - refillAmt).toFixed(2)}€</span>
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-700">{refillTargetLabel}:</span>
                  <span className="font-semibold">
                    {currentEnvelope.toFixed(2)}€ →{' '}
                    <span className="text-blue-800">{(currentEnvelope + refillAmt).toFixed(2)}€</span>
                  </span>
                </div>
              </div>
            )}

            {refillError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-3">
                {refillError}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={handleRefill}
                disabled={refillSaving}
                className="w-full bg-green-700 hover:bg-green-800 active:scale-98 disabled:bg-gray-400 transition-all text-white rounded-xl py-3 font-bold"
              >
                {refillSaving
                  ? 'מעבירה...'
                  : refillModal === 'card' ? 'בצעי הטענה' : 'בצעי חיזוק'}
              </button>
              <button
                onClick={() => setRefillModal(null)}
                className="w-full bg-gray-100 hover:bg-gray-200 active:scale-98 transition-all text-gray-700 rounded-xl py-3 font-medium text-sm"
              >
                ביטול
              </button>
            </div>
          </div>

          <style jsx global>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* Settle pending deposit modal — סגירת מעטפת המתנה */}
      {showSettleModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 animate-[fadeIn_200ms_ease-out]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-[slideUp_300ms_ease-out] max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              ביצעתי הפקדה ✓
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              {showSettleModal === 'all'
                ? `סגירת כל המתנה בבת אחת — סה"כ ${pendingTotal.toFixed(0)}€`
                : `סגירת ההפקדה: ${(showSettleModal as PendingRow).amount.toFixed(0)}€`}
            </p>

            {/* אסמכתא — חובה אם זו הייתה הפקדה */}
            {!settleNotADeposit && (
              <div className="mb-4">
                <label className="block text-sm font-semibold mb-1">
                  צילום אסמכתא <span className="text-red-600">*</span>
                </label>
                <p className="text-xs text-gray-500 mb-2">אישור הפקדה (תמונה / סקרין-שוט)</p>
                <PhotoPicker value={settleReceipt} onChange={setSettleReceipt} />
              </div>
            )}

            {/* טוגל "זו לא הייתה הפקדה" */}
            <label className="flex items-start gap-2 cursor-pointer p-3 bg-gray-50 border border-gray-200 rounded-lg mb-4">
              <input
                type="checkbox"
                checked={settleNotADeposit}
                onChange={(e) => {
                  setSettleNotADeposit(e.target.checked);
                  if (e.target.checked) setSettleReceipt(null);
                }}
                className="mt-1 w-4 h-4 accent-green-700"
              />
              <div>
                <div className="text-sm font-semibold text-gray-800">זו לא הייתה הפקדה</div>
                <div className="text-xs text-gray-600">אין אסמכתא</div>
              </div>
            </label>

            {settleError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-3">
                {settleError}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={handleSettlePending}
                disabled={settleSaving}
                className="w-full bg-red-600 hover:bg-red-700 active:scale-98 disabled:bg-gray-400 transition-all text-white rounded-xl py-3 font-bold"
              >
                {settleSaving ? 'שומר...' : 'אישור — סגור.י את ההמתנה'}
              </button>
              <button
                onClick={() => {
                  setShowSettleModal(null);
                  setSettleError('');
                  setSettleReceipt(null);
                  setSettleNotADeposit(false);
                }}
                disabled={settleSaving}
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

export default function CashBoxesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-500">טוען...</div>
      }
    >
      <CashBoxesContent />
    </Suspense>
  );
}
