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
  updateShift,
  updateGuideAvailability,
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

// סוגי סיור פרטיים — מוצגים אחרת בכרטיס (פוקוס על שם הלקוח/סוג, לא על "פרטי_1")
const PRIVATE_TOUR_TYPES = new Set(['פרטי_1', 'פרטי_2']);

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
//
// בימי רביעי ושישי, הסיור הקלאסי 9:45 (רביעי) / 10:30 (שישי) הוא תלוי-דורו:
// במקרה שהדורו יוצא — דותן מוביל. במקרה שלא — תום מוביל.
// לכן לאותו slot יש שתי רשומות: ה-"primary" יישב על השיבוץ הקיים מהאתר,
// וה-"secondary" ייוצר כשיבוץ ידני נוסף, כך ששני המדריכים יראו אותו במשמרות שלהם.
type PortoSlot = {
  dayOfWeek: number;
  tour_type: string;
  time: string;
  guide_name: string;
  notes?: string;
  /** שם מדריך נוסף שיווצר על אותו slot כשיבוץ-גיבוי (manual) */
  secondary?: { guide_name: string; notes: string };
};
const PORTO_ROSTER: PortoSlot[] = [
  { dayOfWeek: 0, tour_type: 'פורטו_1', time: '09:45', guide_name: 'תום' },
  { dayOfWeek: 1, tour_type: 'פורטו_1', time: '09:45', guide_name: 'תום' },
  { dayOfWeek: 2, tour_type: 'פורטו_1', time: '09:45', guide_name: 'דותן' },
  { dayOfWeek: 2, tour_type: 'טעימות', time: '14:30', guide_name: 'דותן' },
  { dayOfWeek: 3, tour_type: 'דורו', time: '08:20', guide_name: 'תום' },
  {
    dayOfWeek: 3, tour_type: 'פורטו_1', time: '09:45',
    guide_name: 'דותן', notes: 'אם הדורו יוצא',
    secondary: { guide_name: 'תום', notes: 'אם הדורו לא יוצא' },
  },
  { dayOfWeek: 4, tour_type: 'פורטו_1', time: '09:45', guide_name: 'תום' },
  { dayOfWeek: 4, tour_type: 'טעימות', time: '14:30', guide_name: 'תום' },
  { dayOfWeek: 5, tour_type: 'דורו', time: '08:20', guide_name: 'תום' },
  {
    dayOfWeek: 5, tour_type: 'פורטו_1', time: '10:30',
    guide_name: 'דותן', notes: 'אם הדורו יוצא',
    secondary: { guide_name: 'תום', notes: 'אם הדורו לא יוצא' },
  },
  // שבת — מתחלפים תום/דותן לפי שבוע, אז לא בקבע אוטומטי
];

/**
 * אוטופיל שקט של קבע פורטו, רץ בכל טעינה של שבוע.
 *
 * עבור כל slot ב-PORTO_ROSTER:
 *   - אם יש shift מתאים (יום+שעה+סוג סיור) ללא מדריך — נקצה את המדריך הראשי
 *     ונסמן את ה-notes (אם יש) כדי שעומר תראה "אם הדורו יוצא".
 *   - אם ל-slot יש secondary (תום בגיבוי) — ניצור shift ידני נוסף עם המדריך
 *     הגיבוי, אלא אם כבר קיים אחד כזה. שני המדריכים יראו את עצמם משובצים.
 *
 * מחזיר את כמות הפעולות שבוצעו — אם > 0, הקורא ירענן.
 */
async function silentApplyPortoRoster(allShifts: Shift[], allGuides: Guide[]): Promise<number> {
  let actions = 0;
  const guideByName = new Map<string, Guide>();
  for (const g of allGuides) guideByName.set(g.name, g);

  // נבדוק רק שיבוצי פורטו של השבוע הזה
  const portoShifts = allShifts.filter((s) => s.city === 'porto' && s.status !== 'cancelled');
  if (portoShifts.length === 0) return 0;

  // שלב 1: שיבוץ ראשי לכל shift פורטו ללא מדריך
  for (const s of portoShifts) {
    if (s.guide_id) continue;
    const dow = new Date(s.shift_date + 'T00:00:00').getDay();
    const time = shortTime(s.shift_time);
    const slot = PORTO_ROSTER.find(
      (r) => r.dayOfWeek === dow && r.tour_type === s.tour_type && r.time === time,
    );
    if (!slot) continue;
    const g = guideByName.get(slot.guide_name);
    if (!g) continue;
    try {
      await assignGuide(s.id, g.id);
      // אם יש notes ולא הוגדר עדיין על ה-shift, נכתוב גם אותם
      if (slot.notes && !s.notes) {
        await updateShift(s.id, { notes: slot.notes });
      }
      actions++;
    } catch {
      // אם נכשל — לא חוסמים, רק לא מתקדמים
    }
  }

  // שלב 2: ליצור secondary shifts (תום-גיבוי) על כל slot שיש לו secondary
  // ב-portoShifts יש כל הסיורים — חיפוש לפי תאריך+שעה+סוג ידעת אם כבר קיים secondary
  for (const s of portoShifts) {
    const dow = new Date(s.shift_date + 'T00:00:00').getDay();
    const time = shortTime(s.shift_time);
    const slot = PORTO_ROSTER.find(
      (r) => r.dayOfWeek === dow && r.tour_type === s.tour_type && r.time === time,
    );
    if (!slot || !slot.secondary) continue;
    const sec = guideByName.get(slot.secondary.guide_name);
    if (!sec) continue;
    // האם כבר קיים secondary shift על אותו תאריך+שעה+סוג עם המדריך הזה?
    const exists = allShifts.some(
      (x) =>
        x.shift_date === s.shift_date &&
        shortTime(x.shift_time) === time &&
        x.tour_type === s.tour_type &&
        x.guide_id === sec.id,
    );
    if (exists) continue;
    try {
      await createManualShift({
        shift_date: s.shift_date,
        shift_time: time,
        tour_type: s.tour_type,
        city: 'porto',
        guide_id: sec.id,
        notes: slot.secondary.notes,
      });
      actions++;
    } catch {
      // skip silently
    }
  }

  return actions;
}

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
  const [reloadCounter, setReloadCounter] = useState(0);

  function reload() { setReloadCounter((c) => c + 1); }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([loadShiftsForWeek(weekStart, cityFilter), loadAvailableGuides()])
      .then(async ([s, g]) => {
        if (cancelled) return;
        // אוטופיל שקט של קבע פורטו: אם נמצאו שיבוצים ללא מדריך או secondary חסר,
        // נחיל את הקבע ונטען שוב. בלי הודעה, בלי כפתור.
        const applied = await silentApplyPortoRoster(s, g);
        if (cancelled) return;
        if (applied > 0) {
          const fresh = await loadShiftsForWeek(weekStart, cityFilter);
          if (cancelled) return;
          setShifts(fresh);
        } else {
          setShifts(s);
        }
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

  // ה-autofill עבר להיות שקט ואוטומטי — ראי silentApplyPortoRoster למעלה.
  // עומר תמיד יכולה לערוך/למחוק/להוסיף ידנית בלוח עצמו.

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
        <GuidesPanel
          guides={guides}
          onClose={() => setShowGuidesPanel(false)}
          onChanged={reload}
        />
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
          label="ליסבון"
          color="#f0fdf4"
          labelColor={ADMIN_COLORS.green800}
          morning={lisbonMorning}
          afternoon={lisbonAfternoon}
          guides={guides}
          onChange={onChange}
        />
      )}

      {/* פורטו (תמיד מתחת לליסבון) */}
      {hasPorto && (
        <CitySection
          label="פורטו"
          color="#fef3c7"
          labelColor="#92400e"
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
  label, color, labelColor, morning, afternoon, guides, onChange,
}: {
  label: string;
  color: string;
  labelColor: string;
  morning: Shift[];
  afternoon: Shift[];
  guides: Guide[];
  onChange: () => void;
}) {
  return (
    <div style={{ background: color, borderRadius: 6, padding: 5, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: labelColor, letterSpacing: 0.3 }}>
        {label}
      </div>
      {morning.length > 0 && (
        <TimeSlotGroup label="בוקר · עד 13:00" shifts={morning} guides={guides} onChange={onChange} />
      )}
      {afternoon.length > 0 && (
        <TimeSlotGroup label="צהריים · מ-13:00" shifts={afternoon} guides={guides} onChange={onChange} />
      )}
    </div>
  );
}

function TimeSlotGroup({ label, shifts, guides, onChange }: { label: string; shifts: Shift[]; guides: Guide[]; onChange: () => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div
        style={{
          fontSize: 9,
          fontWeight: 600,
          color: ADMIN_COLORS.gray500,
          textTransform: 'none',
          paddingRight: 2,
          marginTop: 2,
        }}
      >
        {label}
      </div>
      {shifts.map((s) => (
        <ShiftCard key={s.id} shift={s} guides={guides} onChange={onChange} />
      ))}
    </div>
  );
}

function ShiftCard({ shift, guides, onChange }: { shift: Shift; guides: Guide[]; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

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
  const isPrivate = PRIVATE_TOUR_TYPES.has(shift.tour_type);

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

  async function handleDeleteShift() {
    const tourLabel = isPrivate ? 'סיור פרטי' : tourTypeLabel(shift.tour_type);
    if (!confirm(`למחוק את המשמרת של ${tourLabel} ב-${shortTime(shift.shift_time)}?\nהשיבוץ ייעלם מהלוח לחלוטין.`)) return;
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

  // לסיור פרטי — שם הסיור הוא "סיור פרטי" והפרטים בהערות
  const displayTourName = isPrivate ? 'סיור פרטי' : tourTypeLabel(shift.tour_type);

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
      {/* שורה 1: סוג סיור (גדול ובולט) + שעה (קטנה לצד) + כפתורי פעולה */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: ADMIN_COLORS.gray900, flex: 1, lineHeight: 1.2 }}>
          {displayTourName}
        </span>
        <span style={{ fontSize: 10, color: ADMIN_COLORS.gray500, whiteSpace: 'nowrap', fontWeight: 600 }}>
          {shortTime(shift.shift_time)}
        </span>
        {shift.status === 'published' && (
          <span title="פורסם" style={{ fontSize: 10 }}>📤</span>
        )}
        <button
          onClick={() => setEditOpen(true)}
          disabled={busy}
          title="ערכי משמרת"
          style={iconBtnStyle}
        >
          ✏️
        </button>
        <button
          onClick={handleDeleteShift}
          disabled={busy}
          title="מחקי משמרת"
          style={{ ...iconBtnStyle, color: '#991b1b' }}
        >
          🗑️
        </button>
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
          {shift.notes}
        </div>
      )}

      {/* Picker dropdown — בחירת מדריך */}
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
            — להסיר מדריך —
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
        </div>
      )}

      {/* Edit modal */}
      {editOpen && (
        <EditShiftModal
          shift={shift}
          onClose={() => setEditOpen(false)}
          onSaved={() => { setEditOpen(false); onChange(); }}
        />
      )}
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: 11,
  padding: '0 2px',
  fontFamily: 'inherit',
  lineHeight: 1,
};

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

function GuidesPanel({ guides, onClose, onChanged }: { guides: Guide[]; onClose: () => void; onChanged: () => void }) {
  const [editingId, setEditingId] = useState<string | null>(null);

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
          width: '100%', maxWidth: 640, maxHeight: '85vh', overflowY: 'auto',
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
          זמינות וסיורים שכל מדריך מוסמך — לחיצה על &quot;ערכי&quot; תאפשר עדכון מהיר.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {guides.map((g) => (
            <GuideCardRow
              key={g.id}
              guide={g}
              guides={guides}
              isEditing={editingId === g.id}
              onEdit={() => setEditingId(g.id)}
              onCancel={() => setEditingId(null)}
              onSaved={() => { setEditingId(null); onChanged(); }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function GuideCardRow({
  guide, guides, isEditing, onEdit, onCancel, onSaved,
}: {
  guide: Guide;
  guides: Guide[];
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const c = guideColor(guide.id, guides);
  const [availability, setAvailability] = useState(guide.availability_notes || '');
  const [qualified, setQualified] = useState<string[]>(guide.qualified_tours || []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // איפוס שדות אם פתחנו עריכה מחדש
  useEffect(() => {
    if (isEditing) {
      setAvailability(guide.availability_notes || '');
      setQualified(guide.qualified_tours || []);
      setErr('');
    }
  }, [isEditing, guide.availability_notes, guide.qualified_tours]);

  const tourOptions = TOUR_TYPES[guide.city];

  function toggleTour(value: string) {
    setQualified((prev) => prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]);
  }

  async function handleSave() {
    setErr('');
    setSaving(true);
    try {
      await updateGuideAvailability(guide.id, {
        availability_notes: availability || null,
        qualified_tours: qualified,
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'משהו השתבש');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
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
            {guide.name}
          </span>
        )}
        <span style={{ fontSize: 11, color: ADMIN_COLORS.gray500 }}>
          {guide.city === 'lisbon' ? 'ליסבון' : 'פורטו'}
        </span>
        {guide.requires_pre_approval && (
          <span style={{ fontSize: 11, color: '#a37b00' }}>⚠️ דורש אישור מראש</span>
        )}
        <div style={{ marginRight: 'auto' }}>
          {!isEditing && (
            <button onClick={onEdit} style={{ ...navBtnStyle, fontSize: 11, padding: '4px 10px' }}>
              ✏️ ערכי
            </button>
          )}
        </div>
      </div>

      {!isEditing ? (
        <>
          {guide.availability_notes && (
            <div style={{ fontSize: 12, color: ADMIN_COLORS.gray700, marginBottom: 4 }}>
              <strong>זמינות:</strong> {guide.availability_notes}
            </div>
          )}
          {guide.vacation_notes && (
            <div style={{ fontSize: 12, color: '#a37b00', marginBottom: 4 }}>
              <strong>חופשות:</strong> {guide.vacation_notes}
            </div>
          )}
          {guide.qualified_tours && guide.qualified_tours.length > 0 && (
            <div style={{ fontSize: 11, color: ADMIN_COLORS.gray500 }}>
              <strong>סיורים:</strong>{' '}
              {guide.qualified_tours.map((t) => tourTypeLabel(t)).join(' · ')}
            </div>
          )}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          <label style={labelStyle}>זמינות (טקסט חופשי)
            <textarea
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              placeholder="לדוגמה: לא בשבת, מעדיפה ימי קיץ"
              style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }}
            />
          </label>
          <div style={labelStyle}>
            סיורים מוסמכים ({guide.city === 'lisbon' ? 'ליסבון' : 'פורטו'})
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {tourOptions.map((t) => {
                const active = qualified.includes(t.value);
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => toggleTour(t.value)}
                    style={{
                      padding: '4px 10px',
                      fontSize: 11,
                      borderRadius: 12,
                      border: `1px solid ${active ? ADMIN_COLORS.green700 : ADMIN_COLORS.gray300}`,
                      background: active ? ADMIN_COLORS.green700 : '#fff',
                      color: active ? '#fff' : ADMIN_COLORS.gray700,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontWeight: 600,
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
            <span style={{ fontSize: 10, color: ADMIN_COLORS.gray500, marginTop: 4 }}>
              ריק = לא הוגדר. סיורים שלא מסומנים לא יופיעו ב-dropdown של שיבוץ.
            </span>
          </div>
          {err && <div style={{ fontSize: 12, color: '#991b1b' }}>{err}</div>}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            <button onClick={onCancel} disabled={saving} style={{ ...navBtnStyle, fontSize: 12 }}>
              ביטול
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              style={{
                padding: '6px 14px', background: ADMIN_COLORS.green700, color: '#fff',
                border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600,
                cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
              }}
            >
              {saving ? 'שומרת...' : 'שמירה'}
            </button>
          </div>
        </div>
      )}
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
  // שדות מיוחדים לסיור פרטי
  const [privateDetail, setPrivateDetail] = useState('');
  const [privateCustomer, setPrivateCustomer] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const tourOptions = TOUR_TYPES[city];
  const isPrivate = PRIVATE_TOUR_TYPES.has(tourType);
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
    // לסיור פרטי — בונים את ההערה אוטומטית מסוג הסיור + שם הלקוח
    let finalNotes: string | undefined = notes || undefined;
    if (isPrivate) {
      const parts: string[] = [];
      if (privateDetail.trim()) parts.push(privateDetail.trim());
      if (privateCustomer.trim()) parts.push(privateCustomer.trim());
      if (parts.length > 0) finalNotes = parts.join(' · ');
    }
    setSaving(true);
    try {
      await createManualShift({
        shift_date: date,
        shift_time: time,
        city,
        tour_type: tourType,
        guide_id: guideId || null,
        notes: finalNotes,
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
          width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 12,
          maxHeight: '90vh', overflowY: 'auto',
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
          <select
            value={city}
            onChange={(e) => {
              const newCity = e.target.value as 'lisbon' | 'porto';
              setCity(newCity);
              // אם בחרת פרטי קודם — נמשיך עם פרטי בעיר החדשה
              if (isPrivate) {
                setTourType(newCity === 'lisbon' ? 'פרטי_1' : 'פרטי_2');
              } else {
                setTourType(TOUR_TYPES[newCity][0].value);
              }
            }}
            style={inputStyle}
          >
            <option value="lisbon">ליסבון</option>
            <option value="porto">פורטו</option>
          </select>
        </label>
        <label style={labelStyle}>סוג סיור
          <select value={tourType} onChange={(e) => setTourType(e.target.value)} style={inputStyle}>
            {tourOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>

        {isPrivate && (
          <>
            <label style={labelStyle}>פירוט הסיור
              <input
                type="text"
                value={privateDetail}
                onChange={(e) => setPrivateDetail(e.target.value)}
                placeholder="לדוגמה: סינטרה פרטי, טעימות פרטי בליסבון"
                style={inputStyle}
              />
            </label>
            <label style={labelStyle}>שם הלקוח / מספר אנשים
              <input
                type="text"
                value={privateCustomer}
                onChange={(e) => setPrivateCustomer(e.target.value)}
                placeholder="לדוגמה: משפחת כהן · 4 אנשים"
                style={inputStyle}
              />
            </label>
            <span style={{ fontSize: 11, color: ADMIN_COLORS.gray500, marginTop: -4 }}>
              ב-לוח יוצג: <strong>סיור פרטי</strong> · {privateDetail || '...'} · {privateCustomer || '...'}
            </span>
          </>
        )}

        <label style={labelStyle}>מדריך {isPrivate ? '' : '(אופציונלי)'}
          <select value={guideId} onChange={(e) => setGuideId(e.target.value)} style={inputStyle}>
            <option value="">— ללא שיבוץ עדיין —</option>
            {eligibleGuides.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>

        {!isPrivate && (
          <label style={labelStyle}>הערה (אופציונלי)
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="הערה חופשית"
              style={inputStyle}
            />
          </label>
        )}

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

// ─── עריכת משמרת קיימת (תאריך / שעה / סוג / הערות) ───
function EditShiftModal({
  shift, onClose, onSaved,
}: {
  shift: Shift;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState(shift.shift_date);
  const [time, setTime] = useState(shortTime(shift.shift_time));
  const [tourType, setTourType] = useState(shift.tour_type);
  const [notes, setNotes] = useState(shift.notes || '');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const tourOptions = TOUR_TYPES[shift.city];

  async function handleSave() {
    setErr('');
    if (!date || !time || !tourType) {
      setErr('צריך תאריך, שעה וסוג סיור');
      return;
    }
    setSaving(true);
    try {
      await updateShift(shift.id, {
        shift_date: date,
        shift_time: time,
        tour_type: tourType,
        notes: notes || null,
      });
      onSaved();
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
          עריכת משמרת
        </h3>
        <p style={{ margin: 0, fontSize: 12, color: ADMIN_COLORS.gray500 }}>
          עיר: {shift.city === 'lisbon' ? 'ליסבון' : 'פורטו'} · {shift.source === 'manual' ? 'נוסף ידנית' : 'מהאתר'}
        </p>
        <label style={labelStyle}>תאריך
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>שעה
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} style={inputStyle} />
        </label>
        <label style={labelStyle}>סוג סיור
          <select value={tourType} onChange={(e) => setTourType(e.target.value)} style={inputStyle}>
            {tourOptions.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </label>
        <label style={labelStyle}>הערה
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="הערה חופשית"
            style={inputStyle}
          />
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
            {saving ? 'שומרת...' : 'שמירה'}
          </button>
        </div>
      </div>
    </div>
  );
}
