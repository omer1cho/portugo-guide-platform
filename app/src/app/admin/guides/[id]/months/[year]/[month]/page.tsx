'use client';

/**
 * /admin/guides/[id]/months/[year]/[month] — דף סגירה היסטורית.
 *
 * מציג את "הסיפור" המלא של חודש מסוים אצל מדריך מסוים:
 *   1. סיכום משכורת (לפי הקונפיגורציה הנוכחית של המדריך)
 *   2. ביצוע הסגירה — צפוי מול בפועל, עם הדגשת פערים
 *   3. כל ה-transfers של החודש
 *   4. כל ה-expenses של החודש
 *   5. יתרות מעטפות + main box (start → end)
 *
 * הדף הוא read-only — רק קריאה. אם יש פער, האדמין צריך לבדוק ידנית.
 *
 * הצורך הזה נולד בסשן 6.5.26 כשעומר תפסה באג בסגירת מני באפריל ולא
 * הצליחה לראות את ההיסטוריה. ראי `memory/session_handoff_2026-05-06.md`.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ADMIN_COLORS, fmtEuro, monthName, cityLabel } from '@/lib/admin/theme';
import {
  loadGuideMonthDetail,
  transferTypeLabel,
  type GuideMonthDetail,
  type TransferRow,
  type ExpenseRow,
} from '@/lib/admin/guide-month-detail';

const TOLERANCE = 0.5; // פער קטן יותר מ-0.5€ נחשב "תואם" (עיגולים)

export default function GuideMonthHistoryPage() {
  const params = useParams<{ id: string; year: string; month: string }>();
  const router = useRouter();
  const id = params.id;
  const year = parseInt(params.year, 10);
  const monthDb = parseInt(params.month, 10); // 1-indexed ב-URL
  const month = monthDb - 1; // 0-indexed פנימי

  const [detail, setDetail] = useState<GuideMonthDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setNotFound(false);
    loadGuideMonthDetail(id, year, month)
      .then((d) => {
        if (cancelled) return;
        if (!d) setNotFound(true);
        else setDetail(d);
      })
      .catch((e) => !cancelled && setError(e?.message || 'משהו השתבש'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [id, year, month]);

  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', color: ADMIN_COLORS.gray500 }}>טוענת...</div>;
  }
  if (notFound) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: ADMIN_COLORS.gray700 }}>מדריך לא נמצא</div>
        <button onClick={() => router.back()} style={btnSecondaryStyle as React.CSSProperties}>← חזרה</button>
      </div>
    );
  }
  if (error || !detail) {
    return (
      <div style={{ padding: 16, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, color: '#991b1b' }}>
        ⚠️ {error || 'לא הצלחנו לטעון את החודש'}
      </div>
    );
  }

  const monthLabel = monthName(year, month);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }} dir="rtl">
      {/* Header */}
      <header>
        <button
          onClick={() => router.back()}
          style={{
            background: 'transparent',
            border: 'none',
            color: ADMIN_COLORS.gray500,
            fontSize: 13,
            cursor: 'pointer',
            padding: 0,
            marginBottom: 8,
            fontFamily: 'inherit',
          }}
        >
          ← חזרה
        </button>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: ADMIN_COLORS.green900, margin: 0 }}>
            {detail.guide.name} — {monthLabel}
          </h1>
          <StatusBadge detail={detail} />
        </div>
        <p style={{ fontSize: 13, color: ADMIN_COLORS.gray500, margin: '4px 0 0' }}>
          {cityLabel(detail.guide.city)}
          {detail.guide.has_vat && ' · חייב מע"מ'}
          {detail.is_closed && detail.closed_at && ` · נסגר ${new Date(detail.closed_at).toLocaleDateString('he-IL')}`}
        </p>
      </header>

      {!detail.has_data && (
        <div style={infoBoxStyle}>
          אין נתונים לחודש הזה אצל המדריך.
        </div>
      )}

      {detail.has_data && (
        <>
          {/* Section 1: סיכום משכורת */}
          <SalarySection detail={detail} />

          {/* Section 2: ביצוע סגירה — Expected vs Actual */}
          <ClosingSection detail={detail} />

          {/* Section 3: העברות */}
          <TransfersSection detail={detail} />

          {/* Section 4: הוצאות */}
          <ExpensesSection detail={detail} />

          {/* Section 5: יתרות */}
          <BalancesSection detail={detail} />
        </>
      )}
    </div>
  );
}

// ===========================================================================
// Status badge
// ===========================================================================

function StatusBadge({ detail }: { detail: GuideMonthDetail }) {
  if (!detail.has_data) {
    return <Badge color={ADMIN_COLORS.gray500} bg={ADMIN_COLORS.gray100} label="אין נתונים" />;
  }
  if (detail.is_closed) {
    return <Badge color={ADMIN_COLORS.green700} bg={ADMIN_COLORS.green25} label="✓ נסגר" />;
  }
  return <Badge color="#a16207" bg="#fef3c7" label="⏳ פתוח" />;
}

function Badge({ color, bg, label }: { color: string; bg: string; label: string }) {
  return (
    <span
      style={{
        background: bg,
        color,
        fontSize: 12,
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: 999,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </span>
  );
}

// ===========================================================================
// Section: Salary breakdown
// ===========================================================================

function SalarySection({ detail }: { detail: GuideMonthDetail }) {
  const s = detail.salary;
  const rows: { label: string; amount: number; hint?: string }[] = [];

  if (s.classic_income !== 0) {
    rows.push({
      label: 'שכר מקלאסי',
      amount: s.classic_income,
      hint: `בסיס ${fmtEuro(s.classic_base, true)} + טיפים ${fmtEuro(s.classic_income - s.classic_base, true)}`,
    });
  }
  if (s.fixed_salaries > 0) rows.push({ label: 'שכר סיורים קבועים', amount: s.fixed_salaries });
  if (s.private_salaries > 0) rows.push({ label: 'שכר סיורים פרטיים', amount: s.private_salaries });
  if (s.non_classic_tips > 0) rows.push({ label: 'טיפים (לא קלאסי)', amount: s.non_classic_tips });
  if (s.eshel > 0) rows.push({ label: `אשל יומי (${s.eshel_days} ימים)`, amount: s.eshel });
  if (s.habraza > 0) rows.push({ label: 'הברזה בכיכר', amount: s.habraza });
  if (s.training > 0) rows.push({ label: 'פעילות הכשרה', amount: s.training });
  if (s.training_lead > 0) rows.push({ label: 'הכשרות שהעבירה', amount: s.training_lead });
  for (const ext of detail.external_activities) {
    rows.push({ label: ext.description, amount: ext.amount });
  }
  if (s.travel > 0) {
    rows.push({
      label: detail.guide.travel_type === 'monthly' ? 'נסיעות (חודשי)' : 'נסיעות (יומי)',
      amount: s.travel,
    });
  }
  if (s.management > 0) rows.push({ label: 'רכיב ניהול', amount: s.management });

  return (
    <Section icon="💰" title="חישוב משכורת">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
              <span style={{ color: ADMIN_COLORS.gray700 }}>{r.label}</span>
              <span style={{ fontWeight: 600 }}>{fmtEuro(r.amount, true)}</span>
            </div>
            {r.hint && <div style={{ fontSize: 11, color: ADMIN_COLORS.gray500, paddingRight: 4 }}>{r.hint}</div>}
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 14,
          padding: 12,
          background: ADMIN_COLORS.green25,
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <RowBetween label="סה״כ עם טיפים" value={fmtEuro(s.total_with_tips, true)} bold />
        <RowBetween
          label="סה״כ למשיכה מהקופה (cash_to_withdraw)"
          value={fmtEuro(s.cash_to_withdraw)}
          bold
          hint={s.vat_amount > 0 ? `כולל מע״מ ${fmtEuro(s.vat_amount, true)}` : 'מעוגל מעלה ליורו'}
        />
      </div>

      {s.receipt_amount > 0 && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            background: '#eff6ff',
            border: '1px solid #bfdbfe',
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <RowBetween label="סכום לקבלה" value={fmtEuro(s.receipt_amount, true)} bold />
          {s.vat_amount > 0 && (
            <>
              <RowBetween label='מע"מ (23%)' value={fmtEuro(s.vat_amount, true)} small />
              <RowBetween label="קבלה כולל מע״מ" value={fmtEuro(s.receipt_with_vat, true)} bold />
            </>
          )}
        </div>
      )}
    </Section>
  );
}

// ===========================================================================
// Section: Closing — expected vs actual (THE KEY SECTION)
// ===========================================================================

function ClosingSection({ detail }: { detail: GuideMonthDetail }) {
  const e = detail.expected;
  const a = detail.actual;

  type ComparisonRow = {
    label: string;
    expected: number;
    actual: number;
    icon?: string;
  };

  const rows: ComparisonRow[] = [
    { label: 'משיכת משכורת', expected: e.take_from_box, actual: a.salary_withdrawn, icon: '💰' },
    { label: 'חיזוק מעטפת הוצאות', expected: e.expenses_refill, actual: a.expenses_refill, icon: '📩' },
    { label: 'חיזוק מעטפת עודף', expected: e.change_refill, actual: a.change_refill, icon: '🪙' },
    { label: 'הפקדה לפורטוגו', expected: e.deposit_to_portugo, actual: a.to_portugo + a.pending_deposit, icon: '🏦' },
    { label: 'השלמה מפורטוגו', expected: e.from_portugo, actual: a.from_portugo, icon: '💚' },
  ];

  // אם הכל אפס בשני הצדדים — לא להציג שורה
  const visibleRows = rows.filter((r) => Math.abs(r.expected) > 0.01 || Math.abs(r.actual) > 0.01);

  const hasAnyDiff = visibleRows.some((r) => Math.abs(r.expected - r.actual) > TOLERANCE);

  return (
    <Section
      icon="🎯"
      title="ביצוע סגירת חודש"
      subtitle={
        detail.is_closed
          ? hasAnyDiff
            ? '⚠️ יש פערים בין הצפוי לבין מה שנרשם'
            : '✓ הכל תואם — אין פערים'
          : 'החודש עוד לא נסגר. הצפוי = מה שיופיע ב-/close-month של המדריך.'
      }
      subtitleColor={
        !detail.is_closed ? '#a16207' : hasAnyDiff ? ADMIN_COLORS.red : ADMIN_COLORS.green700
      }
    >
      {visibleRows.length === 0 ? (
        <div style={{ color: ADMIN_COLORS.gray500, fontSize: 13 }}>אין פעולות סגירה צפויות החודש.</div>
      ) : (
        <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${ADMIN_COLORS.gray300}`, textAlign: 'right', color: ADMIN_COLORS.gray500, fontSize: 12 }}>
              <th style={{ padding: '8px 6px', fontWeight: 600 }}>פעולה</th>
              <th style={{ padding: '8px 6px', fontWeight: 600, textAlign: 'left' }}>צפוי</th>
              <th style={{ padding: '8px 6px', fontWeight: 600, textAlign: 'left' }}>בפועל</th>
              <th style={{ padding: '8px 6px', fontWeight: 600, textAlign: 'left' }}>פער</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r, i) => (
              <ComparisonRow key={i} {...r} />
            ))}
          </tbody>
        </table>
      )}

      {/* Admin top-ups (אם היו) — מוצגים בנפרד כי הם תיקונים ידניים */}
      {(a.admin_topup_change > 0.01 || a.admin_topup_expenses > 0.01) && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: '#fefce8',
            border: '1px solid #fde68a',
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: 4 }}>🔧 שיפויים ידניים החודש</div>
          {a.admin_topup_change > 0.01 && (
            <div>שיפוי מעטפת עודף: <strong>{fmtEuro(a.admin_topup_change, true)}</strong></div>
          )}
          {a.admin_topup_expenses > 0.01 && (
            <div>שיפוי מעטפת הוצאות: <strong>{fmtEuro(a.admin_topup_expenses, true)}</strong></div>
          )}
        </div>
      )}

      {/* Pending deposit warning */}
      {a.pending_deposit > 0.01 && (
        <div
          style={{
            marginTop: 12,
            padding: 10,
            background: '#fef3c7',
            border: '1px solid #fcd34d',
            borderRadius: 6,
            fontSize: 13,
            color: '#78350f',
          }}
        >
          ⏳ {fmtEuro(a.pending_deposit, true)} ב<strong>מעטפת המתנה</strong> — המדריך עוד לא הפקיד פיזית.
        </div>
      )}
    </Section>
  );
}

function ComparisonRow({
  label,
  expected,
  actual,
  icon,
}: {
  label: string;
  expected: number;
  actual: number;
  icon?: string;
}) {
  const diff = actual - expected;
  const isMatch = Math.abs(diff) <= TOLERANCE;
  const diffColor = isMatch ? ADMIN_COLORS.gray500 : ADMIN_COLORS.red;
  const diffSign = diff > 0 ? '+' : '';

  return (
    <tr style={{ borderBottom: `1px solid ${ADMIN_COLORS.gray100}` }}>
      <td style={{ padding: '10px 6px', color: ADMIN_COLORS.gray700 }}>
        {icon} {label}
      </td>
      <td style={{ padding: '10px 6px', textAlign: 'left', fontVariantNumeric: 'tabular-nums' }}>
        {fmtEuro(expected, true)}
      </td>
      <td
        style={{
          padding: '10px 6px',
          textAlign: 'left',
          fontVariantNumeric: 'tabular-nums',
          fontWeight: isMatch ? 400 : 700,
          color: isMatch ? ADMIN_COLORS.gray700 : ADMIN_COLORS.red,
        }}
      >
        {fmtEuro(actual, true)}
      </td>
      <td
        style={{
          padding: '10px 6px',
          textAlign: 'left',
          fontVariantNumeric: 'tabular-nums',
          color: diffColor,
          fontWeight: isMatch ? 400 : 600,
        }}
      >
        {isMatch ? '✓' : `${diffSign}${diff.toFixed(2)}€`}
      </td>
    </tr>
  );
}

// ===========================================================================
// Section: Transfers
// ===========================================================================

function TransfersSection({ detail }: { detail: GuideMonthDetail }) {
  const transfers = detail.transfers;
  if (transfers.length === 0) {
    return (
      <Section icon="💸" title="העברות">
        <div style={{ color: ADMIN_COLORS.gray500, fontSize: 13 }}>אין העברות בחודש זה.</div>
      </Section>
    );
  }

  return (
    <Section icon="💸" title={`העברות בחודש (${transfers.length})`}>
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${ADMIN_COLORS.gray300}`, textAlign: 'right', color: ADMIN_COLORS.gray500, fontSize: 12 }}>
            <th style={{ padding: '8px 6px', fontWeight: 600 }}>תאריך</th>
            <th style={{ padding: '8px 6px', fontWeight: 600 }}>סוג</th>
            <th style={{ padding: '8px 6px', fontWeight: 600, textAlign: 'left' }}>סכום</th>
            <th style={{ padding: '8px 6px', fontWeight: 600 }}>הערה</th>
          </tr>
        </thead>
        <tbody>
          {transfers.map((t) => (
            <TransferRowDisplay key={t.id} t={t} />
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function TransferRowDisplay({ t }: { t: TransferRow }) {
  const { label, icon } = transferTypeLabel(t.transfer_type);
  return (
    <tr style={{ borderBottom: `1px solid ${ADMIN_COLORS.gray100}` }}>
      <td style={{ padding: '8px 6px', color: ADMIN_COLORS.gray700, whiteSpace: 'nowrap' }}>
        {new Date(t.transfer_date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}
      </td>
      <td style={{ padding: '8px 6px', color: ADMIN_COLORS.gray700 }}>
        {icon} {label}
        {t.is_pending_deposit && (
          <span style={{ marginRight: 6, fontSize: 11, color: '#a16207' }}>(ממתין)</span>
        )}
      </td>
      <td style={{ padding: '8px 6px', textAlign: 'left', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {fmtEuro(t.amount, true)}
      </td>
      <td style={{ padding: '8px 6px', color: ADMIN_COLORS.gray500, fontSize: 12 }}>
        {t.notes || '—'}
      </td>
    </tr>
  );
}

// ===========================================================================
// Section: Expenses
// ===========================================================================

function ExpensesSection({ detail }: { detail: GuideMonthDetail }) {
  const expenses = detail.expenses;
  if (expenses.length === 0) {
    return (
      <Section icon="🧾" title="הוצאות">
        <div style={{ color: ADMIN_COLORS.gray500, fontSize: 13 }}>אין הוצאות בחודש זה.</div>
      </Section>
    );
  }
  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);

  return (
    <Section icon="🧾" title={`הוצאות בחודש (${expenses.length})`} subtitle={`סה״כ ${fmtEuro(total, true)}`}>
      <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${ADMIN_COLORS.gray300}`, textAlign: 'right', color: ADMIN_COLORS.gray500, fontSize: 12 }}>
            <th style={{ padding: '8px 6px', fontWeight: 600 }}>תאריך</th>
            <th style={{ padding: '8px 6px', fontWeight: 600 }}>פריט</th>
            <th style={{ padding: '8px 6px', fontWeight: 600 }}>סיור</th>
            <th style={{ padding: '8px 6px', fontWeight: 600, textAlign: 'left' }}>סכום</th>
            <th style={{ padding: '8px 6px', fontWeight: 600 }}>קבלה</th>
          </tr>
        </thead>
        <tbody>
          {expenses.map((e) => (
            <ExpenseRowDisplay key={e.id} e={e} />
          ))}
        </tbody>
      </table>
    </Section>
  );
}

function ExpenseRowDisplay({ e }: { e: ExpenseRow }) {
  return (
    <tr style={{ borderBottom: `1px solid ${ADMIN_COLORS.gray100}` }}>
      <td style={{ padding: '8px 6px', color: ADMIN_COLORS.gray700, whiteSpace: 'nowrap' }}>
        {new Date(e.expense_date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' })}
      </td>
      <td style={{ padding: '8px 6px', color: ADMIN_COLORS.gray700 }}>
        {e.item}
        {e.supplier_name && (
          <span style={{ marginRight: 6, fontSize: 11, color: ADMIN_COLORS.gray500 }}>
            ({e.supplier_name})
          </span>
        )}
        {e.is_admin_added && (
          <span style={{ marginRight: 6, fontSize: 11, color: '#1e6091' }}>🔧 אדמין</span>
        )}
      </td>
      <td style={{ padding: '8px 6px', color: ADMIN_COLORS.gray500, fontSize: 12 }}>
        {e.tour_type || '—'}
      </td>
      <td style={{ padding: '8px 6px', textAlign: 'left', fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>
        {fmtEuro(e.amount, true)}
      </td>
      <td style={{ padding: '8px 6px' }}>
        {e.receipt_url ? (
          <a
            href={e.receipt_url}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: ADMIN_COLORS.green700, textDecoration: 'underline', fontSize: 12 }}
          >
            פתחי
          </a>
        ) : (
          <span style={{ color: ADMIN_COLORS.gray500, fontSize: 12 }}>—</span>
        )}
      </td>
    </tr>
  );
}

// ===========================================================================
// Section: Balances start → end
// ===========================================================================

function BalancesSection({ detail }: { detail: GuideMonthDetail }) {
  const b = detail.envelope_balances;
  return (
    <Section icon="📊" title="יתרות (תחילת חודש → סוף חודש)">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <BalanceCard
          icon="🪙"
          label="מעטפת עודף"
          start={b.change_start}
          end={b.change_end}
          target={detail.guide.target_change_balance ?? 100}
        />
        <BalanceCard
          icon="📩"
          label="מעטפת הוצאות"
          start={b.expenses_start}
          end={b.expenses_end}
          target={detail.guide.target_expenses_balance ?? 150}
        />
      </div>

      {/* Main box — תמיד מציגים גם אם 0 */}
      <div
        style={{
          marginTop: 12,
          padding: 12,
          background: ADMIN_COLORS.gray50,
          border: `1px solid ${ADMIN_COLORS.gray100}`,
          borderRadius: 8,
        }}
      >
        <div style={{ fontSize: 12, color: ADMIN_COLORS.gray500, marginBottom: 4 }}>
          🏦 קופה ראשית — יתרה בסוף החודש
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: Math.abs(detail.main_box_end) < TOLERANCE ? ADMIN_COLORS.gray500 : ADMIN_COLORS.gray900,
          }}
        >
          {fmtEuro(detail.main_box_end, true)}
        </div>
        {Math.abs(detail.main_box_end) > TOLERANCE && detail.is_closed && (
          <div style={{ fontSize: 12, color: '#a16207', marginTop: 4 }}>
            ⚠️ אחרי סגירה הקופה אמורה להתאפס. יתרה לא-אפס מצביעה על פער.
          </div>
        )}
      </div>

      {/* Opening balances — לעזרה לדיבאג */}
      <details style={{ marginTop: 12, fontSize: 12, color: ADMIN_COLORS.gray500 }}>
        <summary style={{ cursor: 'pointer' }}>פרטים נוספים — יתרות פתיחה היסטוריות</summary>
        <div style={{ marginTop: 8, paddingRight: 12, lineHeight: 1.7 }}>
          <div>opening_change_balance: {fmtEuro(detail.guide.opening_change_balance ?? 0, true)}</div>
          <div>opening_expenses_balance: {fmtEuro(detail.guide.opening_expenses_balance ?? 0, true)}</div>
          <div>change_given בחודש: {fmtEuro(detail.change_given_in_month, true)}</div>
          <div>expenses בחודש: {fmtEuro(detail.expenses_total, true)}</div>
        </div>
      </details>
    </Section>
  );
}

function BalanceCard({
  icon,
  label,
  start,
  end,
  target,
}: {
  icon: string;
  label: string;
  start: number;
  end: number;
  target: number;
}) {
  const matchesTarget = target > 0 && Math.abs(end - target) <= TOLERANCE;
  return (
    <div
      style={{
        padding: 12,
        background: '#fff',
        border: `1px solid ${ADMIN_COLORS.gray100}`,
        borderRadius: 8,
      }}
    >
      <div style={{ fontSize: 12, color: ADMIN_COLORS.gray500, marginBottom: 6 }}>
        {icon} {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, fontVariantNumeric: 'tabular-nums' }}>
        <span style={{ fontSize: 14, color: ADMIN_COLORS.gray500 }}>{fmtEuro(start, true)}</span>
        <span style={{ color: ADMIN_COLORS.gray300 }}>→</span>
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            color: matchesTarget ? ADMIN_COLORS.green700 : ADMIN_COLORS.gray900,
          }}
        >
          {fmtEuro(end, true)}
        </span>
      </div>
      {target > 0 && (
        <div style={{ fontSize: 11, color: ADMIN_COLORS.gray500, marginTop: 4 }}>
          יעד: {fmtEuro(target)}
          {matchesTarget && <span style={{ color: ADMIN_COLORS.green700, marginRight: 4 }}>✓</span>}
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// Reusable section wrapper
// ===========================================================================

function Section({
  icon,
  title,
  subtitle,
  subtitleColor,
  children,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  subtitleColor?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        background: '#fff',
        border: `1px solid ${ADMIN_COLORS.gray300}`,
        borderRadius: 12,
        padding: 18,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, color: ADMIN_COLORS.green900, margin: 0 }}>
          {icon} {title}
        </h2>
        {subtitle && (
          <p style={{ fontSize: 12, color: subtitleColor || ADMIN_COLORS.gray500, margin: '4px 0 0' }}>
            {subtitle}
          </p>
        )}
      </div>
      {children}
    </section>
  );
}

function RowBetween({
  label,
  value,
  bold = false,
  small = false,
  hint,
}: {
  label: string;
  value: string;
  bold?: boolean;
  small?: boolean;
  hint?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: small ? 12 : 14,
          fontWeight: bold ? 700 : 400,
          color: ADMIN_COLORS.gray900,
        }}
      >
        <span>{label}</span>
        <span style={{ fontVariantNumeric: 'tabular-nums' }}>{value}</span>
      </div>
      {hint && <div style={{ fontSize: 11, color: ADMIN_COLORS.gray500 }}>{hint}</div>}
    </div>
  );
}

const infoBoxStyle: React.CSSProperties = {
  padding: 16,
  background: '#fff',
  border: `1px solid ${ADMIN_COLORS.gray300}`,
  borderRadius: 8,
  textAlign: 'center',
  color: ADMIN_COLORS.gray500,
};

const btnSecondaryStyle: React.CSSProperties = {
  background: '#fff',
  color: ADMIN_COLORS.gray700,
  border: `1px solid ${ADMIN_COLORS.gray300}`,
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
  marginTop: 16,
};
