'use client';

/**
 * /admin/tips-analytics — אנליטיקת דפי הטיפים בברקוד.
 *
 * בשונה משאר האדמין (Supabase ישירות מהלקוח), הנתונים כאן נמשכים מ-API
 * ייעודי שמחזיר אגרגציה יומית אנונימית (‎/api/tips-events?format=json‎),
 * כי טבלת tips_events חסומה ב-RLS וקריאה רק דרך service key בצד השרת.
 *
 * מה רואים: מבקרים, מעורבות, המרות (סיור נוסף / ביקורת), גרף יומי,
 * פילוח סוגי הקלקות, ההמלצות המובילות וכל ההקלקות — עם פילטרי תקופה ועיר.
 */

import { useEffect, useMemo, useState } from 'react';
import { ADMIN_COLORS } from '@/lib/admin/theme';
import KpiCard from '@/components/admin/KpiCard';

const TIPS_STATS_URL = '/api/tips-events?format=json&k=gogo-stats-2026';

type DayRow = {
  d: string;
  page: string;
  views: number;
  visitors: number;
  engaged: number;
  scrollSum: number;
  scrollN: number;
  secSum: number;
  secN: number;
  mobile: number;
  direct: number;
};

type ClickRow = { d: string; page: string; target: string; n: number };

type StatsPayload = {
  ok: boolean;
  today: string;
  pages: Record<string, string>;
  days: DayRow[];
  clicks: ClickRow[];
};

type CityFilter = 'all' | 'lisbon' | 'porto';

const TYPE_ORDER_COLORS = [
  ADMIN_COLORS.green700,
  ADMIN_COLORS.yellow,
  ADMIN_COLORS.red,
  '#4db870',
  '#e67e22',
  '#22994d',
  '#9b59b6',
  ADMIN_COLORS.gray500,
];

/** סיווג יעד הקלקה לקבוצה עברית */
function classify(target: string): string {
  if (target.startsWith('מקום: ')) return 'המלצות (מקומות)';
  if (target.startsWith('סיור: ')) return 'סיורים נוספים';
  if (target === 'ביקורת בגוגל' || target === 'המלצה בפייסבוק') return 'ביקורות';
  if (target.startsWith('כפתור המפה')) return 'המפה המלאה';
  if (target.startsWith('קטגוריה: ')) return 'ניווט בקטגוריות';
  if (target.startsWith('נשארים בקשר: ')) return 'נשארים בקשר';
  if (target.startsWith('סרגל תחתון')) return 'הסרגל התחתון';
  if (target.startsWith('מייל פידבק')) return 'פידבק במייל';
  return 'אחר';
}

/** רשימת התאריכים (YYYY-MM-DD) של N הימים האחרונים כולל היום, לפי היום של ה-API */
function lastDays(today: string, n: number): string[] {
  const out: string[] = [];
  const t = new Date(today + 'T12:00:00Z');
  for (let i = 0; i < n; i++) {
    const d = new Date(t);
    d.setUTCDate(t.getUTCDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export default function TipsAnalyticsPage() {
  const [data, setData] = useState<StatsPayload | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [period, setPeriod] = useState<1 | 7 | 30>(7);
  const [city, setCity] = useState<CityFilter>('all');

  useEffect(() => {
    let cancelled = false;
    fetch(TIPS_STATS_URL)
      .then((r) => r.json())
      .then((j: StatsPayload) => {
        if (cancelled) return;
        if (!j.ok) throw new Error();
        setData(j);
      })
      .catch(() => {
        if (!cancelled) setLoadError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const view = useMemo(() => {
    if (!data) return null;
    const daysSet = new Set(lastDays(data.today, period));
    const inCity = (p: string) => city === 'all' || p === city;
    const days = data.days.filter((r) => daysSet.has(r.d) && inCity(r.page));
    const clicks = data.clicks.filter((r) => daysSet.has(r.d) && inCity(r.page));

    const sum = <T,>(arr: T[], f: (r: T) => number) => arr.reduce((s, r) => s + f(r), 0);
    const visitors = sum(days, (r) => r.visitors);
    const engaged = sum(days, (r) => r.engaged);
    const views = sum(days, (r) => r.views);
    const totalClicks = sum(clicks, (r) => r.n);
    const tourClicks = sum(clicks.filter((r) => classify(r.target) === 'סיורים נוספים'), (r) => r.n);
    const reviewClicks = sum(clicks.filter((r) => classify(r.target) === 'ביקורות'), (r) => r.n);
    const secN = sum(days, (r) => r.secN);
    const avgSec = secN ? Math.round(sum(days, (r) => r.secSum) / secN) : null;
    const scrollN = sum(days, (r) => r.scrollN);
    const avgScroll = scrollN ? Math.round(sum(days, (r) => r.scrollSum) / scrollN) : null;
    const mobile = sum(days, (r) => r.mobile);
    const direct = sum(days, (r) => r.direct);

    // גרף יומי — תמיד 14 ימים, מושפע רק מפילטר העיר
    const daily = lastDays(data.today, 14)
      .reverse()
      .map((d) => ({
        d,
        lisbon: sum(data.days.filter((r) => r.d === d && r.page === 'lisbon' && inCity('lisbon')), (r) => r.visitors),
        porto: sum(data.days.filter((r) => r.d === d && r.page === 'porto' && inCity('porto')), (r) => r.visitors),
      }));

    const countBy = (f: (c: ClickRow) => string | null) => {
      const m = new Map<string, number>();
      for (const c of clicks) {
        const k = f(c);
        if (k !== null) m.set(k, (m.get(k) ?? 0) + c.n);
      }
      return [...m.entries()].sort((a, b) => b[1] - a[1]);
    };

    return {
      visitors, engaged, views, totalClicks, tourClicks, reviewClicks,
      avgSec, avgScroll, mobile, direct, daily,
      types: countBy((c) => classify(c.target)),
      topPlaces: countBy((c) => (c.target.startsWith('מקום: ') ? c.target.slice(6) : null)).slice(0, 10),
      allClicks: countBy((c) => c.target),
    };
  }, [data, period, city]);

  const pct = (part: number, whole: number) => (whole ? `${Math.round((100 * part) / whole)}%` : '-');
  const fmtSec = (s: number | null) =>
    s === null ? '-' : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (loadError) {
    return (
      <div>
        <PageHeader />
        <Card>לא הצלחנו למשוך את הנתונים. בדקי את החיבור לאינטרנט ורענני את העמוד.</Card>
      </div>
    );
  }

  if (!data || !view) {
    return (
      <div>
        <PageHeader />
        <Card>טוען נתונים חיים...</Card>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
        <PageHeader />
        <div style={{ display: 'flex', gap: 10 }}>
          <FilterSelect value={String(period)} onChange={(v) => setPeriod(Number(v) as 1 | 7 | 30)} options={[
            { value: '1', label: 'היום' },
            { value: '7', label: '7 ימים אחרונים' },
            { value: '30', label: '30 יום' },
          ]} />
          <FilterSelect value={city} onChange={(v) => setCity(v as CityFilter)} options={[
            { value: 'all', label: 'שתי הערים' },
            { value: 'lisbon', label: 'ליסבון' },
            { value: 'porto', label: 'פורטו' },
          ]} />
        </div>
      </div>

      {/* KPI ראשי */}
      <div style={kpiGrid}>
        <KpiCard label="מבקרים" value={view.visitors} sub={`${view.totalClicks} הקלקות סה"כ`} />
        <KpiCard label="הקליקו על משהו" value={pct(view.engaged, view.visitors)} sub={`${view.engaged} מתוך ${view.visitors} מבקרים`} />
        <KpiCard label="התעניינו בסיור נוסף" value={view.tourClicks} sub={`${pct(view.tourClicks, view.visitors)} מהמבקרים`} variant="yellow" />
        <KpiCard label="לחצו על ביקורת" value={view.reviewClicks} sub={`${pct(view.reviewClicks, view.visitors)} מהמבקרים`} variant="yellow" />
        <KpiCard label="זמן ממוצע בדף" value={fmtSec(view.avgSec)} sub={`גלילה ממוצעת: ${view.avgScroll === null ? '-' : view.avgScroll + '%'}`} />
      </div>

      {/* KPI הקשר */}
      <div style={{ ...kpiGrid, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <KpiCard label="כניסות מהנייד" value={pct(view.mobile, view.views)} sub={`מתוך ${view.views} כניסות`} variant="gray" />
        <KpiCard label="הגעה ישירה (סריקת ברקוד)" value={pct(view.direct, view.views)} sub="השאר הגיעו דרך קישור מאתר אחר" variant="gray" />
      </div>

      {/* גרף יומי + פילוח סוגים */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20, marginBottom: 24 }}>
        <Card title="מבקרים לפי יום · 14 הימים האחרונים">
          <DailyBars daily={view.daily} />
        </Card>
        <Card title="על מה מקליקים · פילוח לפי סוג">
          <TypeBars types={view.types} total={view.totalClicks} />
        </Card>
      </div>

      {/* טבלאות */}
      <Card title="ההמלצות המובילות">
        <ClicksTable rows={view.topPlaces} emptyText="אין הקלקות על מקומות בתקופה הזאת" />
      </Card>
      <Card title="כל ההקלקות בתקופה">
        <ClicksTable rows={view.allClicks} withType emptyText="אין הקלקות בתקופה הזאת" />
      </Card>
    </div>
  );
}

// ─────────────────────────────── רכיבי עזר ───────────────────────────────

const kpiGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 16,
  marginBottom: 24,
};

function PageHeader() {
  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 700, color: ADMIN_COLORS.green800, margin: 0 }}>
        📱 דפי הטיפים
      </h1>
      <p style={{ fontSize: 14, color: ADMIN_COLORS.gray500, marginTop: 4 }}>
        נתונים חיים מהדפים שהמטיילים סורקים בסוף הסיור · אנונימי לחלוטין
      </p>
    </div>
  );
}

function FilterSelect({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '10px 14px',
        fontSize: 14,
        fontFamily: 'inherit',
        border: `1px solid ${ADMIN_COLORS.gray300}`,
        borderRadius: 8,
        background: '#fff',
        color: ADMIN_COLORS.gray900,
        cursor: 'pointer',
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 24,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        marginBottom: 24,
      }}
    >
      {title && (
        <h3 style={{ fontSize: 15, fontWeight: 600, color: ADMIN_COLORS.green800, margin: '0 0 18px' }}>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}

/** גרף עמודות יומי — ליסבון ירוק, פורטו צהוב, מוערמים */
function DailyBars({ daily }: { daily: { d: string; lisbon: number; porto: number }[] }) {
  const max = Math.max(1, ...daily.map((r) => r.lisbon + r.porto));
  const H = 160;
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: H + 24 }}>
        {daily.map((r) => {
          const total = r.lisbon + r.porto;
          return (
            <div key={r.d} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}
              title={`${r.d.slice(8, 10)}.${r.d.slice(5, 7)} · ליסבון ${r.lisbon} · פורטו ${r.porto}`}>
              <div style={{ fontSize: 11, color: ADMIN_COLORS.gray500, fontWeight: 600, minHeight: 14 }}>
                {total || ''}
              </div>
              <div style={{ width: '100%', maxWidth: 26, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: H }}>
                <div style={{ height: (r.porto / max) * H, background: ADMIN_COLORS.yellow, borderRadius: total === r.porto ? '4px 4px 0 0' : 0 }} />
                <div style={{ height: (r.lisbon / max) * H, background: ADMIN_COLORS.green700, borderRadius: r.porto === 0 ? '4px 4px 0 0' : 0 }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
        {daily.map((r) => (
          <div key={r.d} style={{ flex: 1, textAlign: 'center', fontSize: 10, color: ADMIN_COLORS.gray500 }}>
            {r.d.slice(8, 10)}.{r.d.slice(5, 7)}
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 14, fontSize: 12, color: ADMIN_COLORS.gray700 }}>
        <LegendDot color={ADMIN_COLORS.green700} label="ליסבון" />
        <LegendDot color={ADMIN_COLORS.yellow} label="פורטו" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{ width: 10, height: 10, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}

/** פסים אופקיים לפילוח סוגי הקלקות */
function TypeBars({ types, total }: { types: [string, number][]; total: number }) {
  if (!types.length) {
    return <div style={{ color: ADMIN_COLORS.gray500, textAlign: 'center', padding: '24px 0' }}>אין הקלקות בתקופה הזאת</div>;
  }
  const max = types[0][1];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {types.map(([label, n], i) => (
        <div key={label}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
            <span style={{ color: ADMIN_COLORS.gray700 }}>{label}</span>
            <span style={{ color: ADMIN_COLORS.gray900, fontWeight: 600 }}>
              {n} <span style={{ color: ADMIN_COLORS.gray500, fontWeight: 400, fontSize: 12 }}>({total ? Math.round((100 * n) / total) : 0}%)</span>
            </span>
          </div>
          <div style={{ height: 10, background: ADMIN_COLORS.gray100, borderRadius: 5, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.round((100 * n) / max)}%`,
              background: TYPE_ORDER_COLORS[i % TYPE_ORDER_COLORS.length],
              borderRadius: 5,
            }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** טבלת הקלקות עם פסי השוואה */
function ClicksTable({ rows, withType = false, emptyText }: {
  rows: [string, number][];
  withType?: boolean;
  emptyText: string;
}) {
  if (!rows.length) {
    return <div style={{ color: ADMIN_COLORS.gray500, textAlign: 'center', padding: '24px 0' }}>{emptyText}</div>;
  }
  const max = rows[0][1];
  const th: React.CSSProperties = {
    padding: '10px 12px', textAlign: 'right', fontSize: 12, fontWeight: 600,
    color: ADMIN_COLORS.green800, background: ADMIN_COLORS.green50,
    borderBottom: '2px solid #a3d9b5',
  };
  const td: React.CSSProperties = {
    padding: '9px 12px', fontSize: 13, color: ADMIN_COLORS.gray700,
    borderBottom: `1px solid ${ADMIN_COLORS.gray100}`,
  };
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>על מה הקליקו</th>
            {withType && <th style={th}>סוג</th>}
            <th style={{ ...th, width: 70 }}>הקלקות</th>
            <th style={{ ...th, width: '30%' }} />
          </tr>
        </thead>
        <tbody>
          {rows.map(([target, n]) => (
            <tr key={target}>
              <td style={td}>{target}</td>
              {withType && <td style={{ ...td, color: ADMIN_COLORS.gray500, fontSize: 12 }}>{classify(target)}</td>}
              <td style={{ ...td, fontWeight: 600, color: ADMIN_COLORS.gray900 }}>{n}</td>
              <td style={td}>
                <div style={{ height: 8, background: ADMIN_COLORS.gray100, borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.round((100 * n) / max)}%`, background: '#22994d', borderRadius: 4 }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
