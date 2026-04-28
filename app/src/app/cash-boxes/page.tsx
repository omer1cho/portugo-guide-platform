'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuthGuard } from '@/lib/auth';

type Totals = {
  collected: number;        // all cash collected (any tour category)
  changeGiven: number;      // sum of change given to customers
  transferred: number;      // money sent to Portugo
  cashRefill: number;       // guide self-reinforcing: main → change envelope
  expenses: number;         // expenses from expenses envelope
  expensesRefill: number;   // guide self-reinforcing: main → expenses envelope
  salaryWithdrawn: number;  // salary withdrawn from main box at month-close
};

type RefillKind = 'change' | 'expenses';

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
  const [totals, setTotals] = useState<Totals>({
    collected: 0,
    changeGiven: 0,
    transferred: 0,
    cashRefill: 0,
    expenses: 0,
    expensesRefill: 0,
    salaryWithdrawn: 0,
  });
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

    // Tours + bookings (for classic collected + change_given)
    const { data: tours } = await supabase
      .from('tours')
      .select('id, category, bookings(price, change_given)')
      .eq('guide_id', id)
      .gte('tour_date', start)
      .lte('tour_date', end);

    let collected = 0;
    let changeGiven = 0;
    (tours || []).forEach((t) => {
      const bks = (t.bookings as { price: number; change_given: number }[]) || [];
      bks.forEach((b) => {
        // All cash paid by tourists (any tour category) goes into the main box
        collected += b.price || 0;
        changeGiven += b.change_given || 0;
      });
    });

    // Transfers — split by type
    const { data: transfers } = await supabase
      .from('transfers')
      .select('amount, transfer_type')
      .eq('guide_id', id)
      .gte('transfer_date', start)
      .lte('transfer_date', end);
    let transferred = 0;
    let cashRefill = 0;
    let expensesRefill = 0;
    let salaryWithdrawn = 0;
    (transfers || []).forEach((t: { amount: number; transfer_type: string }) => {
      const amt = t.amount || 0;
      if (t.transfer_type === 'cash_refill') cashRefill += amt;
      else if (t.transfer_type === 'expenses_refill') expensesRefill += amt;
      else if (t.transfer_type === 'salary_withdrawal') salaryWithdrawn += amt;
      else transferred += amt; // to_portugo (default)
    });

    // Expenses
    const { data: expenses } = await supabase
      .from('expenses')
      .select('amount')
      .eq('guide_id', id)
      .gte('expense_date', start)
      .lte('expense_date', end);
    const expensesTotal = (expenses || []).reduce(
      (s: number, e: { amount: number }) => s + (e.amount || 0),
      0
    );

    setTotals({
      collected,
      changeGiven,
      transferred,
      cashRefill,
      expenses: expensesTotal,
      expensesRefill,
      salaryWithdrawn,
    });
    setLoading(false);
  }

  // Formulas — self-reinforcement is INTERNAL (main box decreases when reinforcing)
  // Main = all cash collected + change_given - transferred to Portugo - refills to envelopes - salary withdrawn at month-close
  // Change envelope = refills - change given
  // Expenses envelope = refills - expenses
  const mainBalance =
    totals.collected +
    totals.changeGiven -
    totals.transferred -
    totals.cashRefill -
    totals.expensesRefill -
    totals.salaryWithdrawn;
  const changeBalance = totals.cashRefill - totals.changeGiven;
  const expensesBalance = totals.expensesRefill - totals.expenses;
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

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <header className="bg-green-800 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <button
            onClick={() => router.back()}
            className="text-sm bg-green-900 hover:bg-green-950 active:scale-95 transition-transform px-3 py-2 rounded-md"
          >
            ← חזרה
          </button>
          <h1 className="text-lg font-bold">הקופות שלי</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        <div className="text-center text-sm text-gray-500">📅 {formatMonthLabel(year, month)}</div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">רגע, מחשב יתרות...</div>
        ) : (
          <>
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
                <div className="flex justify-between">
                  <span className="text-gray-600">חיזוק מהקופה הראשית:</span>
                  <span className="font-semibold">+{totals.cashRefill.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">עודף שנתתי ללקוחות:</span>
                  <span className="font-semibold text-red-700">
                    -{totals.changeGiven.toFixed(2)}€
                  </span>
                </div>
              </div>
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
                <div className="flex justify-between">
                  <span className="text-gray-600">חיזוק מהקופה הראשית:</span>
                  <span className="font-semibold">+{totals.expensesRefill.toFixed(2)}€</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">הוצאות החודש:</span>
                  <span className="font-semibold text-red-700">
                    -{totals.expenses.toFixed(2)}€
                  </span>
                </div>
              </div>
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
