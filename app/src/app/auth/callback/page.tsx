'use client';

/**
 * /auth/callback
 *
 * המקום שאליו Supabase מנתב אחרי לחיצה על Magic Link מהמייל.
 *
 * תומך בשתי זרימות OAuth:
 *   1. PKCE (ברירת מחדל ב-Supabase v2): URL כולל ?code=... — אנחנו קוראים
 *      ל-exchangeCodeForSession מפורש כדי להמיר את הקוד לסשן.
 *   2. Implicit (ישן): URL כולל #access_token=... — ה-SDK מטפל אוטומטית.
 *
 * אחרי שהסשן נוצר:
 *   - טוענים את רשומת המדריך לפי המייל
 *   - שומרים ב-localStorage לטובת הדפים הקיימים
 *   - מנותבים ל-/home
 */

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { supabase } from '@/lib/supabase';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // ─── שלב 1: ודא שיש לנו session פעיל ───
      // PKCE flow: יש ?code=... ב-URL → לקרוא ל-exchangeCodeForSession
      const code = searchParams.get('code');
      if (code) {
        const { error: exchangeErr } = await supabase.auth.exchangeCodeForSession(code);
        if (cancelled) return;
        if (exchangeErr) {
          // אם ה-PKCE נכשל (למשל הקוד פג תוקף או נצרך כבר), נציג שגיאה
          setStatus('error');
          setErrorMsg('הקישור פג תוקף או כבר היה בשימוש. נסי לבקש קישור חדש.');
          return;
        }
      }

      // ─── שלב 2: קבלת ה-session ───
      // Implicit flow: ה-SDK כבר טיפל ב-tokens מה-hash אוטומטית.
      // PKCE flow: ה-exchange שלמעלה הצליח, ה-session כבר ב-localStorage.
      let session = (await supabase.auth.getSession()).data.session;

      // שמירה של עד שנייה וחצי במקרה שה-SDK עדיין מעבד את ה-hash
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

      // ─── שלב 3: טעינת רשומת המדריך + שמירה ב-localStorage ───
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

      // נקה את ה-URL מקודים/טוקנים לפני המעבר ל-home
      router.replace('/home');
    })();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

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

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-500 bg-gradient-to-b from-green-50 via-white to-green-50">
          רגע, מחבר.ת...
        </div>
      }
    >
      <AuthCallbackContent />
    </Suspense>
  );
}
