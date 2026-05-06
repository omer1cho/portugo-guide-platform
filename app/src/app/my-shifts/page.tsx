'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthGuard } from '@/lib/auth';
import {
  loadPublishedShiftsForGuide,
  getLatestPublishTimestampForGuide,
  tourTypeLabel,
  shortTime,
  type Shift,
} from '@/lib/admin/shifts-data';

const DAY_NAMES = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
const PRIVATE_TOUR_TYPES = new Set(['פרטי_1', 'פרטי_2']);
const TRAINING_TOUR_TYPES = new Set(['תצפות', 'נסיון_דפים']);
const TEAM_TOUR_TYPES = new Set(['פעילות_צוות']);
const TENTATIVE_PREFIX = '[כנראה] ';
const TOUR_TYPE_ICONS: Record<string, string> = {
  'תצפות': '👁️',
  'נסיון_דפים': '📋',
  'פעילות_צוות': '🤝',
};
const TOUR_TYPE_SHORT_LABELS: Record<string, string> = {
  'תצפות': 'תצפות',
  'נסיון_דפים': 'ניסיון דפים',
  'פעילות_צוות': 'פעילות צוות',
};

/**
 * מחזיר את שם הסיור להצגה למדריך.
 *  • סיור פרטי: "<detail> פרטי"
 *  • תצפות / ניסיון דפים: "👁️ תצפות: <detail>"
 *  • פעילות צוות: "🤝 פעילות צוות"
 *  • שאר: שם הסיור הרגיל
 */
function displayName(shift: Shift): string {
  const isPrivate = PRIVATE_TOUR_TYPES.has(shift.tour_type);
  const isTraining = TRAINING_TOUR_TYPES.has(shift.tour_type);
  const isTeam = TEAM_TOUR_TYPES.has(shift.tour_type);

  let detailFromNotes: string | null = null;
  if ((isPrivate || isTraining) && shift.notes) {
    let raw = shift.notes;
    if (raw.startsWith(TENTATIVE_PREFIX)) raw = raw.slice(TENTATIVE_PREFIX.length).trim();
    const splitter = raw.includes(' · ') ? ' · ' : raw.includes(' - ') ? ' - ' : raw.includes(' / ') ? ' / ' : null;
    detailFromNotes = splitter ? (raw.split(splitter)[0]?.trim() || null) : raw.trim() || null;
  }

  if (isPrivate) {
    return detailFromNotes ? `${detailFromNotes} פרטי` : tourTypeLabel(shift.tour_type);
  }
  if (isTraining) {
    const icon = TOUR_TYPE_ICONS[shift.tour_type] || '';
    const label = TOUR_TYPE_SHORT_LABELS[shift.tour_type] || tourTypeLabel(shift.tour_type);
    return detailFromNotes ? `${icon} ${label}: ${detailFromNotes}` : `${icon} ${label}`;
  }
  if (isTeam) {
    const icon = TOUR_TYPE_ICONS[shift.tour_type] || '';
    const label = TOUR_TYPE_SHORT_LABELS[shift.tour_type] || tourTypeLabel(shift.tour_type);
    return `${icon} ${label}`;
  }
  return tourTypeLabel(shift.tour_type);
}

/** מחזיר את ההערה התחתונה להצגה (לפרטי = שם לקוח, לפעילות צוות = התיאור, לשאר = ההערה כמו שהיא) */
function displayNotes(shift: Shift): string | null {
  const isPrivate = PRIVATE_TOUR_TYPES.has(shift.tour_type);
  const isTraining = TRAINING_TOUR_TYPES.has(shift.tour_type);
  if (!shift.notes) return null;

  if (isPrivate || isTraining) {
    let raw = shift.notes;
    if (raw.startsWith(TENTATIVE_PREFIX)) raw = raw.slice(TENTATIVE_PREFIX.length).trim();
    const splitter = raw.includes(' · ') ? ' · ' : raw.includes(' - ') ? ' - ' : raw.includes(' / ') ? ' / ' : null;
    if (!splitter) return null;
    const parts = raw.split(splitter);
    return parts.slice(1).join(splitter).trim() || null;
  }
  return shift.notes;
}

function isTentative(shift: Shift): boolean {
  return PRIVATE_TOUR_TYPES.has(shift.tour_type) && (shift.notes?.startsWith(TENTATIVE_PREFIX) ?? false);
}

// === iCalendar (.ics) export — לייצוא ליומן Google / Apple / Outlook ===

/** משך ברירת-מחדל בשעות לכל סוג סיור — להגדרת DTEND ביומן */
const DEFAULT_DURATION_HOURS: Record<string, number> = {
  'קלאסי_1': 3, 'פורטו_1': 3,
  'בלם_1': 2, 'טעימות': 2,
  'קולינרי': 3,
  'סינטרה': 8, 'אראבידה': 8, 'אובידוש': 8, 'דורו': 8,
  'פרטי_1': 3, 'פרטי_2': 3,
  'תצפות': 3, 'נסיון_דפים': 3,
  'פעילות_צוות': 1,
};

/** YYYY-MM-DD + HH:MM:SS → "YYYYMMDDTHHMMSS" (פורמט iCalendar local time) */
function toIcsLocalTime(isoDate: string, hms: string): string {
  const dateClean = isoDate.replace(/-/g, '');
  const timeClean = hms.replace(/:/g, '').padEnd(6, '0');
  return `${dateClean}T${timeClean}`;
}

/** מוסיף שעות לזמן HH:MM:SS, מחזיר זמן חדש (יכול לחצות יום — אבל לא צריך לדאוג כי 8 שעות מ-9:45 זה אותו יום) */
function addHoursToTime(hms: string, hours: number): string {
  const [h, m, s] = hms.split(':').map(Number);
  const totalMinutes = h * 60 + m + hours * 60;
  const newH = Math.floor(totalMinutes / 60) % 24;
  const newM = totalMinutes % 60;
  return `${String(newH).padStart(2, '0')}:${String(newM).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Escapes ל-iCalendar TEXT field — \, ;, , והחלפת newlines ל-\\n */
function icsEscape(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/** בונה תוכן .ics מלא מרשימת משמרות. Timezone: Europe/Lisbon (גם בליסבון וגם בפורטו). */
function buildIcs(shifts: Shift[], guideName: string): string {
  const now = new Date();
  const dtstamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

  const events = shifts.map((s) => {
    const durationHours = DEFAULT_DURATION_HOURS[s.tour_type] ?? 3;
    const endTime = addHoursToTime(s.shift_time, durationHours);
    const dtstart = toIcsLocalTime(s.shift_date, s.shift_time);
    const dtend = toIcsLocalTime(s.shift_date, endTime);
    const summary = icsEscape(displayName(s));
    const cityLabel = s.city === 'lisbon' ? 'ליסבון, פורטוגל' : 'פורטו, פורטוגל';
    const desc = icsEscape(
      [s.notes ? `הערה: ${s.notes}` : null, `שיבוץ פורטוגו של ${guideName}`]
        .filter(Boolean)
        .join('\n'),
    );

    return [
      'BEGIN:VEVENT',
      `UID:portugo-shift-${s.id}@portugo.co.il`,
      `DTSTAMP:${dtstamp}`,
      `DTSTART;TZID=Europe/Lisbon:${dtstart}`,
      `DTEND;TZID=Europe/Lisbon:${dtend}`,
      `SUMMARY:${summary}`,
      `LOCATION:${icsEscape(cityLabel)}`,
      `DESCRIPTION:${desc}`,
      'END:VEVENT',
    ].join('\r\n');
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Portugo//Guide Shifts//HE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:משמרות פורטוגו - ${icsEscape(guideName)}`,
    'X-WR-TIMEZONE:Europe/Lisbon',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');
}

/** מוריד את ה-.ics כקובץ למחשב/נייד של המדריך */
function downloadIcs(shifts: Shift[], guideName: string): void {
  const ics = buildIcs(shifts, guideName);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  // שם הקובץ באנגלית כדי שמערכות mobile יפתחו אותו אוטומטית
  a.download = `portugo-shifts.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** YYYY-MM-DD → "ראשון, 12/5" */
function formatDayLabel(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayName = DAY_NAMES[date.getDay()];
  return `${dayName}, ${d}/${m}`;
}

/** האם ה-iso הוא היום? */
function isToday(iso: string): boolean {
  const today = new Date();
  return iso === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

/** האם ה-iso הוא מחר? */
function isTomorrow(iso: string): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return iso === `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
}

function MyShiftsContent() {
  useAuthGuard();
  const router = useRouter();
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [guideName, setGuideName] = useState('');

  useEffect(() => {
    const id = localStorage.getItem('portugo_guide_id');
    const name = localStorage.getItem('portugo_guide_name') || '';
    if (!id) {
      router.push('/');
      return;
    }
    setGuideName(name);

    async function load() {
      try {
        const data = await loadPublishedShiftsForGuide(id!, 14);
        setShifts(data);
        // ברגע שהמדריך נכנס לדף — מסמנים את הפרסום העדכני כ"נראה",
        // כך שהבאנר ב-/home לא יציק לו עד הפרסום הבא.
        const latestPublishedAt = await getLatestPublishTimestampForGuide(id!);
        if (latestPublishedAt) {
          localStorage.setItem(`portugo_seen_publish_${id}`, latestPublishedAt);
        }
      } catch (e) {
        console.error('Failed to load shifts:', e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [router]);

  // קיבוץ לפי תאריך לתצוגה (תאריך → רשימת shifts)
  const shiftsByDate: Record<string, Shift[]> = {};
  for (const s of shifts) {
    if (!shiftsByDate[s.shift_date]) shiftsByDate[s.shift_date] = [];
    shiftsByDate[s.shift_date].push(s);
  }
  const dates = Object.keys(shiftsByDate).sort();

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* Header */}
      <header className="bg-green-800 text-white p-4 shadow-md">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div>
            <Link
              href="/home"
              className="text-sm opacity-80 hover:opacity-100 transition-opacity"
            >
              → חזרה לעמוד הבית
            </Link>
            <h1 className="text-xl font-bold mt-1">🗓️ המשמרות שלי</h1>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {loading ? (
          <div className="text-gray-400 text-center py-12">רגע, מושכת את הסידור...</div>
        ) : dates.length === 0 ? (
          <div className="bg-white rounded-2xl shadow p-8 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-700 font-semibold mb-1">אין משמרות פורסמו עדיין</p>
            <p className="text-sm text-gray-500">
              ברגע שהסידור החדש יפורסם — הוא יופיע כאן
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* כפתור ייצוא ליומן — מוריד .ics שאפשר להוסיף ל-Google / Apple / Outlook Calendar */}
            <button
              onClick={() => downloadIcs(shifts, guideName)}
              className="w-full bg-white border-2 border-green-600 text-green-800 hover:bg-green-50 active:scale-98 transition-all rounded-xl py-3 font-semibold text-sm flex items-center justify-center gap-2"
            >
              📅 הוסף.י ליומן (Google / Apple)
            </button>

            {dates.map((date) => (
              <section
                key={date}
                className={`bg-white rounded-2xl shadow overflow-hidden ${
                  isToday(date) ? 'ring-2 ring-green-600' : ''
                }`}
              >
                <div
                  className={`px-4 py-2.5 font-bold text-sm flex justify-between items-center ${
                    isToday(date)
                      ? 'bg-green-600 text-white'
                      : isTomorrow(date)
                      ? 'bg-green-50 text-green-900'
                      : 'bg-gray-50 text-gray-700'
                  }`}
                >
                  <span>{formatDayLabel(date)}</span>
                  {isToday(date) && <span className="text-xs">היום</span>}
                  {isTomorrow(date) && <span className="text-xs">מחר</span>}
                </div>
                <ul className="divide-y divide-gray-100">
                  {shiftsByDate[date].map((s) => {
                    const tentative = isTentative(s);
                    const notes = displayNotes(s);
                    return (
                      <li
                        key={s.id}
                        className={`px-4 py-3 flex items-start gap-3 ${
                          tentative ? 'bg-amber-50' : ''
                        }`}
                      >
                        <div className="text-base font-bold text-green-800 min-w-[60px]">
                          {shortTime(s.shift_time)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-gray-900 text-base">
                            {tentative && <span className="ml-1">🤔</span>}
                            {displayName(s)}
                          </div>
                          {notes && (
                            <div className="text-sm text-amber-700 mt-1 italic">
                              {notes}
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}

        <div className="text-center pt-4">
          <Link
            href="/home"
            className="inline-block text-sm text-green-700 underline"
          >
            חזרה לעמוד הבית
          </Link>
        </div>
      </main>
    </div>
  );
}

export default function MyShiftsPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">טוען...</div>}>
      <MyShiftsContent />
    </Suspense>
  );
}
