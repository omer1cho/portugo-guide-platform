'use client';

/**
 * /admin/customers — ניתוח לקוחות אסטרטגי.
 *
 * KPIs + sections לחודש הנבחר, עם מסנן עיר (ליסבון/פורטו/הכל):
 *   1. מקורות לקוחות (תרשים עוגה)
 *   2. קטגוריות לקוחות (תרשים עוגה)
 *   3. טיפ ממוצע פר קטגוריית לקוח (קלאסי + כללי)
 *   4. טיפ ממוצע פר מקור
 *   5. ממוצע טיפ פר מדריך (תרשים עמודות אנכי) — רק קלאסי
 *   6. לקוחות לפי יום בשבוע × קטגוריה — רוחבי או פר סוג סיור (dropdown)
 *   7. תפוסה פר סוג סיור — ממוצע מול מינימום+מקסימום + סיורים בהפסד
 *   8. חבילה vs רגיל — מי קיבל 5€ הנחה
 */

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ADMIN_COLORS, fmtEuro, monthName } from '@/lib/admin/theme';
import { supabase } from '@/lib/supabase';
import KpiCard from '@/components/admin/KpiCard';
import MonthSwitcher from '@/components/admin/MonthSwitcher';

type RawBooking = {
  people: number;
  kids: number;
  price: number;
  tip: number;
  customer_type: string | null;
  source: string | null;
  tour: {
    tour_date: string;
    tour_type: string;
    category: 'classic' | 'fixed' | 'private' | 'other';
    guide: {
      id: string;
      name: string;
      city: 'lisbon' | 'porto';
    } | null;
  } | null;
};

type CityFilter = 'all' | 'lisbon' | 'porto';

const DAY_NAMES_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// קיבולות פר סוג סיור — מתוך project_pricing_session1 (אישור עומר 3.5.26)
const TOUR_CAPACITY: Record<string, { min: number; max: number; label: string }> = {
  קלאסי_1: { min: 2, max: 40, label: 'ליסבון הקלאסית' },
  פורטו_1: { min: 2, max: 40, label: 'פורטו הקלאסית' },
  בלם_1: { min: 2, max: 40, label: 'בלם' },
  קולינרי: { min: 2, max: 20, label: 'קולינרי' },
  סינטרה: { min: 6, max: 34, label: 'סינטרה' },
  אראבידה: { min: 6, max: 34, label: 'אראבידה' },
  אובידוש: { min: 8, max: 34, label: 'אובידוש' },
  טעימות: { min: 2, max: 22, label: 'טעימות פורטו' },
  דורו: { min: 6, max: 24, label: 'דורו' },
};

// מחירי חבילה (עם 5€ הנחה) פר סוג סיור — לזיהוי מי לקח חבילה.
// אם price <= package_price → לקח חבילה. (עומר אישרה — קלאסי הוא free, מקבלים 5€ הנחה אם השתתפו בו)
const PACKAGE_PRICES: Record<string, number> = {
  בלם_1: 15, // רגיל 20
  קולינרי: 60, // רגיל 65
  סינטרה: 85, // רגיל 90 (לפני יולי)
  אראבידה: 85,
  אובידוש: 100, // רגיל 105
  טעימות: 60, // רגיל 65
  דורו: 100, // רגיל 105
};

// פלטה לתרשימי עוגה
const PIE_COLORS = [
  '#145c2e', // green800
  '#1a7a3d', // green700
  '#2e8b4d', // green600
  '#d4351c', // red
  '#f5c518', // yellow
  '#1e6091', // blue
  '#7c3aed', // purple
  '#ea580c', // orange
  '#0891b2', // cyan
  '#be185d', // pink
  '#65a30d', // lime
  '#6b7280', // gray
];

function CustomersContent() {
  const searchParams = useSearchParams();
  const now = new Date();
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : now.getFullYear();
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) - 1 : now.getMonth();
  const initialCity = (searchParams.get('city') as CityFilter) || 'all';
  const [cityFilter, setCityFilter] = useState<CityFilter>(initialCity);

  // dropdown לסוג סיור בטבלת יום-בשבוע (default = "כל הסיורים")
  const [dayChartTourType, setDayChartTourType] = useState<string>('all');

  const [bookings, setBookings] = useState<RawBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      const lastDay = new Date(year, month + 1, 0).getDate();
      const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

      const { data, error: err } = await supabase
        .from('bookings')
        .select(
          'people, kids, price, tip, customer_type, source, tour:tours!inner(tour_date, tour_type, category, guide:guides!inner(id, name, city))',
        )
        .gte('tour.tour_date', start)
        .lte('tour.tour_date', end);

      if (cancelled) return;
      if (err) {
        setError(err.message);
      } else {
        setBookings((data || []) as unknown as RawBooking[]);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [year, month]);

  // סינון לפי עיר
  const filtered = useMemo(
    () => bookings.filter((b) => cityFilter === 'all' || b.tour?.guide?.city === cityFilter),
    [bookings, cityFilter],
  );

  // ─── KPIs ────────────────────────────────────────────────────────────
  const totalPeople = filtered.reduce((s, b) => s + (b.people || 0), 0);
  const totalKids = filtered.reduce((s, b) => s + (b.kids || 0), 0);
  const tourIds = new Set(
    filtered.map((b) => `${b.tour?.tour_date}_${b.tour?.tour_type}_${b.tour?.guide?.id}`),
  );
  const tourCount = tourIds.size;
  const avgPerTour = tourCount > 0 ? totalPeople / tourCount : 0;
  const classicBookings = filtered.filter((b) => b.tour?.category === 'classic');
  const classicCollected = classicBookings.reduce((s, b) => s + (b.price || 0), 0);
  const classicPaying = classicBookings.reduce(
    (s, b) => s + Math.max(0, (b.people || 0) - (b.kids || 0)),
    0,
  );
  const avgTipPerHead = classicPaying > 0 ? classicCollected / classicPaying : 0;
  const kidsPct = totalPeople > 0 ? (totalKids / totalPeople) * 100 : 0;

  // ─── אגרגציות ל-sections ──────────────────────────────────────────────
  const bySource = aggregateBy(filtered, (b) => b.source || 'אחר');
  const byCustomer = aggregateBy(filtered, (b) => b.customer_type || 'אחר');
  const tipByCustomerClassic = aggregateTipByCustomer(classicBookings, true);
  const tipByCustomerAll = aggregateTipByCustomer(filtered, false);
  const tipBySource = aggregateTipBySource(filtered);
  const tipsByGuide = aggregateTipsByGuide(classicBookings);
  const dayChart = aggregateByDayAndCustomer(filtered, dayChartTourType);
  const occupancy = aggregateOccupancy(filtered);
  const packageSplit = aggregatePackageSplit(filtered);

  // סוגי סיור שיש להם נתונים בחודש (ל-dropdown)
  const availableTourTypes = Array.from(
    new Set(filtered.map((b) => b.tour?.tour_type).filter((t): t is string => !!t)),
  ).sort();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
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
            📊 ניתוח לקוחות
          </h1>
          <p style={{ fontSize: 14, color: ADMIN_COLORS.gray500, marginTop: 4 }}>
            {monthName(year, month)} — מקורות, קטגוריות, טיפים, תפוסה
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <CityToggle value={cityFilter} onChange={setCityFilter} />
          <MonthSwitcher year={year} month={month} />
        </div>
      </header>

      {loading && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 60, textAlign: 'center', color: ADMIN_COLORS.gray500 }}>
          טוענת נתונים...
        </div>
      )}

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: 12, padding: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
            <KpiCard label="סה״כ משתתפים" value={totalPeople.toLocaleString('he-IL')} />
            <KpiCard label="ממוצע אנשים פר סיור" value={avgPerTour.toFixed(1)} sub={`${tourCount} סיורים`} />
            <KpiCard
              label="ממוצע טיפ פר ראש (קלאסי)"
              value={fmtEuro(avgTipPerHead)}
              sub={`${classicPaying} משלמים · ${fmtEuro(classicCollected)} סה״כ`}
            />
            <KpiCard label="אחוז ילדים" value={`${kidsPct.toFixed(0)}%`} sub={`${totalKids} מתוך ${totalPeople}`} />
          </section>

          {totalPeople === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: ADMIN_COLORS.gray500 }}>
              אין נתוני לקוחות בחודש זה
            </div>
          ) : (
            <>
              {/* Sections 1+2 — תרשימי עוגה side-by-side */}
              <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
                <SectionBox title="📍 מקורות לקוחות">
                  <PieChart data={bySource} />
                </SectionBox>
                <SectionBox title="👥 קטגוריות לקוחות">
                  <PieChart data={byCustomer} />
                </SectionBox>
              </section>

              {/* Section 3 — טיפ ממוצע פר קטגוריה */}
              <SectionBox title="💰 טיפ ממוצע פר קטגוריית לקוח">
                <TipByCategoryTable classic={tipByCustomerClassic} all={tipByCustomerAll} />
              </SectionBox>

              {/* Section 4 — טיפ ממוצע פר מקור */}
              <SectionBox title="📍 טיפ ממוצע פר מקור (קלאסי)">
                <TipBySourceTable data={tipBySource} />
              </SectionBox>

              {/* Section 5 — תרשים עמודות פר מדריך */}
              {tipsByGuide.length > 0 && (
                <SectionBox title="🎯 ממוצע טיפ פר ראש לכל מדריך (קלאסי)">
                  <BarChart data={tipsByGuide} />
                </SectionBox>
              )}

              {/* Section 6 — יום בשבוע × קטגוריה */}
              <SectionBox
                title="📅 לקוחות לפי יום בשבוע × קטגוריה"
                control={
                  <select
                    value={dayChartTourType}
                    onChange={(e) => setDayChartTourType(e.target.value)}
                    style={selectStyle}
                  >
                    <option value="all">כל הסיורים</option>
                    {availableTourTypes.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                }
              >
                <DayCustomerTable data={dayChart} />
              </SectionBox>

              {/* Section 7 — תפוסה */}
              <SectionBox title="📦 תפוסה פר סוג סיור">
                <OccupancyTable data={occupancy} />
              </SectionBox>

              {/* Section 8 — חבילה vs רגיל */}
              {packageSplit.total > 0 && (
                <SectionBox title="🎁 חבילה vs רגיל (מי קיבל 5€ הנחה)">
                  <PackageSplitTable data={packageSplit} />
                </SectionBox>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ===========================================================================
// UI Components
// ===========================================================================

function CityToggle({ value, onChange }: { value: CityFilter; onChange: (v: CityFilter) => void }) {
  const options: { value: CityFilter; label: string }[] = [
    { value: 'all', label: 'הכל' },
    { value: 'lisbon', label: 'ליסבון' },
    { value: 'porto', label: 'פורטו' },
  ];
  return (
    <div style={{ display: 'flex', background: '#fff', border: `1px solid ${ADMIN_COLORS.gray300}`, borderRadius: 8, overflow: 'hidden' }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '8px 14px',
            background: value === opt.value ? ADMIN_COLORS.green800 : '#fff',
            color: value === opt.value ? '#fff' : ADMIN_COLORS.gray700,
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: value === opt.value ? 600 : 400,
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function SectionBox({
  title,
  control,
  children,
}: {
  title: string;
  control?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: ADMIN_COLORS.green800, margin: 0 }}>
          {title}
        </h2>
        {control}
      </div>
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        {children}
      </div>
    </section>
  );
}

/** תרשים עוגה SVG בסיסי — מציג segments + legend */
function PieChart({ data }: { data: AggregateRow[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) {
    return <div style={{ color: ADMIN_COLORS.gray500, textAlign: 'center', padding: 20 }}>אין נתונים</div>;
  }
  // חישוב segments
  const radius = 80;
  const cx = 100;
  const cy = 100;
  let cumAngle = -Math.PI / 2; // התחלה מ-12 (top)
  const segments = data.map((d, i) => {
    const angle = (d.count / total) * 2 * Math.PI;
    const startAngle = cumAngle;
    const endAngle = cumAngle + angle;
    cumAngle = endAngle;
    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);
    const largeArc = angle > Math.PI ? 1 : 0;
    const path = `M ${cx} ${cy} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;
    return { ...d, color: PIE_COLORS[i % PIE_COLORS.length], path, pct: (d.count / total) * 100 };
  });

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
      <svg viewBox="0 0 200 200" width={180} height={180} style={{ flexShrink: 0 }}>
        {segments.length === 1 ? (
          // segment יחיד = עיגול שלם
          <circle cx={cx} cy={cy} r={radius} fill={segments[0].color} />
        ) : (
          segments.map((s, i) => <path key={i} d={s.path} fill={s.color} stroke="#fff" strokeWidth={1} />)
        )}
      </svg>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, flex: 1, minWidth: 160, fontSize: 13 }}>
        {segments.map((s, i) => (
          <li key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
            <span style={{ width: 12, height: 12, background: s.color, borderRadius: 2, flexShrink: 0 }} />
            <span style={{ flex: 1, color: ADMIN_COLORS.gray700 }}>{s.label}</span>
            <span style={{ fontWeight: 600, color: ADMIN_COLORS.gray700 }}>{s.count}</span>
            <span style={{ color: ADMIN_COLORS.gray500, fontSize: 11, minWidth: 36, textAlign: 'left' }}>
              {s.pct.toFixed(0)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** תרשים עמודות אנכי — לטיפ פר מדריך */
function BarChart({ data }: { data: { name: string; avg: number; collected: number; paying: number }[] }) {
  if (data.length === 0) {
    return <div style={{ color: ADMIN_COLORS.gray500, textAlign: 'center', padding: 20 }}>אין נתונים</div>;
  }
  const maxVal = Math.max(...data.map((d) => d.avg));
  const chartHeight = 200;
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 12,
          height: chartHeight + 50,
          padding: '20px 0 10px',
          borderBottom: `1px solid ${ADMIN_COLORS.gray100}`,
          overflowX: 'auto',
        }}
      >
        {data.map((d) => {
          const h = maxVal > 0 ? (d.avg / maxVal) * chartHeight : 0;
          return (
            <div key={d.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 50, flex: '0 0 auto' }}>
              <div style={{ fontSize: 12, color: ADMIN_COLORS.green800, fontWeight: 600, marginBottom: 4 }}>
                {fmtEuro(d.avg)}
              </div>
              <div
                style={{
                  width: 40,
                  height: h,
                  background: ADMIN_COLORS.green800,
                  borderRadius: '4px 4px 0 0',
                  transition: 'height 200ms',
                }}
              />
              <div style={{ fontSize: 12, color: ADMIN_COLORS.gray700, marginTop: 6, textAlign: 'center', maxWidth: 70 }}>
                {d.name}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12, fontSize: 11, color: ADMIN_COLORS.gray500, textAlign: 'center' }}>
        מבוסס על נאסף בקלאסי ÷ משלמים (ללא ילדים)
      </div>
    </div>
  );
}

function TipByCategoryTable({
  classic,
  all,
}: {
  classic: { category: string; avg: number; people: number }[];
  all: { category: string; avg: number; people: number }[];
}) {
  // מיזוג שתי הרשימות לפי category
  const merged = new Map<string, { classic?: number; all?: number; classic_people?: number; all_people?: number }>();
  for (const c of classic) {
    merged.set(c.category, { classic: c.avg, classic_people: c.people });
  }
  for (const a of all) {
    const existing = merged.get(a.category) || {};
    merged.set(a.category, { ...existing, all: a.avg, all_people: a.people });
  }
  const rows = Array.from(merged.entries()).sort((a, b) => (b[1].all || 0) - (a[1].all || 0));

  if (rows.length === 0) {
    return <div style={{ color: ADMIN_COLORS.gray500, textAlign: 'center', padding: 20 }}>אין נתונים</div>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr style={trHeadStyle}>
            <th style={thStyle}>קטגוריה</th>
            <th style={thStyle}>טיפ ממוצע — קלאסי</th>
            <th style={thStyle}>טיפ ממוצע — כל הסיורים</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([category, vals]) => (
            <tr key={category} style={trBodyStyle}>
              <td style={tdStyle}>{category}</td>
              <td style={tdStyle}>
                {vals.classic !== undefined ? (
                  <span>
                    <strong>{fmtEuro(vals.classic)}</strong>
                    <span style={{ color: ADMIN_COLORS.gray500, fontSize: 11 }}> ({vals.classic_people} משלמים)</span>
                  </span>
                ) : (
                  <span style={{ color: ADMIN_COLORS.gray500 }}>—</span>
                )}
              </td>
              <td style={tdStyle}>
                {vals.all !== undefined ? (
                  <span>
                    <strong>{fmtEuro(vals.all)}</strong>
                    <span style={{ color: ADMIN_COLORS.gray500, fontSize: 11 }}> ({vals.all_people} משלמים)</span>
                  </span>
                ) : (
                  <span style={{ color: ADMIN_COLORS.gray500 }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8, fontSize: 11, color: ADMIN_COLORS.gray500 }}>
        קלאסי = (סה״כ נאסף ÷ משלמים). כללי = (טיפים מסיורים שאינם קלאסי ÷ אנשים).
      </div>
    </div>
  );
}

function TipBySourceTable({ data }: { data: { source: string; avg: number; people: number; collected: number }[] }) {
  if (data.length === 0) {
    return <div style={{ color: ADMIN_COLORS.gray500, textAlign: 'center', padding: 20 }}>אין נתונים</div>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr style={trHeadStyle}>
            <th style={thStyle}>מקור</th>
            <th style={thStyle}>משלמים</th>
            <th style={thStyle}>נאסף סה״כ</th>
            <th style={thStyle}>ממוצע פר ראש</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.source} style={trBodyStyle}>
              <td style={tdStyle}>{row.source}</td>
              <td style={tdStyle}>{row.people}</td>
              <td style={tdStyle}>{fmtEuro(row.collected)}</td>
              <td style={{ ...tdStyle, fontWeight: 600, color: ADMIN_COLORS.green800 }}>{fmtEuro(row.avg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8, fontSize: 11, color: ADMIN_COLORS.gray500 }}>
        מבוסס על קלאסי בלבד (כי בקלאסי כל הכסף שהלקוח שילם הוא טיפ).
      </div>
    </div>
  );
}

function DayCustomerTable({ data }: { data: DayMap }) {
  const customerTypes = Array.from(
    new Set(Object.values(data).flatMap((m) => Object.keys(m)).filter(Boolean)),
  ).sort();

  if (customerTypes.length === 0) {
    return <div style={{ color: ADMIN_COLORS.gray500, textAlign: 'center', padding: 20 }}>אין נתונים</div>;
  }

  // סה"כ פר קטגוריה (לסכום עליון)
  const totalsByCategory: Record<string, number> = {};
  for (const c of customerTypes) totalsByCategory[c] = 0;
  for (const dayData of Object.values(data)) {
    for (const [c, n] of Object.entries(dayData)) {
      totalsByCategory[c] = (totalsByCategory[c] || 0) + n;
    }
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr style={trHeadStyle}>
            <th style={thStyle}>יום</th>
            {customerTypes.map((c) => (
              <th key={c} style={thStyle}>{c}</th>
            ))}
            <th style={thStyle}>סה״כ</th>
          </tr>
        </thead>
        <tbody>
          {DAY_NAMES_HE.map((day, idx) => {
            const dayData = data[idx] || {};
            const dayTotal = Object.values(dayData).reduce((s, n) => s + n, 0);
            if (dayTotal === 0) return null;
            return (
              <tr key={day} style={trBodyStyle}>
                <td style={tdStyle}>{day}</td>
                {customerTypes.map((c) => (
                  <td key={c} style={tdStyle}>{dayData[c] || ''}</td>
                ))}
                <td style={{ ...tdStyle, fontWeight: 600 }}>{dayTotal}</td>
              </tr>
            );
          })}
          <tr style={{ ...trBodyStyle, background: ADMIN_COLORS.gray50, fontWeight: 600 }}>
            <td style={tdStyle}>סה״כ</td>
            {customerTypes.map((c) => (
              <td key={c} style={tdStyle}>{totalsByCategory[c] || ''}</td>
            ))}
            <td style={{ ...tdStyle, color: ADMIN_COLORS.green800 }}>
              {Object.values(totalsByCategory).reduce((s, n) => s + n, 0)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

type OccupancyRow = {
  tour_type: string;
  label: string;
  tours: number;
  avgPeople: number;
  min?: number;
  max?: number;
  belowMin: number;
  occupancyPct?: number;
};

function OccupancyTable({ data }: { data: OccupancyRow[] }) {
  if (data.length === 0) {
    return <div style={{ color: ADMIN_COLORS.gray500, textAlign: 'center', padding: 20 }}>אין נתונים</div>;
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={tableStyle}>
        <thead>
          <tr style={trHeadStyle}>
            <th style={thStyle}>סיור</th>
            <th style={thStyle}>סיורים</th>
            <th style={thStyle}>ממוצע אנשים</th>
            <th style={thStyle}>טווח (מינ׳-מקס׳)</th>
            <th style={thStyle}>% תפוסה</th>
            <th style={thStyle}>מתחת למינ׳ מותג</th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row.tour_type} style={trBodyStyle}>
              <td style={tdStyle}>{row.label}</td>
              <td style={tdStyle}>{row.tours}</td>
              <td style={{ ...tdStyle, fontWeight: 600 }}>{row.avgPeople.toFixed(1)}</td>
              <td style={tdStyle}>
                {row.min !== undefined && row.max !== undefined ? (
                  <span style={{ color: ADMIN_COLORS.gray500 }}>{row.min}–{row.max}</span>
                ) : (
                  <span style={{ color: ADMIN_COLORS.gray500 }}>—</span>
                )}
              </td>
              <td style={tdStyle}>
                {row.occupancyPct !== undefined ? `${row.occupancyPct.toFixed(0)}%` : '—'}
              </td>
              <td style={{ ...tdStyle, color: row.belowMin > 0 ? '#991b1b' : ADMIN_COLORS.gray500, fontWeight: row.belowMin > 0 ? 600 : 400 }}>
                {row.belowMin > 0 ? `${row.belowMin} סיורים` : '0'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ marginTop: 8, fontSize: 11, color: ADMIN_COLORS.gray500 }}>
        סיורים מתחת למינימום מותג = סיורים שיצאו עם פחות מהמינימום הרצוי (פוטנציאל הפסד, מקיימים בשביל המוניטין).
      </div>
    </div>
  );
}

type PackageSplit = {
  total: number;
  packageCount: number;
  regularCount: number;
  byTour: { tour_type: string; label: string; total: number; pkg: number; pkgPct: number }[];
};

function PackageSplitTable({ data }: { data: PackageSplit }) {
  const overallPct = data.total > 0 ? (data.packageCount / data.total) * 100 : 0;
  return (
    <div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <div style={{ flex: '1 1 200px', background: ADMIN_COLORS.gray50, padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: ADMIN_COLORS.gray500 }}>בחבילה</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: ADMIN_COLORS.green800 }}>
            {data.packageCount} משתתפים
          </div>
          <div style={{ fontSize: 12, color: ADMIN_COLORS.gray500 }}>
            {overallPct.toFixed(0)}% מסה״כ הסיורים שאינם קלאסי
          </div>
        </div>
        <div style={{ flex: '1 1 200px', background: ADMIN_COLORS.gray50, padding: 12, borderRadius: 8 }}>
          <div style={{ fontSize: 12, color: ADMIN_COLORS.gray500 }}>במחיר רגיל</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: ADMIN_COLORS.gray700 }}>
            {data.regularCount} משתתפים
          </div>
        </div>
      </div>
      {data.byTour.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={tableStyle}>
            <thead>
              <tr style={trHeadStyle}>
                <th style={thStyle}>סיור</th>
                <th style={thStyle}>סה״כ</th>
                <th style={thStyle}>חבילה</th>
                <th style={thStyle}>% חבילה</th>
              </tr>
            </thead>
            <tbody>
              {data.byTour.map((row) => (
                <tr key={row.tour_type} style={trBodyStyle}>
                  <td style={tdStyle}>{row.label}</td>
                  <td style={tdStyle}>{row.total}</td>
                  <td style={tdStyle}>{row.pkg}</td>
                  <td style={{ ...tdStyle, fontWeight: 600, color: row.pkgPct > 50 ? ADMIN_COLORS.green800 : ADMIN_COLORS.gray700 }}>
                    {row.pkgPct.toFixed(0)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ marginTop: 8, fontSize: 11, color: ADMIN_COLORS.gray500 }}>
        מזוהה לפי המחיר ששולם (אם המחיר ≤ מחיר חבילה, מוגדר כחבילה).
      </div>
    </div>
  );
}

// ===========================================================================
// Aggregations
// ===========================================================================

type AggregateRow = { label: string; count: number };
type DayMap = Record<number, Record<string, number>>;

function aggregateBy(bookings: RawBooking[], keyFn: (b: RawBooking) => string): AggregateRow[] {
  const map = new Map<string, number>();
  for (const b of bookings) {
    const key = keyFn(b);
    map.set(key, (map.get(key) || 0) + (b.people || 0));
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function aggregateByDayAndCustomer(bookings: RawBooking[], filterTourType: string): DayMap {
  const map: DayMap = {};
  for (const b of bookings) {
    if (filterTourType !== 'all' && b.tour?.tour_type !== filterTourType) continue;
    const date = b.tour?.tour_date;
    if (!date) continue;
    const dow = new Date(date + 'T12:00:00').getDay();
    const customer = b.customer_type || 'אחר';
    if (!map[dow]) map[dow] = {};
    map[dow][customer] = (map[dow][customer] || 0) + (b.people || 0);
  }
  return map;
}

function aggregateTipsByGuide(
  classicBookings: RawBooking[],
): { name: string; avg: number; collected: number; paying: number }[] {
  const map = new Map<string, { name: string; collected: number; paying: number }>();
  for (const b of classicBookings) {
    const guide = b.tour?.guide;
    if (!guide) continue;
    const existing = map.get(guide.id) || { name: guide.name, collected: 0, paying: 0 };
    existing.collected += b.price || 0;
    existing.paying += Math.max(0, (b.people || 0) - (b.kids || 0));
    map.set(guide.id, existing);
  }
  return Array.from(map.values())
    .filter((g) => g.paying > 0)
    .map((g) => ({ ...g, avg: g.collected / g.paying }))
    .sort((a, b) => b.avg - a.avg);
}

/** טיפ ממוצע פר קטגוריית לקוח. classic=true → משתמש ב-price; אחרת ב-tip. */
function aggregateTipByCustomer(bookings: RawBooking[], classic: boolean): { category: string; avg: number; people: number }[] {
  const map = new Map<string, { tip: number; people: number }>();
  for (const b of bookings) {
    if (classic && b.tour?.category !== 'classic') continue;
    if (!classic && b.tour?.category === 'classic') continue; // בכללי, לא להכליל קלאסי (כי שם הtip הוא ה-price)
    const cat = b.customer_type || 'אחר';
    const existing = map.get(cat) || { tip: 0, people: 0 };
    if (classic) {
      existing.tip += b.price || 0;
      existing.people += Math.max(0, (b.people || 0) - (b.kids || 0));
    } else {
      existing.tip += b.tip || 0;
      existing.people += b.people || 0;
    }
    map.set(cat, existing);
  }
  return Array.from(map.entries())
    .filter(([, v]) => v.people > 0)
    .map(([category, v]) => ({ category, avg: v.tip / v.people, people: v.people }))
    .sort((a, b) => b.avg - a.avg);
}

function aggregateTipBySource(
  bookings: RawBooking[],
): { source: string; avg: number; people: number; collected: number }[] {
  const map = new Map<string, { collected: number; people: number }>();
  for (const b of bookings) {
    if (b.tour?.category !== 'classic') continue; // רק קלאסי לטיפ פר מקור
    const src = b.source || 'אחר';
    const existing = map.get(src) || { collected: 0, people: 0 };
    existing.collected += b.price || 0;
    existing.people += Math.max(0, (b.people || 0) - (b.kids || 0));
    map.set(src, existing);
  }
  return Array.from(map.entries())
    .filter(([, v]) => v.people > 0)
    .map(([source, v]) => ({ source, avg: v.collected / v.people, people: v.people, collected: v.collected }))
    .sort((a, b) => b.avg - a.avg);
}

function aggregateOccupancy(bookings: RawBooking[]): OccupancyRow[] {
  // קבץ פר tour_id (להבדיל מ-booking)
  const tourMap = new Map<string, { tour_type: string; people: number }>();
  for (const b of bookings) {
    if (!b.tour) continue;
    if (b.tour.category === 'private') continue; // פרטיים — לא מציגים
    const tourId = `${b.tour.tour_date}_${b.tour.tour_type}_${b.tour.guide?.id}`;
    const existing = tourMap.get(tourId) || { tour_type: b.tour.tour_type, people: 0 };
    existing.people += b.people || 0;
    tourMap.set(tourId, existing);
  }
  // אגרגציה פר tour_type
  const byType = new Map<string, { tours: number; totalPeople: number; belowMin: number }>();
  for (const t of tourMap.values()) {
    const existing = byType.get(t.tour_type) || { tours: 0, totalPeople: 0, belowMin: 0 };
    existing.tours += 1;
    existing.totalPeople += t.people;
    const cap = TOUR_CAPACITY[t.tour_type];
    if (cap && t.people < cap.min) existing.belowMin += 1;
    byType.set(t.tour_type, existing);
  }
  return Array.from(byType.entries())
    .map(([tour_type, v]) => {
      const cap = TOUR_CAPACITY[tour_type];
      const avgPeople = v.tours > 0 ? v.totalPeople / v.tours : 0;
      return {
        tour_type,
        label: cap?.label || tour_type,
        tours: v.tours,
        avgPeople,
        min: cap?.min,
        max: cap?.max,
        belowMin: v.belowMin,
        occupancyPct: cap?.max ? (avgPeople / cap.max) * 100 : undefined,
      };
    })
    .sort((a, b) => b.tours - a.tours);
}

function aggregatePackageSplit(bookings: RawBooking[]): PackageSplit {
  // רק bookings בסיורים שיש להם מחיר חבילה (לא קלאסי, לא פרטי)
  let packageCount = 0;
  let regularCount = 0;
  const byTour = new Map<string, { tour_type: string; total: number; pkg: number }>();
  for (const b of bookings) {
    if (!b.tour) continue;
    const pkgPrice = PACKAGE_PRICES[b.tour.tour_type];
    if (pkgPrice === undefined) continue;
    // חישוב מחיר ממוצע פר אדם ב-booking
    const paying = Math.max(0, (b.people || 0) - (b.kids || 0));
    if (paying === 0) continue;
    const pricePerHead = (b.price || 0) / paying;
    const isPkg = pricePerHead <= pkgPrice + 0.5; // סובלנות עשרונית
    if (isPkg) packageCount += b.people || 0;
    else regularCount += b.people || 0;
    const existing = byTour.get(b.tour.tour_type) || { tour_type: b.tour.tour_type, total: 0, pkg: 0 };
    existing.total += b.people || 0;
    if (isPkg) existing.pkg += b.people || 0;
    byTour.set(b.tour.tour_type, existing);
  }
  return {
    total: packageCount + regularCount,
    packageCount,
    regularCount,
    byTour: Array.from(byTour.values())
      .map((v) => ({
        tour_type: v.tour_type,
        label: TOUR_CAPACITY[v.tour_type]?.label || v.tour_type,
        total: v.total,
        pkg: v.pkg,
        pkgPct: v.total > 0 ? (v.pkg / v.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total),
  };
}

// ===========================================================================
// Styles
// ===========================================================================

const tableStyle: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
};

const trHeadStyle: React.CSSProperties = {
  borderBottom: `2px solid ${ADMIN_COLORS.gray300}`,
};

const trBodyStyle: React.CSSProperties = {
  borderBottom: `1px solid ${ADMIN_COLORS.gray100}`,
};

const thStyle: React.CSSProperties = {
  textAlign: 'right',
  padding: '10px 8px',
  fontWeight: 600,
  color: ADMIN_COLORS.gray700,
  fontSize: 12,
};

const tdStyle: React.CSSProperties = {
  textAlign: 'right',
  padding: '8px',
  color: ADMIN_COLORS.gray700,
};

const selectStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 13,
  border: `1px solid ${ADMIN_COLORS.gray300}`,
  borderRadius: 6,
  background: '#fff',
  color: ADMIN_COLORS.gray700,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

// ===========================================================================
export default function AdminCustomersPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: ADMIN_COLORS.gray500 }}>טוענת...</div>}>
      <CustomersContent />
    </Suspense>
  );
}
