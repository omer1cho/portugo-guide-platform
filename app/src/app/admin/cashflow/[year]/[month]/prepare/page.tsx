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
  updateExpenseClassification,
  addAdminExpense,
  setExpenseReceiptUrl,
  updateInvoiceDate,
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

  const reload = async () => {
    setLoading(true);
    setError(null);
    try {
      const d = await loadCashflowPrepareData(year, month);
      setData(d);
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

      {/* Flag summary */}
      {data.flaggedCount > 0 && (
        <div style={{
          padding: 12,
          background: '#fef3c7',
          border: '1px solid #fcd34d',
          borderRadius: 8,
          fontSize: 13,
          color: '#78350f',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
        }}>
          <span>
            🚨 <strong>{data.flaggedCount} פריטים דורשים תשומת לב</strong> — חשד מולטיבנקו, קבלה חסרה, סכום או תאריך חסר
          </span>
          <button
            onClick={() => setShowOnlyFlagged((v) => !v)}
            style={smallBtnStyle()}
          >
            {showOnlyFlagged ? 'הצג הכל' : 'סנן רק דגלים'}
          </button>
        </div>
      )}

      {/* Section: הוצאות */}
      <ExpensesSection
        data={data}
        showOnlyFlagged={showOnlyFlagged}
        savingId={savingId}
        setSavingId={setSavingId}
        onAddClick={() => setShowAddModal(true)}
        onChange={reload}
      />

      {/* Section: הפקדות */}
      <DepositsSection deposits={data.deposits} />

      {/* Section: משכורות */}
      <SalarySection
        invoices={data.salaryInvoices}
        showOnlyFlagged={showOnlyFlagged}
        savingId={savingId}
        setSavingId={setSavingId}
        onChange={reload}
      />

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
// Section: הוצאות מדריכים + אדמין
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

function DepositsSection({ deposits }: { deposits: CashflowDeposit[] }) {
  const total = deposits.reduce((s, d) => s + d.amount, 0);
  return (
    <section style={cardStyle}>
      <div style={sectionHeaderStyle}>
        <h2 style={sectionTitleStyle}>🟡 הפקדות לבנק ({deposits.length})</h2>
        <span style={{ fontSize: 12, color: ADMIN_COLORS.gray500 }}>
          סה"כ: <strong>{fmtEuro(total, true)}</strong>
        </span>
      </div>
      {deposits.length === 0 ? (
        <div style={emptyStyle}>אין הפקדות בחודש זה</div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={theadRowStyle}>
                <th style={thStyle}>תאריך</th>
                <th style={thStyle}>מדריך</th>
                <th style={thStyle}>שם בקשפלו (Description)</th>
                <th style={thStyle}>סכום</th>
                <th style={thStyle}>סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {deposits.map((d) => (
                <tr key={d.id} style={{ borderBottom: `1px solid ${ADMIN_COLORS.gray100}` }}>
                  <td style={tdStyle}>{fmtDate(d.transfer_date)}</td>
                  <td style={tdStyle}>{d.guide_name}</td>
                  <td style={{ ...tdStyle, fontFamily: 'monospace', color: ADMIN_COLORS.gray700 }}>
                    {d.guide_first_name_lc}
                  </td>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{fmtEuro(d.amount, true)}</td>
                  <td style={tdStyle}>
                    {d.is_pending_deposit ? (
                      <span style={{ fontSize: 11, color: '#a16207' }}>⏳ ממתין</span>
                    ) : (
                      <span style={{ fontSize: 11, color: ADMIN_COLORS.green700 }}>✓ הופקד</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

// ===========================================================================
// Section: קבלות מס (Fatura-Recibo)
// ===========================================================================

function SalarySection({
  invoices,
  showOnlyFlagged,
  savingId,
  setSavingId,
  onChange,
}: {
  invoices: CashflowSalaryInvoice[];
  showOnlyFlagged: boolean;
  savingId: string | null;
  setSavingId: (id: string | null) => void;
  onChange: () => void;
}) {
  const visible = showOnlyFlagged
    ? invoices.filter((i) => !i.invoice_date || i.amount === null)
    : invoices;
  const total = invoices.reduce((s, i) => s + (i.amount || 0), 0);

  return (
    <section style={cardStyle}>
      <div style={sectionHeaderStyle}>
        <h2 style={sectionTitleStyle}>🔵 קבלות מס מהמדריכים ({invoices.length})</h2>
        <span style={{ fontSize: 12, color: ADMIN_COLORS.gray500 }}>
          סה"כ: <strong>{fmtEuro(total, true)}</strong>
        </span>
      </div>
      {visible.length === 0 ? (
        <div style={emptyStyle}>אין קבלות {showOnlyFlagged ? 'מסומנות' : 'בחודש זה'}</div>
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
              {visible.map((inv) => (
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
              placeholder="לדוגמה: Pingo Doce"
              style={inputStyle(true)}
            />
            <datalist id="admin-suppliers">
              {FREQUENT_SUPPLIERS.map((s) => <option key={s} value={s} />)}
            </datalist>
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
