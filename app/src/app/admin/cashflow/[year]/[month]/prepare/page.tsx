'use client';

/**
 * /admin/cashflow/[year]/[month]/prepare — הכנת קשפלו (שלב 2 מתוך 3)
 *
 * עומר עוברת על:
 *   - הוצאות מדריכים (לסווג ספק / מספר קבלה / קטגוריה)
 *   - הפקדות לבנק (תצוגה בלבד)
 *   - קבלות מס מהמדריכים (לעדכן תאריך הוצאת חשבונית)
 *   - "דגלים" — חשד מולטיבנקו, חסרה תמונה, חסר סכום או תאריך
 *   - להוסיף קבלות אדמין ידניות
 *
 * השלב הבא (3) ייצר את הקובץ Excel עצמו (לא נוגע בחודשים קודמים).
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ADMIN_COLORS, fmtEuro, monthName } from '@/lib/admin/theme';
import {
  loadCashflowPrepareData,
  loadPreviousFinalBalance,
  updateExpenseClassification,
  addAdminExpense,
  setExpenseReceiptUrl,
  updateInvoiceDate,
  updateTransferSettledAt,
  deleteAdminExpense,
  type CashflowPrepareData,
  type CashflowExpense,
  type CashflowDeposit,
  type CashflowSalaryInvoice,
} from '@/lib/admin/cashflow-data';
import { uploadExpenseReceipt, uploadMonthlyReceipt } from '@/lib/storage';

// ספקים תכופים — autocomplete לעמודת "ספק"
const FREQUENT_SUPPLIERS = [
  'Pastéis de Belém',
  'José Maria da Fonseca',
  'Rei do Bacalhau',
  'Mercado do Camões',
  'Horacio Esteves e Justo',
  'Croqueteria',
  'Padaria Portuguesa',
  'Pingo Doce',
  'Santuário de Cristo Rei',
  'Parques de Sintra',
  'Teleférico de Gaia',
  'Arcadia',
  'CP — Navegante',
];

const fmtDate = (iso: string): string => {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(-2)}`;
};

export default function CashflowPreparePage() {
  const params = useParams<{ year: string; month: string }>();
  const router = useRouter();
  const year = parseInt(params.year, 10);
  const month = parseInt(params.month, 10);

  const [data, setData] = useState<CashflowPrepareData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [showOnlyFlagged, setShowOnlyFlagged] = useState(false);

  // שורת הכנסה ויתרה — הלב של הקשפלו
  const [prevBalance, setPrevBalance] = useState<string>('');
  const [toursIncome, setToursIncome] = useState<string>('');

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, prev] = await Promise.all([
        loadCashflowPrepareData(year, month),
        loadPreviousFinalBalance(year, month),
      ]);
      setData(d);
      // אם יש יתרת חודש קודם ב-DB — אל תדרוס מה שעומר הזינה ידנית
      setPrevBalance((cur) => (cur ? cur : prev != null ? String(prev) : ''));
    } catch (e) {
      const err = e as { message?: string };
      setError(err.message || 'משהו השתבש');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  if (loading && !data) {
    return <div style={{ padding: 40, textAlign: 'center', color: ADMIN_COLORS.gray500 }}>טוענת...</div>;
  }
  if (error) {
    return (
      <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b' }}>
        ⚠️ {error}
        <div style={{ marginTop: 8, fontSize: 12 }}>
          ייתכן שצריך להריץ את המיגרציה <code>db/add_cashflow_prepare.sql</code> ב-Supabase.
        </div>
      </div>
    );
  }
  if (!data) return null;

  const monthLabel = monthName(year, month - 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }} dir="rtl">
      <header>
        <button
          onClick={() => router.back()}
          style={{ background: 'transparent', border: 'none', color: ADMIN_COLORS.gray500, fontSize: 13, cursor: 'pointer', padding: 0, marginBottom: 8, fontFamily: 'inherit' }}
        >
          ← חזרה
        </button>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: ADMIN_COLORS.green900, margin: 0 }}>
            💸 הכנת קשפלו — {monthLabel}
          </h1>
          <span style={{ fontSize: 13, color: ADMIN_COLORS.gray500 }}>שלב 2 מתוך 3</span>
        </div>
      </header>

      {/* Cashflow setup — שורת הכנסה ויתרה (הלב של הקשפלו) */}
      <CashflowSetupSection
        data={data}
        prevBalance={prevBalance}
        setPrevBalance={setPrevBalance}
        toursIncome={toursIncome}
        setToursIncome={setToursIncome}
      />

      {/* Flag summary — עם פירוט לפי סוג */}
      {data.flaggedCount > 0 && (
        <FlagSummary
          data={data}
          showOnlyFlagged={showOnlyFlagged}
          onToggleFilter={() => setShowOnlyFlagged((v) => !v)}
        />
      )}

      {/* Cashflow chronological — שורות אחת אחרי השנייה לפי תאריך, כמו בגליון Excel */}
      <CashflowChronologicalTable
        data={data}
        prevBalance={parseFloat(prevBalance) || 0}
        toursIncome={parseFloat(toursIncome) || 0}
        showOnlyFlagged={showOnlyFlagged}
        savingId={savingId}
        setSavingId={setSavingId}
        onAddClick={() => setShowAddModal(true)}
        onChange={reload}
      />

      {/* הפקדות שעדיין ממתינות (informational) */}
      {data.pendingDeposits.length > 0 && (
        <PendingDepositsSection deposits={data.pendingDeposits} />
      )}

      {/* קבלות מס שעדיין אין להן תאריך (כל החודשים) — דורשות שיוך */}
      {data.unscheduledInvoices.length > 0 && (
        <UnscheduledInvoicesSection
          invoices={data.unscheduledInvoices}
          savingId={savingId}
          setSavingId={setSavingId}
          onChange={reload}
        />
      )}

      {/* Bottom summary + continue */}
      <SummaryBar data={data} />

      {/* Modal */}
      {showAddModal && (
        <AddAdminExpenseModal
          year={year}
          month={month}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            reload();
          }}
        />
      )}
    </div>
  );
}

// ===========================================================================
// Flag summary — מציג פירוט של פריטים שדורשים תשומת לב
// ===========================================================================

function FlagSummary({
  data,
  showOnlyFlagged,
  onToggleFilter,
}: {
  data: CashflowPrepareData;
  showOnlyFlagged: boolean;
  onToggleFilter: () => void;
}) {
  const missingReceiptCount = data.expenses.filter((e) => !e.is_admin_added && !e.receipt_url && e.cashflow_category === 'regular').length;
  const multibancoCount = data.expenses.filter((e) => e.multibanco_suspect).length;
  const unscheduledCount = data.unscheduledInvoices.length;
  const pendingCount = data.pendingDeposits.length;
  const noAmountInvoiceCount = data.salaryInvoices.filter((i) => i.amount === null).length;

  return (
    <div style={{
      padding: 14,
      background: '#fef3c7',
      border: '1px solid #fcd34d',
      borderRadius: 8,
      fontSize: 13,
      color: '#78350f',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <span><strong>🚨 {data.flaggedCount} פריטים דורשים תשומת לב</strong></span>
        <button onClick={onToggleFilter} style={smallBtnStyle()}>
          {showOnlyFlagged ? 'הצג הכל' : 'סנן בטבלה רק דגלים'}
        </button>
      </div>
      <ul style={{ margin: 0, paddingInlineStart: 20, lineHeight: 1.7 }}>
        {missingReceiptCount > 0 && (
          <li>
            📷 <strong>{missingReceiptCount} הוצאות בלי תמונת קבלה</strong>
            <span style={{ color: '#92400e' }}> — שורות אדומות בטבלה. לחיצה על "סנן בטבלה רק דגלים" תציג רק אותן.</span>
          </li>
        )}
        {multibancoCount > 0 && (
          <li>💳 <strong>{multibancoCount} חשד למולטיבנקו</strong> — להחליט אם להחריג</li>
        )}
        {pendingCount > 0 && (
          <li>⏳ <strong>{pendingCount} הפקדות ממתינות</strong> — בסקציה למטה (לא נכנסות לקשפלו)</li>
        )}
        {unscheduledCount > 0 && (
          <li>⚠️ <strong>{unscheduledCount} קבלות מס בלי תאריך</strong> — בסקציה למטה</li>
        )}
        {noAmountInvoiceCount > 0 && (
          <li>💼 <strong>{noAmountInvoiceCount} קבלות מס בלי סכום ב-DB</strong> — בעיית סנכרון, צריך לבדוק</li>
        )}
      </ul>
    </div>
  );
}

// ===========================================================================
// Section: שורת הכנסה ויתרה — הלב של הקשפלו (Excel rows 12+15)
// ===========================================================================

// המטרה: יתרה סוגרת בין 200€ ל-300€ (חוק עומר 7.5.26 — צריך מספיק רזרבה לחודש הבא)
const TARGET_FINAL_BALANCE_MIN = 200;
const TARGET_FINAL_BALANCE_MAX = 300;
const TARGET_FINAL_BALANCE_MID = (TARGET_FINAL_BALANCE_MIN + TARGET_FINAL_BALANCE_MAX) / 2; // 250

function CashflowSetupSection({
  data,
  prevBalance,
  setPrevBalance,
  toursIncome,
  setToursIncome,
}: {
  data: CashflowPrepareData;
  prevBalance: string;
  setPrevBalance: (v: string) => void;
  toursIncome: string;
  setToursIncome: (v: string) => void;
}) {
  const totalOutflow = data.totalRegularOutflow + data.totalDeposits + data.totalSalaries;
  const prev = parseFloat(prevBalance) || 0;
  const suggested = totalOutflow - prev + TARGET_FINAL_BALANCE_MID;
  const income = parseFloat(toursIncome) || 0;
  const projectedFinal = prev + income - totalOutflow;

  // ירוק = בתוך הטווח [200, 300]; צהוב = ±100 מהטווח; אחרת אדום
  const isInRange = projectedFinal >= TARGET_FINAL_BALANCE_MIN && projectedFinal <= TARGET_FINAL_BALANCE_MAX;
  const isClose = projectedFinal >= TARGET_FINAL_BALANCE_MIN - 100 && projectedFinal <= TARGET_FINAL_BALANCE_MAX + 100;

  const fmtSuggested = Math.round(suggested / 10) * 10; // עיגול עשרות

  return (
    <section style={{ ...cardStyle, background: ADMIN_COLORS.green25, borderColor: ADMIN_COLORS.green600 }}>
      <h2 style={{ ...sectionTitleStyle, marginBottom: 8 }}>
        💰 שורת הכנסה — מאזנת את החודש
      </h2>
      <p style={hintStyle}>
        ההכנסה (Row 15 בקשפלו) הולכת לאזן את כל ההוצאות. המטרה: <strong>יתרה סוגרת בין {TARGET_FINAL_BALANCE_MIN}€ ל-{TARGET_FINAL_BALANCE_MAX}€</strong> (רזרבה לחודש הבא).
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 12 }}>
        <Field label="יתרת חודש קודם (I12)">
          <input
            type="number"
            step="0.01"
            value={prevBalance}
            onChange={(e) => setPrevBalance(e.target.value)}
            placeholder="לדוגמה: 1543.20"
            style={inputStyle(true)}
          />
          <span style={{ fontSize: 11, color: ADMIN_COLORS.gray500 }}>
            מתוך I88 בגליון של החודש הקודם
          </span>
        </Field>

        <Field label="הכנסות סיורים (G15) *">
          <input
            type="number"
            step="0.01"
            value={toursIncome}
            onChange={(e) => setToursIncome(e.target.value)}
            placeholder="—"
            style={inputStyle(true)}
          />
          <button
            onClick={() => setToursIncome(String(fmtSuggested))}
            style={{ ...secondaryBtnStyle, marginTop: 4, fontSize: 11 }}
            type="button"
          >
            הצעה: {fmtSuggested.toLocaleString('he-IL')}€
          </button>
        </Field>
      </div>

      {/* תצוגת הנוסחה */}
      <div style={{
        marginTop: 16,
        padding: 12,
        background: '#fff',
        border: `1px solid ${ADMIN_COLORS.gray300}`,
        borderRadius: 8,
        fontSize: 12,
        lineHeight: 1.7,
      }}>
        <div style={{ color: ADMIN_COLORS.gray700, fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span>יתרת חודש קודם:</span>
          <strong>{prev.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</strong>
        </div>
        <div style={{ color: ADMIN_COLORS.green700, fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span>+ הכנסות סיורים:</span>
          <strong>{income.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</strong>
        </div>
        <div style={{ color: ADMIN_COLORS.red, fontFamily: 'monospace', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <span>− סה"כ הוצאות (regular + הפקדות + משכורות):</span>
          <strong>{totalOutflow.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€</strong>
        </div>
        <div style={{
          marginTop: 6,
          paddingTop: 6,
          borderTop: `1px dashed ${ADMIN_COLORS.gray300}`,
          fontFamily: 'monospace',
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          color: isInRange ? ADMIN_COLORS.green700 : isClose ? '#a16207' : ADMIN_COLORS.red,
          fontWeight: 700,
          fontSize: 14,
        }}>
          <span>= יתרה צפויה בסוף חודש (I88):</span>
          <strong>
            {projectedFinal.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}€
            {isInRange ? ' ✓ בטווח' : isClose ? ' ~ קרוב' : ' ⚠ לא בטווח'}
          </strong>
        </div>
      </div>
    </section>
  );
}

// ===========================================================================
// Section: טבלה כרונולוגית — מבנה הקשפלו האמיתי
// ===========================================================================

/** שורה אחת בטבלת הקשפלו (Excel rows 15+) */
type CashflowRow = {
  key: string;
  type: 'income' | 'expense' | 'deposit' | 'salary';
  date: string;
  entity: string;
  description: string;
  inflow: number;
  outflow: number;
  // metadata לעריכה
  expense?: CashflowExpense;
  deposit?: CashflowDeposit;
  invoice?: CashflowSalaryInvoice;
  receipt_url?: string | null;
  flag?: 'multibanco' | 'no-receipt' | null;
};

function buildCashflowRows(
  data: CashflowPrepareData,
  toursIncome: number
): CashflowRow[] {
  const rows: CashflowRow[] = [];

  // 1. שורת tours income — אם יש ערך, מציבים בתחילת החודש
  if (toursIncome > 0) {
    const start = `${data.year}-${String(data.month).padStart(2, '0')}-01`;
    rows.push({
      key: 'income-1',
      type: 'income',
      date: start,
      entity: '',
      description: 'tours income',
      inflow: toursIncome,
      outflow: 0,
    });
  }

  // 2. הוצאות (regular בלבד — multibanco/excluded לא בקשפלו)
  for (const e of data.expenses) {
    if (e.cashflow_category !== 'regular') continue;
    rows.push({
      key: `e-${e.id}`,
      type: 'expense',
      date: e.expense_date,
      entity: e.supplier_name || e.item || '',
      description: e.is_admin_added ? '' : guideFirstNameLcFromName(e.guide_name),
      inflow: 0,
      outflow: e.amount,
      expense: e,
      receipt_url: e.receipt_url,
      flag: e.multibanco_suspect ? 'multibanco' : (!e.is_admin_added && !e.receipt_url ? 'no-receipt' : null),
    });
  }

  // 3. הפקדות (לא pending)
  for (const d of data.deposits) {
    rows.push({
      key: `d-${d.id}`,
      type: 'deposit',
      date: d.effective_date,
      entity: 'deposit',
      description: d.guide_first_name_lc,
      inflow: 0,
      outflow: d.amount,
      deposit: d,
    });
  }

  // 4. משכורות (Fatura-Recibo עם invoice_date בחודש זה)
  for (const inv of data.salaryInvoices) {
    if (!inv.invoice_date) continue; // ל unscheduled יש סקציה נפרדת
    rows.push({
      key: `s-${inv.ack_id}`,
      type: 'salary',
      date: inv.invoice_date,
      entity: `sallary ${guideFirstNameLcFromName(inv.guide_name)}`,
      description: '',
      inflow: 0,
      outflow: inv.amount || 0,
      invoice: inv,
      receipt_url: inv.receipt_url,
    });
  }

  // מיון לפי תאריך, ולאחריו לפי סוג (income → expense → deposit → salary)
  const typeOrder: Record<CashflowRow['type'], number> = { income: 0, expense: 1, deposit: 2, salary: 3 };
  rows.sort((a, b) => {
    const c = a.date.localeCompare(b.date);
    if (c !== 0) return c;
    return typeOrder[a.type] - typeOrder[b.type];
  });

  return rows;
}

/** ממיר שם מדריך מהמערכת (עברית) ל-first name lowercase */
function guideFirstNameLcFromName(fullName: string): string {
  const map: Record<string, string> = {
    'אביב': 'aviv',
    'יניב': 'yaniv',
    'מאיה': 'maya',
    'מני': 'meni',
    'תום': 'tom',
    'דותן': 'dotan',
    'עומר הבן': 'omer',
    'ניר': 'nir',
    'רונה': 'rona',
  };
  if (!fullName || fullName === 'אדמין') return '';
  for (const [he, en] of Object.entries(map)) {
    if (fullName.startsWith(he)) return en;
  }
  return (fullName.split(/\s+/)[0] || fullName).toLowerCase().trim();
}

const fmtAmount = (n: number): string =>
  n === 0 ? '' : n.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '€';

function CashflowChronologicalTable({
  data,
  prevBalance,
  toursIncome,
  showOnlyFlagged,
  savingId,
  setSavingId,
  onAddClick,
  onChange,
}: {
  data: CashflowPrepareData;
  prevBalance: number;
  toursIncome: number;
  showOnlyFlagged: boolean;
  savingId: string | null;
  setSavingId: (id: string | null) => void;
  onAddClick: () => void;
  onChange: () => void;
}) {
  const allRows = buildCashflowRows(data, toursIncome);
  const visible = showOnlyFlagged
    ? allRows.filter((r) => !!r.flag)
    : allRows;

  // יתרה רצה — תמיד על כל השורות (לא על visible)
  const balanceByKey = new Map<string, number>();
  let running = prevBalance;
  for (const r of allRows) {
    running = running + r.inflow - r.outflow;
    balanceByKey.set(r.key, running);
  }

  return (
    <section style={cardStyle}>
      <div style={sectionHeaderStyle}>
        <h2 style={sectionTitleStyle}>📋 קשפלו — תנועות החודש ({allRows.length})</h2>
        <button onClick={onAddClick} style={primaryBtnStyle}>+ הוסף קבלה ידנית</button>
      </div>
      <p style={hintStyle}>
        כל שורה = שורה אחת בגליון Excel. הסדר כרונולוגי. לחיצה על שורה → עריכה.
      </p>

      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr style={theadRowStyle}>
              <th style={thStyle}>#</th>
              <th style={thStyle}>תאריך</th>
              <th style={thStyle}>Entity</th>
              <th style={thStyle}>Description</th>
              <th style={thStyle}>Inflow</th>
              <th style={thStyle}>Outflow</th>
              <th style={thStyle}>Balance</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r, idx) => (
              <CashflowRowItem
                key={r.key}
                row={r}
                index={idx + 1}
                balance={balanceByKey.get(r.key) || 0}
                isSaving={savingId === r.key}
                onSavingStart={() => setSavingId(r.key)}
                onSavingEnd={() => setSavingId(null)}
                onChange={onChange}
              />
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} style={emptyStyle}>אין תנועות בחודש זה</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CashflowRowItem({
  row,
  index,
  balance,
  isSaving,
  onSavingStart,
  onSavingEnd,
  onChange,
}: {
  row: CashflowRow;
  index: number;
  balance: number;
  isSaving: boolean;
  onSavingStart: () => void;
  onSavingEnd: () => void;
  onChange: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [entity, setEntity] = useState(row.entity);
  const [showReceipt, setShowReceipt] = useState(false);

  // צבע רקע לפי דגל
  const flagBg =
    row.flag === 'multibanco' ? '#fef3c7'
    : row.flag === 'no-receipt' ? '#fee2e2'
    : row.type === 'income' ? ADMIN_COLORS.green25
    : 'transparent';

  // צבע אייקון לפי סוג
  const typeIcon =
    row.type === 'income' ? '📈'
    : row.type === 'deposit' ? '🏦'
    : row.type === 'salary' ? '💼'
    : '🧾';

  const handleSaveEntity = async () => {
    if (!row.expense) return;
    onSavingStart();
    try {
      await updateExpenseClassification({
        expenseId: row.expense.id,
        supplier_name: entity,
      });
      onChange();
      setEditing(false);
    } catch (e) {
      const err = e as { message?: string };
      alert(err.message || 'שגיאה בשמירה');
    } finally {
      onSavingEnd();
    }
  };

  const isExpenseEditable = !!row.expense;

  return (
    <>
      <tr style={{ background: flagBg, borderBottom: `1px solid ${ADMIN_COLORS.gray100}` }}>
        <td style={{ ...tdStyle, color: ADMIN_COLORS.gray500, fontFamily: 'monospace' }}>{index}</td>
        <td style={tdStyle}>{fmtDate(row.date)}</td>
        <td style={tdStyle}>
          {editing && isExpenseEditable ? (
            <div style={{ display: 'flex', gap: 4 }}>
              <input
                type="text"
                value={entity}
                onChange={(ev) => setEntity(ev.target.value)}
                style={inputStyle()}
                autoFocus
              />
              <button onClick={handleSaveEntity} disabled={isSaving} style={primaryBtnStyle}>
                {isSaving ? '...' : '✓'}
              </button>
              <button onClick={() => { setEntity(row.entity); setEditing(false); }} style={secondaryBtnStyle}>✕</button>
            </div>
          ) : (
            <span
              style={{ fontFamily: 'monospace', color: ADMIN_COLORS.gray700, cursor: isExpenseEditable ? 'pointer' : 'default' }}
              onClick={() => isExpenseEditable && setEditing(true)}
              title={isExpenseEditable ? 'לחיצה לעריכה' : ''}
            >
              {typeIcon} {row.entity || <em style={{ color: ADMIN_COLORS.gray500 }}>—</em>}
            </span>
          )}
          {row.flag === 'multibanco' && (
            <div style={{ fontSize: 10, color: '#92400e', marginTop: 2 }}>🚨 חשד מולטיבנקו</div>
          )}
          {row.flag === 'no-receipt' && (
            <div style={{ fontSize: 10, color: '#991b1b', marginTop: 2 }}>⚠ חסרה תמונת קבלה</div>
          )}
        </td>
        <td style={{ ...tdStyle, fontFamily: 'monospace', color: ADMIN_COLORS.gray700 }}>
          {row.description}
        </td>
        <td style={{ ...tdStyle, fontFamily: 'monospace', color: ADMIN_COLORS.green700, textAlign: 'left' }}>
          {fmtAmount(row.inflow)}
        </td>
        <td style={{ ...tdStyle, fontFamily: 'monospace', color: row.outflow > 0 ? ADMIN_COLORS.red : '', textAlign: 'left' }}>
          {fmtAmount(row.outflow)}
        </td>
        <td style={{ ...tdStyle, fontFamily: 'monospace', fontWeight: 600, textAlign: 'left' }}>
          {fmtAmount(balance)}
        </td>
        <td style={tdStyle}>
          {row.receipt_url && (
            <button onClick={() => setShowReceipt((v) => !v)} style={linkBtnStyle} type="button">
              {showReceipt ? 'הסתר' : '📷'}
            </button>
          )}
        </td>
      </tr>
      {showReceipt && row.receipt_url && (
        <tr>
          <td colSpan={8} style={{ padding: 12, background: ADMIN_COLORS.gray50 }}>
            <a href={row.receipt_url} target="_blank" rel="noreferrer">
              {row.receipt_url.endsWith('.pdf') ? (
                <embed src={row.receipt_url} width="100%" height="500" />
              ) : (
                <Image src={row.receipt_url} alt="קבלה" width={400} height={500} style={{ maxWidth: '100%', height: 'auto', borderRadius: 6 }} unoptimized />
              )}
            </a>
          </td>
        </tr>
      )}
    </>
  );
}

// ===========================================================================
// Section: הוצאות מדריכים + אדמין (legacy — לא בשימוש בעמוד הראשי, כן בסקציות עזר)
// ===========================================================================

function ExpensesSection({
  data,
  showOnlyFlagged,
  savingId,
  setSavingId,
  onAddClick,
  onChange,
}: {
  data: CashflowPrepareData;
  showOnlyFlagged: boolean;
  savingId: string | null;
  setSavingId: (id: string | null) => void;
  onAddClick: () => void;
  onChange: () => void;
}) {
  const visible = showOnlyFlagged
    ? data.expenses.filter((e) => e.multibanco_suspect || (!e.is_admin_added && !e.receipt_url))
    : data.expenses;

  return (
    <section style={cardStyle}>
      <div style={sectionHeaderStyle}>
        <h2 style={sectionTitleStyle}>🟢 הוצאות ({data.expenses.length})</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: ADMIN_COLORS.gray500 }}>
            סה"כ regular: <strong>{fmtEuro(data.totalRegularOutflow, true)}</strong>
          </span>
          <button onClick={onAddClick} style={primaryBtnStyle}>+ הוסף קבלה ידנית</button>
        </div>
      </div>

      {visible.length === 0 ? (
        <div style={emptyStyle}>אין הוצאות {showOnlyFlagged ? 'מסומנות' : 'בחודש זה'}</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={theadRowStyle}>
                <th style={thStyle}>תאריך</th>
                <th style={thStyle}>מדריך</th>
                <th style={thStyle}>פריט / הערות</th>
                <th style={thStyle}>ספק (לקשפלו)</th>
                <th style={thStyle}># קבלה</th>
                <th style={thStyle}>סכום</th>
                <th style={thStyle}>סיווג</th>
                <th style={thStyle}>קבלה</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {visible.map((e) => (
                <ExpenseRow
                  key={e.id}
                  expense={e}
                  isSaving={savingId === e.id}
                  onSavingStart={() => setSavingId(e.id)}
                  onSavingEnd={() => setSavingId(null)}
                  onChange={onChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function ExpenseRow({
  expense,
  isSaving,
  onSavingStart,
  onSavingEnd,
  onChange,
}: {
  expense: CashflowExpense;
  isSaving: boolean;
  onSavingStart: () => void;
  onSavingEnd: () => void;
  onChange: () => void;
}) {
  // ברירת מחדל: שם ספק שמור (מולא אוטומטית בעת הטעינה אם הייתה התאמה)
  const [supplier, setSupplier] = useState(expense.supplier_name || '');
  const [receiptNum, setReceiptNum] = useState(expense.receipt_number || '');
  const [category, setCategory] = useState(expense.cashflow_category);
  const [showReceipt, setShowReceipt] = useState(false);

  const dirty =
    supplier !== (expense.supplier_name || '') ||
    receiptNum !== (expense.receipt_number || '') ||
    category !== expense.cashflow_category;

  const flagBg = expense.multibanco_suspect
    ? '#fef3c7'
    : !expense.is_admin_added && !expense.receipt_url
      ? '#fee2e2'
      : 'transparent';

  const handleSave = async () => {
    onSavingStart();
    try {
      await updateExpenseClassification({
        expenseId: expense.id,
        supplier_name: supplier,
        receipt_number: receiptNum,
        cashflow_category: category,
      });
      onChange();
    } catch (e) {
      const err = e as { message?: string };
      alert(err.message || 'שגיאה בשמירה');
    } finally {
      onSavingEnd();
    }
  };

  const handleDeleteAdmin = async () => {
    if (!confirm(`למחוק את ההוצאה "${expense.item}" (${fmtEuro(expense.amount, true)})?`)) return;
    onSavingStart();
    try {
      await deleteAdminExpense(expense.id);
      onChange();
    } catch (e) {
      const err = e as { message?: string };
      alert(err.message || 'שגיאה במחיקה');
    } finally {
      onSavingEnd();
    }
  };

  return (
    <>
      <tr style={{ background: flagBg, borderBottom: `1px solid ${ADMIN_COLORS.gray100}` }}>
        <td style={tdStyle}>{fmtDate(expense.expense_date)}</td>
        <td style={tdStyle}>
          {expense.is_admin_added ? (
            <span style={{ fontSize: 11, padding: '2px 8px', background: ADMIN_COLORS.green25, color: ADMIN_COLORS.green700, borderRadius: 4 }}>
              אדמין
            </span>
          ) : (
            expense.guide_name
          )}
        </td>
        <td style={{ ...tdStyle, maxWidth: 220 }}>
          <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${expense.item}${expense.notes ? ' · ' + expense.notes : ''}`}>
            {expense.item}
            {expense.notes && <span style={{ color: ADMIN_COLORS.gray500, fontSize: 11 }}> · {expense.notes}</span>}
          </div>
          {expense.multibanco_suspect && (
            <div style={{ fontSize: 11, color: '#92400e', marginTop: 2 }}>🚨 חשד למולטיבנקו</div>
          )}
        </td>
        <td style={tdStyle}>
          <input
            type="text"
            value={supplier}
            onChange={(ev) => setSupplier(ev.target.value)}
            list={`suppliers-${expense.id}`}
            placeholder="שם ספק"
            style={inputStyle()}
          />
          <datalist id={`suppliers-${expense.id}`}>
            {FREQUENT_SUPPLIERS.map((s) => <option key={s} value={s} />)}
          </datalist>
        </td>
        <td style={tdStyle}>
          <input
            type="text"
            value={receiptNum}
            onChange={(ev) => setReceiptNum(ev.target.value)}
            placeholder="—"
            style={{ ...inputStyle(), width: 90 }}
          />
        </td>
        <td style={{ ...tdStyle, fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtEuro(expense.amount, true)}</td>
        <td style={tdStyle}>
          <select
            value={category}
            onChange={(ev) => setCategory(ev.target.value as CashflowExpense['cashflow_category'])}
            style={inputStyle()}
          >
            <option value="regular">רגיל</option>
            <option value="multibanco">מולטיבנקו</option>
            <option value="excluded">החרג</option>
          </select>
        </td>
        <td style={tdStyle}>
          {expense.receipt_url ? (
            <button
              onClick={() => setShowReceipt((v) => !v)}
              style={linkBtnStyle}
              type="button"
            >
              {showReceipt ? 'הסתר' : '📷 הצג'}
            </button>
          ) : (
            <span style={{ fontSize: 11, color: '#991b1b' }}>חסרה</span>
          )}
        </td>
        <td style={tdStyle}>
          {dirty && (
            <button onClick={handleSave} disabled={isSaving} style={primaryBtnStyle}>
              {isSaving ? '...' : 'שמרי'}
            </button>
          )}
          {!dirty && expense.is_admin_added && (
            <button onClick={handleDeleteAdmin} disabled={isSaving} style={dangerBtnStyle}>
              🗑
            </button>
          )}
        </td>
      </tr>
      {showReceipt && expense.receipt_url && (
        <tr>
          <td colSpan={9} style={{ padding: 12, background: ADMIN_COLORS.gray50 }}>
            <a href={expense.receipt_url} target="_blank" rel="noreferrer" style={{ display: 'inline-block' }}>
              <Image
                src={expense.receipt_url}
                alt="קבלה"
                width={400}
                height={500}
                style={{ maxWidth: '100%', height: 'auto', borderRadius: 6, border: `1px solid ${ADMIN_COLORS.gray300}` }}
                unoptimized
              />
            </a>
          </td>
        </tr>
      )}
    </>
  );
}

// ===========================================================================
// Section: הפקדות לבנק
// ===========================================================================

function DepositsSection({
  deposits,
  savingId,
  setSavingId,
  onChange,
}: {
  deposits: CashflowDeposit[];
  savingId: string | null;
  setSavingId: (id: string | null) => void;
  onChange: () => void;
}) {
  const total = deposits.reduce((s, d) => s + d.amount, 0);
  return (
    <section style={cardStyle}>
      <div style={sectionHeaderStyle}>
        <h2 style={sectionTitleStyle}>🟡 הפקדות לבנק ({deposits.length})</h2>
        <span style={{ fontSize: 12, color: ADMIN_COLORS.gray500 }}>
          סה"כ: <strong>{fmtEuro(total, true)}</strong>
        </span>
      </div>
      <p style={hintStyle}>תאריך ההפקדה בפועל הוא שקובע באיזה חודש קשפלו ההפקדה תופיע. אם רוצה לתקן — אפשר לערוך את התאריך.</p>
      {deposits.length === 0 ? (
        <div style={emptyStyle}>אין הפקדות בחודש זה</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={theadRowStyle}>
                <th style={thStyle}>תאריך הפקדה</th>
                <th style={thStyle}>מדריך</th>
                <th style={thStyle}>שם בקשפלו (Description)</th>
                <th style={thStyle}>סכום</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((d) => (
                <DepositRow
                  key={d.id}
                  deposit={d}
                  isSaving={savingId === d.id}
                  onSavingStart={() => setSavingId(d.id)}
                  onSavingEnd={() => setSavingId(null)}
                  onChange={onChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function DepositRow({
  deposit,
  isSaving,
  onSavingStart,
  onSavingEnd,
  onChange,
}: {
  deposit: CashflowDeposit;
  isSaving: boolean;
  onSavingStart: () => void;
  onSavingEnd: () => void;
  onChange: () => void;
}) {
  const [date, setDate] = useState(deposit.effective_date);
  const dirty = date !== deposit.effective_date;

  const handleSave = async () => {
    onSavingStart();
    try {
      // אם זה אותו תאריך כמו transfer_date המקורי — נקה settled_at;
      // אחרת — שמור settled_at = הערך החדש.
      const newSettled = date === deposit.transfer_date ? null : date;
      await updateTransferSettledAt(deposit.id, newSettled);
      onChange();
    } catch (e) {
      const err = e as { message?: string };
      alert(err.message || 'שגיאה בשמירה');
    } finally {
      onSavingEnd();
    }
  };

  const overridden = !!deposit.settled_at;

  return (
    <tr style={{ borderBottom: `1px solid ${ADMIN_COLORS.gray100}` }}>
      <td style={tdStyle}>
        <input
          type="date"
          value={date}
          onChange={(ev) => setDate(ev.target.value)}
          style={{ ...inputStyle(), width: 140 }}
        />
        {overridden && (
          <div style={{ fontSize: 10, color: ADMIN_COLORS.gray500, marginTop: 2 }}>
            (סגירה הייתה ב-{fmtDate(deposit.transfer_date)})
          </div>
        )}
      </td>
      <td style={tdStyle}>{deposit.guide_name}</td>
      <td style={{ ...tdStyle, fontFamily: 'monospace', color: ADMIN_COLORS.gray700 }}>
        {deposit.guide_first_name_lc}
      </td>
      <td style={{ ...tdStyle, fontWeight: 600 }}>{fmtEuro(deposit.amount, true)}</td>
      <td style={tdStyle}>
        {dirty && (
          <button onClick={handleSave} disabled={isSaving} style={primaryBtnStyle}>
            {isSaving ? '...' : 'שמרי'}
          </button>
        )}
      </td>
    </tr>
  );
}

// ===========================================================================
// Section: הפקדות שעדיין ממתינות (informational — לא נכללות בקשפלו)
// ===========================================================================

function PendingDepositsSection({ deposits }: { deposits: CashflowDeposit[] }) {
  const total = deposits.reduce((s, d) => s + d.amount, 0);
  return (
    <section style={{ ...cardStyle, background: '#fffbeb', borderColor: '#fcd34d' }}>
      <div style={sectionHeaderStyle}>
        <h2 style={{ ...sectionTitleStyle, color: '#78350f' }}>
          ⏳ ממתינות להפקדה ({deposits.length})
        </h2>
        <span style={{ fontSize: 12, color: '#78350f' }}>
          סה"כ: <strong>{fmtEuro(total, true)}</strong>
        </span>
      </div>
      <p style={{ ...hintStyle, color: '#78350f' }}>
        אלו הפקדות שהמדריכים סגרו אך עדיין לא הפקידו בבנק. לא נכללות בקשפלו עד שהם יסמנו "הפקדתי" ב-/cash-boxes.
      </p>
      {deposits.length > 0 && (
        <table style={tableStyle}>
          <thead>
            <tr style={theadRowStyle}>
              <th style={thStyle}>תאריך סגירה</th>
              <th style={thStyle}>מדריך</th>
              <th style={thStyle}>סכום</th>
            </tr>
          </thead>
          <tbody>
            {deposits.map((d) => (
              <tr key={d.id} style={{ borderBottom: `1px solid #fde68a` }}>
                <td style={tdStyle}>{fmtDate(d.transfer_date)}</td>
                <td style={tdStyle}>{d.guide_name}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{fmtEuro(d.amount, true)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

// ===========================================================================
// Section: קבלות מס (Fatura-Recibo)
// ===========================================================================

function SalarySection({
  invoices,
  savingId,
  setSavingId,
  onChange,
}: {
  invoices: CashflowSalaryInvoice[];
  savingId: string | null;
  setSavingId: (id: string | null) => void;
  onChange: () => void;
}) {
  const total = invoices.reduce((s, i) => s + (i.amount || 0), 0);

  return (
    <section style={cardStyle}>
      <div style={sectionHeaderStyle}>
        <h2 style={sectionTitleStyle}>🔵 קבלות מס בחודש זה ({invoices.length})</h2>
        <span style={{ fontSize: 12, color: ADMIN_COLORS.gray500 }}>
          סה"כ: <strong>{fmtEuro(total, true)}</strong>
        </span>
      </div>
      <p style={hintStyle}>
        מוצגות רק קבלות עם תאריך הוצאת חשבונית בחודש זה. אם יש קבלות שעדיין אין להן תאריך — הן מופיעות בסקציה המיוחדת למטה.
      </p>
      {invoices.length === 0 ? (
        <div style={emptyStyle}>אין קבלות עם תאריך הוצאה בחודש זה</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={theadRowStyle}>
                <th style={thStyle}>מדריך</th>
                <th style={thStyle}>חודש שירות</th>
                <th style={thStyle}>תאריך הוצאת חשבונית</th>
                <th style={thStyle}>סכום (TOTAL A PAGAR)</th>
                <th style={thStyle}>קבלה</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <SalaryRow
                  key={inv.ack_id}
                  invoice={inv}
                  isSaving={savingId === inv.ack_id}
                  onSavingStart={() => setSavingId(inv.ack_id)}
                  onSavingEnd={() => setSavingId(null)}
                  onChange={onChange}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function SalaryRow({
  invoice,
  isSaving,
  onSavingStart,
  onSavingEnd,
  onChange,
}: {
  invoice: CashflowSalaryInvoice;
  isSaving: boolean;
  onSavingStart: () => void;
  onSavingEnd: () => void;
  onChange: () => void;
}) {
  const [invoiceDate, setInvoiceDate] = useState(invoice.invoice_date || '');
  const [showReceipt, setShowReceipt] = useState(false);
  const [uploading, setUploading] = useState(false);

  const dirty = invoiceDate !== (invoice.invoice_date || '');
  const missingAmount = invoice.amount === null;
  const missingDate = !invoice.invoice_date;
  const flagBg = missingAmount || missingDate ? '#fee2e2' : 'transparent';

  const handleSave = async () => {
    onSavingStart();
    try {
      await updateInvoiceDate(invoice.ack_id, invoiceDate || null);
      onChange();
    } catch (e) {
      const err = e as { message?: string };
      alert(err.message || 'שגיאה בשמירה');
    } finally {
      onSavingEnd();
    }
  };

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      await uploadMonthlyReceipt({
        file,
        guideId: invoice.guide_id,
        receiptYear: invoice.service_year,
        receiptMonth: invoice.service_month,
      });
      // הקישור יישמר ב-receipt_acknowledgements ע"י ה-flow הקיים — כאן רק מעלים תמונה
      // (אם רוצים — אפשר לעדכן receipt_url, אבל זה מתבצע בדף /home של המדריך)
      onChange();
    } catch (e) {
      const err = e as { message?: string };
      alert(err.message || 'שגיאה בהעלאה');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <tr style={{ background: flagBg, borderBottom: `1px solid ${ADMIN_COLORS.gray100}` }}>
        <td style={tdStyle}>{invoice.guide_name}</td>
        <td style={tdStyle}>{invoice.service_month}/{invoice.service_year}</td>
        <td style={tdStyle}>
          <input
            type="date"
            value={invoiceDate}
            onChange={(ev) => setInvoiceDate(ev.target.value)}
            style={{ ...inputStyle(), width: 140 }}
          />
          {missingDate && <div style={{ fontSize: 11, color: '#991b1b', marginTop: 2 }}>חסר תאריך</div>}
        </td>
        <td style={{ ...tdStyle, fontWeight: 600 }}>
          {invoice.amount !== null ? fmtEuro(invoice.amount, true) : <span style={{ color: '#991b1b', fontSize: 11 }}>חסר ב-DB</span>}
        </td>
        <td style={tdStyle}>
          {invoice.receipt_url ? (
            <button onClick={() => setShowReceipt((v) => !v)} style={linkBtnStyle} type="button">
              {showReceipt ? 'הסתר' : '📄 הצג'}
            </button>
          ) : (
            <label style={{ ...linkBtnStyle, cursor: uploading ? 'wait' : 'pointer' }}>
              {uploading ? 'מעלה...' : '↑ העלי'}
              <input
                type="file"
                accept="image/*,application/pdf"
                style={{ display: 'none' }}
                disabled={uploading}
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (f) handleUpload(f);
                }}
              />
            </label>
          )}
        </td>
        <td style={tdStyle}>
          {dirty && (
            <button onClick={handleSave} disabled={isSaving} style={primaryBtnStyle}>
              {isSaving ? '...' : 'שמרי'}
            </button>
          )}
        </td>
      </tr>
      {showReceipt && invoice.receipt_url && (
        <tr>
          <td colSpan={6} style={{ padding: 12, background: ADMIN_COLORS.gray50 }}>
            <a href={invoice.receipt_url} target="_blank" rel="noreferrer">
              {invoice.receipt_url.endsWith('.pdf') ? (
                <embed src={invoice.receipt_url} width="100%" height="500" />
              ) : (
                <Image src={invoice.receipt_url} alt="חשבונית" width={400} height={500} style={{ maxWidth: '100%', height: 'auto', borderRadius: 6 }} unoptimized />
              )}
            </a>
          </td>
        </tr>
      )}
    </>
  );
}

// ===========================================================================
// Section: קבלות מס שעדיין אין להן תאריך — דורשות שיוך לחודש
// ===========================================================================

function UnscheduledInvoicesSection({
  invoices,
  savingId,
  setSavingId,
  onChange,
}: {
  invoices: CashflowSalaryInvoice[];
  savingId: string | null;
  setSavingId: (id: string | null) => void;
  onChange: () => void;
}) {
  return (
    <section style={{ ...cardStyle, background: '#fef2f2', borderColor: '#fca5a5' }}>
      <div style={sectionHeaderStyle}>
        <h2 style={{ ...sectionTitleStyle, color: '#991b1b' }}>
          ⚠️ קבלות מס בלי תאריך הוצאת חשבונית ({invoices.length})
        </h2>
      </div>
      <p style={{ ...hintStyle, color: '#991b1b' }}>
        כדי שקבלה תופיע בקשפלו, צריך להזין את התאריך שבו המדריך הפיק אותה. התאריך הזה קובע באיזה חודש קשפלו היא תיכלל.
      </p>
      <div style={{ overflowX: 'auto' }}>
        <table style={tableStyle}>
          <thead>
            <tr style={theadRowStyle}>
              <th style={thStyle}>מדריך</th>
              <th style={thStyle}>חודש שירות</th>
              <th style={thStyle}>תאריך הוצאת חשבונית</th>
              <th style={thStyle}>סכום</th>
              <th style={thStyle}>קבלה</th>
              <th style={thStyle}></th>
            </tr>
          </thead>
          <tbody>
            {invoices.map((inv) => (
              <SalaryRow
                key={inv.ack_id}
                invoice={inv}
                isSaving={savingId === inv.ack_id}
                onSavingStart={() => setSavingId(inv.ack_id)}
                onSavingEnd={() => setSavingId(null)}
                onChange={onChange}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ===========================================================================
// Bottom summary bar
// ===========================================================================

function SummaryBar({ data }: { data: CashflowPrepareData }) {
  const totalOutflow = data.totalRegularOutflow + data.totalDeposits + data.totalSalaries;
  return (
    <section style={{ ...cardStyle, position: 'sticky', bottom: 0, zIndex: 5, boxShadow: '0 -2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 13 }}>
          <div>
            <div style={{ color: ADMIN_COLORS.gray500, fontSize: 11 }}>הוצאות (regular)</div>
            <div style={{ fontWeight: 700, color: ADMIN_COLORS.green900 }}>{fmtEuro(data.totalRegularOutflow, true)}</div>
          </div>
          <div>
            <div style={{ color: ADMIN_COLORS.gray500, fontSize: 11 }}>הפקדות</div>
            <div style={{ fontWeight: 700 }}>{fmtEuro(data.totalDeposits, true)}</div>
          </div>
          <div>
            <div style={{ color: ADMIN_COLORS.gray500, fontSize: 11 }}>משכורות</div>
            <div style={{ fontWeight: 700 }}>{fmtEuro(data.totalSalaries, true)}</div>
          </div>
          <div>
            <div style={{ color: ADMIN_COLORS.gray500, fontSize: 11 }}>סה"כ outflow</div>
            <div style={{ fontWeight: 700, fontSize: 18, color: ADMIN_COLORS.green900 }}>{fmtEuro(totalOutflow, true)}</div>
          </div>
        </div>
        <button
          disabled
          title="שלב 3 (ייצור Excel) ייבנה בסשן הבא"
          style={{ ...primaryBtnStyle, opacity: 0.5, cursor: 'not-allowed', fontSize: 14, padding: '10px 20px' }}
        >
          → המשך לייצור Excel (בקרוב)
        </button>
      </div>
    </section>
  );
}

// ===========================================================================
// Modal: הוספת קבלה ידנית של אדמין
// ===========================================================================

function AddAdminExpenseModal({
  year,
  month,
  onClose,
  onSaved,
}: {
  year: number;
  month: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(`${year}-${String(month).padStart(2, '0')}-01`);
  const [supplier, setSupplier] = useState('');
  const [amount, setAmount] = useState('');
  const [receiptNum, setReceiptNum] = useState('');
  const [notes, setNotes] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const valid = supplier.trim() && parseFloat(amount) > 0 && date;

  const handleSave = async () => {
    if (!valid) return;
    setSaving(true);
    try {
      const { id } = await addAdminExpense({
        expense_date: date,
        supplier_name: supplier.trim(),
        amount: parseFloat(amount),
        receipt_number: receiptNum || null,
        notes: notes || null,
      });
      if (file) {
        const url = await uploadExpenseReceipt({
          file,
          expenseId: id,
          expenseDate: date,
          tourType: null,
        });
        await setExpenseReceiptUrl(id, url);
      }
      onSaved();
    } catch (e) {
      const err = e as { message?: string };
      alert(err.message || 'שגיאה בשמירה');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.4)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onClick={onClose}
    >
      <div
        style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 480, width: '100%', maxHeight: '90vh', overflow: 'auto' }}
        onClick={(ev) => ev.stopPropagation()}
        dir="rtl"
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 700, color: ADMIN_COLORS.green900 }}>
          + קבלה ידנית של אדמין
        </h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Field label="תאריך הקבלה">
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle(true)} />
          </Field>
          <Field label="שם ספק *">
            <input
              type="text"
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              list="admin-suppliers"
              placeholder="כל שם — בחרי מהרשימה או כתבי חופשי"
              style={inputStyle(true)}
              autoComplete="off"
            />
            <datalist id="admin-suppliers">
              {FREQUENT_SUPPLIERS.map((s) => <option key={s} value={s} />)}
            </datalist>
            <span style={{ fontSize: 11, color: ADMIN_COLORS.gray500, marginTop: 2 }}>
              אפשר לכתוב כל שם ספק — הרשימה היא רק הצעה.
            </span>
          </Field>
          <Field label="סכום (€) *">
            <input
              type="number"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              style={inputStyle(true)}
            />
          </Field>
          <Field label="מספר קבלה">
            <input type="text" value={receiptNum} onChange={(e) => setReceiptNum(e.target.value)} style={inputStyle(true)} />
          </Field>
          <Field label="הערות">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} style={{ ...inputStyle(true), resize: 'vertical' }} />
          </Field>
          <Field label="צילום קבלה (אופציונלי)">
            <input type="file" accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {file && <div style={{ fontSize: 11, color: ADMIN_COLORS.gray500, marginTop: 4 }}>{file.name}</div>}
          </Field>
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 20 }}>
          <button onClick={onClose} style={secondaryBtnStyle} disabled={saving}>ביטול</button>
          <button onClick={handleSave} disabled={!valid || saving} style={{ ...primaryBtnStyle, opacity: valid ? 1 : 0.5 }}>
            {saving ? 'שומרת...' : 'שמרי'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: ADMIN_COLORS.gray700 }}>{label}</span>
      {children}
    </label>
  );
}

// ===========================================================================
// Styles
// ===========================================================================

const cardStyle: React.CSSProperties = {
  background: '#fff',
  border: `1px solid ${ADMIN_COLORS.gray300}`,
  borderRadius: 8,
  padding: 16,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  marginBottom: 12,
  flexWrap: 'wrap',
  gap: 8,
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 17,
  fontWeight: 700,
  color: ADMIN_COLORS.green900,
  margin: 0,
};

const tableStyle: React.CSSProperties = {
  width: '100%',
  fontSize: 13,
  borderCollapse: 'collapse',
};

const theadRowStyle: React.CSSProperties = {
  borderBottom: `1px solid ${ADMIN_COLORS.gray300}`,
  textAlign: 'right',
  color: ADMIN_COLORS.gray700,
};

const thStyle: React.CSSProperties = {
  padding: '8px 6px',
  fontWeight: 600,
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '8px 6px',
  verticalAlign: 'top',
};

const emptyStyle: React.CSSProperties = {
  color: ADMIN_COLORS.gray500,
  padding: 24,
  textAlign: 'center',
  fontSize: 13,
};

const hintStyle: React.CSSProperties = {
  fontSize: 12,
  color: ADMIN_COLORS.gray500,
  margin: '0 0 12px',
  lineHeight: 1.5,
};

function inputStyle(full: boolean = false): React.CSSProperties {
  return {
    padding: '6px 10px',
    fontSize: 13,
    borderRadius: 6,
    border: `1px solid ${ADMIN_COLORS.gray300}`,
    fontFamily: 'inherit',
    width: full ? '100%' : 140,
    boxSizing: 'border-box',
  };
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: ADMIN_COLORS.green700,
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const secondaryBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: '#fff',
  color: ADMIN_COLORS.gray700,
  border: `1px solid ${ADMIN_COLORS.gray300}`,
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const dangerBtnStyle: React.CSSProperties = {
  padding: '6px 10px',
  background: '#fff',
  color: ADMIN_COLORS.red,
  border: `1px solid ${ADMIN_COLORS.gray300}`,
  borderRadius: 6,
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const linkBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: ADMIN_COLORS.green700,
  border: 'none',
  fontSize: 12,
  cursor: 'pointer',
  textDecoration: 'underline',
  padding: 0,
  fontFamily: 'inherit',
  display: 'inline-block',
};

function smallBtnStyle(): React.CSSProperties {
  return {
    padding: '4px 10px',
    background: '#fff',
    color: '#78350f',
    border: '1px solid #fcd34d',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}
