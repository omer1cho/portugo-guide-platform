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
  updateGuideVacations,
  isGuideOnVacation,
  weekStartOf,
  toIsoDate,
  addDays,
  tourTypeLabel,
  shortTime,
  type Shift,
} from '@/lib/admin/shifts-data';
import type { Guide, GuideVacation } from '@/lib/supabase';
import { TOUR_TYPES } from '@/lib/supabase';
import { getCalendarEventsForDate } from '@/lib/calendar-events';

// סוגי סיור פרטיים — מוצגים אחרת בכרטיס (פוקוס על שם הלקוח/סוג, לא על "פרטי_1")
const PRIVATE_TOUR_TYPES = new Set(['פרטי_1', 'פרטי_2']);

// תחילית לסיור פרטי שעוד לא הסתיים סופית ("הצעה שצפויה לסגור")
const TENTATIVE_PREFIX = '[כנראה] ';

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

/** פורמט תאריך קצר 'D/M' מ-YYYY-MM-DD */
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${parseInt(d, 10)}/${parseInt(m, 10)}`;
}

/** מציג חופשה בפורמט קומפקטי לתצוגה */
function fmtVacation(v: GuideVacation): string {
  const range = v.start === v.end ? shortDate(v.start) : `${shortDate(v.start)}–${shortDate(v.end)}`;
  return v.label ? `${range} (${v.label})` : range;
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
  /** שעה ספציפית להתאמה; אם undefined — מתאים לכל שעה באותו יום (גמיש) */
  time?: string;
  /** שעת ברירת-מחדל ליצירת shift חדש כשהאתר לא פרסם (HH:MM) */
  defaultTime: string;
  guide_name: string;
  notes?: string;
  /** שם מדריך נוסף שיווצר על אותו slot כשיבוץ-גיבוי (manual) */
  secondary?: { guide_name: string; notes: string };
};
const PORTO_ROSTER: PortoSlot[] = [
  { dayOfWeek: 0, tour_type: 'פורטו_1', defaultTime: '09:45', guide_name: 'תום' },
  { dayOfWeek: 1, tour_type: 'פורטו_1', defaultTime: '09:45', guide_name: 'תום' },
  { dayOfWeek: 2, tour_type: 'פורטו_1', defaultTime: '09:45', guide_name: 'דותן' },
  { dayOfWeek: 2, tour_type: 'טעימות',  defaultTime: '14:30', guide_name: 'דותן' },
  { dayOfWeek: 3, tour_type: 'דורו',     defaultTime: '08:20', guide_name: 'תום' },
  {
    dayOfWeek: 3, tour_type: 'פורטו_1', defaultTime: '09:45',
    guide_name: 'דותן', notes: 'אם הדורו יוצא',
    secondary: { guide_name: 'תום', notes: 'אם הדורו לא יוצא' },
  },
  { dayOfWeek: 4, tour_type: 'פורטו_1', defaultTime: '09:45', guide_name: 'תום' },
  { dayOfWeek: 4, tour_type: 'טעימות',  defaultTime: '14:30', guide_name: 'תום' },
  { dayOfWeek: 5, tour_type: 'דורו',     defaultTime: '08:20', guide_name: 'תום' },
  {
    dayOfWeek: 5, tour_type: 'פורטו_1', defaultTime: '10:30',
    guide_name: 'דותן', notes: 'אם הדורו יוצא',
    secondary: { guide_name: 'תום', notes: 'אם הדורו לא יוצא' },
  },
  // שבת — מתחלפים תום/דותן לפי שבוע, אז לא בקבע אוטומטי
];

/**
 * אוטופיל שקט של קבע פורטו, רץ בכל טעינה של שבוע.
 *
 * 3 שלבים:
 *   1) על שיבוצים קיימים (מהאתר) — להצמיד מדריך ראשי לפי הקבע + להשלים notes.
 *   2) על שיבוצים קיימים — אם ל-slot יש secondary (תום-גיבוי), ליצור shift ידני נוסף.
 *   3) על ימים בעתיד שבהם הקבע "מצפה" ל-slot שלא קיים בכלל (האתר לא פרסם) —
 *      ליצור את הראשי + secondary ידנית, עם תווית "🤖 קבע" כדי שעומר תזהה.
 *      זה הכרחי לימי שישי שבהם פעמים רבות פורטו_1 לא מופיע באתר.
 *
 * מחזיר את כמות הפעולות שבוצעו — אם > 0, הקורא ירענן.
 */
async function silentApplyPortoRoster(allShifts: Shift[], allGuides: Guide[], weekStart: Date): Promise<number> {
  let actions = 0;
  const guideByName = new Map<string, Guide>();
  for (const g of allGuides) guideByName.set(g.name, g);

  const portoShifts = allShifts.filter((s) => s.city === 'porto' && s.status !== 'cancelled');

  // === שלב 1: לכל shift פורטו קיים, להצמיד את המדריך הראשי לפי הקבע ===
  for (const s of portoShifts) {
    const dow = new Date(s.shift_date + 'T00:00:00').getDay();
    const time = shortTime(s.shift_time);
    const slot = PORTO_ROSTER.find(
      (r) => r.dayOfWeek === dow && r.tour_type === s.tour_type && (!r.time || r.time === time),
    );
    if (!slot) continue;
    const primary = guideByName.get(slot.guide_name);
    if (!primary) continue;

    const primaryOnVacation = isGuideOnVacation(primary, s.shift_date);

    if (!s.guide_id && !primaryOnVacation) {
      try { await assignGuide(s.id, primary.id); actions++; } catch { /* ignore */ }
    }
    if (slot.notes && !s.notes && (s.guide_id === primary.id || (!s.guide_id && !primaryOnVacation))) {
      try { await updateShift(s.id, { notes: slot.notes }); actions++; } catch { /* ignore */ }
    }
  }

  // === שלב 2: על shifts קיימים — ליצור secondary (תום-גיבוי) אם חסר ===
  for (const s of portoShifts) {
    const dow = new Date(s.shift_date + 'T00:00:00').getDay();
    const time = shortTime(s.shift_time);
    const slot = PORTO_ROSTER.find(
      (r) => r.dayOfWeek === dow && r.tour_type === s.tour_type && (!r.time || r.time === time),
    );
    if (!slot || !slot.secondary) continue;
    const sec = guideByName.get(slot.secondary.guide_name);
    if (!sec) continue;
    if (isGuideOnVacation(sec, s.shift_date)) continue;
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
    } catch { /* ignore */ }
  }

  // === שלב 3: ימים בקבע שאין להם שיבוץ בכלל — האתר לא פרסם, אנחנו ניצור ידנית ===
  // זה תופס בדיוק את המקרה של שישי שבו לפעמים פורטו_1 לא מופיע באתר.
  // יוצרים רק לעתיד (כולל היום), לא לימים שעברו.
  const todayIso = toIsoDate(new Date());
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStart, i);
    const isoDate = toIsoDate(d);
    if (isoDate < todayIso) continue;
    const dow = d.getDay();
    const slotsForDay = PORTO_ROSTER.filter((r) => r.dayOfWeek === dow);
    for (const slot of slotsForDay) {
      // האם קיים shift כלשהו על היום הזה לסוג הסיור הזה?
      const exists = allShifts.some(
        (x) =>
          x.shift_date === isoDate &&
          x.tour_type === slot.tour_type &&
          x.city === 'porto' &&
          x.status !== 'cancelled',
      );
      if (exists) continue;
      const primary = guideByName.get(slot.guide_name);
      if (!primary || isGuideOnVacation(primary, isoDate)) continue;
      const baseNotes = '🤖 קבע';
      try {
        await createManualShift({
          shift_date: isoDate,
          shift_time: slot.defaultTime,
          tour_type: slot.tour_type,
          city: 'porto',
          guide_id: primary.id,
          notes: slot.notes ? `${baseNotes} · ${slot.notes}` : baseNotes,
        });
        actions++;
      } catch { /* ignore */ }
      if (slot.secondary) {
        const sec = guideByName.get(slot.secondary.guide_name);
        if (sec && !isGuideOnVacation(sec, isoDate)) {
          try {
            await createManualShift({
              shift_date: isoDate,
              shift_time: slot.defaultTime,
              tour_type: slot.tour_type,
              city: 'porto',
              guide_id: sec.id,
              notes: `${baseNotes} · ${slot.secondary.notes}`,
            });
            actions++;
          } catch { /* ignore */ }
        }
      }
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
        // או slot שלא קיים בכלל — נחיל את הקבע ונטען שוב. בלי הודעה, בלי כפתור.
        // לא רץ כשהמשתמשת מסננת לליסבון בלבד (אחרת ניצור ידני בלי לדעת שיש shifts).
        const applied = cityFilter === 'lisbon' ? 0 : await silentApplyPortoRoster(s, g, weekStart);
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

  // חישוב גובה אחיד לאזורי חגים+חופשות (כדי שכל הימים יישרו בקו אחד)
  // גבהים נפרדים: חג קטן (פונט 9) לעומת חופשה בולטת יותר (פונט 11 + מסגרת 2px)
  const HOLIDAY_PILL_HEIGHT = 17;
  const VACATION_PILL_HEIGHT = 28;
  const { maxHolidaysHeight, maxVacationsHeight } = useMemo(() => {
    let maxHolidays = 0;
    let maxVacations = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const isoDate = toIsoDate(d);
      const evCount = getCalendarEventsForDate(isoDate)
        .filter((e) => e.category === 'israel' || e.category === 'portugal').length;
      const vacCount = guides.filter((g) =>
        g.vacations?.some((v) => isoDate >= v.start && isoDate <= v.end),
      ).length;
      if (evCount > maxHolidays) maxHolidays = evCount;
      if (vacCount > maxVacations) maxVacations = vacCount;
    }
    return {
      maxHolidaysHeight:
        maxHolidays * HOLIDAY_PILL_HEIGHT + (maxHolidays > 1 ? (maxHolidays - 1) * 2 : 0),
      maxVacationsHeight:
        maxVacations * VACATION_PILL_HEIGHT + (maxVacations > 1 ? (maxVacations - 1) * 3 : 0),
    };
  }, [weekStart, guides]);

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
          <button
            onClick={() => setShowGuidesPanel(true)}
            style={secondaryBtnStyle}
            title="עריכת זמינות, סיורים מוסמכים והוספת חופשות"
          >
            👥 מדריכים & 🌴 חופשות
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

      {/* Week switcher — 3 עמודות: ימין=שבוע קודם, מרכז=תאריך+השבוע, שמאל=שבוע הבא.
          במובייל: שורה 1 = תאריך+השבוע מרכזי, שורה 2 = שבוע קודם / שבוע הבא בצדדים. */}
      <div
        data-week-nav
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <button
          data-nav-prev
          onClick={() => setWeekStart(addDays(weekStart, -7))}
          style={navBtnStyle}
        >
          ▶ שבוע קודם
        </button>
        <div
          data-nav-center
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 600, color: ADMIN_COLORS.gray700 }}>
            {fmtWeekRange(weekStart)}
          </div>
          <button onClick={() => setWeekStart(weekStartOf(new Date()))} style={navBtnStyle}>
            השבוע
          </button>
        </div>
        <button
          data-nav-next
          onClick={() => setWeekStart(addDays(weekStart, 7))}
          style={navBtnStyle}
        >
          שבוע הבא ◀
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
            gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
            gap: 4,
          }}
          data-shifts-board
        >
          {Array.from({ length: 7 }).map((_, i) => {
            const d = addDays(weekStart, i);
            const isoDate = toIsoDate(d);
            const dayShifts = shiftsByDay.get(isoDate) || [];
            // מחשבים אילו מדריכים בחופש ביום הזה
            const vacationsForDay = guides
              .map((g) => {
                const v = g.vacations?.find((vac) => isoDate >= vac.start && isoDate <= vac.end);
                return v ? { guide: g, label: v.label || null } : null;
              })
              .filter((x): x is { guide: Guide; label: string | null } => x !== null);
            return (
              <DayColumn
                key={isoDate}
                date={d}
                shifts={dayShifts}
                guides={guides}
                vacationsForDay={vacationsForDay}
                holidaysAreaMinHeight={maxHolidaysHeight}
                vacationsAreaMinHeight={maxVacationsHeight}
                onChange={reload}
              />
            );
          })}
        </div>
      )}

      <style jsx>{`
        /* טאבלט ומסכי לפטופ צרים — נשארים על 7 עמודות אבל מקטינים מינימום */
        @media (max-width: 1100px) and (min-width: 721px) {
          [data-shifts-board] {
            grid-template-columns: repeat(7, minmax(80px, 1fr)) !important;
          }
        }
        /* מובייל — שינוי מהותי: ימים מערום אנכי, כל יום בגודל מלא וקריא */
        @media (max-width: 720px) {
          [data-shifts-board] {
            grid-template-columns: 1fr !important;
            gap: 10px !important;
          }
          [data-shifts-board] [data-day-column] {
            min-height: auto !important;
            padding: 10px !important;
          }
          [data-shifts-board] [data-day-header] {
            font-size: 14px !important;
            padding-bottom: 6px !important;
          }
          [data-shifts-board] [data-shift-card] {
            padding: 8px 10px !important;
          }
          [data-shifts-board] [data-shift-card] [data-shift-title] {
            font-size: 14px !important;
          }
          [data-shifts-board] [data-shift-card] [data-shift-time] {
            font-size: 12px !important;
          }
          [data-shifts-board] [data-shift-card] [data-shift-notes] {
            font-size: 11px !important;
            white-space: normal !important;
          }
          [data-shifts-board] [data-shift-card] [data-shift-guide] {
            font-size: 13px !important;
            padding: 4px 10px !important;
          }
          [data-shifts-board] [data-vacation-pill] {
            font-size: 13px !important;
            padding: 6px 9px !important;
          }
          [data-shifts-board] [data-city-section] {
            padding: 6px !important;
          }
          [data-shifts-board] [data-city-label] {
            font-size: 12px !important;
            margin-bottom: 4px !important;
          }
          /* תפריט הניווט: שורה 1 = מרכז (תאריך+השבוע), שורה 2 = שבוע קודם וצמוד אליו שבוע הבא */
          [data-week-nav] {
            grid-template-columns: 1fr 1fr !important;
            grid-template-rows: auto auto !important;
            gap: 8px !important;
          }
          [data-week-nav] [data-nav-center] {
            grid-column: 1 / -1 !important;
            grid-row: 1 !important;
          }
          [data-week-nav] [data-nav-prev] {
            grid-column: 1 !important;
            grid-row: 2 !important;
          }
          [data-week-nav] [data-nav-next] {
            grid-column: 2 !important;
            grid-row: 2 !important;
          }
          [data-week-nav] button {
            padding: 10px 14px !important;
            font-size: 14px !important;
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

function DayColumn({
  date, shifts, guides, vacationsForDay, onChange,
  holidaysAreaMinHeight, vacationsAreaMinHeight,
}: {
  date: Date;
  shifts: Shift[];
  guides: Guide[];
  vacationsForDay: { guide: Guide; label: string | null }[];
  onChange: () => void;
  holidaysAreaMinHeight: number;
  vacationsAreaMinHeight: number;
}) {
  const isToday = toIsoDate(date) === toIsoDate(new Date());
  const events = getCalendarEventsForDate(toIsoDate(date)).filter((e) => e.category === 'israel' || e.category === 'portugal');

  // קיבוץ לפי עיר בלבד (ליסבון מעל פורטו), לפי סדר השעות
  const lisbon = shifts.filter((s) => s.city === 'lisbon').sort((a, b) => a.shift_time.localeCompare(b.shift_time));
  const porto = shifts.filter((s) => s.city === 'porto').sort((a, b) => a.shift_time.localeCompare(b.shift_time));
  const hasShifts = lisbon.length > 0 || porto.length > 0;

  return (
    <div
      data-day-column
      style={{
        background: isToday ? '#f0fdf4' : '#fff',
        border: `1px solid ${isToday ? ADMIN_COLORS.green700 : ADMIN_COLORS.gray300}`,
        borderRadius: 8,
        padding: 5,
        display: 'grid',
        gridTemplateRows: 'auto auto auto 1fr',
        gap: 5,
        minHeight: 140,
        minWidth: 0,
      }}
    >
      {/* שורה 1 — כותרת היום */}
      <div
        data-day-header
        style={{
          fontSize: 12,
          fontWeight: 700,
          color: isToday ? ADMIN_COLORS.green800 : ADMIN_COLORS.gray700,
          textAlign: 'center',
          paddingBottom: 4,
          borderBottom: `1px solid ${ADMIN_COLORS.gray100}`,
        }}
      >
        {fmtDayLabel(date)}
      </div>

      {/* שורה 2 — אזור חגים (גובה אחיד בכל הימים) */}
      <div
        style={{
          minHeight: holidaysAreaMinHeight,
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
        }}
      >
        {events.map((e, i) => (
          <div
            key={i}
            style={{
              fontSize: 9,
              background: e.category === 'israel' ? '#fef3c7' : '#dbeafe',
              color: e.category === 'israel' ? '#854d0e' : '#1e40af',
              padding: '2px 5px',
              borderRadius: 3,
              textAlign: 'center',
              fontWeight: 600,
              lineHeight: 1.3,
            }}
            title={e.text}
          >
            {e.text}
          </div>
        ))}
      </div>

      {/* שורה 3 — אזור חופשות מדריכים (גובה אחיד, עיצוב מאוד בולט: פסים אלכסוניים + מסגרת כתומה) */}
      <div
        style={{
          minHeight: vacationsAreaMinHeight,
          display: 'flex',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        {vacationsForDay.map((v, i) => {
          const c = guideColor(v.guide.id, guides);
          return (
            <div
              key={i}
              data-vacation-pill
              style={{
                fontSize: 11,
                background: '#fde68a',
                color: '#78350f',
                padding: '4px 6px',
                borderRadius: 5,
                textAlign: 'center',
                fontWeight: 800,
                lineHeight: 1.3,
                border: '2px solid #d97706',
                borderRight: c ? `5px solid ${c.border}` : '2px solid #d97706',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                letterSpacing: 0.2,
              }}
              title={`${v.guide.name} בחופש${v.label ? ` — ${v.label}` : ''}`}
            >
              🌴 בחופש: {v.guide.name}
            </div>
          );
        })}
      </div>

      {/* שורה 4 — שיבוצים */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {!hasShifts && (
          <div style={{ fontSize: 11, color: ADMIN_COLORS.gray500, textAlign: 'center', padding: '6px 0' }}>—</div>
        )}
        {lisbon.length > 0 && (
          <CitySection
            label="ליסבון"
            color="#f0fdf4"
            labelColor={ADMIN_COLORS.green800}
            shifts={lisbon}
            guides={guides}
            onChange={onChange}
          />
        )}
        {porto.length > 0 && (
          <CitySection
            label="פורטו"
            color="#fef3c7"
            labelColor="#92400e"
            shifts={porto}
            guides={guides}
            onChange={onChange}
          />
        )}
      </div>
    </div>
  );
}

function CitySection({
  label, color, labelColor, shifts, guides, onChange,
}: {
  label: string;
  color: string;
  labelColor: string;
  shifts: Shift[];
  guides: Guide[];
  onChange: () => void;
}) {
  return (
    <div
      data-city-section
      style={{ background: color, borderRadius: 6, padding: 4, display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}
    >
      <div data-city-label style={{ fontSize: 10, fontWeight: 700, color: labelColor, letterSpacing: 0.3 }}>
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
      // מדריך בחופש בתאריך הזה — לא בdropdown
      if (isGuideOnVacation(g, shift.shift_date)) return false;
      return true;
    });
  }, [guides, shift.city, shift.tour_type, shift.shift_date]);

  const currentGuide = guides.find((g) => g.id === shift.guide_id);
  const guideClr = guideColor(shift.guide_id, guides);
  const isPrivate = PRIVATE_TOUR_TYPES.has(shift.tour_type);
  // האם זו "הצעה שצפויה לסגור" שעוד לא אושרה סופית — מסומן בתחילית [כנראה]
  const isTentative = isPrivate && (shift.notes?.startsWith(TENTATIVE_PREFIX) ?? false);

  // לסיור פרטי — שולפים את ה-detail (חלק ראשון לפני המפריד) מתוך notes
  // ומציגים אותו כ"<detail> פרטי". השאר בהערה.
  // תומך בכמה מפרידים: " · " (הפורמט הרשמי), " - " ו-" / " (פורמט ידני שעומר השתמשה בו בעבר).
  let privateDetail: string | null = null;
  let restNotes: string | null = null;
  if (isPrivate && shift.notes) {
    let raw = shift.notes;
    if (isTentative) raw = raw.slice(TENTATIVE_PREFIX.length).trim();
    const splitter = raw.includes(' · ')
      ? ' · '
      : raw.includes(' - ')
        ? ' - '
        : raw.includes(' / ')
          ? ' / '
          : null;
    if (splitter) {
      const parts = raw.split(splitter);
      privateDetail = parts[0]?.trim() || null;
      restNotes = parts.slice(1).join(splitter).trim() || null;
    } else {
      privateDetail = raw.trim() || null;
      restNotes = null;
    }
  }

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

  // מסגרת לכרטיס לפי סטטוס. סיור "כנראה פרטי" — מסגרת מקווקווית + רקע קרם
  let cardBg: string = '#fff';
  let cardBorder: string = ADMIN_COLORS.gray300;
  let cardBorderStyle: string = 'solid';
  if (shift.status === 'cancelled') {
    cardBg = '#fef2f2';
    cardBorder = '#fca5a5';
  } else if (isTentative) {
    cardBg = '#fffbeb';
    cardBorder = '#a37b00';
    cardBorderStyle = 'dashed';
  } else if (shift.status === 'published') {
    cardBorder = '#93c5fd';
  }

  // לסיור פרטי — שם הסיור = "<detail> פרטי" (למשל "אראבידה פרטי", "ליסבון הקלאסית פרטי")
  // אם אין detail — נופלים לסיור פרטי (ליסבון/פורטו)
  const displayTourName = isPrivate
    ? (privateDetail ? `${privateDetail} פרטי` : tourTypeLabel(shift.tour_type))
    : tourTypeLabel(shift.tour_type);
  // ההערה התחתונה: לסיור פרטי — רק שם לקוח/מספר אנשים. לרגיל — כל ה-notes.
  const displayNotes = isPrivate ? restNotes : shift.notes;

  return (
    <div
      data-shift-card
      style={{
        background: cardBg,
        border: `1.5px ${cardBorderStyle} ${cardBorder}`,
        borderRadius: 5,
        padding: '4px 5px',
        opacity: shift.status === 'cancelled' ? 0.7 : 1,
        position: 'relative',
        minWidth: 0,
      }}
    >
      {/* שורה 1: שעה + סוג סיור + כפתורים */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 3, minWidth: 0 }}>
        <span
          data-shift-time
          style={{ fontSize: 10, color: ADMIN_COLORS.gray500, whiteSpace: 'nowrap', fontWeight: 700, flexShrink: 0 }}
        >
          {shortTime(shift.shift_time)}
        </span>
        {isTentative && (
          <span
            title="הצעה שצפויה לסגור — לא סגור סופית"
            style={{ fontSize: 11, flexShrink: 0 }}
          >
            🤔
          </span>
        )}
        <span
          data-shift-title
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: ADMIN_COLORS.gray900,
            flex: '1 1 0',
            minWidth: 0,
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={isTentative ? `כנראה: ${displayTourName}` : displayTourName}
        >
          {displayTourName}
        </span>
        {shift.status === 'published' && (
          <span title="פורסם" style={{ fontSize: 9, flexShrink: 0 }}>📤</span>
        )}
        <button
          onClick={() => setEditOpen(true)}
          disabled={busy}
          title="ערכי משמרת"
          style={{ ...iconBtnStyle, flexShrink: 0 }}
        >
          ✏️
        </button>
        <button
          onClick={handleDeleteShift}
          disabled={busy}
          title="מחקי משמרת"
          style={{ ...iconBtnStyle, color: '#991b1b', flexShrink: 0 }}
        >
          🗑️
        </button>
      </div>

      {/* שורה 2: מדריך כצ'יפ צבעוני, או placeholder */}
      {shift.status === 'cancelled' ? (
        <div style={{ fontSize: 9, color: '#991b1b', fontStyle: 'italic' }}>
          {shift.notes || 'בוטל'}
        </div>
      ) : currentGuide && guideClr ? (
        <button
          onClick={() => setPickerOpen(!pickerOpen)}
          disabled={busy}
          title={currentGuide.availability_notes || ''}
          data-shift-guide
          style={{
            background: guideClr.bg,
            color: guideClr.fg,
            border: `1px solid ${guideClr.border}`,
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 11,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
            width: '100%',
            textAlign: 'right',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {currentGuide.name}
        </button>
      ) : (
        <button
          onClick={() => setPickerOpen(!pickerOpen)}
          disabled={busy}
          data-shift-guide
          style={{
            background: '#fff',
            color: ADMIN_COLORS.gray500,
            border: `1px dashed ${ADMIN_COLORS.gray300}`,
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 10,
            cursor: 'pointer',
            fontFamily: 'inherit',
            width: '100%',
            textAlign: 'right',
          }}
        >
          + שבצי
        </button>
      )}

      {/* הערות אופציונליות — nowrap + ellipsis כדי שלא יגלשו אופקית */}
      {displayNotes && shift.status !== 'cancelled' && (
        <div
          data-shift-notes
          title={displayNotes}
          style={{
            fontSize: 9,
            color: '#a37b00',
            marginTop: 2,
            fontStyle: 'italic',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayNotes}
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
          זמינות, חופשות וסיורים שכל מדריך מוסמך — לחיצה על &quot;ערכי&quot; תאפשר עדכון מהיר.
        </p>
        <div
          style={{
            background: '#fffbeb',
            border: '1px solid #fcd34d',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: 12,
            color: '#78350f',
            display: 'flex',
            gap: 6,
            alignItems: 'flex-start',
          }}
        >
          <span style={{ fontSize: 14 }}>🌴</span>
          <span>
            <strong>חופשה?</strong> לחצי על &quot;ערכי&quot; ליד המדריך, ובחלון העריכה תופיע סקציית
            &quot;חופשות&quot; עם תאריך התחלה–סיום. לאחר שמירה, היא תוצג בלוח השיבוצים בכל יום
            רלוונטי, והמדריך לא יופיע ב-dropdown של שיבוץ.
          </span>
        </div>
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
  const [vacations, setVacations] = useState<GuideVacation[]>(guide.vacations || []);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  // איפוס שדות אם פתחנו עריכה מחדש
  useEffect(() => {
    if (isEditing) {
      setAvailability(guide.availability_notes || '');
      setQualified(guide.qualified_tours || []);
      setVacations(guide.vacations || []);
      setErr('');
    }
  }, [isEditing, guide.availability_notes, guide.qualified_tours, guide.vacations]);

  const tourOptions = TOUR_TYPES[guide.city];

  function toggleTour(value: string) {
    setQualified((prev) => prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]);
  }

  function addVacation() {
    setVacations((prev) => [...prev, { start: '', end: '', label: '' }]);
  }
  function updateVacation(i: number, field: keyof GuideVacation, value: string) {
    setVacations((prev) => prev.map((v, idx) => idx === i ? { ...v, [field]: value } : v));
  }
  function removeVacation(i: number) {
    setVacations((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    setErr('');
    // ולידציה — כל חופשה צריכה start ו-end תקפים, וstart <= end
    for (const v of vacations) {
      if (!v.start || !v.end) {
        setErr('כל חופשה צריכה תאריך התחלה ותאריך סיום');
        return;
      }
      if (v.start > v.end) {
        setErr('תאריך התחלה צריך להיות לפני תאריך סיום');
        return;
      }
    }
    setSaving(true);
    try {
      // ניקוי label ריק ל-undefined
      const cleanedVacations = vacations.map((v) => ({
        start: v.start,
        end: v.end,
        ...(v.label?.trim() ? { label: v.label.trim() } : {}),
      }));
      await updateGuideAvailability(guide.id, {
        availability_notes: availability || null,
        qualified_tours: qualified,
      });
      await updateGuideVacations(guide.id, cleanedVacations);
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
          {guide.vacations && guide.vacations.length > 0 && (
            <div style={{ fontSize: 12, color: '#713f12', marginBottom: 4 }}>
              <strong>🌴 חופשות:</strong>{' '}
              {guide.vacations.map((v, i) => (
                <span key={i} style={{ marginInlineEnd: 8 }}>
                  {fmtVacation(v)}
                </span>
              ))}
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 4 }}>
          <label style={labelStyle}>זמינות (טקסט חופשי)
            <textarea
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              placeholder="לדוגמה: לא בשבת, מעדיפה ימי קיץ"
              style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }}
            />
          </label>

          <div style={labelStyle}>
            🌴 חופשות (חוסמות שיבוץ)
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
              {vacations.length === 0 && (
                <span style={{ fontSize: 11, color: ADMIN_COLORS.gray500 }}>
                  אין חופשות מתוכננות.
                </span>
              )}
              {vacations.map((v, i) => (
                <div key={i} style={{ display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="date"
                    value={v.start}
                    onChange={(e) => updateVacation(i, 'start', e.target.value)}
                    style={{ ...inputStyle, padding: '4px 6px', fontSize: 12, flex: '1 1 100px' }}
                  />
                  <span style={{ fontSize: 11, color: ADMIN_COLORS.gray500 }}>עד</span>
                  <input
                    type="date"
                    value={v.end}
                    onChange={(e) => updateVacation(i, 'end', e.target.value)}
                    style={{ ...inputStyle, padding: '4px 6px', fontSize: 12, flex: '1 1 100px' }}
                  />
                  <input
                    type="text"
                    value={v.label || ''}
                    onChange={(e) => updateVacation(i, 'label', e.target.value)}
                    placeholder="תיאור (אופציונלי)"
                    style={{ ...inputStyle, padding: '4px 6px', fontSize: 12, flex: '2 1 140px' }}
                  />
                  <button
                    type="button"
                    onClick={() => removeVacation(i)}
                    style={{ ...iconBtnStyle, fontSize: 13, color: '#991b1b', padding: '0 4px' }}
                    title="מחקי חופשה"
                  >
                    🗑️
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addVacation}
                style={{
                  alignSelf: 'flex-start',
                  padding: '4px 12px',
                  fontSize: 11,
                  borderRadius: 6,
                  border: `1px dashed ${ADMIN_COLORS.green700}`,
                  background: '#fff',
                  color: ADMIN_COLORS.green700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontWeight: 600,
                }}
              >
                + הוסיפי חופשה
              </button>
            </div>
          </div>

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
  const [privateDetail, setPrivateDetail] = useState(''); // value מהתפריט (קלאסי / סינטרה / "אחר" / וכו')
  const [privateDetailOther, setPrivateDetailOther] = useState(''); // אם נבחר "אחר"
  const [privateCustomer, setPrivateCustomer] = useState('');
  const [tentative, setTentative] = useState(false); // "כנראה פרטי" — הצעה שעוד לא אושרה
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const tourOptions = TOUR_TYPES[city];
  const isPrivate = PRIVATE_TOUR_TYPES.has(tourType);

  // אפשרויות לסיור פרטי = כל הסוגים בעיר חוץ מ-פרטי עצמו, + "אחר"
  const privateDetailOptions = useMemo(() => {
    const base = TOUR_TYPES[city]
      .filter((t) => !PRIVATE_TOUR_TYPES.has(t.value))
      .map((t) => ({ value: t.label, label: `${t.label} פרטי` }));
    return [...base, { value: '__other__', label: 'אחר (טקסט חופשי)' }];
  }, [city]);

  const eligibleGuides = useMemo(
    () =>
      guides.filter(
        (g) =>
          g.city === city &&
          (!g.qualified_tours?.length || g.qualified_tours.includes(tourType)) &&
          !isGuideOnVacation(g, date),
      ),
    [guides, city, tourType, date],
  );

  async function handleSave() {
    setErr('');
    if (!date || !time || !tourType) {
      setErr('צריך תאריך, שעה וסוג סיור');
      return;
    }
    // לסיור פרטי — בונים את ההערה אוטומטית מסוג הסיור + שם הלקוח
    // אם זה "כנראה" (הצעה שלא נסגרה סופית) — מוסיפים תחילית [כנראה] שהכרטיס יזהה
    let finalNotes: string | undefined = notes || undefined;
    if (isPrivate) {
      const detailText = privateDetail === '__other__' ? privateDetailOther.trim() : privateDetail;
      if (!detailText) {
        setErr('צריך לבחור את סוג הסיור הפרטי');
        return;
      }
      const parts: string[] = [detailText];
      if (privateCustomer.trim()) parts.push(privateCustomer.trim());
      const body = parts.join(' · ');
      finalNotes = tentative ? `${TENTATIVE_PREFIX}${body}` : body;
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
              <select
                value={privateDetail}
                onChange={(e) => setPrivateDetail(e.target.value)}
                style={inputStyle}
              >
                <option value="">— בחרי סוג סיור —</option>
                {privateDetailOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            {privateDetail === '__other__' && (
              <label style={labelStyle}>פרטי הסיור (טקסט חופשי)
                <input
                  type="text"
                  value={privateDetailOther}
                  onChange={(e) => setPrivateDetailOther(e.target.value)}
                  placeholder="לדוגמה: טיול עירוני מותאם"
                  style={inputStyle}
                />
              </label>
            )}
            <label style={labelStyle}>שם הלקוח / מספר אנשים
              <input
                type="text"
                value={privateCustomer}
                onChange={(e) => setPrivateCustomer(e.target.value)}
                placeholder="לדוגמה: משפחת כהן · 4 אנשים"
                style={inputStyle}
              />
            </label>

            {/* "כנראה פרטי" — הצעה שעוד לא אושרה סופית; הכרטיס יוצג עם מסגרת מקווקווית ו-🤔 */}
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
                fontSize: 12,
                color: '#78350f',
                background: '#fffbeb',
                border: '1px dashed #d97706',
                borderRadius: 6,
                padding: '8px 10px',
                cursor: 'pointer',
              }}
            >
              <input
                type="checkbox"
                checked={tentative}
                onChange={(e) => setTentative(e.target.checked)}
                style={{ marginTop: 2, accentColor: '#d97706' }}
              />
              <span style={{ flex: 1, lineHeight: 1.4 }}>
                <strong>🤔 כנראה ייצא לפועל</strong> — לסמן הצעה ששלחת ונראית בסבירות גבוהה לסגירה.
                בלוח הסיור יופיע במסגרת מקווקווית, כדי שתזכרי לקחת אותו בחשבון בשיבוצים.
              </span>
            </label>

            <span style={{ fontSize: 11, color: ADMIN_COLORS.gray500, marginTop: -4 }}>
              ב-לוח יוצג: <strong>{tentative ? '🤔 ' : ''}
                {(privateDetail === '__other__' ? privateDetailOther : privateDetail) || '(בחרי סוג סיור)'} פרטי</strong>
              {privateCustomer ? ` · ${privateCustomer}` : ''}
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
