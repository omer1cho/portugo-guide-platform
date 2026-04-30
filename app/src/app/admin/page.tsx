'use client';

/**
 * /admin — דשבורד ראשי לעומר.
 *
 * מציג: ברכת "שלום עומר", בורר חודש, KPI עליונים, כרטיסי
 * סטטוס מדריכים, וטבלת סיכום משכורות מצרפי.
 *
 * מבוסס על portugo-dashboard-v4.html (עמוד ראשי), אבל מתחבר
 * לדאטה אמיתית מ-Supabase ומשתמש ב-lib/salary.ts.
 */

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ADMIN_COLORS, fmtEuro, monthName, cityLabel } from '@/lib/admin/theme';
import { loadMonthSnapshot, type MonthSnapshot } from '@/lib/admin/data';
import KpiCard from '@/components/admin/KpiCard';
import GuideStatusCard from '@/components/admin/GuideStatusCard';
import MonthSwitcher from '@/components/admin/MonthSwitcher';

function AdminMainContent() {
  const searchParams = useSearchParams();
  const now = new Date();
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : now.getFullYear();
  const month = searchParams.get('month')
    ? parseInt(searchParams.get('month')!) - 1
    : now.getMonth();
  const cityFilter = (searchParams.get('city') as 'all' | 'lisbon' | 'porto') || 'all';

  const [snapshot, setSnapshot] = useState<MonthSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    loadMonthSnapshot(year, month, { cityFilter })
      .then((data) => {
        if (!cancelled) setSnapshot(data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'משהו השתבש בטעינה');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [year, month, cityFilter, reloadCounter]);

  const handleReload = () => setReloadCounter((c) => c + 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: ADMIN_COLORS.green800, margin: 0 }}>
            שלום עומר 👋
          </h1>
          <p style={{ fontSize: 14, color: ADMIN_COLORS.gray500, marginTop: 4 }}>
            סיכום {monthName(year, month)} — כל המדריכים במבט אחד
          </p>
        </div>
        <MonthSwitcher year={year} month={month} />
      </header>

      {loading && (
        <div
          style={{
            background: '#fff',
            borderRadius: 12,
            padding: 60,
            textAlign: 'center',
            color: ADMIN_COLORS.gray500,
          }}
        >
          טוענת נתונים...
        </div>
      )}

      {error && (
        <div
          style={{
            background: '#fee2e2',
            border: '1px solid #fca5a5',
            color: '#991b1b',
            borderRadius: 12,
            padding: 16,
          }}
        >
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && snapshot && (
        <>
          {/* KPIs עליונים */}
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
            }}
          >
            <KpiCard label="סה״כ סיורים" value={snapshot.totals.tours} />
            <KpiCard label="סה״כ משתתפים" value={snapshot.totals.people.toLocaleString('he-IL')} />
            <KpiCard
              label="סה״כ קופה (כל המדריכים)"
              value={fmtEuro(snapshot.totals.cash_collected)}
              sub="כסף שנאסף בסיורים"
            />
            <KpiCard
              label="סה״כ הוצאות"
              value={fmtEuro(snapshot.totals.expenses)}
              variant="red"
              sub="ששילמו המדריכים"
            />
            <KpiCard
              label="סה״כ משכורות"
              value={fmtEuro(snapshot.totals.salary_total_with_tips)}
              sub="כולל טיפים"
            />
            <KpiCard
              label="להעברה לפורטוגו"
              value={fmtEuro(snapshot.totals.salary_to_pay)}
              sub="מה שצריך לשלם בנטו"
            />
          </section>

          {/* סטטוס מדריכים */}
          <section>
            <SectionHeader
              title="המדריכים החודש"
              subtitle={`${snapshot.totals.closed_count} סגרו · ${snapshot.totals.open_count} פתוחים · ${snapshot.guides.length - snapshot.totals.closed_count - snapshot.totals.open_count} בלי פעילות`}
            />
            {snapshot.guides.length === 0 ? (
              <EmptyState message="אין מדריכים פעילים החודש" />
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 16,
                }}
              >
                {snapshot.guides.map((s) => (
                  <GuideStatusCard key={s.guide.id} summary={s} onChange={handleReload} />
                ))}
              </div>
            )}
          </section>

          {/* טבלת סיכום משכורות */}
          {snapshot.guides.length > 0 && (
            <section>
              <SectionHeader title="סיכום משכורות מפורט" />
              <SalaryTable snapshot={snapshot} />
            </section>
          )}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components (inline — שימוש פעם אחת)
// ---------------------------------------------------------------------------

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <h2 style={{ fontSize: 20, fontWeight: 700, color: ADMIN_COLORS.green800, margin: 0 }}>
        {title}
      </h2>
      {subtitle && (
        <p style={{ fontSize: 13, color: ADMIN_COLORS.gray500, marginTop: 4 }}>{subtitle}</p>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 40,
        textAlign: 'center',
        color: ADMIN_COLORS.gray500,
      }}
    >
      {message}
    </div>
  );
}

function SalaryTable({ snapshot }: { snapshot: MonthSnapshot }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        overflowX: 'auto',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ background: ADMIN_COLORS.green25 }}>
            <Th>מדריך.ה</Th>
            <Th>עיר</Th>
            <Th align="center">סיורים</Th>
            <Th align="center">משתתפים</Th>
            <Th align="center">ימים</Th>
            <Th align="left">קלאסי</Th>
            <Th align="left">קבוע</Th>
            <Th align="left">פרטי</Th>
            <Th align="left">טיפים</Th>
            <Th align="left">אשל</Th>
            <Th align="left">נסיעות</Th>
            <Th align="left">הכשרות</Th>
            <Th align="left">סה"כ</Th>
            <Th align="left">להעברה</Th>
            <Th>סטטוס</Th>
          </tr>
        </thead>
        <tbody>
          {snapshot.guides.map((s, idx) => {
            const sal = s.salary;
            const trainings = sal.training + sal.training_lead;
            return (
              <tr
                key={s.guide.id}
                style={{
                  background: idx % 2 === 0 ? '#fff' : ADMIN_COLORS.gray50,
                  borderBottom: `1px solid ${ADMIN_COLORS.gray100}`,
                }}
              >
                <Td bold>{s.guide.name}</Td>
                <Td>{cityLabel(s.guide.city)}</Td>
                <Td align="center">{s.tours_count}</Td>
                <Td align="center">{s.people_count}</Td>
                <Td align="center">{sal.work_days}</Td>
                <Td align="left">{fmtEuro(sal.classic_income)}</Td>
                <Td align="left">{fmtEuro(sal.fixed_salaries)}</Td>
                <Td align="left">{fmtEuro(sal.private_salaries)}</Td>
                <Td align="left">{fmtEuro(sal.non_classic_tips)}</Td>
                <Td align="left">{fmtEuro(sal.eshel)}</Td>
                <Td align="left">{fmtEuro(sal.travel)}</Td>
                <Td align="left">{fmtEuro(trainings)}</Td>
                <Td align="left" bold>
                  {fmtEuro(sal.total_with_tips)}
                </Td>
                <Td align="left">{fmtEuro(sal.transfer_amount)}</Td>
                <Td>
                  <StatusPill status={s.status} />
                </Td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr
            style={{
              background: ADMIN_COLORS.green25,
              borderTop: `2px solid ${ADMIN_COLORS.green700}`,
              fontWeight: 700,
            }}
          >
            <Td bold>סה"כ</Td>
            <Td>—</Td>
            <Td align="center">{snapshot.totals.tours}</Td>
            <Td align="center">{snapshot.totals.people}</Td>
            <Td align="center">—</Td>
            <Td align="left">
              {fmtEuro(snapshot.guides.reduce((s, x) => s + x.salary.classic_income, 0))}
            </Td>
            <Td align="left">
              {fmtEuro(snapshot.guides.reduce((s, x) => s + x.salary.fixed_salaries, 0))}
            </Td>
            <Td align="left">
              {fmtEuro(snapshot.guides.reduce((s, x) => s + x.salary.private_salaries, 0))}
            </Td>
            <Td align="left">
              {fmtEuro(snapshot.guides.reduce((s, x) => s + x.salary.non_classic_tips, 0))}
            </Td>
            <Td align="left">{fmtEuro(snapshot.guides.reduce((s, x) => s + x.salary.eshel, 0))}</Td>
            <Td align="left">
              {fmtEuro(snapshot.guides.reduce((s, x) => s + x.salary.travel, 0))}
            </Td>
            <Td align="left">
              {fmtEuro(
                snapshot.guides.reduce(
                  (s, x) => s + x.salary.training + x.salary.training_lead,
                  0,
                ),
              )}
            </Td>
            <Td align="left" bold>
              {fmtEuro(snapshot.totals.salary_total_with_tips)}
            </Td>
            <Td align="left" bold>
              {fmtEuro(snapshot.totals.salary_to_pay)}
            </Td>
            <Td>—</Td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function Th({
  children,
  align = 'right',
}: {
  children: React.ReactNode;
  align?: 'right' | 'left' | 'center';
}) {
  return (
    <th
      style={{
        padding: '12px 8px',
        textAlign: align,
        color: ADMIN_COLORS.green800,
        fontWeight: 600,
        fontSize: 13,
        borderBottom: `2px solid ${ADMIN_COLORS.green700}`,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = 'right',
  bold,
}: {
  children: React.ReactNode;
  align?: 'right' | 'left' | 'center';
  bold?: boolean;
}) {
  return (
    <td
      style={{
        padding: '10px 8px',
        textAlign: align,
        color: ADMIN_COLORS.gray700,
        fontWeight: bold ? 600 : 400,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </td>
  );
}

function StatusPill({ status }: { status: 'empty' | 'open' | 'closed' | 'awaiting_deposit' }) {
  const map = {
    empty: { label: 'בלי פעילות', bg: ADMIN_COLORS.gray100, color: ADMIN_COLORS.gray500 },
    open: { label: 'פתוח', bg: ADMIN_COLORS.green25, color: ADMIN_COLORS.green700 },
    closed: { label: 'סגור', bg: ADMIN_COLORS.gray50, color: ADMIN_COLORS.gray700 },
    awaiting_deposit: { label: 'מחכה להפקדה', bg: '#fff8d4', color: '#a37b00' },
  } as const;
  const m = map[status];
  return (
    <span
      style={{
        padding: '4px 8px',
        borderRadius: 999,
        background: m.bg,
        color: m.color,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {m.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page wrapper (Suspense for searchParams)
// ---------------------------------------------------------------------------

export default function AdminMainPage() {
  return (
    <Suspense
      fallback={
        <div style={{ color: '#6b7280', textAlign: 'center', padding: 40 }}>טוענת...</div>
      }
    >
      <AdminMainContent />
    </Suspense>
  );
}
