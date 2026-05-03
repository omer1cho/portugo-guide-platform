'use client';

/**
 * /admin/customers — ניתוח לקוחות.
 *
 * KPIs + 4 sections לחודש הנבחר, עם מסנן עיר (ליסבון/פורטו/הכל):
 *   1. מקורות לקוחות (גוגל/פייסבוק/חב"ד/...)
 *   2. קטגוריות לקוחות (זוג מבוגר/זוג צעיר/משפחה/...)
 *   3. לקוחות לפי יום בשבוע (טבלה דו-ממדית: יום × קטגוריה)
 *   4. ממוצע טיפ פר ראש בקלאסי לכל מדריך
 *
 * מקור הנתונים: bookings + tours + guides לחודש שנבחר ב-MonthSwitcher.
 */

import { useEffect, useState, Suspense } from 'react';
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

function CustomersContent() {
  const searchParams = useSearchParams();
  const now = new Date();
  const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : now.getFullYear();
  const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) - 1 : now.getMonth();
  const initialCity = (searchParams.get('city') as CityFilter) || 'all';
  const [cityFilter, setCityFilter] = useState<CityFilter>(initialCity);

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

      // join: bookings → tours → guides. הסינון לפי tour_date דרך הטיול
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

  // סינון לפי עיר (לוקאלי, על הנתונים שכבר נטענו)
  const filtered = bookings.filter((b) => {
    if (cityFilter === 'all') return true;
    return b.tour?.guide?.city === cityFilter;
  });

  // ─── אגרגציות ────────────────────────────────────────────────────────────
  const totalPeople = filtered.reduce((s, b) => s + (b.people || 0), 0);
  const totalKids = filtered.reduce((s, b) => s + (b.kids || 0), 0);
  const tourIds = new Set(
    filtered.map((b) => `${b.tour?.tour_date}_${b.tour?.tour_type}_${b.tour?.guide?.id}`),
  );
  const tourCount = tourIds.size;
  const avgPerTour = tourCount > 0 ? totalPeople / tourCount : 0;

  // ממוצע טיפ פר ראש בקלאסי (ללא ילדים)
  const classicBookings = filtered.filter((b) => b.tour?.category === 'classic');
  const classicCollected = classicBookings.reduce((s, b) => s + (b.price || 0), 0);
  const classicPaying = classicBookings.reduce(
    (s, b) => s + Math.max(0, (b.people || 0) - (b.kids || 0)),
    0,
  );
  const avgTipPerHead = classicPaying > 0 ? classicCollected / classicPaying : 0;

  // אחוז ילדים מסך המשתתפים
  const kidsPct = totalPeople > 0 ? (totalKids / totalPeople) * 100 : 0;

  // sections 1-3
  const bySource = aggregateBy(filtered, (b) => b.source || 'אחר');
  const byCustomer = aggregateBy(filtered, (b) => b.customer_type || 'אחר');
  const byDayAndCustomer = aggregateByDayAndCustomer(filtered);

  // section 4 — ממוצע טיפ פר ראש בקלאסי לכל מדריך
  const tipsByGuide = aggregateTipsByGuide(classicBookings);

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
            📊 ניתוח לקוחות
          </h1>
          <p style={{ fontSize: 14, color: ADMIN_COLORS.gray500, marginTop: 4 }}>
            {monthName(year, month)} — מקורות, קטגוריות, ימי שבוע
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
          {/* KPIs */}
          <section
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
            }}
          >
            <KpiCard label="סה״כ משתתפים" value={totalPeople.toLocaleString('he-IL')} />
            <KpiCard label="ממוצע אנשים פר סיור" value={avgPerTour.toFixed(1)} sub={`${tourCount} סיורים`} />
            <KpiCard
              label="ממוצע טיפ פר ראש (קלאסי)"
              value={fmtEuro(avgTipPerHead)}
              sub={`${classicPaying} משלמים · ${fmtEuro(classicCollected)} סה״כ`}
            />
            <KpiCard
              label="אחוז ילדים"
              value={`${kidsPct.toFixed(0)}%`}
              sub={`${totalKids} ילדים מתוך ${totalPeople}`}
            />
          </section>

          {totalPeople === 0 ? (
            <div style={{ background: '#fff', borderRadius: 12, padding: 40, textAlign: 'center', color: ADMIN_COLORS.gray500 }}>
              אין נתוני לקוחות בחודש זה
            </div>
          ) : (
            <>
              {/* Section 1 — מקורות */}
              <Section title="📍 מקורות לקוחות">
                <Distribution data={bySource} totalPeople={totalPeople} />
              </Section>

              {/* Section 2 — קטגוריות */}
              <Section title="👥 קטגוריות לקוחות">
                <Distribution data={byCustomer} totalPeople={totalPeople} />
              </Section>

              {/* Section 3 — לפי יום בשבוע */}
              <Section title="📅 לקוחות לפי יום בשבוע">
                <DayCustomerTable data={byDayAndCustomer} />
              </Section>

              {/* Section 4 — טיפ ממוצע פר מדריך */}
              {tipsByGuide.length > 0 && (
                <Section title="💰 ממוצע טיפ פר ראש (קלאסי) לכל מדריך">
                  <GuideTipsTable data={tipsByGuide} />
                </Section>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ===========================================================================
// Helpers — UI components
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
            transition: 'all 150ms',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: ADMIN_COLORS.green800, margin: '0 0 12px' }}>
        {title}
      </h2>
      <div style={{ background: '#fff', borderRadius: 12, padding: 16, boxShadow: '0 1px 3px rgba(0,0,0,.06)' }}>
        {children}
      </div>
    </section>
  );
}

/**
 * הצגת התפלגות (מקור / קטגוריה) — שורות עם bar אנכי, count, %
 */
function Distribution({ data, totalPeople }: { data: AggregateRow[]; totalPeople: number }) {
  if (data.length === 0) {
    return <div style={{ color: ADMIN_COLORS.gray500, textAlign: 'center', padding: 20 }}>אין נתונים</div>;
  }
  const maxCount = Math.max(...data.map((d) => d.count));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {data.map((d) => {
        const pct = totalPeople > 0 ? (d.count / totalPeople) * 100 : 0;
        const barWidth = maxCount > 0 ? (d.count / maxCount) * 100 : 0;
        return (
          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 130, fontSize: 13, color: ADMIN_COLORS.gray700 }}>{d.label}</div>
            <div style={{ flex: 1, position: 'relative', height: 24, background: ADMIN_COLORS.gray100, borderRadius: 4 }}>
              <div
                style={{
                  width: `${barWidth}%`,
                  height: '100%',
                  background: ADMIN_COLORS.green800,
                  borderRadius: 4,
                  transition: 'width 200ms',
                }}
              />
            </div>
            <div style={{ minWidth: 80, fontSize: 13, color: ADMIN_COLORS.gray700, textAlign: 'left' }}>
              <span style={{ fontWeight: 600 }}>{d.count}</span>{' '}
              <span style={{ color: ADMIN_COLORS.gray500, fontSize: 11 }}>({pct.toFixed(0)}%)</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayCustomerTable({ data }: { data: DayMap }) {
  // דניאל: לחץ על העיוות. בנייה של רשימה מקופלת
  const customerTypes = Array.from(
    new Set(
      Object.values(data)
        .flatMap((m) => Object.keys(m))
        .filter(Boolean),
    ),
  ).sort();

  if (customerTypes.length === 0) {
    return <div style={{ color: ADMIN_COLORS.gray500, textAlign: 'center', padding: 20 }}>אין נתונים</div>;
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${ADMIN_COLORS.gray300}` }}>
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
              <tr key={day} style={{ borderBottom: `1px solid ${ADMIN_COLORS.gray100}` }}>
                <td style={tdStyle}>{day}</td>
                {customerTypes.map((c) => (
                  <td key={c} style={tdStyle}>{dayData[c] || ''}</td>
                ))}
                <td style={{ ...tdStyle, fontWeight: 600 }}>{dayTotal}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function GuideTipsTable({ data }: { data: { name: string; avg: number; collected: number; paying: number }[] }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead>
          <tr style={{ borderBottom: `2px solid ${ADMIN_COLORS.gray300}` }}>
            <th style={thStyle}>מדריך.ה</th>
            <th style={thStyle}>נאסף סה״כ</th>
            <th style={thStyle}>משלמים</th>
            <th style={thStyle}>ממוצע טיפ פר ראש</th>
          </tr>
        </thead>
        <tbody>
          {data.map((g) => (
            <tr key={g.name} style={{ borderBottom: `1px solid ${ADMIN_COLORS.gray100}` }}>
              <td style={tdStyle}>{g.name}</td>
              <td style={tdStyle}>{fmtEuro(g.collected)}</td>
              <td style={tdStyle}>{g.paying}</td>
              <td style={{ ...tdStyle, fontWeight: 600, color: ADMIN_COLORS.green800 }}>
                {fmtEuro(g.avg)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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

// ===========================================================================
// Helpers — Aggregations
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

function aggregateByDayAndCustomer(bookings: RawBooking[]): DayMap {
  const map: DayMap = {};
  for (const b of bookings) {
    const date = b.tour?.tour_date;
    if (!date) continue;
    const dow = new Date(date + 'T12:00:00').getDay(); // 0-6 (Sun-Sat) שעון מקומי
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

// ===========================================================================
export default function AdminCustomersPage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: ADMIN_COLORS.gray500 }}>טוענת...</div>}>
      <CustomersContent />
    </Suspense>
  );
}
