'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useAuthGuard } from '@/lib/auth';

type TourWithBookings = {
  id: string;
  tour_date: string;
  tour_type: string;
  category: string;
  notes: string;
  start_time: string | null;
  bookings: { people: number; price: number; tip: number }[];
};

type Activity = {
  id: string;
  activity_date: string;
  activity_type: string;
  amount: number;
  notes: string;
};

function activityTypeLabel(t: string): string {
  if (t === 'habraza') return 'הברזה בכיכר';
  if (t === 'training') return 'הכשרה (כתלמיד.ה)';
  if (t === 'training_lead') return 'הכשרה (העברתי)';
  if (t === 'external') return 'פעילות חיצונית';
  if (t === 'eshel') return 'אשל';
  return t;
}

function MyToursContent() {
  useAuthGuard();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tours, setTours] = useState<TourWithBookings[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityToDelete, setActivityToDelete] = useState<Activity | null>(null);
  const [deletingActivity, setDeletingActivity] = useState(false);
  const [month, setMonth] = useState(() => {
    const y = searchParams.get('year');
    const m = searchParams.get('month');
    if (y && m) return `${y}-${m.padStart(2, '0')}`;
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });
  const [tourToDelete, setTourToDelete] = useState<TourWithBookings | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    const id = localStorage.getItem('portugo_guide_id');
    if (!id) {
      router.push('/');
      return;
    }

    async function load() {
      const [year, m] = month.split('-');
      const start = `${year}-${m}-01`;
      const lastDay = new Date(parseInt(year), parseInt(m), 0).getDate();
      const end = `${year}-${m}-${String(lastDay).padStart(2, '0')}`;

      // טעינה במקביל של סיורים + פעילויות. הכל בסדר עולה (מ-1 לחודש)
      // כדי שהמדריך יראה את היומן באופן כרונולוגי טבעי.
      const [toursRes, activitiesRes] = await Promise.all([
        supabase
          .from('tours')
          .select('id, tour_date, tour_type, category, notes, start_time, bookings(people, price, tip)')
          .eq('guide_id', id)
          .gte('tour_date', start)
          .lte('tour_date', end)
          .order('tour_date', { ascending: true })
          .order('start_time', { ascending: true, nullsFirst: true }),
        supabase
          .from('activities')
          .select('id, activity_date, activity_type, amount, notes')
          .eq('guide_id', id)
          .gte('activity_date', start)
          .lte('activity_date', end)
          .order('activity_date', { ascending: true }),
      ]);

      if (toursRes.error) console.error(toursRes.error);
      if (activitiesRes.error) console.error(activitiesRes.error);
      setTours((toursRes.data as TourWithBookings[]) || []);
      setActivities((activitiesRes.data as Activity[]) || []);
      setLoading(false);
    }
    load();
  }, [router, month]);

  const confirmDeleteTour = async () => {
    if (!tourToDelete) return;
    setDeleting(true);
    setDeleteError('');
    const { error } = await supabase.from('tours').delete().eq('id', tourToDelete.id);
    setDeleting(false);
    if (error) {
      setDeleteError('משהו השתבש: ' + error.message);
      return;
    }
    setTours(tours.filter((t) => t.id !== tourToDelete.id));
    setTourToDelete(null);
  };

  const confirmDeleteActivity = async () => {
    if (!activityToDelete) return;
    setDeletingActivity(true);
    setDeleteError('');
    const { error } = await supabase.from('activities').delete().eq('id', activityToDelete.id);
    setDeletingActivity(false);
    if (error) {
      setDeleteError('משהו השתבש: ' + error.message);
      return;
    }
    setActivities(activities.filter((a) => a.id !== activityToDelete.id));
    setActivityToDelete(null);
  };

  const formatDate = (d: string) => {
    const dt = new Date(d);
    return dt.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', weekday: 'short' });
  };

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <header className="bg-green-800 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex gap-2">
            <button
              onClick={() => router.back()}
              className="text-sm bg-green-900 hover:bg-green-950 active:scale-95 transition-transform px-3 py-2 rounded-md"
            >
              ← חזרה
            </button>
            <Link
              href="/home"
              aria-label="מסך הבית"
              className="text-base bg-green-900 hover:bg-green-950 active:scale-95 transition-transform px-3 py-2 rounded-md"
            >
              🏠
            </Link>
          </div>
          <h1 className="text-lg font-bold">הסיורים והפעילויות שלי</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-3">
        <div className="bg-white rounded-xl shadow p-3">
          <label className="block text-sm text-gray-600 mb-1">בחר.י חודש</label>
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2"
          />
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-500">טוען...</div>
        ) : tours.length === 0 && activities.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-white rounded-xl shadow">
            עוד לא הוספת סיור או פעילות בחודש הזה — בוא.י נתחיל! 👇
          </div>
        ) : (
          <>
            {/* סיורים + פעילויות ממוזגים בסדר כרונולוגי עולה.
                סיורים נשארים בסגנון לבן/ירוק, פעילויות בסגול — קל להבחין. */}
            {[
              ...tours.map((t) => ({
                kind: 'tour' as const,
                date: t.tour_date,
                sortKey: `${t.tour_date}_${t.start_time || '00:00:00'}_t`,
                tour: t,
              })),
              ...activities.map((a) => ({
                kind: 'activity' as const,
                date: a.activity_date,
                sortKey: `${a.activity_date}_99:99:99_a`, // פעילויות נופלות בסוף היום
                activity: a,
              })),
            ]
              .sort((x, y) => x.sortKey.localeCompare(y.sortKey))
              .map((item) => {
                if (item.kind === 'tour') {
                  const t = item.tour;
                  const people = t.bookings.reduce((s, b) => s + (b.people || 0), 0);
                  const price = t.bookings.reduce((s, b) => s + (b.price || 0), 0);
                  const tip = t.bookings.reduce((s, b) => s + (b.tip || 0), 0);
                  return (
                    <div key={`tour-${t.id}`} className="bg-white rounded-xl shadow p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-bold text-lg">{t.tour_type}</div>
                          <div className="text-sm text-gray-600">
                            {formatDate(t.tour_date)}
                            {t.start_time && (
                              <span className="mr-2 font-medium text-green-700">
                                · {t.start_time.slice(0, 5)}
                              </span>
                            )}
                          </div>
                          {t.notes && <div className="text-xs text-gray-500 mt-1">{t.notes}</div>}
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-800">{price}€</div>
                          <div className="text-sm text-gray-600">{people} אנשים</div>
                          {tip > 0 && <div className="text-xs text-gray-500">טיפ: {tip}€</div>}
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2 border-t">
                        <button
                          onClick={() => router.push(`/add-tour?edit=${t.id}`)}
                          className="flex-1 bg-green-100 hover:bg-green-200 active:scale-95 transition-transform text-green-800 text-sm font-semibold px-3 py-2 rounded-md"
                        >
                          עריכה
                        </button>
                        <button
                          onClick={() => {
                            setDeleteError('');
                            setTourToDelete(t);
                          }}
                          className="text-red-600 text-sm px-3 py-2 rounded-md hover:bg-red-50"
                        >
                          מחיקה
                        </button>
                      </div>
                    </div>
                  );
                }
                // פעילות
                const a = item.activity;
                return (
                  <div
                    key={`act-${a.id}`}
                    className="bg-purple-50 border border-purple-200 rounded-xl shadow p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-bold text-lg text-purple-900">
                          {activityTypeLabel(a.activity_type)}
                        </div>
                        <div className="text-sm text-gray-600">{formatDate(a.activity_date)}</div>
                        {a.notes && <div className="text-xs text-gray-600 mt-1">{a.notes}</div>}
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-purple-900">{a.amount}€</div>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-2 border-t border-purple-200">
                      <button
                        onClick={() => router.push(`/add-tour?editActivity=${a.id}`)}
                        className="flex-1 bg-purple-200 hover:bg-purple-300 active:scale-95 transition-transform text-purple-900 text-sm font-semibold px-3 py-2 rounded-md"
                      >
                        עריכה
                      </button>
                      <button
                        onClick={() => {
                          setDeleteError('');
                          setActivityToDelete(a);
                        }}
                        className="text-red-600 text-sm px-3 py-2 rounded-md hover:bg-red-50"
                      >
                        מחיקה
                      </button>
                    </div>
                  </div>
                );
              })}
          </>
        )}
      </main>

      {/* Delete-tour confirm modal — replaces native window.confirm */}
      {tourToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 animate-[fadeIn_200ms_ease-out]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-[slideUp_300ms_ease-out]">
            <h3 className="text-lg font-bold text-gray-900 mb-2">
              למחוק את הסיור?
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              אי אפשר לשחזר אחרי המחיקה.
            </p>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">סיור:</span>
                <span className="font-bold">{tourToDelete.tour_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">תאריך:</span>
                <span className="font-semibold">{formatDate(tourToDelete.tour_date)}</span>
              </div>
            </div>

            {deleteError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-3">
                {deleteError}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={confirmDeleteTour}
                disabled={deleting}
                className="w-full bg-red-600 hover:bg-red-700 active:scale-98 disabled:bg-gray-400 transition-all text-white rounded-xl py-3 font-bold"
              >
                {deleting ? 'מוחק...' : 'כן, מחק.י'}
              </button>
              <button
                onClick={() => {
                  setTourToDelete(null);
                  setDeleteError('');
                }}
                disabled={deleting}
                className="w-full bg-gray-100 hover:bg-gray-200 active:scale-98 transition-all text-gray-700 rounded-xl py-3 font-medium text-sm"
              >
                ביטול
              </button>
            </div>
          </div>

          <style jsx global>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* Delete-activity confirm modal */}
      {activityToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 animate-[fadeIn_200ms_ease-out]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-[slideUp_300ms_ease-out]">
            <h3 className="text-lg font-bold text-gray-900 mb-2">למחוק את הפעילות?</h3>
            <p className="text-sm text-gray-600 mb-4">אי אפשר לשחזר אחרי המחיקה.</p>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-4 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">פעילות:</span>
                <span className="font-bold">{activityTypeLabel(activityToDelete.activity_type)}</span>
              </div>
              <div className="flex justify-between mb-1">
                <span className="text-gray-600">תאריך:</span>
                <span className="font-semibold">{formatDate(activityToDelete.activity_date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">סכום:</span>
                <span className="font-semibold">{activityToDelete.amount}€</span>
              </div>
            </div>

            {deleteError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-3">
                {deleteError}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <button
                onClick={confirmDeleteActivity}
                disabled={deletingActivity}
                className="w-full bg-red-600 hover:bg-red-700 active:scale-98 disabled:bg-gray-400 transition-all text-white rounded-xl py-3 font-bold"
              >
                {deletingActivity ? 'מוחק...' : 'כן, מחק.י'}
              </button>
              <button
                onClick={() => {
                  setActivityToDelete(null);
                  setDeleteError('');
                }}
                disabled={deletingActivity}
                className="w-full bg-gray-100 hover:bg-gray-200 active:scale-98 transition-all text-gray-700 rounded-xl py-3 font-medium text-sm"
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyToursPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">טוען...</div>}>
      <MyToursContent />
    </Suspense>
  );
}
