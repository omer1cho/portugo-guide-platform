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
import { supabase } from '@/lib/supabase';
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
            {snapshot.totals.pending_total > 0 && (
              <KpiCard
                label="ממתין להפקדה (כל המדריכים)"
                value={fmtEuro(snapshot.totals.pending_total)}
                variant="red"
                sub="כסף שטרם הופקד פיזית"
              />
            )}
            {snapshot.totals.missing_photos_total > 0 && (
              <KpiCard
                label="תמונות חסרות"
                value={snapshot.totals.missing_photos_total}
                variant="yellow"
                sub="סיורים בלי תמונה"
              />
            )}
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

          {/* דוח תמונות חסרות — מתקפל, מציג רק אם יש */}
          {snapshot.totals.missing_photos_total > 0 && (
            <section>
              <MissingPhotosReport snapshot={snapshot} />
            </section>
          )}

          {/* דוח קבלות חודשיות — מתקפל, מציג רק אם יש מדריכים שזכאים לקבלה */}
          <section>
            <MonthlyReceiptsReport snapshot={snapshot} onChange={handleReload} />
          </section>

          {/* דוח הפקדות שמחכות — מתקפל, מציג רק אם יש מדריכים עם סכום ממתין */}
          {snapshot.totals.pending_total > 0 && (
            <section>
              <PendingDepositsReport snapshot={snapshot} onChange={handleReload} />
            </section>
          )}

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
// דוח תמונות חסרות — מקופל כברירת מחדל; קליק פותח רשימה לפי מדריך
// ---------------------------------------------------------------------------

function MissingPhotosReport({ snapshot }: { snapshot: MonthSnapshot }) {
  const [open, setOpen] = useState(false);
  const guidesWithMissing = snapshot.guides.filter((g) => g.missing_photos > 0);

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit' });
  };

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        border: '1px solid #fff8d4',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'right',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, color: '#a37b00' }}>
          📷 תמונות חסרות החודש ({snapshot.totals.missing_photos_total})
        </span>
        <span style={{ color: ADMIN_COLORS.gray500, fontSize: 13 }}>
          {open ? '▲ הסתר.י' : '▼ הצג.י פירוט'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #fff8d4' }}>
          {guidesWithMissing.map((g) => (
            <div key={g.guide.id} style={{ marginTop: 12 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: ADMIN_COLORS.green800,
                  marginBottom: 6,
                }}
              >
                {g.guide.name} — {g.missing_photos} סיור{g.missing_photos > 1 ? 'ים' : ''}
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {g.missing_photos_list.map((t) => (
                  <li
                    key={t.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '6px 10px',
                      background: '#fffbe6',
                      borderRadius: 6,
                      fontSize: 13,
                      color: ADMIN_COLORS.gray700,
                    }}
                  >
                    <span>{t.tour_type}</span>
                    <span style={{ color: ADMIN_COLORS.gray500 }}>{formatDate(t.tour_date)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// דוח קבלות חודשיות — מי הוציא ומי לא, עם קישור לאסמכתא
// ---------------------------------------------------------------------------

function MonthlyReceiptsReport({
  snapshot,
  onChange,
}: {
  snapshot: MonthSnapshot;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);

  // אישור ידני: יוצר שורה ב-receipt_acknowledgements ללא receipt_url
  // (המשמעות: עומר אישרה שהמדריך הוציא קבלה מחוץ למערכת — אין תמונה)
  async function approveManually(guideId: string) {
    const { error } = await supabase.from('receipt_acknowledgements').insert({
      guide_id: guideId,
      year: snapshot.year,
      month: snapshot.month + 1,
    });
    if (error) {
      alert('משהו השתבש: ' + error.message);
      return;
    }
    onChange();
  }

  // רק מדריכים שיש להם משכורת לקבלה > 0 (מי שלא עבד החודש לא רלוונטי)
  const eligible = snapshot.guides.filter((g) => g.salary.receipt_amount > 0);

  if (eligible.length === 0) return null;

  const submitted = eligible.filter(
    (g) => g.receipt_ack !== null && g.receipt_ack.acknowledged_at !== null,
  );
  const missing = eligible.filter(
    (g) => g.receipt_ack === null || g.receipt_ack.acknowledged_at === null,
  );

  const headerColor = missing.length > 0 ? '#991b1b' : ADMIN_COLORS.green800;
  const borderColor = missing.length > 0 ? '#fecaca' : '#d1fae5';
  const summary =
    missing.length > 0
      ? `${missing.length} לא הוצאו · ${submitted.length} הוצאו`
      : `${submitted.length} הוצאו — הכל בסדר ✓`;

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        border: `1px solid ${borderColor}`,
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'right',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, color: headerColor }}>
          🧾 קבלות חודשיות ({summary})
        </span>
        <span style={{ color: ADMIN_COLORS.gray500, fontSize: 13 }}>
          {open ? '▲ הסתר.י' : '▼ הצג.י פירוט'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${borderColor}` }}>
          {missing.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#991b1b',
                  marginBottom: 6,
                }}
              >
                🚨 לא הוצאו ({missing.length})
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {missing.map((g) => {
                  const notified =
                    g.receipt_ack !== null && g.receipt_ack.admin_notified_at !== null;
                  return (
                    <li
                      key={g.guide.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 12px',
                        background: '#fef2f2',
                        borderRadius: 6,
                        fontSize: 14,
                        color: ADMIN_COLORS.gray700,
                      }}
                    >
                      <span style={{ fontWeight: 600 }}>{g.guide.name}</span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        {notified && (
                          <span style={{ fontSize: 11, color: '#a37b00' }}>📨 נשלחה התראה</span>
                        )}
                        <span style={{ color: '#991b1b', fontWeight: 600 }}>
                          {fmtEuro(g.salary.receipt_amount)}
                        </span>
                        <InlineConfirmButton
                          label="✓ סמן.י כהוצאה"
                          confirmLabel="בטוח.ה?"
                          onConfirm={() => approveManually(g.guide.id)}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {submitted.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: ADMIN_COLORS.green800,
                  marginBottom: 6,
                }}
              >
                ✅ הוצאו ({submitted.length})
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {submitted.map((g) => (
                  <li
                    key={g.guide.id}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '8px 12px',
                      background: '#f0fdf4',
                      borderRadius: 6,
                      fontSize: 14,
                      color: ADMIN_COLORS.gray700,
                    }}
                  >
                    <span style={{ fontWeight: 600 }}>{g.guide.name}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      {g.receipt_ack?.receipt_url ? (
                        <a
                          href={g.receipt_ack.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: 12,
                            color: '#1d4ed8',
                            textDecoration: 'underline',
                          }}
                        >
                          📷 צפי בקבלה
                        </a>
                      ) : (
                        <span style={{ fontSize: 11, color: ADMIN_COLORS.gray500 }}>
                          אישור ידני (אין תמונה)
                        </span>
                      )}
                      <span style={{ fontWeight: 600 }}>
                        {fmtEuro(g.salary.receipt_amount)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// דוח הפקדות שמחכות — מי לא הפקיד עדיין, חוצה חודשים
// ---------------------------------------------------------------------------

function PendingDepositsReport({
  snapshot,
  onChange,
}: {
  snapshot: MonthSnapshot;
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);
  const guidesWithPending = snapshot.guides
    .filter((g) => g.pending_total > 0)
    .sort((a, b) => b.pending_total - a.pending_total);

  if (guidesWithPending.length === 0) return null;

  // שחרור ידני של הפקדה: מסמן את כל ה-pending של המדריך כ-"הופקד" בלי אסמכתא
  async function settleManually(guideId: string) {
    const { error } = await supabase
      .from('transfers')
      .update({ is_pending_deposit: false })
      .eq('guide_id', guideId)
      .eq('transfer_type', 'to_portugo')
      .eq('is_pending_deposit', true);
    if (error) {
      alert('משהו השתבש: ' + error.message);
      return;
    }
    onChange();
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        border: '1px solid #fecaca',
      }}
    >
      <button
        onClick={() => setOpen(!open)}
        style={{
          width: '100%',
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'right',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <span style={{ fontSize: 16, fontWeight: 600, color: '#991b1b' }}>
          💰 הפקדות מחכות ({guidesWithPending.length} מדריכים · {fmtEuro(snapshot.totals.pending_total)})
        </span>
        <span style={{ color: ADMIN_COLORS.gray500, fontSize: 13 }}>
          {open ? '▲ הסתר.י' : '▼ הצג.י פירוט'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #fecaca' }}>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: ADMIN_COLORS.gray500, marginBottom: 8 }}>
              סכומים שצריכים להיכנס לחשבון פורטוגו (מצטבר על פני חודשים)
            </div>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
            >
              {guidesWithPending.map((g) => (
                <li
                  key={g.guide.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '8px 12px',
                    background: '#fef2f2',
                    borderRadius: 6,
                    fontSize: 14,
                    color: ADMIN_COLORS.gray700,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>{g.guide.name}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ color: '#991b1b', fontWeight: 600 }}>
                      {fmtEuro(g.pending_total)}
                    </span>
                    <InlineConfirmButton
                      label="✓ סמן.י כהופקד"
                      confirmLabel="בטוח.ה?"
                      onConfirm={() => settleManually(g.guide.id)}
                    />
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// כפתור עם אישור inline — לחיצה ראשונה הופכת לשני כפתורים (אישור/ביטול),
// לחיצה שנייה על אישור מבצעת. בלי modal, בלי confirm נטיב.
// ---------------------------------------------------------------------------

function InlineConfirmButton({
  label,
  confirmLabel,
  onConfirm,
}: {
  label: string;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (busy) {
    return (
      <span style={{ fontSize: 12, color: ADMIN_COLORS.gray500 }}>שומר...</span>
    );
  }

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        style={{
          fontSize: 11,
          padding: '4px 10px',
          background: '#fff',
          border: `1px solid ${ADMIN_COLORS.gray300}`,
          borderRadius: 6,
          cursor: 'pointer',
          color: ADMIN_COLORS.gray700,
          fontFamily: 'inherit',
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
      <button
        onClick={async () => {
          setBusy(true);
          await onConfirm();
          setBusy(false);
          setConfirming(false);
        }}
        style={{
          fontSize: 11,
          padding: '4px 10px',
          background: ADMIN_COLORS.green800,
          color: '#fff',
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {confirmLabel}
      </button>
      <button
        onClick={() => setConfirming(false)}
        style={{
          fontSize: 11,
          padding: '4px 8px',
          background: '#fff',
          border: `1px solid ${ADMIN_COLORS.gray300}`,
          borderRadius: 6,
          cursor: 'pointer',
          color: ADMIN_COLORS.gray500,
          fontFamily: 'inherit',
        }}
      >
        ✗
      </button>
    </span>
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
                <Td align="left">{fmtEuro(sal.cash_to_withdraw)}</Td>
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
