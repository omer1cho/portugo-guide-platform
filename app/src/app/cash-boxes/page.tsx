'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuthGuard } from '@/lib/auth';
import { uploadTransferReceipt } from '@/lib/storage';
import PhotoPicker from '@/components/PhotoPicker';

type Totals = {
  collected: number;        // all cash collected (any tour category)
  changeGiven: number;      // sum of change given to customers
  transferred: number;      // money sent to Portugo
  cashRefill: number;       // guide self-reinforcing: main → change envelope
  expenses: number;         // expenses from expenses envelope
  expensesRefill: number;   // guide self-reinforcing: main → expenses envelope
  salaryWithdrawn: number;  // salary withdrawn from main box at month-close
  adminTopupChange: number; // אדמין הוסיף למעטפת עודף (לא מהקופה הראשית)
  adminTopupExpenses: number; // אדמין הוסיף למעטפת הוצאות (לא מהקופה הראשית)
};

type RefillKind = 'change' | 'expenses';

/** תנועה אחת בקופה — לטיימליין */
type Movement = {
  date: string;
  description: string;
  amount: number;     // חיובי = נכנס, שלילי = יצא
};

function formatShortDate(d: string): string {
  const dt = new Date(d);
  return dt.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
}

/** רכיב טיימליין: שורות עם תאריך, תיאור, סכום (+/-) */
function Timeline({ movements }: { movements: Movement[] }) {
  if (movements.length === 0) {
    return (
      <div className="text-center text-xs text-gray-400 py-3">אין תנועות בחודש זה</div>
    );
  }
  return (
    <ul className="space-y-1.5 text-sm pt-2 border-t mt-3">
      {movements.map((m, idx) => {
        const isPositive = m.amount > 0;
        return (
          <li key={idx} className="flex justify-between items-center gap-2">
            <span className="text-xs text-gray-500 font-mono shrink-0 w-12">
              {formatShortDate(m.date)}
            </span>
            <span className="flex-1 text-gray-700 truncate">{m.description}</span>
            <span className={`font-semibold shrink-0 ${isPositive ? 'text-green-700' : 'text-red-700'}`}>
              {isPositive ? '+' : ''}{m.amount.toFixed(2)}€
            </span>
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
    expensesRefill: 0,
    salaryWithdrawn: 0,
    adminTopupChange: 0,
    adminTopupExpenses: 0,
  });
  const [mainMovements, setMainMovements] = useState<Movement[]>([]);
  const [changeMovements, setChangeMovements] = useState<Movement[]>([]);
  const [expensesMovements, setExpensesMovements] = useState<Movement[]>([]);
  const [showMainTimeline, setShowMainTimeline] = useState(false);
  const [showChangeTimeline, setShowChangeTimeline] = useState(false);
  const [showExpensesTimeline, setShowExpensesTimeline] = useState(false);
  const [loading, setLoading] = useState(true);

  // Refill modal state
  const [refillModal, setRefillModal] = useState<RefillKind | null>(null);
  const [refillAmount, setRefillAmount] = useState('');
  const [refillSaving, setRefillSaving] = useState(false);
  const [refillError, setRefillError] = useState('');

  useEffect(() => {
    const id = localStorage.getItem('portugo_guide_id');
    if (!id) {
      router.push('/');
      return;
    }
    setGuideId(id);
    loadTotals(id);
  }, [router, year, month]);

  async function loadTotals(id: string) {
    setLoading(true);
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    // Guide opening balances (יתרות פתיחה — הכסף שהמדריך נכנס איתו למערכת)
    const { data: guideRow } = await supabase
      .from('guides')
      .select('opening_change_balance, opening_expenses_balance')
      .eq('id', id)
      .single();
    setOpeningChange(guideRow?.opening_change_balance || 0);
    setOpeningExpenses(guideRow?.opening_expenses_balance || 0);

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
    let transferred = 0;
    let cashRefill = 0;
    let expensesRefill = 0;
    let salaryWithdrawn = 0;
    let adminTopupChange = 0;
    let adminTopupExpenses = 0;
    const expensesMov: Movement[] = [];

    (transfers || []).forEach(
      (t: { amount: number; transfer_type: string; transfer_date: string; notes: string | null; is_pending_deposit?: boolean | null }) => {
        const amt = t.amount || 0;
        if (t.transfer_type === 'cash_refill') {
          cashRefill += amt;
          mainMov.push({ date: t.transfer_date, description: 'חיזוק למעטפת עודף', amount: -amt });
          changeMov.push({ date: t.transfer_date, description: 'חיזוק מהקופה הראשית', amount: amt });
        } else if (t.transfer_type === 'expenses_refill') {
          expensesRefill += amt;
          mainMov.push({ date: t.transfer_date, description: 'חיזוק למעטפת הוצאות', amount: -amt });
          expensesMov.push({ date: t.transfer_date, description: 'חיזוק מהקופה הראשית', amount: amt });
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

    // Expenses (כולל תאריך ופריט לטיימליין)
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount, expense_date, item')
      .eq('guide_id', id)
      .gte('expense_date', start)
      .lte('expense_date', end)
      .order('expense_date', { ascending: true });
    const expensesTotal = (expenses || []).reduce(
      (s: number, e: { amount: number }) => s + (e.amount || 0),
      0,
    );

    (expenses || []).forEach(
      (e: { amount: number; expense_date: string; item: string }) => {
        if (e.amount > 0) {
          expensesMov.push({
            date: e.expense_date,
            description: e.item || 'הוצאה',
            amount: -(e.amount || 0),
          });
        }
      },
    );

    // יתרת פתיחה — מוסיפים בראש הטיימליין של מעטפות (רק אם יש)
    if ((guideRow?.opening_change_balance || 0) > 0) {
      changeMov.unshift({
        date: start,
        description: 'יתרת פתיחה',
        amount: guideRow!.opening_change_balance,
      });
    }
    if ((guideRow?.opening_expenses_balance || 0) > 0) {
      expensesMov.unshift({
        date: start,
        description: 'יתרת פתיחה',
        amount: guideRow!.opening_expenses_balance,
      });
    }

    // מיון לפי תאריך עולה
    mainMov.sort((a, b) => a.date.localeCompare(b.date));
    changeMov.sort((a, b) => a.date.localeCompare(b.date));
    expensesMov.sort((a, b) => a.date.localeCompare(b.date));

    setMainMovements(mainMov);
    setChangeMovements(changeMov);
    setExpensesMovements(expensesMov);

    setTotals({
      collected,
      changeGiven,
      transferred,
      cashRefill,
      expenses: expensesTotal,
      expensesRefill,
      salaryWithdrawn,
      adminTopupChange,
      adminTopupExpenses,
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
  const changeBalance = openingChange + totals.cashRefill + totals.adminTopupChange - totals.changeGiven;
  const expensesBalance = openingExpenses + totals.expensesRefill + totals.adminTopupExpenses - totals.expenses;
  // קופה רביעית: סך הכל ממתין להפקדה (חוצה חודשים — לא תלוי בחודש הנבחר)
  const pendingTotal = pendingDeposits.reduce((s, p) => s + (p.amount || 0), 0);
  const needsChangeRefill = totals.changeGiven > 0 && changeBalance < 51;

  const refillAmt = parseFloat(refillAmount) || 0;
  const refillTargetLabel = refillModal === 'change' ? 'מעטפת העודף' : 'מעטפת ההוצאות';
  const currentEnvelope = refillModal === 'change' ? changeBalance : expensesBalance;

  async function handleRefill() {
    if (!guideId || !refillModal) return;
    setRefillError('');
    const amt = parseFloat(refillAmount);
    if (!amt || amt <= 0) {
      setRefillError('נשאר להזין סכום');
      return;
    }
    if (amt > mainBalance) {
      setRefillError('אין מספיק בקופה הראשית לחיזוק הזה');
      return;
    }
    setRefillSaving(true);
    const { error } = await supabase.from('transfers').insert({
      guide_id: guideId,
      transfer_date: todayISO(),
      amount: amt,
      transfer_type: refillModal === 'change' ? 'cash_refill' : 'expenses_refill',
      notes: `חיזוק מהקופה הראשית ל${refillTargetLabel}`,
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

    // עדכון הרשומות: דגל פנדינג=false, תאריך, אסמכתא, is_deposit
    const { error } = await supabase
      .from('transfers')
      .update({
        is_pending_deposit: false,
        transfer_date: today,
        is_deposit: !settleNotADeposit,
        receipt_url: receiptUrl,
      })
      .in('id', targetIds);

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
                  סמני &quot;ביצעתי הפקדה&quot; ותצרפ.י אסמכתא.
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
                  <span className="text-gray-600">נאסף בקלאסי:</span>
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
              {showMainTimeline && <Timeline movements={mainMovements} />}

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
                {openingChange > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">יתרת פתיחה:</span>
                    <span className="font-semibold">+{openingChange.toFixed(2)}€</span>
                  </div>
                )}
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
              {showChangeTimeline && <Timeline movements={changeMovements} />}

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

            {/* Expenses envelope */}
            <div className="bg-white rounded-xl shadow p-5">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold">מעטפת הוצאות</h3>
                <span className="text-2xl font-bold text-amber-700">
                  {expensesBalance.toFixed(2)}€
                </span>
              </div>
              <div className="space-y-1 text-sm">
                {openingExpenses > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">יתרת פתיחה:</span>
                    <span className="font-semibold">+{openingExpenses.toFixed(2)}€</span>
                  </div>
                )}
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
              </div>

              {/* Timeline toggle */}
              <button
                onClick={() => setShowExpensesTimeline(!showExpensesTimeline)}
                className="w-full mt-3 text-sm text-amber-800 hover:text-amber-900 font-medium flex items-center justify-center gap-1"
              >
                {showExpensesTimeline ? '▲ הסתר.י פירוט תנועות' : '▼ פירוט תנועות לפי תאריך'}
              </button>
              {showExpensesTimeline && <Timeline movements={expensesMovements} />}

              <div className="flex gap-2 mt-3">
                <Link
                  href={`/expenses?year=${year}&month=${month + 1}`}
                  className="flex-1 text-center bg-amber-600 hover:bg-amber-700 active:scale-98 transition-all text-white rounded-lg py-2 font-semibold"
                >
                  הוסף הוצאה
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
            </div>

            <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-xl p-4 text-sm">
              💡 חיזוק = העברת כסף מהקופה הראשית למעטפת עודף או הוצאות, כשהן מתרוקנות.
            </div>
          </>
        )}
      </main>

      {/* Refill modal */}
      {refillModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 animate-[fadeIn_200ms_ease-out]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-[slideUp_300ms_ease-out]">
            <h3 className="text-lg font-bold text-gray-900 mb-1">
              חיזוק {refillTargetLabel}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              כמה להעביר מהקופה הראשית ל{refillTargetLabel}?
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">יש כרגע בראשית:</span>
                <span className="font-semibold text-green-800">{mainBalance.toFixed(2)}€</span>
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

            {refillAmt > 0 && refillAmt <= mainBalance && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3 text-sm space-y-1">
                <div className="font-semibold text-blue-900 mb-1">אחרי החיזוק:</div>
                <div className="flex justify-between">
                  <span className="text-gray-700">ראשית:</span>
                  <span className="font-semibold">
                    {mainBalance.toFixed(2)}€ →{' '}
                    <span className="text-green-800">{(mainBalance - refillAmt).toFixed(2)}€</span>
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
                {refillSaving ? 'מעביר...' : 'בצע חיזוק'}
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
