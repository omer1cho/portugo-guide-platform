'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

// משפטי עידוד מתחלפים — נשארים חמים, חמים ומשמחים
const COMPLIMENTS = [
  'על חלל',
  'מופלא.ה',
  'כוכב.ת',
  'נשמה',
  'אלוף.ה',
  'אגדה',
  'מנצח.ת',
  'יהלום',
  'זהב',
  'פנטסטי.ת',
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [complimentIdx, setComplimentIdx] = useState(0);
  const [checkingSession, setCheckingSession] = useState(true);

  // אם יש כבר סשן פעיל — מנתבים ישר ל-/home
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        // נוודא שיש לוקאל-סטורג' טרי לפני המעבר
        const email = data.session.user.email;
        if (email) {
          const { data: guide } = await supabase
            .from('guides')
            .select('id, name, city, is_admin')
            .ilike('email', email)
            .single();
          if (guide) {
            try {
              localStorage.setItem('portugo_guide_id', guide.id);
              localStorage.setItem('portugo_guide_name', guide.name);
              localStorage.setItem('portugo_guide_city', guide.city);
              localStorage.setItem('portugo_is_admin', guide.is_admin ? '1' : '0');
            } catch {}
            router.push('/home');
            return;
          }
        }
      }
      setCheckingSession(false);
    })();
  }, [router]);

  // הצגת compliment מתחלף
  useEffect(() => {
    const timer = setInterval(() => {
      setComplimentIdx((prev) => (prev + 1) % COMPLIMENTS.length);
    }, 2200);
    return () => clearInterval(timer);
  }, []);

  const handleSendLink = async () => {
    setError('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed) {
      setError('נשאר להזין מייל');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('המייל לא נראה תקין — נבדוק שוב?');
      return;
    }

    // אבטחה דו-שכבתית:
    //   1. Supabase Auth שולח Magic Link לכל מייל שמזינים (shouldCreateUser=true)
    //   2. /auth/callback מאמת שהמייל קיים ברשימת המדריכים שלנו — אחרת זורק
    setSending(true);
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error: authErr } = await supabase.auth.signInWithOtp({
      email: trimmed,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    });
    setSending(false);

    if (authErr) {
      // הודעה ידידותית — לא מציגים כל פרט
      const msg = authErr.message || '';
      if (/signups not allowed/i.test(msg) || /not allowed/i.test(msg) || /not found/i.test(msg)) {
        setError('המייל הזה לא מופיע אצלנו ברשימת המדריכים. דברי עם פורטוגו.');
      } else if (/rate limit/i.test(msg)) {
        setError('שלחנו כבר קישור לאחרונה. תבדוק.י את המייל לפני בקשה חדשה.');
      } else {
        setError('משהו השתבש: ' + msg);
      }
      return;
    }

    setSent(true);
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 bg-gradient-to-b from-green-50 via-white to-green-50">
        רגע, בודקים...
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-start sm:justify-center p-6 pt-10 bg-gradient-to-b from-green-50 via-white to-green-50">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-6">
          <Image
            src="/logo.png"
            alt="פורטוגו"
            width={200}
            height={80}
            priority
            className="h-auto w-auto max-h-20"
          />
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-6 border border-green-100">
          {/* כותרת חמה */}
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              היי מדריך.ה{' '}
              <span
                key={complimentIdx}
                className="inline-block text-green-700 animate-[fadeIn_300ms_ease-out]"
              >
                {COMPLIMENTS[complimentIdx]}
              </span>
              ,
            </h2>
            <h2 className="text-xl font-bold text-gray-900 mt-1">
              {sent ? 'יופי! עכשיו פותחים את המייל' : 'מה המייל שלך?'}
            </h2>
          </div>

          {sent ? (
            <div className="text-center space-y-3">
              <div className="text-5xl">📬</div>
              <p className="text-gray-700 text-sm">
                שלחנו לך קישור ל-
                <span className="font-bold text-green-800">{email}</span>
              </p>
              <p className="text-gray-600 text-sm leading-relaxed">
                פתח.י את המייל שלך, לחצ.י על הקישור הירוק, וזהו —
                <br />
                המערכת תיפתח אוטומטית.
              </p>
              <p className="text-xs text-gray-500 mt-4">
                לא רואה.ה את המייל? תבדוק.י בתיקיית הספאם, או
              </p>
              <button
                onClick={() => {
                  setSent(false);
                  setEmail('');
                }}
                className="text-green-700 underline text-sm hover:text-green-800"
              >
                נסי עם מייל אחר
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@gmail.com"
                inputMode="email"
                autoComplete="email"
                dir="ltr"
                className="w-full border border-gray-300 rounded-xl px-4 py-3 text-lg text-center focus:border-green-700 focus:outline-none"
              />
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                  {error}
                </div>
              )}
              <button
                onClick={handleSendLink}
                disabled={sending}
                className="w-full bg-green-700 hover:bg-green-800 disabled:bg-gray-400 active:scale-98 transition-all text-white rounded-xl py-3 text-lg font-bold"
              >
                {sending ? 'שולח...' : 'שלח.י לי קישור 💌'}
              </button>
            </div>
          )}

          <p className="text-xs text-gray-400 text-center mt-6">
            Portugo 2026
          </p>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
