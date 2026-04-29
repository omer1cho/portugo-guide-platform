'use client';

/**
 * AdminGuideSwitcher
 *
 * רכיב שמופיע רק לאדמינים (עומר/רונה/פורטוגו).
 * מאפשר לעבור בין מדריכים — מעדכן את ה-localStorage כך שכל הדפים
 * הקיימים מציגים את הנתונים של המדריך שנבחר.
 *
 * "חזרה לעצמי" → טוען מחדש את הזהות של האדמין.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase, type Guide } from '@/lib/supabase';

export default function AdminGuideSwitcher() {
  const router = useRouter();
  const [show, setShow] = useState(false);
  const [guides, setGuides] = useState<Pick<Guide, 'id' | 'name' | 'city'>[]>([]);
  const [currentGuideId, setCurrentGuideId] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const isAdmin = typeof window !== 'undefined' && localStorage.getItem('portugo_is_admin') === '1';
      if (!isAdmin) return;

      const { data: sessionData } = await supabase.auth.getSession();
      const email = sessionData.session?.user.email || null;
      if (cancelled || !email) return;
      setAdminEmail(email);

      // לטעון רק מדריכים פעילים (לא אדמינים)
      const { data } = await supabase
        .from('guides')
        .select('id, name, city')
        .eq('is_active', true)
        .order('name');

      if (cancelled) return;
      setGuides((data as Pick<Guide, 'id' | 'name' | 'city'>[]) || []);
      setCurrentGuideId(localStorage.getItem('portugo_guide_id'));
      setShow(true);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!show) return null;

  const isViewingOther = currentGuideId !== null && !!adminEmail;
  const currentGuide = guides.find((g) => g.id === currentGuideId);

  const handleSwitch = (guideId: string) => {
    const guide = guides.find((g) => g.id === guideId);
    if (!guide) return;
    localStorage.setItem('portugo_guide_id', guide.id);
    localStorage.setItem('portugo_guide_name', guide.name);
    localStorage.setItem('portugo_guide_city', guide.city);
    // נשארים אדמין כי זה מבוסס על ה-Auth Email, לא על המדריך הנבחר
    setCurrentGuideId(guide.id);
    router.refresh();
    window.location.reload();
  };

  const handleBackToSelf = async () => {
    if (!adminEmail) return;
    const { data: me } = await supabase
      .from('guides')
      .select('id, name, city')
      .ilike('email', adminEmail)
      .single();
    if (!me) return;
    localStorage.setItem('portugo_guide_id', me.id);
    localStorage.setItem('portugo_guide_name', me.name);
    localStorage.setItem('portugo_guide_city', me.city);
    setCurrentGuideId(me.id);
    window.location.reload();
  };

  // אם האדמין מסתכל על עצמו — מציג סלקטור.
  // אם האדמין מסתכל על מדריך — מציג באנר עם כפתור חזרה.
  const adminIsViewingSelf = currentGuide === undefined && adminEmail;

  return (
    <div className="space-y-2">
      {/* פס אדמין מסטר — קישור לדשבורד הניהולי */}
      <div className="bg-green-800 text-white rounded-xl p-3 text-sm flex items-center justify-between gap-2">
        <span className="font-semibold">🏠 לוח הבקרה של פורטוגו</span>
        <Link
          href="/admin"
          className="bg-white text-green-800 hover:bg-green-50 active:scale-98 transition-all rounded-md px-3 py-1.5 text-xs font-semibold"
        >
          פתח.י דשבורד ←
        </Link>
      </div>

      {/* פס "צפה בתור..." */}
      <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 text-sm">
        {adminIsViewingSelf ? (
          <div className="flex items-center gap-2">
            <span className="text-purple-900 font-semibold">👁️ צופה בתור:</span>
            <select
              value=""
              onChange={(e) => handleSwitch(e.target.value)}
              className="flex-1 bg-white border border-purple-300 rounded-md px-2 py-1.5 text-purple-900"
            >
              <option value="">בחר.י מדריך לצפות בנתונים שלו</option>
              {guides.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.city === 'lisbon' ? 'ליסבון' : 'פורטו'})
                </option>
              ))}
            </select>
          </div>
        ) : isViewingOther && currentGuide ? (
          <div className="flex items-center gap-2">
            <span className="text-purple-900 font-semibold flex-1">
              👁️ את.ה רואה את הנתונים של <span className="font-bold">{currentGuide.name}</span>
            </span>
            <button
              onClick={handleBackToSelf}
              className="bg-purple-700 hover:bg-purple-800 active:scale-98 transition-all text-white rounded-md px-3 py-1.5 text-xs font-semibold"
            >
              חזרה לעצמי
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
