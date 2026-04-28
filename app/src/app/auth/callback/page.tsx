'use client';

/**
 * /auth/callback
 *
 * המקום שאליו Supabase מנתב אחרי לחיצה על Magic Link מהמייל.
 * מה שקורה כאן:
 *   1. Supabase Auth מזהה את הקוד מה-URL ומייצר session אוטומטית
 *   2. אנחנו טוענים את רשומת המדריך לפי המייל המאומת
 *   3. שומרים פרטי המדריך ב-localStorage כדי שכל הדפים הקיימים יעבדו כרגיל
 *   4. מנותבים ל-/home (או חזרה ל-/ עם הודעה אם לא נמצא)
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // נחכה רגע ש-Supabase יעבד את הקוד מה-URL hash
      // (ה-SDK עושה את זה אוטומטית בטעינה)
      let session = (await supabase.auth.getSession()).data.session;

      // אם אין סשן, ננסה שוב כמה פעמים — ה-SDK עשוי להיות באמצע עיבוד
      for (let i = 0; i < 5 && !session; i++) {
        await new Promise((r) => setTimeout(r, 300));
        session = (await supabase.auth.getSession()).data.session;
      }

      if (cancelled) return;

      if (!session?.user?.email) {
        setStatus('error');
        setErrorMsg('הקישור פג תוקף או כבר היה בשימוש. נסי לבקש קישור חדש.');
        return;
      }

      // טעינת רשומת המדריך לפי המייל
      const { data: guide, error: guideErr } = await supabase
        .from('guides')
        .select('id, name, city, is_admin')
        .ilike('email', session.user.email)
        .single();

      if (cancelled) return;

      if (guideErr || !guide) {
        setStatus('error');
        setErrorMsg('המייל מאומת, אבל לא מצאנו אותך ברשימת המדריכים. דברי עם פורטוגו.');
        return;
      }

      try {
        localStorage.setItem('portugo_guide_id', guide.id);
        localStorage.setItem('portugo_guide_name', guide.name);
        localStorage.setItem('portugo_guide_city', guide.city);
        localStorage.setItem('portugo_is_admin', guide.is_admin ? '1' : '0');
      } catch {}

      router.replace('/home');
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-b from-green-50 via-white to-green-50">
      <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full text-center border border-green-100">
        {status === 'loading' ? (
          <>
            <div className="text-4xl mb-3">🔐</div>
            <p className="text-gray-700 font-semibold">רגע, מחבר.ת אותך למערכת...</p>
            <p className="text-sm text-gray-500 mt-2">לוקח כמה שניות.</p>
          </>
        ) : (
          <>
            <div className="text-4xl mb-3">⚠️</div>
            <p className="text-red-700 font-semibold mb-3">{errorMsg}</p>
            <button
              onClick={() => router.replace('/')}
              className="bg-green-700 hover:bg-green-800 active:scale-98 transition-all text-white rounded-xl py-2 px-6 font-semibold"
            >
              חזרה למסך הכניסה
            </button>
          </>
        )}
      </div>
    </div>
  );
}
