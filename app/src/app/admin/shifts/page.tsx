'use client';

/**
 * /admin/shifts — לוח שיבוצים שבועי.
 *
 * עיצוב:
 *   - 7 ימים מימין לשמאל (ראשון-שבת); היום הנוכחי מודגש
 *   - בכל יום: חגים למעלה, ואז ליסבון בוקר → ליסבון צהריים → פורטו בוקר → פורטו צהריים
 *   - כל שיבוץ: שם הסיור הוא הכי בולט, השעה קטנה לצד, מדריך כצ׳יפ צבעוני
 *   - לכל מדריך צבע ייחודי לזיהוי מהיר
 *   - הtooltip של המדריך מציג את ה-availability_notes
 *
 * פעולות:
 *   - "פרסמי שבוע" — draft → published
 *   - "הוסיפי שיבוץ ידני" — לסיורים פרטיים
 *   - "מלאי קבע פורטו" — תום/דותן לפי הקבע
 */

import { useEffect, useMemo, useState, Suspense } from 'react';
import { ADMIN_COLORS } from '@/lib/admin/theme';
import {
  loadShiftsForWeek,
  loadAvailableGuides,
  assignGuide,
  publishWeek,
  createManualShift,
  deleteShift,
  weekStartOf,
  toIsoDate,
  addDays,
  tourTypeLabel,
  shortTime,
  type Shift,
} from '@/lib/admin/shifts-data';
import type { Guide } from '@/lib/supabase';
import { TOUR_TYPES } from '@/lib/supabase';
import { getCalendarEventsForDate } from '@/lib/calendar-events';

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

// Palette צבעים נעימה למדריכים — 8 צבעים עם ניגודיות טקסט גבוהה
const GUIDE_PALETTE: Array<{ bg: string; fg: string; border: string }> = [
  { bg: '#fce7f3', fg: '#9d174d', border: '#f9a8d4' }, // ורוד
  { bg: '#dbeafe', fg: '#1e40af', border: '#93c5fd' }, // כחול
  { bg: '#fef3c7', fg: '#92400e', border: '#fcd34d' }, // צהוב-חום
  { bg: '#d1fae5', fg: '#065f46', border: '#6ee7b7' }, // ירוק
  { bg: '#e9d5ff', fg: '#6b21a8', border: '#c4b5fd' }, // סגול
  { bg: '#fed7aa', fg: '#9a3412', border: '#fdba74' }, // כתום
  { bg: '#cffafe', fg: '#155e75', border: '#67e8f9' }, // טורקיז
  { bg: '#fecaca', fg: '#991b1b', border: '#fca5a5' }, // אדום
];

function guideColor(guideId: string | null, guides: Guide[]): { bg: string; fg: string; border: string } | null {
  if (!guideId) return null;
  const idx = guides.findIndex((g) => g.id === guideId);
  if (idx < 0) return null;
  return GUIDE_PALETTE[idx % GUIDE_PALETTE.length];
}

function fmtDayLabel(d: Date): string {
  const dow = DAY_NAMES[d.getDay()];
  return `${dow} · ${d.getDate()}/${d.getMonth() + 1}`;
}

function fmtWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  return `${weekStart.getDate()}/${weekStart.getMonth() + 1} – ${end.getDate()}/${end.getMonth() + 1}`;
}

// ─── Porto permanent roster (קבע מאי-יולי לפי הקובץ של עומר) ───
// dayOfWeek: 0=ראשון, 1=שני, 2=שלישי, 3=רביעי, 4=חמישי, 5=שישי, 6=שבת
type PortoSlot = { dayOfWeek: number; tour_type: string; time: string; guide_name: string };
const PORTO_ROSTER: PortoSlot[] = [
  { dayOfWeek: 0, tour_type: 'פורטו_1', time: '09:45', guide_name: 'תום' },
  { dayOfWeek: 1, tour_type: 'פורטו_1', time: '09:45', guide_name: 'תום' },
  { dayOfWeek: 2, tour_type: 'פורטו_1', time: '09:45', guide_name: 'דותן' },
  { dayOfWeek: 2, tour_type: 'טעימות', time: '14:30', guide_name: 'דותן' },
  { dayOfWeek: 3, tour_type: 'דורו', time: '08:20', guide_name: 'תום' },
  { dayOfWeek: 3, tour_type: 'פורטו_1', time: '09:45', guide_name: 'דותן' },
  { dayOfWeek: 4, tour_type: 'פורטו_1', time: '09:45', guide_name: 'תום' },
  { dayOfWeek: 4, tour_type: 'טעימות', time: '14:30', guide_name: 'תום' },
  { dayOfWeek: 5, tour_type: 'דורו', time: '08:20', guide_name: 'תום' },
  { dayOfWeek: 5, tour_type: 'פורטו_1', time: '10:30', guide_name: 'דותן' },
  // שבת — מתחלפים תום/דותן לפי שבוע, אז לא בקבע אוטומטי
];

export default function AdminShiftsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 20 }}>טוענים...</div>}>
      <ShiftsContent />
    </Suspense>
  );
}

function ShiftsContent() {
  const [weekStart, setWeekStart] = useState<Date>(() => weekStartOf(new Date()));
  const [cityFilter, setCityFilter] = useState<'all' | 'lisbon' | 'porto'>('all');
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [guides, setGuides] = useState<Guide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGuidesPanel, setShowGuidesPanel] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [autofilling, setAutofilling] = useState(false);
  const [reloadCounter, setReloadCounter] = useState(0);

  function reload() { setReloadCounter((c) => c + 1); }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([loadShiftsForWeek(weekStart, cityFilter), loadAvailableGuides()])
      .then(([s, g]) => {
        if (cancelled) return;
        setShifts(s);
        setGuides(g);
      })
      .catch((e) => !cancelled && setError(e.message || 'משהו השתבש'))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [weekStart, cityFilter, reloadCounter]);

  // קיבוץ שיבוצים לפי יום
  const shiftsByDay = useMemo(() => {
    const map = new Map<string, Shift[]>();
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      map.set(toIsoDate(d), []);
    }
    for (const s of shifts) {
      const arr = map.get(s.shift_date);
      if (arr) arr.push(s);
    }
    return map;
  }, [shifts, weekStart]);

  const totalDraftCount = shifts.filter((s) => s.status === 'draft').length;
  const assignedDraftCount = shifts.filter((s) => s.status === 'draft' && s.guide_id).length;
  const unassignedCount = shifts.filter((s) => !s.guide_id && s.status !== 'cancelled').length;

  async function handlePublishWeek() {
    if (!confirm(`לפרסם ${totalDraftCount} שיבוצים לשבוע ${fmtWeekRange(weekStart)}?`)) return;
    setPublishing(true);
    try {
      const n = await publishWeek(weekStart, cityFilter);
      alert(`פורסמו ${n} שיבוצים`);
      reload();
    } catch (e) {
      alert('פרסום נכשל: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setPublishing(false);
    }
  }

  async function handleAutofillPorto() {
    // מקצים מדריכים לפי PORTO_ROSTER לכל shift של פורטו שאין לו מדריך
    const tomGuide = guides.find((g) => g.name === 'תום');
    const dotanGuide = guides.find((g) => g.name === 'דותן');
    if (!tomGuide || !dotanGuide) {
      alert('לא נמצאו תום או דותן ברשימת המדריכים');
      return;
    }
    const portoShifts = shifts.filter((s) => s.city === 'porto' && !s.guide_id && s.status === 'draft');
    if (portoShifts.length === 0) {
      alert('אין שיבוצי פורטו ללא מדריך השבוע');
      return;
    }
    const matches: { shift: Shift; guideId: string; guideName: string }[] = [];
    for (const s of portoShifts) {
      const dt = new Date(s.shift_date + 'T00:00:00');
      const dow = dt.getDay();
      const time = shortTime(s.shift_time);
      const slot = PORTO_ROSTER.find((r) => r.dayOfWeek === dow && r.tour_type === s.tour_type && r.time === time);
      if (!slot) continue;
      const g = slot.guide_name === 'תום' ? tomGuide : dotanGuide;
      matches.push({ shift: s, guideId: g.id, guideName: slot.guide_name });
    }
    if (matches.length === 0) {
      alert('לא נמצאו שיבוצים שתואמים את הקבע. השוואה לפי יום+שעה+סוג סיור.');
      return;
    }
    if (!confirm(`להקצות ${matches.length} מדריכים לפי קבע פורטו?\n(שבת מתחלפת ולא נכלל באוטו.)`)) return;
    setAutofilling(true);
    try {
      for (const m of matches) {
        await assignGuide(m.shift.id, m.guideId);
      }
      alert(`הוקצו ${matches.length} שיבוצים`);
      reload();
    } catch (e) {
      alert('שיבוץ נכשל: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setAutofilling(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }} dir="rtl">
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: ADMIN_COLORS.green900, margin: 0 }}>
            🗓️ לוח שיבוצים
          </h1>
          <p style={{ fontSize: 13, color: ADMIN_COLORS.gray500, margin: '4px 0 0' }}>
            סיורים מסונכרנים אוטומטית מ-portugo.co.il כל לילה
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <CitySwitcher value={cityFilter} onChange={setCityFilter} />
          <button onClick={() => setShowGuidesPanel(true)} style={secondaryBtnStyle}>
            👥 פרטי מדריכים
          </button>
          <button onClick={handleAutofillPorto} disabled={autofilling} style={secondaryBtnStyle}>
            🤖 מלאי קבע פורטו
          </button>
          <button onClick={() => setShowAddModal(true)} style={secondaryBtnStyle}>
            + הוסיפי שיבוץ
          </button>
          <button
            onClick={handlePublishWeek}
            disabled={publishing || totalDraftCount === 0}
            style={{
              padding: '8px 14px',
              background: totalDraftCount > 0 ? ADMIN_COLORS.green700 : ADMIN_COLORS.gray300,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: totalDraftCount > 0 ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
            }}
          >
            📤 פרסמי שבוע ({totalDraftCount})
          </button>
        </div>
      </header>

      {/* Week switcher */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} style={navBtnStyle}>שבוע הבא ▶</button>
        <div style={{ minWidth: 200, textAlign: 'center', fontSize: 16, fontWeight: 600, color: ADMIN_COLORS.gray700 }}>
          {fmtWeekRange(weekStart)}
        </div>
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} style={navBtnStyle}>◀ שבוע קודם</button>
        <button onClick={() => setWeekStart(weekStartOf(new Date()))} style={{ ...navBtnStyle, marginRight: 12 }}>
          השבוע
        </button>
      </div>

      {/* Summary chips */}
      {!loading && shifts.length > 0 && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: ADMIN_COLORS.gray700 }}>
          <Chip color="green" label={`${assignedDraftCount} משובצים`} />
          {unassignedCount > 0 && <Chip color="yellow" label={`${unassignedCount} ממתינים לשיבוץ`} />}
          {shifts.filter((s) => s.status === 'published').length > 0 && (
            <Chip color="blue" label={`${shifts.filter((s) => s.status === 'published').length} פורסמו`} />
          )}
          {shifts.filter((s) => s.status === 'cancelled').length > 0 && (
            <Chip color="red" label={`${shifts.filter((s) => s.status === 'cancelled').length} בוטלו`} />
          )}
        </div>
      )}

      {/* Loading / error */}
      {loading && <div style={{ padding: 30, textAlign: 'center', color: ADMIN_COLORS.gray500 }}>טוענים שיבוצים...</div>}
      {error && <div style={{ padding: 16, background: '#fef2f2', color: '#991b1b', borderRadius: 8 }}>{error}</div>}

      {/* Week board */}
      {!loading && !error && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 8,
          }}
          data-shifts-board
        >
          {Array.from({ length: 7 }).map((_, i) => {
            const d = addDays(weekStart, i);
            const isoDate = toIsoDate(d);
            const dayShifts = shiftsByDay.get(isoDate) || [];
            return (
              <DayColumn
                key={isoDate}
                date={d}
                shifts={dayShifts}
                guides={guides}
                onChange={reload}
              />
            );
          })}
        </div>
      )}

      <style jsx>{`
        @media (max-width: 900px) {
          [data-shifts-board] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {showAddModal && (
        <ManualAddModal
          weekStart={weekStart}
          guides={guides}
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); reload(); }}
        />
      )}
      {showGuidesPanel && (
        <GuidesPanel guides={guides} onClose={() => setShowGuidesPanel(false)} />
      )}
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  padding: '6px 12px', background: '#fff', border: `1px solid ${ADMIN_COLORS.gray300}`,
  borderRadius: 6, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', color: ADMIN_COLORS.gray700,
};
const secondaryBtnStyle: React.CSSProperties = {
  padding: '8px 14px', background: '#fff', border: `1px solid ${ADMIN_COLORS.gray300}`,
  borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
  fontFamily: 'inherit', color: ADMIN_COLORS.gray700,
};

function Chip({ color, label }: { color: 'green' | 'yellow' | 'red' | 'blue'; label: string }) {
  const styles: Record<string, { bg: string; fg: string }> = {
    green: { bg: '#d1fae5', fg: '#065f46' },
    yellow: { bg: '#fef3c7', fg: '#92400e' },
    red: { bg: '#fee2e2', fg: '#991b1b' },
    blue: { bg: '#dbeafe', fg: '#1e40af' },
  };
  const s = styles[color];
  return (
    <span style={{ background: s.bg, color: s.fg, padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 }}>
      {label}
    </span>
  );
}

function CitySwitcher({ value, onChange }: { value: 'all' | 'lisbon' | 'porto'; onChange: (v: 'all' | 'lisbon' | 'porto') => void }) {
  const opts: { v: typeof value; label: string }[] = [
    { v: 'all', label: 'הכל' },
    { v: 'lisbon', label: 'ליסבון' },
    { v: 'porto', label: 'פורטו' },
  ];
  return (
    <div style={{ display: 'flex', background: '#fff', border: `1px solid ${ADMIN_COLORS.gray300}`, borderRadius: 8, overflow: 'hidden' }}>
      {opts.map((o) => (
        <button
          key={o.v}
          onClick={() => onChange(o.v)}
          style={{
            padding: '6px 12px',
            background: value === o.v ? ADMIN_COLORS.green700 : 'transparent',
            color: value === o.v ? '#fff' : ADMIN_COLORS.gray700,
            border: 'none', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function DayColumn({ date, shifts, guides, onChange }: { date: Date; shifts: Shift[]; guides: Guide[]; onChange: () => void }) {
  const isToday = toIsoDate(date) === toIsoDate(new Date());
  const events = getCalendarEventsForDate(toIsoDate(date)).filter((e) => e.category === 'israel' || e.category === 'portugal');

  // קיבוץ: city × time-slot
  const lisbonMorning = shifts.filter((s) => s.city === 'lisbon' && parseInt(s.shift_time) < 13);
  const lisbonAfternoon = shifts.filter((s) => s.city === 'lisbon' && parseInt(s.shift_time) >= 13);
  const portoMorning = shifts.filter((s) => s.city === 'porto' && parseInt(s.shift_time) < 13);
  const portoAfternoon = shifts.filter((s) => s.city === 'porto' && parseInt(s.shift_time) >= 13);

  const hasLisbon = lisbonMorning.length > 0 || lisbonAfternoon.length > 0;
  const hasPorto = portoMorning.length > 0 || portoAfternoon.length > 0;

  return (
    <div
      style={{
        background: isToday ? '#f0fdf4' : '#fff',
        border: `1px solid ${isToday ? ADMIN_COLORS.green700 : ADMIN_COLORS.gray300}`,
        borderRadius: 10,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        minHeight: 140,
      }}
    >
      {/* כותרת היום */}
      <div
        style={{
          fontSize: 13,
          fontWeight: 700,
          color: isToday ? ADMIN_COLORS.green800 : ADMIN_COLORS.gray700,
          textAlign: 'center',
          paddingBottom: 6,
          borderBottom: `1px solid ${ADMIN_COLORS.gray100}`,
        }}
      >
        {fmtDayLabel(date)}
      </div>

      {/* חגים */}
      {events.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {events.map((e, i) => (
            <div
              key={i}
              style={{
                fontSize: 10,
                background: e.category === 'israel' ? '#fef3c7' : '#dbeafe',
                color: e.category === 'israel' ? '#854d0e' : '#1e40af',
                padding: '3px 6px',
                borderRadius: 4,
                textAlign: 'center',
                fontWeight: 600,
              }}
              title={e.text}
            >
              {e.text}
            </div>
          ))}
        </div>
      )}

      {/* אם אין שיבוצים בכלל */}
      {!hasLisbon && !hasPorto && (
        <div style={{ fontSize: 11, color: ADMIN_COLORS.gray500, textAlign: 'center', padding: '12px 0' }}>—</div>
      )}

      {/* ליסבון */}
      {hasLisbon && (
        <CitySection
          label="🇵🇹 ליסבון"
          color="#f0fdf4"
          morning={lisbonMorning}
          afternoon={lisbonAfternoon}
          guides={guides}
          onChange={onChange}
        />
      )}

      {/* פורטו (תמיד מתחת לליסבון) */}
      {hasPorto && (
        <CitySection
          label="🏛️ פורטו"
          color="#fef3c7"
          morning={portoMorning}
          afternoon={portoAfternoon}
          guides={guides}
          onChange={onChange}
        />
      )}
    </div>
  );
}

function CitySection({
  label, color, morning, afternoon, guides, onChange,
}: {
  label: string;
  color: string;
  morning: Shift[];
  afternoon: Shift[];
  guides: Guide[];
  onChange: () => void;
}) {
  return (
    <div style={{ background: color, borderRadius: 6, padding: 5, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: ADMIN_COLORS.gray700, opacity: 0.8 }}>
        {label}
      </div>
      {morning.length > 0 && (
        <TimeSlotGroup label="🌅" shifts={morning} guides={guides} onChange={onChange} />
      )}
      {afternoon.length > 0 && (
        <TimeSlotGroup label="☀️" shifts={afternoon} guides={guides} onChange={onChange} />
      )}
    </div>
  );
}

function TimeSlotGroup({ label, shifts, guides, onChange }: { label: string; shifts: Shift[]; guides: Guide[]; onChange: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      {shifts.map((s) => (
        <ShiftCard key={s.id} shift={s} guides={guides} onChange={onChange} timeSlotIcon={label} />
      ))}
    </div>
  );
}

function ShiftCard({ shift, guides, onChange, timeSlotIcon }: { shift: Shift; guides: Guide[]; onChange: () => void; timeSlotIcon: string }) {
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  const eligibleGuides = useMemo(() => {
    return guides.filter((g) => {
      if (g.city !== shift.city) return false;
      const qt = g.qualified_tours || [];
      if (qt.length > 0 && !qt.includes(shift.tour_type)) return false;
      return true;
    });
  }, [guides, shift.city, shift.tour_type]);

  const currentGuide = guides.find((g) => g.id === shift.guide_id);
  const guideClr = guideColor(shift.guide_id, guides);

  async function handleAssign(guideId: string | null) {
    setBusy(true);
    setPickerOpen(false);
    try {
      await assignGuide(shift.id, guideId);
      onChange();
    } catch (e) {
      alert('משהו השתבש: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`למחוק את השיבוץ של ${tourTypeLabel(shift.tour_type)} ב-${shortTime(shift.shift_time)}?`)) return;
    setBusy(true);
    try {
      await deleteShift(shift.id);
      onChange();
    } catch (e) {
      alert('משהו השתבש: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  }

  // מסגרת לכרטיס לפי סטטוס
  let cardBg: string = '#fff';
  let cardBorder: string = ADMIN_COLORS.gray300;
  if (shift.status === 'cancelled') {
    cardBg = '#fef2f2';
    cardBorder = '#fca5a5';
  } else if (shift.status === 'published') {
    cardBorder = '#93c5fd';
  }

  return (
    <div
      style={{
        background: cardBg,
        border: `1px solid ${cardBorder}`,
        borderRadius: 6,
        padding: '5px 7px',
        opacity: shift.status === 'cancelled' ? 0.7 : 1,
        position: 'relative',
      }}
    >
      {/* שורה 1: סוג סיור (גדול ובולט) + שעה (קטנה לצד) + סטטוס */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: ADMIN_COLORS.gray900, flex: 1, lineHeight: 1.2 }}>
          {tourTypeLabel(shift.tour_type)}
        </span>
        <span style={{ fontSize: 10, color: ADMIN_COLORS.gray500, whiteSpace: 'nowrap' }}>
          {timeSlotIcon} {shortTime(shift.shift_time)}
        </span>
        {shift.source === 'manual' && (
          <span title="הוסף ידנית" style={{ fontSize: 10 }}>✏️</span>
        )}
        {shift.status === 'published' && (
          <span title="פורסם" style={{ fontSize: 10 }}>📤</span>
        )}
      </div>

      {/* שורה 2: מדריך כצ'יפ צבעוני, או placeholder */}
      {shift.status === 'cancelled' ? (
        <div style={{ fontSize: 10, color: '#991b1b', fontStyle: 'italic' }}>
          {shift.notes || 'בוטל'}
        </div>
      ) : currentGuide && guideClr ? (
        <button
          onClick={() => setPickerOpen(!pickerOpen)}
          disabled={busy}
          title={currentGuide.availability_notes || ''}
          style={{
            background: guideClr.bg,
            color: guideClr.fg,
            border: `1px solid ${guideClr.border}`,
            borderRadius: 4,
            padding: '3px 8px',
            fontSize: 12,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            width: '100%',
            textAlign: 'right',
          }}
        >
          {currentGuide.name}
        </button>
      ) : (
        <button
          onClick={() => setPickerOpen(!pickerOpen)}
          disabled={busy}
          style={{
            background: '#fff',
            color: ADMIN_COLORS.gray500,
            border: `1px dashed ${ADMIN_COLORS.gray300}`,
            borderRadius: 4,
            padding: '3px 8px',
            fontSize: 11,
            cursor: 'pointer',
            fontFamily: 'inherit',
            width: '100%',
            textAlign: 'right',
          }}
        >
          + לשבץ מדריך
        </button>
      )}

      {/* הערות אופציונליות */}
      {shift.notes && shift.status !== 'cancelled' && (
        <div style={{ fontSize: 10, color: '#a37b00', marginTop: 3, fontStyle: 'italic' }}>
          ℹ️ {shift.notes}
        </div>
      )}

      {/* Picker dropdown — מופיע מעל הכרטיס */}
      {pickerOpen && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            right: 0,
            left: 0,
            marginTop: 2,
            background: '#fff',
            border: `1px solid ${ADMIN_COLORS.gray300}`,
            borderRadius: 6,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 5,
            maxHeight: 200,
            overflowY: 'auto',
          }}
        >
          <button
            onClick={() => handleAssign(null)}
            disabled={busy}
            style={pickerItemStyle({ bg: '#fff', fg: ADMIN_COLORS.gray500, border: 'transparent' }, true)}
          >
            — להסיר שיבוץ —
          </button>
          {eligibleGuides.map((g) => {
            const c = guideColor(g.id, guides);
            return (
              <button
                key={g.id}
                onClick={() => handleAssign(g.id)}
                disabled={busy}
                style={pickerItemStyle(c || { bg: '#fff', fg: '#000', border: 'transparent' })}
              >
                {g.name}{g.requires_pre_approval ? ' ⚠️' : ''}
              </button>
            );
          })}
          <button
            onClick={handleDelete}
            disabled={busy}
            style={{
              ...pickerItemStyle({ bg: '#fff', fg: '#991b1b', border: 'transparent' }, true),
              borderTop: `1px solid ${ADMIN_COLORS.gray300}`,
              fontSize: 11,
            }}
          >
            🗑️ מחקי שיבוץ
          </button>
        </div>
      )}
    </div>
  );
}

function pickerItemStyle(c: { bg: string; fg: string; border: string }, italic = false): React.CSSProperties {
  return {
    display: 'block',
    width: '100%',
    padding: '6px 10px',
    background: c.bg,
    color: c.fg,
    border: 'none',
    borderBottom: `1px solid ${ADMIN_COLORS.gray100}`,
    fontSize: 12,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textAlign: 'right',
    fontStyle: italic ? 'italic' : 'normal',
    fontWeight: italic ? 400 : 600,
  };
}

function GuidesPanel({ guides, onClose }: { guides: Guide[]; onClose: () => void }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12, padding: 20,
          width: '100%', maxWidth: 600, maxHeight: '85vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: 12,
        }}
        dir="rtl"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: ADMIN_COLORS.green900 }}>
            👥 פרטי מדריכים
          </h3>
          <button onClick={onClose} style={navBtnStyle}>סגור</button>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: ADMIN_COLORS.gray500 }}>
          זמינות, חופשות, וסיורים שכל מדריך מוסמך להוביל
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {guides.map((g) => {
            const c = guideColor(g.id, guides);
            return (
              <div
                key={g.id}
                style={{
                  background: '#f9fafb',
                  border: `1px solid ${ADMIN_COLORS.gray100}`,
                  borderRadius: 8,
                  padding: 12,
                  borderRight: c ? `4px solid ${c.border}` : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  {c && (
                    <span
                      style={{
                        background: c.bg,
                        color: c.fg,
                        padding: '2px 10px',
                        borderRadius: 12,
                        fontSize: 13,
                        fontWeight: 700,
                      }}
                    >
                      {g.name}
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: ADMIN_COLORS.gray500 }}>
                    {g.city === 'lisbon' ? 'ליסבון' : 'פורטו'}
                  </span>
                  {g.requires_pre_approval && (
                    <span style={{ fontSize: 11, color: '#a37b00' }}>⚠️ דורש אישור מראש</span>
                  )}
                </div>
                {g.availability_notes && (
                  <div style={{ fontSize: 12, color: ADMIN_COLORS.gray700, marginBottom: 4 }}>
                    <strong>זמינות:</strong> {g.availability_notes}
                  </div>
                )}
                {g.vacation_notes && (
                  <div style={{ fontSize: 12, color: '#a37b00', marginBottom: 4 }}>
                    <strong>חופשות:</strong> {g.vacation_notes}
                  </div>
                )}
                {g.qualified_tours && g.qualified_tours.length > 0 && (
                  <div style={{ fontSize: 11, color: ADMIN_COLORS.gray500 }}>
                    <strong>סיורים:</strong>{' '}
                    {g.qualified_tours.map((t) => tourTypeLabel(t)).join(' · ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function ManualAddModal({
  weekStart, guides, onClose, onCreated,
}: {
  weekStart: Date;
  guides: Guide[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const [date, setDate] = useState(toIsoDate(weekStart));
  const [time, setTime] = useState('10:00');
  const [city, setCity] = useState<'lisbon' | 'porto'>('lisbon');
  const [tourType, setTourType] = useState('פרטי_1');
  const [guideId, setGuideId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const tourOptions = TOUR_TYPES[city];
  const eligibleGuides = useMemo(
    () => guides.filter((g) => g.city === city && (!g.qualified_tours?.length || g.qualified_tours.includes(tourType))),
    [guides, city, tourType],
  );

  async function handleSave() {
    setErr('');
    if (!date || !time || !tourType) {
      setErr('צריך תאריך, שעה וסוג סיור');
      return;
    }
    setSaving(true);
    try {
      await createManualShift({
        shift_date: date,
        shift_time: time,
        city,
        tour_type: tourType,
        guide_id: guideId || null,
        notes: notes || undefined,
      });
      onCreated();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'משהו השתבש');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50, padding: 16,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 12, padding: 20,
          width: '100%', maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 12,
        }}
        dir="rtl"
      >
        <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: ADMIN_COLORS.green900 }}>
          הוסיפי שיבוץ ידני
        </h3>
        <p style={{ margin: 0, fontSize: 12, color: ADMIN_COLORS.gray500 }}>
          לסיורים פרטיים או חד-פעמיים שלא מסונכרנים מהאתר
        </p>
        <label style={labelStyle}>תאריך
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>שעה
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>עיר
          <select value={city} onChange={(e) => { setCity(e.target.value as 'lisbon' | 'porto'); setTourType(e.target.value === 'lisbon' ? 'פרטי_1' : 'פרטי_2'); }} style={inputStyle}>
            <option value="lisbon">ליסבון</option>
            <option value="porto">פורטו</option>
          </select>
        </label>
        <label style={labelStyle}>סוג סיור
          <select value={tourType} onChange={(e) => setTourType(e.target.value)} style={inputStyle}>
            {tourOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label style={labelStyle}>מדריך (אופציונלי)
          <select value={guideId} onChange={(e) => setGuideId(e.target.value)} style={inputStyle}>
            <option value="">— ללא שיבוץ עדיין —</option>
            {eligibleGuides.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <label style={labelStyle}>הערה (אופציונלי)
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="לדוג': משפחת כהן, 4 אנשים" style={inputStyle} />
        </label>
        {err && <div style={{ fontSize: 12, color: '#991b1b' }}>{err}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
          <button onClick={onClose} disabled={saving} style={{ ...navBtnStyle, flex: 1 }}>ביטול</button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 2, padding: '8px 14px', background: ADMIN_COLORS.green700, color: '#fff',
              border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
            }}
          >
            {saving ? 'שומר...' : 'הוסיפי'}
          </button>
        </div>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'flex', flexDirection: 'column', gap: 4,
  fontSize: 12, color: ADMIN_COLORS.gray700, fontWeight: 600,
};
const inputStyle: React.CSSProperties = {
  padding: '8px 10px', fontSize: 13, borderRadius: 6,
  border: `1px solid ${ADMIN_COLORS.gray300}`, fontFamily: 'inherit',
};
