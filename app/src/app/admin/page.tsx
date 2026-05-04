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
import { useRouter, useSearchParams } from 'next/navigation';
import { ADMIN_COLORS, fmtEuro, monthName, cityLabel } from '@/lib/admin/theme';
import { loadMonthSnapshot, loadOutstandingMonthlyReceipts, type MonthSnapshot, type OutstandingReceipt } from '@/lib/admin/data';
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
  const [prevSnapshot, setPrevSnapshot] = useState<MonthSnapshot | null>(null);
  const [outstandingReceipts, setOutstandingReceipts] = useState<OutstandingReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    // החודש הקודם — לחישוב השוואות
    const prevY = month === 0 ? year - 1 : year;
    const prevM = month === 0 ? 11 : month - 1;

    // השוואה הוגנת: אם המוצג הוא החודש הנוכחי, נשווה רק עד היום הנוכחי
    // (1-3 במאי מול 1-3 באפריל, לא מול כל אפריל). אחרת — חודש מלא.
    const today = new Date();
    const isCurrentMonth = year === today.getFullYear() && month === today.getMonth();
    const dayLimit = isCurrentMonth ? today.getDate() : undefined;

    Promise.all([
      loadMonthSnapshot(year, month, { cityFilter, dayLimit }),
      loadMonthSnapshot(prevY, prevM, { cityFilter, dayLimit }),
      loadOutstandingMonthlyReceipts({ cityFilter }),
    ])
      .then(([current, prev, outstanding]) => {
        if (cancelled) return;
        setSnapshot(current);
        setPrevSnapshot(prev);
        setOutstandingReceipts(outstanding);
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

  // === Helpers להשוואה לחודש קודם ===
  function pctChange(current: number, prev: number): number | null {
    if (prev === 0) return current === 0 ? 0 : null; // לא מציגים אם הקודם 0 (אין בסיס)
    return ((current - prev) / prev) * 100;
  }

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
          {/* ─── שכבה 1: 🚨 Inbox — מה צריך תשומת לב עכשיו ─── */}
          <InboxAlerts
            snapshot={snapshot}
            isCurrentMonth={year === now.getFullYear() && month === now.getMonth()}
            outstandingReceipts={outstandingReceipts}
          />

          {/* ─── שכבה 2: 📊 Pulse — KPIs מרכזיים עם השוואה לחודש קודם ─── */}
          <section>
            <SectionHeader title="📊 איך אנחנו החודש" subtitle="השוואה לחודש הקודם" />
            <div
              data-kpi-grid
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 16,
              }}
            >
              <KpiCard
                label="🎫 סיורים"
                value={snapshot.totals.tours}
                delta={prevSnapshot ? pctChange(snapshot.totals.tours, prevSnapshot.totals.tours) : null}
                deltaLabel="מהחודש הקודם"
                sub={prevSnapshot ? `קודם: ${prevSnapshot.totals.tours}` : undefined}
              />
              <KpiCard
                label="👥 משתתפים"
                value={snapshot.totals.people.toLocaleString('he-IL')}
                delta={prevSnapshot ? pctChange(snapshot.totals.people, prevSnapshot.totals.people) : null}
                deltaLabel="מהחודש הקודם"
                sub={prevSnapshot ? `קודם: ${prevSnapshot.totals.people}` : undefined}
              />
              <KpiCard
                label="🎯 ממוצע משתתפים פר סיור"
                value={
                  snapshot.totals.tours > 0
                    ? Math.round(snapshot.totals.people / snapshot.totals.tours).toString()
                    : '0'
                }
                delta={
                  prevSnapshot && prevSnapshot.totals.tours > 0 && snapshot.totals.tours > 0
                    ? pctChange(
                        snapshot.totals.people / snapshot.totals.tours,
                        prevSnapshot.totals.people / prevSnapshot.totals.tours,
                      )
                    : null
                }
                deltaLabel="מהחודש הקודם"
                sub={
                  snapshot.totals.tours > 0
                    ? `${snapshot.totals.people} ÷ ${snapshot.totals.tours} = ${(snapshot.totals.people / snapshot.totals.tours).toFixed(1)}`
                    : undefined
                }
              />
              <KpiCard
                label="💰 סה״כ קופה"
                value={fmtEuro(snapshot.totals.cash_collected)}
                delta={prevSnapshot ? pctChange(snapshot.totals.cash_collected, prevSnapshot.totals.cash_collected) : null}
                deltaLabel="מהחודש הקודם"
                sub="כסף שנאסף בסיורים"
              />
            </div>
          </section>

          {/* ─── שכבה 3: ✨ Highlights — תובנות אסטרטגיות ─── */}
          <Highlights snapshot={snapshot} prevSnapshot={prevSnapshot} pctChange={pctChange} />

          {/* ─── סקציה משנית: 💼 KPIs פיננסיים תפעוליים ─── */}
          <section>
            <SectionHeader title="💼 פיננסי" subtitle="להעברה ללא רווח/הפסד — מודל התמחור עוד בעבודה" />
            <div
              data-kpi-grid
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: 16,
              }}
            >
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
              <KpiCard
                label="הוצאות"
                value={fmtEuro(snapshot.totals.expenses)}
                variant="red"
                sub="ששילמו המדריכים"
              />
            </div>
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

          {/* מדריכים פתוחים — אפשרות לסגור עבורם.
              מציג רק לחודשים שעברו (בחודש הנוכחי "פתוח" זה מצב תקין). */}
          {snapshot.totals.open_count > 0 &&
            !(year === now.getFullYear() && month === now.getMonth()) && (
              <section id="section-open-guides">
                <OpenGuidesReport snapshot={snapshot} />
              </section>
            )}

          {/* דוח תמונות חסרות — מתקפל, מציג רק אם יש */}
          {snapshot.totals.missing_photos_total > 0 && (
            <section id="section-missing-photos">
              <MissingPhotosReport snapshot={snapshot} />
            </section>
          )}

          {/* דוח קבלות חודשיות — חוצה-חודשים, מציג רק אם יש קבלות חסרות מחודשים שהסתיימו */}
          {outstandingReceipts.length > 0 && (
            <section id="section-receipts">
              <MonthlyReceiptsReport outstanding={outstandingReceipts} onChange={handleReload} />
            </section>
          )}

          {/* דוח הפקדות שמחכות — מתקפל, מציג רק אם יש מדריכים עם סכום ממתין */}
          {snapshot.totals.pending_total > 0 && (
            <section id="section-pending-deposits">
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
// ⏳ מדריכים שעוד לא סגרו — עם כפתור "סגרי בשבילי" (מנווט ל-/close-month)
// ---------------------------------------------------------------------------

function OpenGuidesReport({ snapshot }: { snapshot: MonthSnapshot }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const openGuides = snapshot.guides.filter((g) => g.status === 'open');
  if (openGuides.length === 0) return null;

  // לוחצים על "סגרי בשבילי" — שמים localStorage למדריך וניווט ל-/close-month
  function handleCloseFor(guideId: string, guideName: string) {
    if (typeof window === 'undefined') return;
    localStorage.setItem('portugo_guide_id', guideId);
    localStorage.setItem('portugo_guide_name', guideName);
    router.push(`/close-month?year=${snapshot.year}&month=${snapshot.month + 1}`);
  }

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        border: '1px solid #fde047',
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
        <span style={{ fontSize: 16, fontWeight: 600, color: '#854d0e' }}>
          ⏳ מדריכים פתוחים ({openGuides.length}) — עוד לא סגרו את החודש
        </span>
        <span style={{ color: ADMIN_COLORS.gray500, fontSize: 13 }}>
          {open ? '▲ הסתר.י' : '▼ הצג.י פירוט'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #fde047' }}>
          <div style={{ marginTop: 12 }}>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {openGuides.map((g) => (
                <li
                  key={g.guide.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: '#fef9c3',
                    borderRadius: 6,
                    fontSize: 14,
                    color: ADMIN_COLORS.gray700,
                  }}
                >
                  <span>
                    <strong>{g.guide.name}</strong>
                    <span style={{ color: ADMIN_COLORS.gray500, fontSize: 12, marginInlineStart: 8 }}>
                      {g.tours_count} סיורים · {fmtEuro(g.salary.total_with_tips)} שכר
                    </span>
                  </span>
                  <button
                    onClick={() => handleCloseFor(g.guide.id, g.guide.name)}
                    style={{
                      background: ADMIN_COLORS.green800,
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                    }}
                  >
                    סגרי בשבילי ←
                  </button>
                </li>
              ))}
            </ul>
            <div style={{ marginTop: 10, fontSize: 11, color: ADMIN_COLORS.gray500 }}>
              לחיצה על &quot;סגרי בשבילי&quot; תקח אותך לדף סגירת חודש של המדריך עם כל הפרטים.
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// 🚨 Inbox — alerts קצרים על דברים שצריכים תשומת לב מיידית
// ---------------------------------------------------------------------------

function InboxAlerts({
  snapshot,
  isCurrentMonth,
  outstandingReceipts,
}: {
  snapshot: MonthSnapshot;
  isCurrentMonth: boolean;
  outstandingReceipts: OutstandingReceipt[];
}) {
  const alerts: { icon: string; text: string; color: 'red' | 'yellow'; targetId: string }[] = [];

  // קבלות חסרות — חוצה-חודשים, לא תלוי בחודש הנבחר
  if (outstandingReceipts.length > 0) {
    const totalAmount = outstandingReceipts.reduce((s, o) => s + o.receipt_amount, 0);
    // סופרים מדריכים יחודיים (ייתכן ולמדריך אחד יש כמה חודשים פתוחים)
    const uniqueGuides = new Set(outstandingReceipts.map((o) => o.guide.id)).size;
    // סופרים חודשים יחודיים. אם יש רק חודש אחד — להציג את שמו במפורש
    // ("4 קבלות חסרות על אפריל"), אחרת לתת ספירה ("4 קבלות חסרות מ-2 חודשים")
    const uniqueMonths = new Set(outstandingReceipts.map((o) => `${o.year}-${o.month}`));
    let scope: string;
    if (uniqueMonths.size === 1) {
      const o = outstandingReceipts[0];
      scope = `על ${monthName(o.year, o.month)}`;
    } else {
      scope = `מ-${uniqueMonths.size} חודשים`;
    }
    alerts.push({
      icon: '🧾',
      text: `${uniqueGuides} מדריכים לא הוציאו קבלה ${scope} — סה״כ ${totalAmount.toFixed(0)}€`,
      color: 'red',
      targetId: 'section-receipts',
    });
  }

  // הפקדות מחכות
  if (snapshot.totals.pending_total > 0) {
    const guidesWithPending = snapshot.guides.filter((g) => g.pending_total > 0).length;
    alerts.push({
      icon: '💰',
      text: `${guidesWithPending} מדריכים עם כסף שמחכה להפקדה — סה״כ ${snapshot.totals.pending_total.toFixed(0)}€`,
      color: 'red',
      targetId: 'section-pending-deposits',
    });
  }

  // תמונות חסרות
  if (snapshot.totals.missing_photos_total > 0) {
    alerts.push({
      icon: '📷',
      text: `${snapshot.totals.missing_photos_total} סיורים בלי תמונה`,
      color: 'yellow',
      targetId: 'section-missing-photos',
    });
  }

  // מדריכים פתוחים — עבדו ולא סגרו את החודש (open status)
  // מציג רק לחודשים שכבר הסתיימו (בחודש הנוכחי "פתוח" זה מצב תקין)
  if (!isCurrentMonth && snapshot.totals.open_count > 0) {
    alerts.push({
      icon: '⏳',
      text: `${snapshot.totals.open_count} מדריכים עוד לא סגרו את החודש`,
      color: 'yellow',
      targetId: 'section-open-guides',
    });
  }

  if (alerts.length === 0) return null;

  function scrollToSection(id: string) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <section>
      <h2
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: '#991b1b',
          margin: '0 0 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        🚨 צריך תשומת לב
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {alerts.map((a, i) => {
          const bg = a.color === 'red' ? '#fee2e2' : '#fef9c3';
          const border = a.color === 'red' ? '#fca5a5' : '#fde047';
          const fg = a.color === 'red' ? '#991b1b' : '#854d0e';
          return (
            <button
              key={i}
              onClick={() => scrollToSection(a.targetId)}
              style={{
                background: bg,
                border: `1px solid ${border}`,
                color: fg,
                padding: '10px 14px',
                borderRadius: 8,
                fontSize: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'right',
                width: '100%',
                transition: 'background 150ms',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background =
                  a.color === 'red' ? '#fecaca' : '#fef08a';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.background = bg;
              }}
            >
              <span style={{ fontSize: 18 }}>{a.icon}</span>
              <span style={{ flex: 1 }}>{a.text}</span>
              <span style={{ fontSize: 12, opacity: 0.7 }}>← לפירוט</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// ✨ Highlights — תובנות אסטרטגיות אוטומטיות
// ---------------------------------------------------------------------------

function Highlights({
  snapshot,
  prevSnapshot,
  pctChange,
}: {
  snapshot: MonthSnapshot;
  prevSnapshot: MonthSnapshot | null;
  pctChange: (current: number, prev: number) => number | null;
}) {
  // === מדדים פר מדריך (אסטרטגיים — לא תלויים בשיבוצים שעומר עושה) ===
  // 1. הכי הרבה משמרות (מדד נכונות לעבוד / זמינות)
  const guidesByShifts = [...snapshot.guides]
    .filter((g) => g.tours_count > 0)
    .sort((a, b) => b.tours_count - a.tours_count);
  const topByShifts = guidesByShifts[0];

  // 2. ממוצע טיפ פר ראש בקלאסי הכי גבוה (מדריך משפיע על איכות הטיפ)
  const guidesByClassicTip = snapshot.guides
    .filter((g) => g.salary.classic_people >= 5) // לפחות 5 משתתפים בקלאסי, אחרת לא מובהק
    .map((g) => ({
      name: g.guide.name,
      avgClassic: g.salary.classic_collected / g.salary.classic_people,
      classicPeople: g.salary.classic_people,
    }))
    .sort((a, b) => b.avgClassic - a.avgClassic);
  const topByClassicTip = guidesByClassicTip[0];

  // 3. סך הטיפים הרגילים הכי גבוה (סיורים שאינם קלאסי)
  const guidesByOtherTips = snapshot.guides
    .filter((g) => g.salary.non_classic_tips > 0)
    .map((g) => ({
      name: g.guide.name,
      tips: g.salary.non_classic_tips,
    }))
    .sort((a, b) => b.tips - a.tips);
  const topByOtherTips = guidesByOtherTips[0];

  // 4. מגמה כללית — האם החודש טוב יותר מהקודם?
  let trendText = '';
  let trendColor: string = ADMIN_COLORS.gray700;
  if (prevSnapshot) {
    const toursPct = pctChange(snapshot.totals.tours, prevSnapshot.totals.tours);
    const peoplePct = pctChange(snapshot.totals.people, prevSnapshot.totals.people);
    if (toursPct !== null && peoplePct !== null) {
      if (toursPct > 0 && peoplePct > 0) {
        trendText = `מגמה חיובית — סיורים +${toursPct.toFixed(0)}%, משתתפים +${peoplePct.toFixed(0)}%. צמיחה!`;
        trendColor = '#15803d';
      } else if (toursPct < 0 && peoplePct < 0) {
        trendText = `ירידה — סיורים ${toursPct.toFixed(0)}%, משתתפים ${peoplePct.toFixed(0)}%. שווה לחקור.`;
        trendColor = '#b91c1c';
      } else {
        trendText = `מעורב — סיורים ${toursPct >= 0 ? '+' : ''}${toursPct.toFixed(0)}%, משתתפים ${peoplePct >= 0 ? '+' : ''}${peoplePct.toFixed(0)}%.`;
        trendColor = '#a37b00';
      }
    }
  }

  // 5. סיור עם תפוסה ממוצעת הכי גבוהה / נמוכה
  // נחשב ממוצע משתתפים פר סיור ומשווה למינימום מותג של אותו סיור
  // (קיבולות מתוך סקיל התמחור - ראה /admin/customers TOUR_CAPACITY)
  // למניעת כפל קוד, נציג רק טקסט פשוט בהליילייטס.

  const cards: { icon: string; title: string; text: string; color?: string }[] = [];

  if (topByShifts) {
    cards.push({
      icon: '🌟',
      title: 'הכי הרבה משמרות',
      text: `${topByShifts.guide.name} — ${topByShifts.tours_count} סיורים החודש (${topByShifts.people_count} משתתפים).`,
    });
  }

  if (topByClassicTip) {
    cards.push({
      icon: '💰',
      title: 'ממוצע טיפ הכי גבוה (קלאסי)',
      text: `${topByClassicTip.name} — ממוצע ${topByClassicTip.avgClassic.toFixed(2)}€ פר ראש (${topByClassicTip.classicPeople} משתתפים בקלאסי).`,
    });
  }

  if (topByOtherTips) {
    cards.push({
      icon: '💵',
      title: 'הכי הרבה טיפים בסיורים רגילים',
      text: `${topByOtherTips.name} — ${topByOtherTips.tips.toFixed(0)}€ טיפים מסיורים שאינם קלאסי.`,
    });
  }

  if (trendText) {
    cards.push({
      icon: '📈',
      title: 'מגמה כללית',
      text: trendText,
      color: trendColor,
    });
  }

  // ממוצע משתתפים פר סיור — מול חודש קודם
  if (prevSnapshot && snapshot.totals.tours > 0 && prevSnapshot.totals.tours > 0) {
    const currentAvg = snapshot.totals.people / snapshot.totals.tours;
    const prevAvg = prevSnapshot.totals.people / prevSnapshot.totals.tours;
    const diff = currentAvg - prevAvg;
    if (Math.abs(diff) > 0.5) {
      cards.push({
        icon: diff > 0 ? '✅' : '⚠️',
        title: diff > 0 ? 'הסיורים מתמלאים יותר' : 'הסיורים מתמלאים פחות',
        text: `ממוצע משתתפים פר סיור: ${currentAvg.toFixed(1)} (חודש קודם: ${prevAvg.toFixed(1)}, ${diff > 0 ? '+' : ''}${diff.toFixed(1)}).`,
        color: diff > 0 ? '#15803d' : '#b91c1c',
      });
    }
  }

  // מדריכים שעבדו אבל לא סיימו אישור קבלה — תזכורת אסטרטגית
  const notClosedAndOverdue = snapshot.guides.filter(
    (g) => g.tours_count > 0 && g.status === 'open',
  );
  if (notClosedAndOverdue.length > 0) {
    cards.push({
      icon: '⏳',
      title: 'מדריכים שעוד לא סגרו',
      text: `${notClosedAndOverdue.length} מדריכים — ${notClosedAndOverdue.map((g) => g.guide.name).slice(0, 3).join(', ')}${notClosedAndOverdue.length > 3 ? '...' : ''}`,
    });
  }

  if (cards.length === 0) return null;

  return (
    <section>
      <SectionHeader title="✨ היילייטס" subtitle="התובנות החשובות של החודש" />
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: 12,
        }}
      >
        {cards.map((c, i) => (
          <div
            key={i}
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 16,
              boxShadow: '0 1px 3px rgba(0,0,0,.06)',
              borderRight: `4px solid ${c.color || ADMIN_COLORS.green700}`,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 18 }}>{c.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: c.color || ADMIN_COLORS.green800 }}>{c.title}</span>
            </div>
            <div style={{ fontSize: 13, color: ADMIN_COLORS.gray700, lineHeight: 1.5 }}>{c.text}</div>
          </div>
        ))}
      </div>
    </section>
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
  outstanding,
  onChange,
}: {
  outstanding: OutstandingReceipt[];
  onChange: () => void;
}) {
  const [open, setOpen] = useState(false);

  // אישור ידני: יוצר שורה ב-receipt_acknowledgements ללא receipt_url
  // (המשמעות: עומר אישרה שהמדריך הוציא קבלה מחוץ למערכת — אין תמונה)
  async function approveManually(guideId: string, year: number, month: number) {
    const { error } = await supabase.from('receipt_acknowledgements').insert({
      guide_id: guideId,
      year,
      month: month + 1, // ל-DB 1-indexed
    });
    if (error) {
      alert('משהו השתבש: ' + error.message);
      return;
    }
    onChange();
  }

  if (outstanding.length === 0) return null;

  const totalAmount = outstanding.reduce((s, o) => s + o.receipt_amount, 0);

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
          🧾 קבלות שלא הוצאו ({outstanding.length} · {fmtEuro(totalAmount)})
        </span>
        <span style={{ color: ADMIN_COLORS.gray500, fontSize: 13 }}>
          {open ? '▲ הסתר.י' : '▼ הצג.י פירוט'}
        </span>
      </button>
      {open && (
        <div style={{ padding: '0 16px 16px', borderTop: '1px solid #fecaca' }}>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: ADMIN_COLORS.gray500, marginBottom: 8 }}>
              קבלות מחודשים שהסתיימו — מציג רק חודשים קודמים, לא את החודש הנוכחי
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {outstanding.map((o) => (
                <li
                  key={`${o.guide.id}-${o.year}-${o.month}`}
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
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontWeight: 600 }}>{o.guide.name}</span>
                    <span style={{ fontSize: 12, color: ADMIN_COLORS.gray500 }}>
                      {monthName(o.year, o.month)}
                    </span>
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    {o.admin_notified_at && (
                      <span style={{ fontSize: 11, color: '#a37b00' }}>📨 נשלחה התראה</span>
                    )}
                    <span style={{ color: '#991b1b', fontWeight: 600 }}>
                      {fmtEuro(o.receipt_amount)}
                    </span>
                    <InlineConfirmButton
                      label="✓ סמן.י כהופקה"
                      confirmLabel="בטוח.ה?"
                      onConfirm={() => approveManually(o.guide.id, o.year, o.month)}
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
