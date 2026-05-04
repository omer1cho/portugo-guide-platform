/**
 * Shifts data layer — שכבת data ל-/admin/shifts.
 *
 * הtable shifts מתאכלסת אוטומטית מהאתר (cron יומי דרך
 * /api/cron/sync-shifts). הפונקציות כאן מאפשרות לעומר:
 *   - לטעון שיבוצים של שבוע נתון
 *   - לשבץ/לבטל מדריך
 *   - להוסיף שיבוץ ידני (פרטי / חד-פעמי)
 *   - לפרסם שבוע (כל ה-draft → published)
 *   - למחוק שיבוץ
 */

import { supabase } from '@/lib/supabase';
import type { Guide, GuideVacation } from '@/lib/supabase';

export type Shift = {
  id: string;
  shift_date: string;       // YYYY-MM-DD
  shift_time: string;       // HH:MM:SS
  tour_type: string;
  city: 'lisbon' | 'porto';
  guide_id: string | null;
  status: 'draft' | 'published' | 'cancelled';
  source: 'website' | 'manual';
  website_tour_id: string | null;
  notes: string | null;
  manually_edited: boolean;
  requires_guide_approval: boolean;
  guide_approval: 'pending' | 'approved' | 'rejected' | null;
  guide_responded_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * מחזיר את תחילת השבוע (יום ראשון) של תאריך נתון.
 * עברית: השבוע מתחיל ביום ראשון (יום 0 ב-JS).
 */
export function weekStartOf(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dayOfWeek = d.getDay(); // 0=Sun, 6=Sat
  d.setDate(d.getDate() - dayOfWeek);
  return d;
}

export function toIsoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

/** טוען shifts לשבוע (ראשון-שבת) ולעיר אופציונלית */
export async function loadShiftsForWeek(weekStart: Date, cityFilter: 'all' | 'lisbon' | 'porto' = 'all'): Promise<Shift[]> {
  const start = toIsoDate(weekStart);
  const end = toIsoDate(addDays(weekStart, 6));

  let q = supabase
    .from('shifts')
    .select('*')
    .gte('shift_date', start)
    .lte('shift_date', end)
    .order('shift_date', { ascending: true })
    .order('shift_time', { ascending: true });

  if (cityFilter !== 'all') {
    q = q.eq('city', cityFilter);
  }

  const { data, error } = await q;
  if (error) throw error;
  return (data || []) as Shift[];
}

/** טוען את כל המדריכים הפעילים (לשימוש ב-dropdown) */
export async function loadAvailableGuides(): Promise<Guide[]> {
  const SAFE = 'id, name, city, is_admin, is_active, availability_notes, vacation_notes, requires_pre_approval, qualified_tours, travel_type, has_vat, has_mgmt_bonus, mgmt_bonus_amount, classic_transfer_per_person';
  const FULL = `${SAFE}, vacations`;

  // ננסה עם vacations; אם העמודה לא קיימת ב-DB עדיין — נחזור בלי שהדף ייקרס
  const first = await supabase
    .from('guides')
    .select(FULL)
    .eq('is_active', true)
    .eq('is_admin', false)
    .order('name');
  if (!first.error) return (first.data || []) as Guide[];

  if (first.error.message?.toLowerCase().includes('vacations')) {
    const fallback = await supabase
      .from('guides')
      .select(SAFE)
      .eq('is_active', true)
      .eq('is_admin', false)
      .order('name');
    if (fallback.error) throw fallback.error;
    return (fallback.data || []) as Guide[];
  }
  throw first.error;
}

/** האם מדריך בחופש בתאריך נתון? */
export function isGuideOnVacation(guide: Guide, isoDate: string): boolean {
  if (!guide.vacations || guide.vacations.length === 0) return false;
  return guide.vacations.some((v) => isoDate >= v.start && isoDate <= v.end);
}

/** מחזיר את החופשה של המדריך בתאריך נתון, או null */
export function getGuideVacationForDate(guide: Guide, isoDate: string): GuideVacation | null {
  if (!guide.vacations) return null;
  return guide.vacations.find((v) => isoDate >= v.start && isoDate <= v.end) || null;
}

/** משבץ מדריך לשיבוץ (או null = להסיר שיבוץ) */
export async function assignGuide(shiftId: string, guideId: string | null): Promise<void> {
  const { error } = await supabase
    .from('shifts')
    .update({ guide_id: guideId, manually_edited: true })
    .eq('id', shiftId);
  if (error) throw error;
}

/** מפרסם את כל ה-draft shifts בשבוע (status: draft → published) */
export async function publishWeek(weekStart: Date, cityFilter: 'all' | 'lisbon' | 'porto' = 'all'): Promise<number> {
  const start = toIsoDate(weekStart);
  const end = toIsoDate(addDays(weekStart, 6));

  let q = supabase
    .from('shifts')
    .update({ status: 'published', published_at: new Date().toISOString() })
    .eq('status', 'draft')
    .gte('shift_date', start)
    .lte('shift_date', end);

  if (cityFilter !== 'all') {
    q = q.eq('city', cityFilter);
  }

  const { data, error } = await q.select('id');
  if (error) throw error;
  return (data || []).length;
}

/** יוצר שיבוץ ידני (לסיור פרטי / חד-פעמי שלא באתר) */
export async function createManualShift(opts: {
  shift_date: string;
  shift_time: string;        // HH:MM (יישמר כ-HH:MM:00)
  tour_type: string;
  city: 'lisbon' | 'porto';
  guide_id?: string | null;
  notes?: string;
}): Promise<Shift> {
  const time = opts.shift_time.length === 5 ? `${opts.shift_time}:00` : opts.shift_time;
  const { data, error } = await supabase
    .from('shifts')
    .insert({
      shift_date: opts.shift_date,
      shift_time: time,
      tour_type: opts.tour_type,
      city: opts.city,
      guide_id: opts.guide_id || null,
      notes: opts.notes || null,
      source: 'manual',
      status: 'draft',
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as Shift;
}

/** מוחק שיבוץ */
export async function deleteShift(shiftId: string): Promise<void> {
  const { error } = await supabase.from('shifts').delete().eq('id', shiftId);
  if (error) throw error;
}

/** מעדכן שדות בשיבוץ (תאריך, שעה, סוג, הערות) */
export async function updateShift(
  shiftId: string,
  updates: Partial<Pick<Shift, 'shift_date' | 'shift_time' | 'tour_type' | 'city' | 'notes'>>,
): Promise<void> {
  const payload: Record<string, unknown> = { ...updates, manually_edited: true };
  // אם הזמן הגיע כ-HH:MM נמיר ל-HH:MM:00
  if (typeof payload.shift_time === 'string' && (payload.shift_time as string).length === 5) {
    payload.shift_time = `${payload.shift_time}:00`;
  }
  const { error } = await supabase.from('shifts').update(payload).eq('id', shiftId);
  if (error) throw error;
}

/** מעדכן זמינות וסיורים מוסמכים של מדריך (מתוך מודאל הפרטים בשיבוצים) */
export async function updateGuideAvailability(
  guideId: string,
  updates: { availability_notes?: string | null; qualified_tours?: string[] },
): Promise<void> {
  const { error } = await supabase.from('guides').update(updates).eq('id', guideId);
  if (error) throw error;
}

/** מעדכן רשימת חופשות של מדריך */
export async function updateGuideVacations(
  guideId: string,
  vacations: GuideVacation[],
): Promise<void> {
  const { error } = await supabase
    .from('guides')
    .update({ vacations })
    .eq('id', guideId);
  if (error) throw error;
}

/** מחזיר תווית קריאה לסוג סיור (למשל 'קלאסי_1' → 'ליסבון הקלאסית') */
export function tourTypeLabel(tourType: string): string {
  const map: Record<string, string> = {
    'קלאסי_1': 'ליסבון הקלאסית',
    'פורטו_1': 'פורטו הקלאסית',
    'בלם_1': 'בלם',
    'סינטרה': 'סינטרה',
    'אראבידה': 'אראבידה',
    'אובידוש': 'אובידוש',
    'קולינרי': 'קולינרי',
    'טעימות': 'טעימות פורטו',
    'דורו': 'דורו',
    'פרטי_1': 'פרטי (ליסבון)',
    'פרטי_2': 'פרטי (פורטו)',
  };
  return map[tourType] || tourType;
}

/** מחזיר HH:MM מתוך HH:MM:SS */
export function shortTime(t: string): string {
  return t.slice(0, 5);
}
