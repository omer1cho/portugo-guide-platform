'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase, type Guide, SYSTEM_START_DATE } from '@/lib/supabase';
import { calculateMonthlySalary, type SalaryBreakdown, type SalaryTour, type SalaryActivity } from '@/lib/salary';
import { useAuthGuard } from '@/lib/auth';

function formatMonthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
}

type CashState = {
  mainBalance: number;
  changeBalance: number;
  expensesBalance: number;
  salaryWithdrawn: number;
};

function CloseMonthContent() {
  useAuthGuard();
  const router = useRouter();
  const searchParams = useSearchParams();
  const now = new Date();
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : now.getFullYear();
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) - 1 : now.getMonth();

  const [loading, setLoading] = useState(true);
  const [guide, setGuide] = useState<Pick<Guide, 'id' | 'name' | 'travel_type' | 'has_mgmt_bonus' | 'mgmt_bonus_amount' | 'has_vat' | 'classic_transfer_per_person' | 'target_change_balance' | 'target_expenses_balance'> | null>(null);
  const [salary, setSalary] = useState<SalaryBreakdown | null>(null);
  const [externalActivities, setExternalActivities] = useState<{ description: string; amount: number }[]>([]);
  const [cash, setCash] = useState<CashState>({ mainBalance: 0, changeBalance: 0, expensesBalance: 0, salaryWithdrawn: 0 });
  const [confirming, setConfirming] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmError, setConfirmError] = useState('');
  // מודאל "העבר למעטפת המתנה"
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingSaving, setPendingSaving] = useState(false);
  const [pendingError, setPendingError] = useState('');

  const loadData = React.useCallback(async () => {
    const id = localStorage.getItem('portugo_guide_id');
    if (!id) {
      router.push('/');
      return;
    }

    setLoading(true);
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const [guideRes, toursRes, actRes, expRes, trRes, cumTrRes, cumChangeGivenRes, cumExpRes] = await Promise.all([
      supabase.from('guides').select('id, name, travel_type, has_mgmt_bonus, mgmt_bonus_amount, has_vat, classic_transfer_per_person, opening_change_balance, opening_expenses_balance, target_change_balance, target_expenses_balance').eq('id', id).single(),
      supabase.from('tours').select('id, tour_date, tour_type, category, notes, bookings(people, kids, price, tip, change_given)')
        .eq('guide_id', id).gte('tour_date', start).lte('tour_date', end),
      supabase.from('activities').select('amount, activity_type, activity_date, notes')
        .eq('guide_id', id).gte('activity_date', start).lte('activity_date', end),
      supabase.from('expenses').select('amount')
        .eq('guide_id', id).gte('expense_date', start).lte('expense_date', end),
      supabase.from('transfers').select('amount, transfer_type')
        .eq('guide_id', id).gte('transfer_date', start).lte('transfer_date', end),
      // יתרות מעטפות מצטברות — מ-SYSTEM_START_DATE עד סוף החודש הנבחר
      // (נתונים מלפני התאריך הם ארכיון, יתרת הפתיחה כבר מייצגת אותם)
      supabase.from('transfers').select('amount, transfer_type')
        .eq('guide_id', id).gte('transfer_date', SYSTEM_START_DATE).lte('transfer_date', end),
      supabase.from('tours').select('bookings(change_given)')
        .eq('guide_id', id).gte('tour_date', SYSTEM_START_DATE).lte('tour_date', end),
      supabase.from('expenses').select('amount')
        .eq('guide_id', id).gte('expense_date', SYSTEM_START_DATE).lte('expense_date', end),
    ]);

    const g = (guideRes.data as Pick<Guide, 'id' | 'name' | 'travel_type' | 'has_mgmt_bonus' | 'mgmt_bonus_amount' | 'has_vat' | 'classic_transfer_per_person' | 'opening_change_balance' | 'opening_expenses_balance' | 'target_change_balance' | 'target_expenses_balance'>) || null;
    setGuide(g);
    const openingChange = g?.opening_change_balance || 0;
    const openingExpenses = g?.opening_expenses_balance || 0;

    type RawTour = {
      tour_date: string;
      tour_type: string;
      category: 'classic' | 'fixed' | 'private' | 'other';
      notes: string | null;
      bookings: { people: number; kids: number; price: number; tip: number; change_given: number }[] | null;
    };

    const salaryTours: SalaryTour[] = [];
    let changeGiven = 0;
    (toursRes.data as RawTour[] || []).forEach((t) => {
      const bks = t.bookings || [];
      bks.forEach((b) => {
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

    const salaryActivities: SalaryActivity[] = (actRes.data || []).map((a: { activity_type: string; activity_date: string; amount: number; notes: string }) => ({
      activity_date: a.activity_date,
      activity_type: a.activity_type,
      amount: a.amount || 0,
      notes: a.notes || '',
    }));

    const extRows = salaryActivities
      .filter((a) => a.activity_type === 'external')
      .map((a) => ({ description: a.notes || 'ללא תיאור', amount: a.amount }));
    setExternalActivities(extRows);

    const s = calculateMonthlySalary(g, salaryTours, salaryActivities);
    setSalary(s);

    const expensesTotal = (expRes.data || []).reduce((acc, e: { amount: number }) => acc + (e.amount || 0), 0);
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

    // יתרות מצטברות (עד סוף החודש הנבחר) — כסף פיזי שעובר מחודש לחודש
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
      (s2: number, e: { amount: number }) => s2 + (e.amount || 0),
      0,
    );

    setCash({
      mainBalance: s.total_cash_collected + changeGiven - transfersTotal - cashRefill - expensesRefill - salaryWithdrawn,
      // יתרת מעטפות מצטברת
      changeBalance: openingChange + cumChangeRefill + cumAdminTopupChange - cumChangeGiven,
      expensesBalance: openingExpenses + cumExpensesRefill + cumAdminTopupExpenses - cumExpenses,
      salaryWithdrawn,
    });
    setLoading(false);
  }, [router, year, month]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ─────────── Month-closing reconciliation ───────────
  // Priority order out of the main box:
  //   1. Salary (full amount, up to what the box holds)
  //   2. Refill EXPENSES envelope to target (per-guide, default 150€) — higher priority
  //   3. Refill CHANGE envelope to target (per-guide, default 100€)
  //   4. Deposit the remainder to Portugo, rounded DOWN to a multiple of 5€
  //      (any leftover "coins" <5€ are pushed into the expenses envelope
  //      so the guide can deposit a clean whole-bill amount)
  //   5. If the box didn't cover the full salary — Portugo transfers the rest separately.
  // יעדים פר-מדריך (עמודות בטבלת guides). אם 0 → לא מחזקים את המעטפת בכלל.
  const EXPENSES_TARGET = guide?.target_expenses_balance ?? 150;
  const CHANGE_TARGET = guide?.target_change_balance ?? 100;
  const DEPOSIT_STEP = 5;
  const skipAllRefills = EXPENSES_TARGET === 0 && CHANGE_TARGET === 0;

  // משיכת משכורת בקופה הראשית:
  //  - למדריכים עם מע"מ נכללת גם תוספת המע"מ (Portugo משלמת receipt_with_vat).
  //  - הסכום מעוגל מעלה ליורו שלם — תמיד לטובת המדריך, אין צורך בעודף עשרוני.
  // cash_to_withdraw מחושב פעם אחת ב-salary.ts ומשמש בכל מקומות התצוגה.
  const baseSalary = salary?.transfer_amount || 0;
  const vatAmount = salary?.vat_amount || 0;
  const totalSalary = salary?.cash_to_withdraw || 0;
  const totalSalaryRaw = baseSalary + vatAmount;
  const hasVatComponent = vatAmount > 0.01;
  const wasRoundedUp = totalSalary > totalSalaryRaw + 0.005;
  const salaryRemaining = Math.max(0, totalSalary - cash.salaryWithdrawn);
  const mainBox = cash.mainBalance;

  const takeFromBox = Math.max(0, Math.min(mainBox, salaryRemaining));
  const fromPortugo = Math.max(0, salaryRemaining - mainBox);
  let remaining = Math.max(0, mainBox - takeFromBox);

  // Envelope refills — expenses first
  const expensesNeed = Math.max(0, EXPENSES_TARGET - cash.expensesBalance);
  let expensesRefill = Math.min(expensesNeed, remaining);
  remaining -= expensesRefill;

  const changeNeed = Math.max(0, CHANGE_TARGET - cash.changeBalance);
  const changeRefill = Math.min(changeNeed, remaining);
  remaining -= changeRefill;

  // עיגול הפקדה למכפלת DEPOSIT_STEP; "הרזרבה" שמתחת ל-5€ נדחפת למעטפת ההוצאות
  // כדי שהמדריך יפקיד שטרות שלמים. אם המדריך פטור מחיזוק מעטפות (skipAllRefills),
  // לא דוחפים שום דבר למעטפה — מפקידים את כל הסכום כמו שהוא.
  const depositRounded = skipAllRefills
    ? remaining
    : Math.floor(remaining / DEPOSIT_STEP) * DEPOSIT_STEP;
  const coinExtra = remaining - depositRounded;
  if (!skipAllRefills) {
    expensesRefill += coinExtra;
  }
  const depositToPortugo = depositRounded;

  const needsDeposit = depositToPortugo > 0.01;
  const needsExpensesRefill = expensesRefill > 0.01;
  const needsChangeRefill = changeRefill > 0.01;
  const needsFromPortugo = fromPortugo > 0.01;
  const needsSalaryWithdraw = takeFromBox > 0.01;
  const alreadyConfirmed = cash.salaryWithdrawn > 0.01;
  // The confirm button triggers immediate actions only: salary withdrawal + envelope refills.
  // The bank deposit to Portugo is a separate action because it can take a few days.
  const hasImmediateActions = needsSalaryWithdraw || needsExpensesRefill || needsChangeRefill;

  async function handleConfirmActions() {
    const id = localStorage.getItem('portugo_guide_id');
    if (!id) return;
    if (!hasImmediateActions) return;

    setConfirming(true);
    setConfirmError('');
    const today = new Date().toISOString().slice(0, 10);
    const monthLabel = formatMonthLabel(year, month);
    const rows: { guide_id: string; transfer_date: string; amount: number; transfer_type: string; notes: string }[] = [];

    if (needsSalaryWithdraw) {
      rows.push({
        guide_id: id,
        transfer_date: today,
        amount: Number(takeFromBox.toFixed(2)),
        transfer_type: 'salary_withdrawal',
        notes: `משכורת — סגירת ${monthLabel}`,
      });
    }
    if (needsExpensesRefill) {
      rows.push({
        guide_id: id,
        transfer_date: today,
        amount: Number(expensesRefill.toFixed(2)),
        transfer_type: 'expenses_refill',
        notes: `חיזוק מעטפת הוצאות — סגירת ${monthLabel}`,
      });
    }
    if (needsChangeRefill) {
      rows.push({
        guide_id: id,
        transfer_date: today,
        amount: Number(changeRefill.toFixed(2)),
        transfer_type: 'cash_refill',
        notes: `חיזוק מעטפת עודף — סגירת ${monthLabel}`,
      });
    }

    const { error } = await supabase.from('transfers').insert(rows);
    setConfirming(false);
    if (error) {
      setConfirmError('משהו השתבש: ' + error.message);
      return;
    }
    setShowConfirmModal(false);
    await loadData();
  }

  // העברה למעטפת המתנה: יוצרים transfer רגיל מסוג to_portugo עם דגל is_pending_deposit=true
  // הסכום יוצא מיד מהקופה הראשית; כשהמדריך יפקיד פיזית, הוא ייכנס למעטפה ויסמן "ביצעתי הפקדה".
  async function handleMoveToPending() {
    const id = localStorage.getItem('portugo_guide_id');
    if (!id) return;
    setPendingSaving(true);
    setPendingError('');
    const today = new Date().toISOString().slice(0, 10);
    const monthLabel = formatMonthLabel(year, month);
    const { error } = await supabase.from('transfers').insert({
      guide_id: id,
      transfer_date: today,
      amount: Number(depositToPortugo.toFixed(2)),
      transfer_type: 'to_portugo',
      is_pending_deposit: true,
      notes: `ממתין להפקדה — סגירת ${monthLabel}`,
    });
    setPendingSaving(false);
    if (error) {
      setPendingError('משהו השתבש: ' + error.message);
      return;
    }
    setShowPendingModal(false);
    await loadData();
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
          <h1 className="text-lg font-bold">סגירת חודש</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {loading || !salary ? (
          <div className="text-center py-12 text-gray-500">מחשבת את הסיכום...</div>
        ) : salary.total_with_tips === 0 && mainBox === 0 ? (
          <div className="bg-white rounded-xl shadow p-6 text-center text-gray-500">
            אין נתונים לחודש {formatMonthLabel(year, month)}.
          </div>
        ) : (
          <>
            {/* Month + guide */}
            <div className="bg-white rounded-xl shadow p-4 text-center">
              <div className="text-xs text-gray-500">📅 {formatMonthLabel(year, month)}</div>
              <div className="text-lg font-bold">{guide?.name}</div>
            </div>

            {/* Salary summary */}
            <section className="bg-white rounded-2xl shadow p-4">
              <h2 className="font-bold mb-3">סיכום השכר</h2>
              <div className="space-y-1 text-sm">
                {salary.classic_income !== 0 && (
                  <div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">שכר מקלאסי:</span>
                      <span className="font-semibold">{salary.classic_income.toFixed(2)}€</span>
                    </div>
                    <div className="text-xs text-gray-500 pr-3 mt-0.5">
                      בסיס {salary.classic_base.toFixed(2)}€ + טיפים {(salary.classic_income - salary.classic_base).toFixed(2)}€
                    </div>
                  </div>
                )}
                {salary.fixed_salaries > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">שכר סיורים קבועים:</span>
                    <span className="font-semibold">{salary.fixed_salaries.toFixed(2)}€</span>
                  </div>
                )}
                {salary.private_salaries > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">שכר סיורים פרטיים:</span>
                    <span className="font-semibold">{salary.private_salaries.toFixed(2)}€</span>
                  </div>
                )}
                {salary.non_classic_tips > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">טיפים (לא קלאסי):</span>
                    <span className="font-semibold">{salary.non_classic_tips.toFixed(2)}€</span>
                  </div>
                )}
                {salary.eshel > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">אשל יומי ({salary.eshel_days} ימים):</span>
                    <span className="font-semibold">{salary.eshel.toFixed(2)}€</span>
                  </div>
                )}
                {salary.habraza > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">הברזה בכיכר:</span>
                    <span className="font-semibold">{salary.habraza.toFixed(2)}€</span>
                  </div>
                )}
                {salary.training > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">פעילות הכשרה:</span>
                    <span className="font-semibold">{salary.training.toFixed(2)}€</span>
                  </div>
                )}
                {salary.training_lead > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">הכשרות שהעברתי:</span>
                    <span className="font-semibold">{salary.training_lead.toFixed(2)}€</span>
                  </div>
                )}
                {externalActivities.map((ext, i) => (
                  <div key={`ext-${i}`} className="flex justify-between">
                    <span className="text-gray-600">{ext.description || 'פעילות מיוחדת'}:</span>
                    <span className="font-semibold">{ext.amount.toFixed(2)}€</span>
                  </div>
                ))}
                {salary.travel > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">
                      {guide?.travel_type === 'monthly' ? 'חופשי חודשי:' : 'החזר נסיעות:'}
                    </span>
                    <span className="font-semibold">{salary.travel.toFixed(2)}€</span>
                  </div>
                )}
                {salary.management > 0 && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">רכיב ניהול:</span>
                    <span className="font-semibold">{salary.management.toFixed(2)}€</span>
                  </div>
                )}
              </div>
              <div className="mt-3 pt-3 border-t border-green-200 bg-green-50 -mx-2 px-3 py-2 rounded-lg space-y-1">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-green-900">סיכום שכר מלא</span>
                  <span className="font-bold text-green-900 text-lg">{salary.total_with_tips.toFixed(2)}€</span>
                </div>
                <div className="text-[11px] text-green-800 leading-tight pr-1">
                  כולל טיפים מסיורים רגילים
                </div>
                {(salary.non_classic_tips > 0 || hasVatComponent) && (
                  <>
                    <div className="flex justify-between items-center pt-2 mt-1 border-t border-green-300">
                      <span className="font-semibold text-green-900 text-sm">סה&quot;כ למשוך מהקופה</span>
                      <span className="font-bold text-green-900">{salary.cash_to_withdraw}€</span>
                    </div>
                    <div className="text-[11px] text-green-800 leading-tight pr-1">
                      {salary.non_classic_tips > 0 && hasVatComponent
                        ? 'משכורת + מע"מ, ללא הטיפים מהסיורים הרגילים'
                        : hasVatComponent
                          ? 'משכורת + מע"מ'
                          : 'ללא הטיפים מהסיורים הרגילים'}
                    </div>
                  </>
                )}
              </div>

              {/* Receipt */}
              {salary.receipt_amount > 0 && (
                <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-blue-900 font-semibold">סכום לקבלה</span>
                    <span className="font-bold text-blue-900">{salary.receipt_amount.toFixed(2)}€</span>
                  </div>
                  {salary.vat_amount > 0 && (
                    <>
                      <div className="flex justify-between text-xs text-blue-800">
                        <span>מע"מ (23%):</span>
                        <span className="font-semibold">{salary.vat_amount.toFixed(2)}€</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-blue-200">
                        <span className="text-blue-900 font-semibold">קבלה כולל מע"מ</span>
                        <span className="font-bold text-blue-900">{salary.receipt_with_vat.toFixed(2)}€</span>
                      </div>
                    </>
                  )}
                </div>
              )}
            </section>

            {/* Closing instructions — next steps */}
            <section className="bg-white rounded-2xl shadow p-4 border-2 border-amber-300">
              <div className="flex items-start gap-2 mb-3">
                <span className="text-2xl">🎯</span>
                <div>
                  <h2 className="font-bold text-amber-900">הנחיות סגירת חודש</h2>
                  <p className="text-xs text-amber-800">ככה תקבל.י את השכר ותסגר.י את החודש</p>
                </div>
              </div>

              <div className="flex justify-between py-2 text-sm border-b border-amber-100">
                <span className="text-gray-600">יש בקופה הראשית:</span>
                <span className="font-bold text-gray-900">{mainBox.toFixed(2)}€</span>
              </div>

              {/* Step-by-step */}
              {!alreadyConfirmed && (
                <div className="mt-3 bg-amber-50 rounded-lg p-3 space-y-2 text-sm">
                  {mainBox < 0.01 && !needsFromPortugo ? (
                    <div className="text-amber-900">אין פעולות לביצוע החודש.</div>
                  ) : (
                    (() => {
                      const steps: React.ReactNode[] = [];

                      if (needsSalaryWithdraw) {
                        const takeIsWhole = Math.abs(takeFromBox - Math.round(takeFromBox)) < 0.005;
                        const takeDisplay = takeIsWhole ? Math.round(takeFromBox).toString() : takeFromBox.toFixed(2);
                        steps.push(
                          <span>
                            קח.י לעצמך{' '}
                            <span className="font-bold">{takeDisplay}€</span>{' '}
                            {hasVatComponent ? 'מהקופה הראשית — משכורת + מע"מ' : 'משכורת מהקופה הראשית'}.
                            {(hasVatComponent || wasRoundedUp) && (
                              <span className="block text-[11px] text-amber-700 font-normal mt-0.5">
                                {hasVatComponent && (
                                  <>({baseSalary.toFixed(2)}€ משכורת + {vatAmount.toFixed(2)}€ מע&quot;מ</>
                                )}
                                {!hasVatComponent && wasRoundedUp && (
                                  <>(שכר בפועל {totalSalaryRaw.toFixed(2)}€</>
                                )}
                                {wasRoundedUp && <>, מעוגל ל-{totalSalary}€</>}
                                {takeFromBox < totalSalary - 0.01 && (
                                  <>, סה&quot;כ {totalSalary}€ — היתרה תשלים פורטוגו</>
                                )}
                                )
                              </span>
                            )}
                          </span>
                        );
                      }

                      if (needsExpensesRefill) {
                        steps.push(
                          <span>
                            חזק.י את מעטפת ההוצאות ב-
                            <span className="font-bold">{expensesRefill.toFixed(2)}€</span>{' '}
                            (ל-{EXPENSES_TARGET}€
                            {coinExtra > 0.01 && (
                              <> + {coinExtra.toFixed(2)}€ עודף כדי שההפקדה תצא עגולה</>
                            )}
                            ).
                          </span>
                        );
                      }

                      if (needsChangeRefill) {
                        steps.push(
                          <span>
                            חזק.י את מעטפת העודף ב-
                            <span className="font-bold">{changeRefill.toFixed(2)}€</span>{' '}
                            (ל-{CHANGE_TARGET}€).
                          </span>
                        );
                      }

                      if (needsDeposit) {
                        steps.push(
                          <span>
                            הפקיד.י לפורטוגו{' '}
                            <span className="font-bold">{depositToPortugo.toFixed(0)}€</span>{' '}
                            <span className="text-xs text-amber-700 font-semibold">— נא הפקיד.י בהקדם</span>
                          </span>
                        );
                      }

                      if (needsFromPortugo) {
                        steps.push(
                          <span>
                            פורטוגו תשלים לך עוד{' '}
                            <span className="font-bold">{fromPortugo.toFixed(2)}€</span>{' '}
                            בהעברה נפרדת 💚
                          </span>
                        );
                      }

                      return steps.map((s, i) => (
                        <div key={i} className="flex gap-2 text-amber-900">
                          <span className="font-bold">{i + 1}.</span>
                          <div>{s}</div>
                        </div>
                      ));
                    })()
                  )}
                </div>
              )}

              {/* Confirm-done button — records immediate actions (salary + refills) in one click */}
              {!alreadyConfirmed && hasImmediateActions && (
                <button
                  onClick={() => {
                    setConfirmError('');
                    setShowConfirmModal(true);
                  }}
                  className="mt-3 block w-full bg-amber-600 hover:bg-amber-700 active:scale-98 transition-all text-white rounded-xl py-3 font-bold text-center"
                >
                  ✓ ביצעתי את הפעולות האלו
                </button>
              )}

              {/* After confirm: show what's left to do (deposit or celebration) */}
              {alreadyConfirmed && (
                <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                  <div className="text-green-900">✓ משיכת משכורת וחיזוקי מעטפות נרשמו.</div>
                  {needsDeposit ? (
                    <div className="text-green-900 mt-1">
                      נשאר להפקיד לפורטוגו{' '}
                      <span className="font-bold">{depositToPortugo.toFixed(0)}€</span>{' '}
                      — נא להפקיד בהקדם.
                    </div>
                  ) : needsFromPortugo ? (
                    <div className="text-green-900 mt-1">
                      פורטוגו תעביר לך את היתרה ({fromPortugo.toFixed(2)}€) 💚
                    </div>
                  ) : (
                    <div className="text-green-900 font-bold mt-1 text-center text-base">
                      🎉 סגרת את החודש. כל הכבוד!
                    </div>
                  )}
                </div>
              )}

              {/* תזכורת הוצאת קבלה — אחרי סגירת חודש, רק אם יש סכום לקבלה */}
              {alreadyConfirmed && (salary?.receipt_amount || 0) > 0 && (
                <div className="mt-3 bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm">
                  <div className="flex items-start gap-2">
                    <span className="text-lg">🧾</span>
                    <div className="text-amber-900">
                      <div className="font-bold">אל תשכח.י להוציא קבלה החודש!</div>
                      <div className="mt-0.5">
                        סכום הקבלה: <span className="font-bold">{(salary?.receipt_amount || 0).toFixed(2)}€</span>.
                        אם תשכח.י — נזכיר שוב בתחילת החודש הבא.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Deposit buttons — שתי אפשרויות: הפקדה מיידית או העברה למעטפת המתנה */}
              {needsDeposit && (
                <div className="mt-3 space-y-2">
                  <Link
                    href={`/transfers?year=${year}&month=${month + 1}&prefill=${depositToPortugo.toFixed(0)}&note=${encodeURIComponent(`יתרת קופה — סגירת ${formatMonthLabel(year, month)}`)}`}
                    className="block w-full bg-green-700 hover:bg-green-800 active:scale-98 transition-all text-white rounded-xl py-3 font-bold text-center"
                  >
                    הפקדתי עכשיו — דווחי על העברה ({depositToPortugo.toFixed(0)}€) ←
                  </Link>
                  <button
                    onClick={() => setShowPendingModal(true)}
                    className="block w-full bg-amber-500 hover:bg-amber-600 active:scale-98 transition-all text-white rounded-xl py-3 font-bold text-center"
                  >
                    העבר.י למעטפת המתנה ({depositToPortugo.toFixed(0)}€)
                  </button>
                  <p className="text-[11px] text-gray-500 text-center leading-tight">
                    💡 לא הפקדת עדיין? &quot;מעטפת המתנה&quot; שומרת לך את הסכום עד שתפקיד.י בפועל.
                  </p>
                </div>
              )}
            </section>

            {/* Envelopes — informational */}
            <section className="bg-white rounded-xl shadow p-4">
              <h3 className="font-semibold mb-2 text-sm">מצב המעטפות</h3>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-blue-800">{cash.changeBalance.toFixed(0)}€</div>
                  <div className="text-xs text-gray-600 mt-0.5">מעטפת עודף</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-amber-700">{cash.expensesBalance.toFixed(0)}€</div>
                  <div className="text-xs text-gray-600 mt-0.5">מעטפת הוצאות</div>
                </div>
              </div>
              <p className="text-[11px] text-gray-500 mt-2 leading-tight">
                המעטפות נשארות אצלך לחודש הבא.
              </p>
            </section>
          </>
        )}
      </main>

      {/* Confirm actions modal — replaces native window.confirm */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 animate-[fadeIn_200ms_ease-out]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-[slideUp_300ms_ease-out]">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              לאשר שביצעת את הפעולות?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              אחרי האישור זה יירשם במערכת:
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm space-y-2">
              {needsSalaryWithdraw && (
                <div className="flex justify-between">
                  <span className="text-gray-700">משיכת משכורת מהקופה:</span>
                  <span className="font-bold text-amber-900">{takeFromBox.toFixed(2)}€</span>
                </div>
              )}
              {needsExpensesRefill && (
                <div className="flex justify-between">
                  <span className="text-gray-700">חיזוק מעטפת הוצאות:</span>
                  <span className="font-bold text-amber-900">{expensesRefill.toFixed(2)}€</span>
                </div>
              )}
              {needsChangeRefill && (
                <div className="flex justify-between">
                  <span className="text-gray-700">חיזוק מעטפת עודף:</span>
                  <span className="font-bold text-amber-900">{changeRefill.toFixed(2)}€</span>
                </div>
              )}
            </div>

            {confirmError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-3">
                {confirmError}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={handleConfirmActions}
                disabled={confirming}
                className="w-full bg-amber-600 hover:bg-amber-700 active:scale-98 disabled:bg-gray-400 transition-all text-white rounded-xl py-3 font-bold"
              >
                {confirming ? 'שומר...' : 'כן, לאשר'}
              </button>
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setConfirmError('');
                }}
                disabled={confirming}
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

      {/* Pending-deposit modal — אישור העברה למעטפת המתנה */}
      {showPendingModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 animate-[fadeIn_200ms_ease-out]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-[slideUp_300ms_ease-out]">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              העברה למעטפת המתנה
            </h3>
            <p className="text-sm text-gray-600 mb-4 leading-relaxed">
              הסכום הזה <span className="font-bold">{depositToPortugo.toFixed(0)}€</span> יצא
              עכשיו מהקופה הראשית ויעבור למעטפת ההמתנה.
              <br />
              כשתפקיד.י בפועל — תיכנס.י למעטפה ותסמן.י &quot;ביצעתי הפקדה&quot; (עם אסמכתא).
            </p>

            <div className="bg-amber-50 border border-amber-300 rounded-lg p-3 mb-4 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-700">סכום למעטפת המתנה:</span>
                <span className="font-bold text-amber-900">{depositToPortugo.toFixed(0)}€</span>
              </div>
            </div>

            {pendingError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-3">
                {pendingError}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={handleMoveToPending}
                disabled={pendingSaving}
                className="w-full bg-amber-600 hover:bg-amber-700 active:scale-98 disabled:bg-gray-400 transition-all text-white rounded-xl py-3 font-bold"
              >
                {pendingSaving ? 'שומר...' : 'כן, להעביר למעטפת המתנה'}
              </button>
              <button
                onClick={() => {
                  setShowPendingModal(false);
                  setPendingError('');
                }}
                disabled={pendingSaving}
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

export default function CloseMonthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">טוען...</div>}>
      <CloseMonthContent />
    </Suspense>
  );
}
