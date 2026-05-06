'use client';

/**
 * /admin/cashflow — דף ראשי של תהליך הקשפלו החודשי.
 *
 * מציג:
 *   - בחירת חודש (default: חודש קודם — כי קשפלו נעשה בתחילת החודש העוקב)
 *   - סטטוס סגירת חודש לכל מדריך פעיל (סגר/לא סגר, הוציא קבלה/לא)
 *   - היסטוריית הרצות קשפלו (אם יש כבר גרסאות לחודש הזה)
 *   - כפתור "→ הכנת קשפלו" כשכל המדריכים סגרו
 *
 * הדפים הפנימיים (prepare + generate) ייבנו בסשן הבא.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ADMIN_COLORS } from '@/lib/admin/theme';
import {
  loadGuidesCashflowStatus,
  loadCashflowRunsForMonth,
  monthNameHe,
  type CashflowGuideStatus,
  type CashflowRun,
} from '@/lib/admin/cashflow-data';

const HE_LOCALE = 'he-IL';

/** ברירת מחדל = חודש קודם (כי קשפלו רץ בתחילת החודש העוקב) */
function defaultMonth(): { year: number; month: number } {
  const now = new Date();
  let y = now.getFullYear();
  let m = now.getMonth(); // 0-11; חודש קודם
  if (m === 0) {
    y -= 1;
    m = 12;
  }
  return { year: y, month: m };
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(HE_LOCALE, { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

export default function AdminCashflowPage() {
  const [{ year, month }, setPeriod] = useState(defaultMonth());
  const [guides, setGuides] = useState<CashflowGuideStatus[]>([]);
  const [runs, setRuns] = useState<CashflowRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      loadGuidesCashflowStatus(year, month),
      loadCashflowRunsForMonth(year, month),
    ])
      .then(([g, r]) => {
        if (cancelled) return;
        setGuides(g);
        setRuns(r);
      })
      .catch((e) => !cancelled && setError(e.message || 'משהו השתבש'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [year, month]);

  const closedCount = guides.filter((g) => g.is_closed).length;
  const totalCount = guides.length;
  const allClosed = totalCount > 0 && closedCount === totalCount;

  // אפשרויות חודשים — 12 חודשים אחרונים
  const monthOptions: { year: number; month: number; label: string }[] = [];
  {
    const now = new Date();
    let y = now.getFullYear();
    let m = now.getMonth() + 1;
    for (let i = 0; i < 12; i++) {
      monthOptions.push({ year: y, month: m, label: `${monthNameHe(m)} ${y}` });
      m -= 1;
      if (m === 0) { m = 12; y -= 1; }
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }} dir="rtl">
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: ADMIN_COLORS.green900, margin: 0 }}>
          💸 קשפלו חודשי
        </h1>
        <p style={{ fontSize: 13, color: ADMIN_COLORS.gray500, margin: '4px 0 0' }}>
          הכנת גליון Excel חודשי ל-PIRO LDA — שלב 1 מתוך 3
        </p>
      </header>

      {/* בחירת חודש */}
      <section style={{
        background: '#fff',
        border: `1px solid ${ADMIN_COLORS.gray300}`,
        borderRadius: 8,
        padding: 16,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: ADMIN_COLORS.gray700 }}>
          חודש לעיבוד:
        </label>
        <select
          value={`${year}-${String(month).padStart(2, '0')}`}
          onChange={(e) => {
            const [y, m] = e.target.value.split('-').map(Number);
            setPeriod({ year: y, month: m });
          }}
          style={{
            padding: '6px 12px',
            fontSize: 13,
            borderRadius: 6,
            border: `1px solid ${ADMIN_COLORS.gray300}`,
            fontFamily: 'inherit',
            minWidth: 160,
          }}
        >
          {monthOptions.map((o) => (
            <option key={`${o.year}-${o.month}`} value={`${o.year}-${String(o.month).padStart(2, '0')}`}>
              {o.label}
            </option>
          ))}
        </select>
      </section>

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 6, color: '#991b1b', fontSize: 13 }}>
          {error}
        </div>
      )}

      {/* סטטוס מדריכים */}
      <section style={{ background: '#fff', border: `1px solid ${ADMIN_COLORS.gray300}`, borderRadius: 8, padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: ADMIN_COLORS.green900, margin: 0 }}>
            👥 סטטוס סגירת חודש
          </h2>
          <span style={{
            fontSize: 13,
            fontWeight: 600,
            color: allClosed ? ADMIN_COLORS.green700 : '#a16207',
          }}>
            {closedCount} / {totalCount} סגרו
          </span>
        </div>

        {loading ? (
          <div style={{ color: ADMIN_COLORS.gray500, padding: 16, textAlign: 'center' }}>טוענים...</div>
        ) : guides.length === 0 ? (
          <div style={{ color: ADMIN_COLORS.gray500, padding: 16, textAlign: 'center', fontSize: 13 }}>
            אין מדריכים פעילים להציג
          </div>
        ) : (
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${ADMIN_COLORS.gray300}`, textAlign: 'right', color: ADMIN_COLORS.gray700 }}>
                <th style={{ padding: '8px 6px', fontWeight: 600 }}>מדריך</th>
                <th style={{ padding: '8px 6px', fontWeight: 600 }}>עיר</th>
                <th style={{ padding: '8px 6px', fontWeight: 600 }}>סגר חודש</th>
                <th style={{ padding: '8px 6px', fontWeight: 600 }}>הוציא קבלה</th>
                <th style={{ padding: '8px 6px', fontWeight: 600 }}>משך משכורת</th>
              </tr>
            </thead>
            <tbody>
              {guides.map((g) => (
                <tr key={g.guide_id} style={{ borderBottom: `1px solid ${ADMIN_COLORS.gray100}` }}>
                  <td style={{ padding: '8px 6px', fontWeight: 600 }}>{g.guide_name}</td>
                  <td style={{ padding: '8px 6px', color: ADMIN_COLORS.gray500 }}>
                    {g.city === 'lisbon' ? 'ליסבון' : 'פורטו'}
                  </td>
                  <td style={{ padding: '8px 6px' }}>
                    {g.is_closed ? (
                      <span style={{ color: ADMIN_COLORS.green700 }}>
                        ✓ {formatDateTime(g.closed_at)}
                      </span>
                    ) : (
                      <span style={{ color: '#a16207' }}>⏳ עוד לא</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 6px' }}>
                    {g.has_receipt ? (
                      <span style={{ color: ADMIN_COLORS.green700 }}>✓</span>
                    ) : (
                      <span style={{ color: ADMIN_COLORS.gray500 }}>—</span>
                    )}
                  </td>
                  <td style={{ padding: '8px 6px', color: ADMIN_COLORS.gray700 }}>
                    {g.salary_withdrawn != null ? `${g.salary_withdrawn.toFixed(2)}€` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <div style={{ marginTop: 16, padding: 12, background: allClosed ? '#f0fdf4' : '#fffbeb', border: `1px solid ${allClosed ? '#86efac' : '#fcd34d'}`, borderRadius: 6, fontSize: 13, color: allClosed ? '#14532d' : '#78350f' }}>
          {allClosed ? (
            <>
              <strong>🎉 כל המדריכים סגרו את החודש!</strong>
              <div style={{ marginTop: 4 }}>אפשר להתחיל בהכנת הקשפלו.</div>
            </>
          ) : (
            <>
              <strong>⏳ עוד {totalCount - closedCount} מדריכים לא סגרו את החודש</strong>
              <div style={{ marginTop: 4 }}>אפשר להמשיך לקשפלו גם ככה (המערכת תכלול את מי שיש לו נתונים), אבל מומלץ להמתין.</div>
            </>
          )}
        </div>

        {/* TODO (סשן הבא): כפתור "→ הכנת קשפלו" שינווט ל-/admin/cashflow/[year]/[month]/prepare */}
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
          <button
            disabled
            title="הדף הבא ייבנה בסשן הבא — prepare + generate"
            style={{
              padding: '10px 18px',
              background: ADMIN_COLORS.gray300,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 600,
              cursor: 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            → הכנת קשפלו (בקרוב)
          </button>
        </div>
      </section>

      {/* היסטוריה */}
      <section style={{ background: '#fff', border: `1px solid ${ADMIN_COLORS.gray300}`, borderRadius: 8, padding: 16 }}>
        <h2 style={{ fontSize: 17, fontWeight: 700, color: ADMIN_COLORS.green900, margin: '0 0 12px' }}>
          📚 היסטוריית הרצות לחודש זה
        </h2>
        {loading ? (
          <div style={{ color: ADMIN_COLORS.gray500, padding: 8, textAlign: 'center', fontSize: 13 }}>טוענים...</div>
        ) : runs.length === 0 ? (
          <div style={{ color: ADMIN_COLORS.gray500, padding: 8, textAlign: 'center', fontSize: 13 }}>
            לא נוצר עדיין קשפלו לחודש זה
          </div>
        ) : (
          <table style={{ width: '100%', fontSize: 13, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${ADMIN_COLORS.gray300}`, textAlign: 'right', color: ADMIN_COLORS.gray700 }}>
                <th style={{ padding: '8px 6px', fontWeight: 600 }}>תאריך</th>
                <th style={{ padding: '8px 6px', fontWeight: 600 }}>הכנסת סיורים</th>
                <th style={{ padding: '8px 6px', fontWeight: 600 }}>סה"כ הוצאות</th>
                <th style={{ padding: '8px 6px', fontWeight: 600 }}># עסקאות</th>
                <th style={{ padding: '8px 6px', fontWeight: 600 }}>קובץ</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${ADMIN_COLORS.gray100}` }}>
                  <td style={{ padding: '8px 6px' }}>{formatDateTime(r.generated_at)}</td>
                  <td style={{ padding: '8px 6px' }}>{r.tours_income.toFixed(2)}€</td>
                  <td style={{ padding: '8px 6px' }}>{r.total_outflow.toFixed(2)}€</td>
                  <td style={{ padding: '8px 6px' }}>{r.transactions_count}</td>
                  <td style={{ padding: '8px 6px' }}>
                    {r.excel_file_url ? (
                      <a href={r.excel_file_url} download style={{ color: ADMIN_COLORS.green700, textDecoration: 'underline' }}>
                        הורד xlsx
                      </a>
                    ) : (
                      <span style={{ color: ADMIN_COLORS.gray500 }}>—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* הסבר זמני */}
      <section style={{ background: '#f9fafb', border: `1px dashed ${ADMIN_COLORS.gray300}`, borderRadius: 6, padding: 12, fontSize: 12, color: ADMIN_COLORS.gray500, lineHeight: 1.6 }}>
        <strong>שלבי הפיתוח:</strong>
        <ol style={{ margin: '6px 0 0', paddingInlineStart: 18 }}>
          <li>✅ <strong>שלב 1 (כעת):</strong> סטטוס סגירה + היסטוריה</li>
          <li>⏳ <strong>שלב 2:</strong> דף הכנה (prepare) — סקירה וסיווג קבלות, העלאת קבלות אדמין</li>
          <li>⏳ <strong>שלב 3:</strong> דף ייצור (generate) — תצוגה מקדימה + יצירת sheet חדש בקובץ</li>
        </ol>
      </section>
    </div>
  );
}
