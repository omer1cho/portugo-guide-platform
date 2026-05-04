'use client';

/**
 * /admin/shifts — לוח שיבוצים שבועי.
 *
 * שלב A:
 *   - שיבוצים מסונכרנים אוטומטית מהאתר (cron יומי)
 *   - עומר משבצת מדריכים מ-dropdown לכל שיבוץ
 *   - המדריכים בdropdown מסוננים לפי עיר ו-qualified_tours
 *   - "פרסמי שבוע" — הופך את כל ה-draft של השבוע ל-published
 *   - "+ הוסיפי שיבוץ ידני" — לסיורים פרטיים / חד-פעמיים
 *   - תווית availability_notes ליד כל מדריך ב-dropdown
 *
 * צד מדריך (שלב B): "המשמרות שלי" עם אישור/דחייה — לא בקובץ זה.
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

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

function fmtDayLabel(d: Date): string {
  const dow = DAY_NAMES[d.getDay()];
  return `${dow} ${d.getDate()}/${d.getMonth() + 1}`;
}

function fmtWeekRange(weekStart: Date): string {
  const end = addDays(weekStart, 6);
  return `${weekStart.getDate()}/${weekStart.getMonth() + 1} – ${end.getDate()}/${end.getMonth() + 1}`;
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
  const [publishing, setPublishing] = useState(false);
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

  const draftCount = shifts.filter((s) => s.status === 'draft' && s.guide_id).length;
  const totalDraftCount = shifts.filter((s) => s.status === 'draft').length;
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
          <button
            onClick={() => setShowAddModal(true)}
            style={{
              padding: '8px 14px',
              background: '#fff',
              border: `1px solid ${ADMIN_COLORS.green700}`,
              color: ADMIN_COLORS.green700,
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            + הוסיפי שיבוץ ידני
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
      {!loading && (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 13, color: ADMIN_COLORS.gray700 }}>
          <Chip color="green" label={`${draftCount} משובצים`} />
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

      {/* Mobile note: a 7-column grid is too narrow on phone, so on small screens we stack */}
      <style jsx>{`
        @media (max-width: 900px) {
          [data-shifts-board] {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>

      {/* Manual add modal */}
      {showAddModal && (
        <ManualAddModal
          weekStart={weekStart}
          guides={guides}
          onClose={() => setShowAddModal(false)}
          onCreated={() => { setShowAddModal(false); reload(); }}
        />
      )}
    </div>
  );
}

const navBtnStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: '#fff',
  border: `1px solid ${ADMIN_COLORS.gray300}`,
  borderRadius: 6,
  fontSize: 13,
  cursor: 'pointer',
  fontFamily: 'inherit',
  color: ADMIN_COLORS.gray700,
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
            border: 'none',
            fontSize: 13,
            cursor: 'pointer',
            fontFamily: 'inherit',
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
  return (
    <div
      style={{
        background: isToday ? '#f0fdf4' : '#fff',
        border: `1px solid ${isToday ? ADMIN_COLORS.green700 : ADMIN_COLORS.gray300}`,
        borderRadius: 10,
        padding: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minHeight: 120,
      }}
    >
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
      {shifts.length === 0 ? (
        <div style={{ fontSize: 11, color: ADMIN_COLORS.gray500, textAlign: 'center', padding: '12px 0' }}>—</div>
      ) : (
        shifts.map((s) => <ShiftCard key={s.id} shift={s} guides={guides} onChange={onChange} />)
      )}
    </div>
  );
}

function ShiftCard({ shift, guides, onChange }: { shift: Shift; guides: Guide[]; onChange: () => void }) {
  const [busy, setBusy] = useState(false);

  // סינון מדריכים מתאימים
  const eligibleGuides = useMemo(() => {
    return guides.filter((g) => {
      if (g.city !== shift.city) return false;
      const qt = g.qualified_tours || [];
      // אם רשימה ריקה — לא הוגדר, לאפשר הכל. אחרת — לבדוק שהsiור ברשימה.
      if (qt.length > 0 && !qt.includes(shift.tour_type)) return false;
      return true;
    });
  }, [guides, shift.city, shift.tour_type]);

  const currentGuide = guides.find((g) => g.id === shift.guide_id);

  async function handleAssign(guideId: string | null) {
    setBusy(true);
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

  // צבע רקע לפי סטטוס
  let bg: string = '#fff';
  let borderColor: string = ADMIN_COLORS.gray300;
  if (shift.status === 'cancelled') {
    bg = '#fef2f2';
    borderColor = '#fca5a5';
  } else if (shift.status === 'published') {
    bg = '#dbeafe';
    borderColor = '#93c5fd';
  } else if (shift.guide_id) {
    bg = '#f0fdf4';
    borderColor = '#86efac';
  }

  return (
    <div
      style={{
        background: bg,
        border: `1px solid ${borderColor}`,
        borderRadius: 8,
        padding: 6,
        fontSize: 12,
        opacity: shift.status === 'cancelled' ? 0.7 : 1,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontWeight: 700, color: ADMIN_COLORS.gray900 }}>{shortTime(shift.shift_time)}</span>
        <span style={{ fontSize: 10, color: ADMIN_COLORS.gray500 }}>
          {shift.source === 'manual' ? '✏️' : ''}
          {shift.status === 'published' ? '📤' : ''}
          {shift.status === 'cancelled' ? '❌' : ''}
        </span>
      </div>
      <div style={{ marginBottom: 6, color: ADMIN_COLORS.gray700, fontSize: 11 }}>{tourTypeLabel(shift.tour_type)}</div>

      {shift.status === 'cancelled' ? (
        <div style={{ fontSize: 10, color: '#991b1b', fontStyle: 'italic' }}>
          {shift.notes || 'בוטל'}
        </div>
      ) : (
        <>
          <select
            value={shift.guide_id || ''}
            onChange={(e) => handleAssign(e.target.value || null)}
            disabled={busy}
            style={{
              width: '100%',
              padding: '4px 6px',
              fontSize: 11,
              borderRadius: 4,
              border: `1px solid ${ADMIN_COLORS.gray300}`,
              fontFamily: 'inherit',
              background: '#fff',
            }}
          >
            <option value="">— בחרי מדריך —</option>
            {eligibleGuides.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}{g.requires_pre_approval ? ' ⚠️' : ''}
              </option>
            ))}
          </select>
          {currentGuide?.availability_notes && (
            <div style={{ fontSize: 10, color: ADMIN_COLORS.gray500, marginTop: 4, lineHeight: 1.3 }}>
              {currentGuide.availability_notes}
            </div>
          )}
          {shift.notes && (
            <div style={{ fontSize: 10, color: '#a37b00', marginTop: 4, fontStyle: 'italic' }}>
              ℹ️ {shift.notes}
            </div>
          )}
          <button
            onClick={handleDelete}
            disabled={busy}
            style={{
              fontSize: 10,
              color: '#991b1b',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 2,
              marginTop: 2,
              fontFamily: 'inherit',
            }}
          >
            מחק
          </button>
        </>
      )}
    </div>
  );
}

function ManualAddModal({
  weekStart,
  guides,
  onClose,
  onCreated,
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
