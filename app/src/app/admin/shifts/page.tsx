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
  republishWeek,
  unpublishWeek,
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

// סוגי "הכשרה" — תצפות וניסיון דפים. דורשים בחירת סוג סיור (כמו פרטי) + שדה "מדריך מלווה" אופציונלי.
const TRAINING_TOUR_TYPES = new Set(['תצפות', 'נסיון_דפים']);

// פעילות צוות — לא קשורה לסיור ספציפי, רק תיאור חופשי.
const TEAM_TOUR_TYPES = new Set(['פעילות_צוות']);

// סוגים שמשתמשים בלוגיקת "פירוט ב-notes" (כמו פרטי) — סינון מדריכים סלחני (בלי qualified_tours).
const FLEXIBLE_TOUR_TYPES = new Set([...PRIVATE_TOUR_TYPES, ...TRAINING_TOUR_TYPES, ...TEAM_TOUR_TYPES]);

// קידומת ההערה של שיבוצים שנוצרו ע"י silentApplyPortoRoster ("🤖 קבע · אם הדורו יוצא" וכו')
const ROSTER_AUTOFILL_PREFIX = '🤖 קבע';

// localStorage — slots של "🤖 קבע" שעומר מחקה ידנית, כדי שה-autofill לא ישחזר אותם.
// ערך = "YYYY-MM-DD|HH:MM|tour_type|city". מנקים אוטומטית entries של תאריכים שעברו.
const SKIP_ROSTER_KEY = 'portugo_skip_roster_slots';

function rosterSlotKey(date: string, time: string, tourType: string, city: 'lisbon' | 'porto'): string {
  return `${date}|${time}|${tourType}|${city}`;
}

function getSkippedRosterSlots(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(SKIP_ROSTER_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    // ניקוי entries של תאריכים שעברו
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const fresh = arr.filter((k) => (k.split('|')[0] || '') >= todayIso);
    if (fresh.length !== arr.length) {
      localStorage.setItem(SKIP_ROSTER_KEY, JSON.stringify(fresh));
    }
    return new Set(fresh);
  } catch {
    return new Set();
  }
}

function addSkippedRosterSlot(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(SKIP_ROSTER_KEY);
    const arr = raw ? (JSON.parse(raw) as string[]) : [];
    if (!arr.includes(key)) {
      arr.push(key);
      localStorage.setItem(SKIP_ROSTER_KEY, JSON.stringify(arr));
    }
  } catch {
    /* ignore */
  }
}

// אייקון לסוג סיור (תצפות / ניסיון דפים / פעילות צוות) — להצגה בקלף
const TOUR_TYPE_ICONS: Record<string, string> = {
  'תצפות': '👁️',
  'נסיון_דפים': '📋',
  'פעילות_צוות': '🤝',
};

// תוויות קצרות לסוגים החדשים — להצגה בכרטיס
const TOUR_TYPE_SHORT_LABELS: Record<string, string> = {
  'תצפות': 'תצפות',
  'נסיון_דפים': 'ניסיון דפים',
  'פעילות_צוות': 'פעילות צוות',
};

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
 * 2 שלבים:
 *   1) על שיבוצים קיימים (מהאתר) — להצמיד מדריך ראשי לפי הקבע + להשלים notes.
 *   2) על שיבוצים קיימים — אם ל-slot יש secondary (תום-גיבוי), ליצור shift ידני נוסף.
 *
 * (שלב 3 — יצירת קבע גם כשהאתר לא פרסם — בוטל ב-8.5.26. ראי הערה למטה.)
 *
 * מחזיר את כמות הפעולות שבוצעו — אם > 0, הקורא ירענן.
 */
async function silentApplyPortoRoster(allShifts: Shift[], allGuides: Guide[], weekStart: Date): Promise<number> {
  let actions = 0;
  const guideByName = new Map<string, Guide>();
  for (const g of allGuides) guideByName.set(g.name, g);

  // slots שעומר מחקה ידנית — לא להחזיר ב-autofill
  const skipped = getSkippedRosterSlots();

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
    // עומר מחקה ידנית את ה-secondary slot הזה — לא להחזיר אותו
    if (skipped.has(rosterSlotKey(s.shift_date, time, s.tour_type, 'porto'))) continue;
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

  // === שלב 3 בוטל (8.5.26) ===
  // עד אז שלב 3 היה יוצר אוטומטית ימי קבע פורטו (פורטו_1 ב-ב'/ה'/ש' + דורו ב-ד'/ו')
  // גם כשהאתר לא פרסם אותם. הבעיה: מקור האמת אמור להיות האתר. ה-cron היומי
  // לא מנקה shifts שמקורם 'manual', ולכן הסיורים האלה היו תקועים במערכת
  // עד מחיקה ידנית. עומר ביטלה את שלב 3 ב-8.5.26.

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
  const publishedCount = shifts.filter((s) => s.status === 'published').length;
  // אם אין יותר drafts אבל יש published — מציגים "פרסמי מחדש" ו-"בטלי פרסום" במקום "פרסמי שבוע"
  const allPublished = totalDraftCount === 0 && publishedCount > 0;

  // חישוב גבהים אחידים לאזורים — כדי שכל הימים יישרו בקו אנכי אחד
  // (חגים, חופשות, ובעיקר: סקציית ליסבון, כדי שפורטו תתחיל באותה גובה בכל הימים)
  const HOLIDAY_PILL_HEIGHT = 16;
  const VACATION_PILL_HEIGHT = 24;
  const CARD_HEIGHT = 70; // נדיב — קלף עם כותרת 2 שורות + הערה לוקח ~70px. מבטיח שום עמודה לא חורגת
  const CARD_GAP = 4;
  const SECTION_OVERHEAD = 26; // label + padding + margin
  const { maxHolidaysHeight, maxVacationsHeight, lisbonAreaMinHeight } = useMemo(() => {
    let maxHolidays = 0;
    let maxVacations = 0;
    let maxLisbon = 0;
    for (let i = 0; i < 7; i++) {
      const d = addDays(weekStart, i);
      const isoDate = toIsoDate(d);
      const evCount = getCalendarEventsForDate(isoDate)
        .filter((e) => e.category === 'israel' || e.category === 'portugal').length;
      const vacCount = guides.filter((g) =>
        g.vacations?.some((v) => isoDate >= v.start && isoDate <= v.end),
      ).length;
      const lisbonCount = shifts.filter(
        (s) => s.shift_date === isoDate && s.city === 'lisbon' && s.status !== 'cancelled',
      ).length;
      if (evCount > maxHolidays) maxHolidays = evCount;
      if (vacCount > maxVacations) maxVacations = vacCount;
      if (lisbonCount > maxLisbon) maxLisbon = lisbonCount;
    }
    return {
      maxHolidaysHeight:
        maxHolidays * HOLIDAY_PILL_HEIGHT + (maxHolidays > 1 ? (maxHolidays - 1) * 2 : 0),
      maxVacationsHeight:
        maxVacations * VACATION_PILL_HEIGHT + (maxVacations > 1 ? (maxVacations - 1) * 3 : 0),
      lisbonAreaMinHeight:
        maxLisbon > 0
          ? maxLisbon * CARD_HEIGHT + (maxLisbon - 1) * CARD_GAP + SECTION_OVERHEAD
          : 0,
    };
  }, [weekStart, guides, shifts]);

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

  /**
   * "פרסמי מחדש" — מעדכן רק את ה-published_at, בלי לשנות status.
   * השימוש העיקרי: אחרי שעדכנת/תיקנת משמרות שכבר פורסמו, ולחיצה על "מחדש" תגרום
   * לבאנר "הסידור פורסם" להופיע שוב למדריכים שכבר ראו.
   */
  async function handleRepublishWeek() {
    if (!confirm(`לעדכן ${publishedCount} שיבוצים מפורסמים? המדריכים יקבלו את הבאנר שוב.`)) return;
    setPublishing(true);
    try {
      const n = await republishWeek(weekStart, cityFilter);
      alert(`עודכנו ${n} שיבוצים — הבאנר יחזור למדריכים`);
      reload();
    } catch (e) {
      alert('עדכון נכשל: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setPublishing(false);
    }
  }

  /**
   * "בטלי פרסום" — מחזיר את כל ה-published shifts בשבוע ל-draft.
   * המדריכים יפסיקו לראות אותם ב-/my-shifts מיד.
   */
  async function handleUnpublishWeek() {
    if (!confirm(`לבטל פרסום של ${publishedCount} שיבוצים? המדריכים יפסיקו לראות אותם.`)) return;
    setPublishing(true);
    try {
      const n = await unpublishWeek(weekStart, cityFilter);
      alert(`בוטל פרסום של ${n} שיבוצים — חזרו ל-draft`);
      reload();
    } catch (e) {
      alert('ביטול פרסום נכשל: ' + (e instanceof Error ? e.message : ''));
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
          {allPublished ? (
            // מצב "הכל פורסם" — מציגים שני כפתורים: עדכון פרסום (ירוק) + ביטול (אפור)
            <>
              <button
                onClick={handleUnpublishWeek}
                disabled={publishing}
                title="מחזיר את כל המשמרות ל-draft. המדריכים יפסיקו לראות אותן."
                style={{
                  padding: '8px 14px',
                  background: '#fff',
                  color: '#991b1b',
                  border: '1px solid #fca5a5',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: publishing ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                ↩️ בטלי פרסום
              </button>
              <button
                onClick={handleRepublishWeek}
                disabled={publishing}
                title="מעדכן את זמן הפרסום — הבאנר יחזור למדריכים שכבר ראו"
                style={{
                  padding: '8px 14px',
                  background: ADMIN_COLORS.green700,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: publishing ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                🔄 פרסמי מחדש
              </button>
            </>
          ) : (
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
          )}
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
                lisbonAreaMinHeight={lisbonAreaMinHeight}
                onChange={reload}
              />
            );
          })}
        </div>
      )}

      <style jsx global>{`
        /* מובייל ≤720px: ימים מערום אנכי, פונטים גדולים, notes wrap לקריאות.
           ⚠️ global ולא scoped — כי הסלקטורים מתייחסים ל-data-attributes
           שנמצאים בתוך קומפוננטות-ילד (DayColumn, ShiftCard) שלא חולקות
           scope עם ה-<style jsx> של ShiftsContent. ה-scoping האפקטיבי נשמר
           דרך התלות ב-[data-shifts-board] שהוא ייחודי לדף הזה. */
        @media (max-width: 720px) {
          [data-shifts-board] {
            grid-template-columns: 1fr !important;
            gap: 12px !important;
          }
          [data-shifts-board] [data-day-column] {
            min-height: auto !important;
            padding: 12px !important;
          }
          [data-shifts-board] [data-day-header] {
            font-size: 15px !important;
            padding-bottom: 8px !important;
          }
          /* ⚠️ במובייל: ביטול ההזרה של גובה ליסבון. אין צורך ליישר עמודות (יום אחד
             לעמודה). ביטול ההזרה מקצר את המרווח בין ליסבון לפורטו דרמטית. */
          [data-shifts-board] [data-lisbon-row] {
            min-height: 0 !important;
          }
          /* כרטיס שיבוץ: padding נדיב + לפחות 60px גובה שיהיה נוח לאצבע */
          [data-shifts-board] [data-shift-card] {
            padding: 10px 12px !important;
            min-height: 60px !important;
          }
          [data-shifts-board] [data-shift-card] [data-shift-title] {
            font-size: 15px !important;
          }
          [data-shifts-board] [data-shift-card] [data-shift-time] {
            font-size: 13px !important;
          }
          [data-shifts-board] [data-shift-card] [data-shift-notes] {
            font-size: 12px !important;
            white-space: normal !important;
          }
          /* צ'יפ מדריך / "+ שבצי" — גובה touch-friendly של 44px */
          [data-shifts-board] [data-shift-card] [data-shift-guide] {
            font-size: 14px !important;
            padding: 10px 12px !important;
            min-height: 44px !important;
          }
          /* ✏️ + 🗑️ — אייקונים עם אזור לחיצה של 44×44 (סטנדרט iOS/Android) */
          [data-shifts-board] [data-shift-card] button {
            font-size: 18px !important;
            min-width: 44px !important;
            min-height: 44px !important;
            padding: 6px !important;
          }
          /* הצ'יפ עצמו של בחירת המדריך הוא button — הוא יקבל את הגדלים שלו מ-data-shift-guide למעלה.
             כדי לא להחיל את ה-44×44 על הצ'יפ (שצריך להיות full-width), נחזיר min-width: 0 */
          [data-shifts-board] [data-shift-card] button[data-shift-guide] {
            min-width: 0 !important;
            width: 100% !important;
          }
          [data-shifts-board] [data-vacation-pill] {
            font-size: 13px !important;
            padding: 7px 10px !important;
          }
          [data-shifts-board] [data-city-section] {
            padding: 8px !important;
            gap: 8px !important;
          }
          [data-shifts-board] [data-city-label] {
            font-size: 13px !important;
            margin-bottom: 6px !important;
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
            padding: 12px 14px !important;
            font-size: 14px !important;
            min-height: 44px !important;
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
  holidaysAreaMinHeight, vacationsAreaMinHeight, lisbonAreaMinHeight,
}: {
  date: Date;
  shifts: Shift[];
  guides: Guide[];
  vacationsForDay: { guide: Guide; label: string | null }[];
  onChange: () => void;
  holidaysAreaMinHeight: number;
  vacationsAreaMinHeight: number;
  lisbonAreaMinHeight: number;
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
        borderRadius: 7,
        padding: 4,
        // ⚠️ חשוב: flex column ולא grid! ב-display:grid בלי gridTemplateColumns
        // מפורש, ה-implicit column לא מכבד padding ודוחף ילדים 3-4px לעמודה
        // הסמוכה במסכים צרים (זה היה הבאג של "המלבנים גולשים").
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minHeight: 120,
        minWidth: 0,
        boxSizing: 'border-box',
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
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
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
                fontSize: 10,
                background: '#fffbeb',
                color: '#92400e',
                padding: '3px 6px',
                borderRadius: 4,
                textAlign: 'center',
                fontWeight: 700,
                lineHeight: 1.3,
                border: '1px solid #fcd34d',
                borderRight: c ? `3px solid ${c.border}` : '1px solid #fcd34d',
                overflow: 'hidden',
                whiteSpace: 'nowrap',
                textOverflow: 'ellipsis',
              }}
              title={`${v.guide.name} בחופש${v.label ? ` — ${v.label}` : ''}`}
            >
              {v.guide.name}
              {v.label && (
                <span style={{ fontWeight: 500, opacity: 0.7, marginRight: 4 }}>
                  · {v.label}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* שורה 4 — אזור ליסבון (גובה שמור אחיד בכל הימים, כדי שפורטו ייושר).
          במובייל ה-CSS מבטל את ה-minHeight כי אין צורך ביישור (יום אחד בעמודה). */}
      <div data-lisbon-row style={{ minHeight: lisbonAreaMinHeight }}>
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
      </div>

      {/* שורה 5 — אזור פורטו (גובה אוטומטי, מתחיל באותה Y בכל ימי השבוע) */}
      <div>
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
        {!hasShifts && (
          <div style={{ fontSize: 11, color: ADMIN_COLORS.gray500, textAlign: 'center', padding: '6px 0' }}>—</div>
        )}
      </div>

      {/* filler — תופס את הגובה הנותר כדי שהעמודה תמלא את הגריד */}
      <div style={{ flex: 1 }} />
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
      style={{
        background: color,
        borderRadius: 5,
        padding: 4,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        minWidth: 0,
      }}
    >
      <div data-city-label style={{ fontSize: 9, fontWeight: 700, color: labelColor, letterSpacing: 0.3, marginBottom: 1 }}>
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
    // לסיורים פרטיים / הכשרות / פעילות צוות — כל מדריך בעיר זמין
    // (ההסמכה הספציפית באה לידי ביטוי בפירוט הסיור).
    // לשאר הסיורים — מסננים לפי qualified_tours.
    const skipQualificationFilter = FLEXIBLE_TOUR_TYPES.has(shift.tour_type);
    return guides.filter((g) => {
      if (g.city !== shift.city) return false;
      if (!skipQualificationFilter) {
        const qt = g.qualified_tours || [];
        if (qt.length > 0 && !qt.includes(shift.tour_type)) return false;
      }
      // מדריך בחופש בתאריך הזה — לא בdropdown
      if (isGuideOnVacation(g, shift.shift_date)) return false;
      return true;
    });
  }, [guides, shift.city, shift.tour_type, shift.shift_date]);

  const currentGuide = guides.find((g) => g.id === shift.guide_id);
  const guideClr = guideColor(shift.guide_id, guides);
  const isPrivate = PRIVATE_TOUR_TYPES.has(shift.tour_type);
  const isTraining = TRAINING_TOUR_TYPES.has(shift.tour_type);
  const isTeam = TEAM_TOUR_TYPES.has(shift.tour_type);
  // האם זו "הצעה שצפויה לסגור" שעוד לא אושרה סופית — מסומן בתחילית [כנראה]
  const isTentative = isPrivate && (shift.notes?.startsWith(TENTATIVE_PREFIX) ?? false);

  // לסיור פרטי / הכשרה — שולפים את ה-detail (חלק ראשון לפני המפריד) מתוך notes.
  // לפעילות צוות — ה-notes כולו הוא התיאור (אין splitter).
  // תומך בכמה מפרידים: " · " (הפורמט הרשמי), " - " ו-" / " (פורמט ידני שעומר השתמשה בו בעבר).
  let detailFromNotes: string | null = null;
  let restNotes: string | null = null;
  if ((isPrivate || isTraining) && shift.notes) {
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
      detailFromNotes = parts[0]?.trim() || null;
      restNotes = parts.slice(1).join(splitter).trim() || null;
    } else {
      detailFromNotes = raw.trim() || null;
      restNotes = null;
    }
  }
  const privateDetail = isPrivate ? detailFromNotes : null;

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
    let tourLabel: string;
    if (isPrivate) tourLabel = 'סיור פרטי';
    else if (isTraining || isTeam) tourLabel = TOUR_TYPE_SHORT_LABELS[shift.tour_type] || tourTypeLabel(shift.tour_type);
    else tourLabel = tourTypeLabel(shift.tour_type);
    if (!confirm(`למחוק את המשמרת של ${tourLabel} ב-${shortTime(shift.shift_time)}?\nהשיבוץ ייעלם מהלוח לחלוטין.`)) return;
    setBusy(true);
    try {
      // אם זה שיבוץ "🤖 קבע" — לזכור שעומר ביטלה אותו ידנית, אחרת ה-autofill ישחזר אותו בטעינה הבאה
      const isRosterAutofill = shift.notes?.startsWith(ROSTER_AUTOFILL_PREFIX) ?? false;
      if (isRosterAutofill && shift.city === 'porto') {
        addSkippedRosterSlot(rosterSlotKey(shift.shift_date, shortTime(shift.shift_time), shift.tour_type, 'porto'));
      }
      await deleteShift(shift.id);
      onChange();
    } catch (e) {
      alert('משהו השתבש: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  }

  /**
   * שכפול לתצפות — יוצר ישר משמרת חדשה בלוח באותו תאריך/שעה/עיר/סיור,
   * עם tour_type='תצפות'. ה-detail (שם הסיור) נשמר ב-notes לפי אותו פורמט
   * שכרטיס תצפות יודע לקרוא. השיבוץ נשאר ריק — עומר תבחר את המדריך הצופה
   * דרך הקלף בלוח כמו כל משמרת אחרת.
   */
  async function handleDuplicateToObservation() {
    setBusy(true);
    try {
      const observationDetail = isPrivate
        ? (detailFromNotes || 'סיור פרטי')
        : tourTypeLabel(shift.tour_type);
      await createManualShift({
        shift_date: shift.shift_date,
        shift_time: shortTime(shift.shift_time),
        city: shift.city,
        tour_type: 'תצפות',
        guide_id: null,
        notes: observationDetail,
      });
      onChange();
    } catch (e) {
      alert('משהו השתבש: ' + (e instanceof Error ? e.message : ''));
    } finally {
      setBusy(false);
    }
  }

  // האם זה סיור פרטי סגור סופית (לא "כנראה" טנטטיבי)?
  const isConfirmedPrivate = isPrivate && !isTentative && shift.status !== 'cancelled';

  // מסגרת לכרטיס לפי סטטוס.
  //   • cancelled → רקע אדום בהיר
  //   • tentative private (🤔) → רקע קרם + מסגרת מקווקווית
  //   • confirmed private (🔒) → רקע ירוק בהיר + מסגרת ירוקה עבה (להבליט מהרגיל)
  //   • published → מסגרת תכלת
  let cardBg: string = '#fff';
  let cardBorder: string = ADMIN_COLORS.gray300;
  let cardBorderStyle: string = 'solid';
  let cardBorderWidth: number = 1;
  if (shift.status === 'cancelled') {
    cardBg = '#fef2f2';
    cardBorder = '#fca5a5';
  } else if (isTentative) {
    cardBg = '#fffbeb';
    cardBorder = '#a37b00';
    cardBorderStyle = 'dashed';
  } else if (isConfirmedPrivate) {
    cardBg = '#ecfdf5';
    cardBorder = ADMIN_COLORS.green600;
    cardBorderWidth = 2;
  } else if (shift.status === 'published') {
    cardBorder = '#93c5fd';
  }

  // שם הסיור להצגה:
  //   • פרטי: "<detail> פרטי" (למשל "אראבידה פרטי")
  //   • תצפות / ניסיון דפים: "<icon> <kind>: <detail>" (למשל "👁️ תצפות: ליסבון הקלאסית")
  //   • פעילות צוות: "🤝 פעילות צוות"
  //   • שאר: שם הסיור הרגיל
  let displayTourName: string;
  if (isPrivate) {
    displayTourName = detailFromNotes ? `${detailFromNotes} פרטי` : tourTypeLabel(shift.tour_type);
  } else if (isTraining) {
    const icon = TOUR_TYPE_ICONS[shift.tour_type] || '';
    const shortLabel = TOUR_TYPE_SHORT_LABELS[shift.tour_type] || tourTypeLabel(shift.tour_type);
    displayTourName = detailFromNotes
      ? `${icon} ${shortLabel}: ${detailFromNotes}`
      : `${icon} ${shortLabel}`;
  } else if (isTeam) {
    const icon = TOUR_TYPE_ICONS[shift.tour_type] || '';
    const shortLabel = TOUR_TYPE_SHORT_LABELS[shift.tour_type] || tourTypeLabel(shift.tour_type);
    displayTourName = `${icon} ${shortLabel}`;
  } else {
    displayTourName = tourTypeLabel(shift.tour_type);
  }
  // ההערה התחתונה:
  //   • פרטי: שם הלקוח/מספר אנשים (restNotes)
  //   • תצפות / ניסיון דפים: שם המדריך המלווה/מתלמד (restNotes)
  //   • פעילות צוות: כל ה-notes (התיאור)
  //   • שאר: כל ה-notes
  const displayNotes = isPrivate || isTraining ? restNotes : shift.notes;

  return (
    <div
      data-shift-card
      style={{
        background: cardBg,
        border: `${cardBorderWidth}px ${cardBorderStyle} ${cardBorder}`,
        borderRadius: 4,
        padding: '3px 4px',
        opacity: shift.status === 'cancelled' ? 0.7 : 1,
        position: 'relative',
        minWidth: 0,
        boxSizing: 'border-box',
        // overflow:hidden מבטיח שום תוכן (אייקונים, dropdown, טקסט) לא יוכל לחרוג ממסגרת הקלף
        overflow: 'hidden',
      }}
    >
      {/* שורה 1: שעה + סוג סיור + כפתורים */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 2, marginBottom: 2, minWidth: 0 }}>
        <span
          data-shift-time
          style={{ fontSize: 9, color: ADMIN_COLORS.gray500, whiteSpace: 'nowrap', fontWeight: 700, flexShrink: 0 }}
        >
          {shortTime(shift.shift_time)}
        </span>
        {isTentative && (
          <span
            title="הצעה שצפויה לסגור — לא סגור סופית"
            style={{ fontSize: 10, flexShrink: 0 }}
          >
            🤔
          </span>
        )}
        {isConfirmedPrivate && (
          <span
            title="סיור פרטי סגור סופית"
            style={{ fontSize: 10, flexShrink: 0 }}
          >
            🔒
          </span>
        )}
        <span
          data-shift-title
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: ADMIN_COLORS.gray900,
            flex: '1 1 0',
            minWidth: 0,
            lineHeight: 1.25,
            // עד 2 שורות — שמות ארוכים כמו "ליסבון הקלאסית פרטי" יראו במלואם
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
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
            padding: '2px 5px',
            fontSize: 10,
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
            padding: '2px 5px',
            fontSize: 9,
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

      {/* Picker dropdown — נפתח inline בתוך הקלף (במקום position:absolute) כך
          שהקלף מתרחב כלפי מטה, ולא מכסה קלפים מתחת. גם תואם ל-overflow:hidden של
          הקלף, שלא יכול להציג רכיבים שיוצאים ממנו. */}
      {pickerOpen && (
        <div
          style={{
            marginTop: 4,
            background: '#fff',
            border: `1px solid ${ADMIN_COLORS.gray300}`,
            borderRadius: 6,
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
          // "שכפלי כתצפות" — רלוונטי רק על משמרות רגילות (לא על תצפות / ניסיון דפים / פעילות צוות).
          // לחיצה יוצרת ישר משמרת חדשה (אין modal) — עומר תשבץ את המדריך הצופה דרך הקלף.
          onDuplicateToObservation={
            !isTraining && !isTeam
              ? async () => { await handleDuplicateToObservation(); setEditOpen(false); }
              : undefined
          }
        />
      )}
    </div>
  );
}

const iconBtnStyle: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: 10,
  padding: 0,
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
  // תיאור פעילות צוות (לדוגמה "ארוחת צהריים בכיכר", "פגישת תיאום")
  const [teamDescription, setTeamDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const tourOptions = TOUR_TYPES[city];
  const isPrivate = PRIVATE_TOUR_TYPES.has(tourType);
  const isTraining = TRAINING_TOUR_TYPES.has(tourType);
  const isTeam = TEAM_TOUR_TYPES.has(tourType);
  // שדות "פירוט סוג סיור" — משותפים לפרטי + הכשרות (תצפות / ניסיון דפים)
  const requiresTourDetail = isPrivate || isTraining;

  // אפשרויות לסיור פרטי = כל הסיורים הרגילים בעיר (לא פרטי, לא הכשרות, לא צוות), + "אחר"
  const privateDetailOptions = useMemo(() => {
    const base = TOUR_TYPES[city]
      .filter((t) => !FLEXIBLE_TOUR_TYPES.has(t.value))
      .map((t) => ({ value: t.label, label: `${t.label} פרטי` }));
    return [...base, { value: '__other__', label: 'אחר (טקסט חופשי)' }];
  }, [city]);

  const eligibleGuides = useMemo(() => {
    // לסיורים פרטיים / הכשרות / פעילות צוות — כל מדריך בעיר זמין
    // (ההסמכה הספציפית באה לידי ביטוי בפירוט הסיור).
    // לשאר הסיורים — מסננים לפי qualified_tours.
    const skipQualificationFilter = FLEXIBLE_TOUR_TYPES.has(tourType);
    return guides.filter(
      (g) =>
        g.city === city &&
        (skipQualificationFilter || !g.qualified_tours?.length || g.qualified_tours.includes(tourType)) &&
        !isGuideOnVacation(g, date),
    );
  }, [guides, city, tourType, date]);

  async function handleSave() {
    setErr('');
    if (!date || !time || !tourType) {
      setErr('צריך תאריך, שעה וסוג סיור');
      return;
    }
    // בונים את ההערה אוטומטית לפי הסוג. הפורמט "<detail> · <extra>" מוכר לכרטיס.
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
    } else if (isTraining) {
      const detailText = privateDetail === '__other__' ? privateDetailOther.trim() : privateDetail;
      if (!detailText) {
        setErr('צריך לבחור את סוג הסיור');
        return;
      }
      finalNotes = detailText;
    } else if (isTeam) {
      if (!teamDescription.trim()) {
        setErr('צריך תיאור לפעילות הצוות');
        return;
      }
      finalNotes = teamDescription.trim();
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
              // אם בחרת פרטי קודם — נמשיך עם פרטי בעיר החדשה.
              // הכשרות / פעילות צוות זהות בשתי הערים — נשמור על אותו סוג.
              if (isPrivate) {
                setTourType(newCity === 'lisbon' ? 'פרטי_1' : 'פרטי_2');
              } else if (!isTraining && !isTeam) {
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

        {requiresTourDetail && (
          <>
            <label style={labelStyle}>{isTraining ? 'איזה סיור מועבר?' : 'פירוט הסיור'}
              <select
                value={privateDetail}
                onChange={(e) => setPrivateDetail(e.target.value)}
                style={inputStyle}
              >
                <option value="">— בחרי סוג סיור —</option>
                {privateDetailOptions.map((o) => (
                  <option key={o.value} value={o.value}>
                    {isTraining ? o.value : o.label}
                  </option>
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
          </>
        )}

        {isPrivate && (
          <>
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

        {isTeam && (
          <label style={labelStyle}>תיאור הפעילות
            <input
              type="text"
              value={teamDescription}
              onChange={(e) => setTeamDescription(e.target.value)}
              placeholder='לדוגמה: "ארוחת צהריים בכיכר", "פגישת תיאום"'
              style={inputStyle}
            />
          </label>
        )}

        <label style={labelStyle}>{isTeam ? 'מדריך/ה (אופציונלי)' : `מדריך ${isPrivate ? '' : '(אופציונלי)'}`}
          <select value={guideId} onChange={(e) => setGuideId(e.target.value)} style={inputStyle}>
            <option value="">— ללא שיבוץ עדיין —</option>
            {eligibleGuides.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>

        {!isPrivate && !isTraining && !isTeam && (
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
  shift, onClose, onSaved, onDuplicateToObservation,
}: {
  shift: Shift;
  onClose: () => void;
  onSaved: () => void;
  /** אופציונלי — אם קיים, מציג כפתור "שכפלי כתצפות" שיוצר ישר משמרת תצפות חדשה ללוח */
  onDuplicateToObservation?: () => Promise<void>;
}) {
  const [date, setDate] = useState(shift.shift_date);
  const [time, setTime] = useState(shortTime(shift.shift_time));
  const [tourType, setTourType] = useState(shift.tour_type);
  const [notes, setNotes] = useState(shift.notes || '');
  const [saving, setSaving] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [err, setErr] = useState('');

  async function handleDuplicateClick() {
    if (!onDuplicateToObservation) return;
    setDuplicating(true);
    try {
      await onDuplicateToObservation();
    } finally {
      setDuplicating(false);
    }
  }

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
        <label style={{ ...labelStyle, fontSize: 13 }}>📝 הערה למשמרת
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={'"רק אם הדורו יוצא" · "להגיע 15 דק׳ קודם" · "כפולה עם בלם"'}
            rows={3}
            style={{
              ...inputStyle,
              fontSize: 13,
              fontFamily: 'inherit',
              resize: 'vertical',
              minHeight: 64,
              lineHeight: 1.4,
            }}
          />
          <span style={{ fontSize: 11, color: ADMIN_COLORS.gray500, fontWeight: 400, marginTop: 2 }}>
            ההערה תופיע בלוח השבועי מתחת לשם המדריך
          </span>
        </label>
        {err && <div style={{ fontSize: 12, color: '#991b1b' }}>{err}</div>}
        {onDuplicateToObservation && (
          <button
            onClick={handleDuplicateClick}
            disabled={saving || duplicating}
            title="יוצרת ישר בלוח משמרת תצפות באותו תאריך/שעה/סיור — את משבצת את המדריך הצופה דרך הקלף"
            style={{
              padding: '8px 12px',
              background: '#fff',
              color: ADMIN_COLORS.green900,
              border: `1px dashed ${ADMIN_COLORS.green700}`,
              borderRadius: 6,
              fontSize: 12,
              fontWeight: 600,
              cursor: (saving || duplicating) ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              textAlign: 'center',
            }}
          >
            {duplicating ? 'יוצרת...' : '👁️ שכפלי משמרת זו כתצפות'}
          </button>
        )}
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
