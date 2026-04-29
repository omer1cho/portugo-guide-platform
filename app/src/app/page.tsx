'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';

// משפטי עידוד מתחלפים
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

type Step = 'email' | 'code';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [complimentIdx, setComplimentIdx] = useState(0);
  const [checkingSession, setCheckingSession] = useState(true);

  // אם יש כבר סשן פעיל — מנתבים ישר ל-/home
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const sessionEmail = data.session.user.email;
        if (sessionEmail) {
          const { data: guide } = await supabase
            .from('guides')
            .select('id, name, city, is_admin')
            .ilike('email', sessionEmail)
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

  // ─────────── שלב 1: שליחת קוד ───────────
  const handleSendCode = async () => {
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

    setSending(true);
    // נשלח גם לינק (כ-fallback) וגם קוד 6-ספרות. המייל מציג את שניהם.
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
      const msg = authErr.message || '';
      if (/signups not allowed/i.test(msg) || /not allowed/i.test(msg) || /not found/i.test(msg)) {
        setError('המייל הזה לא מופיע אצלנו ברשימת המדריכים. דבר.י עם פורטוגו.');
      } else if (/rate limit/i.test(msg)) {
        setError('בקשה אחרונה הייתה לפני רגע — תמתינ.י דקה ותנסה.י שוב.');
      } else {
        setError('משהו השתבש: ' + msg);
      }
      return;
    }

    setEmail(trimmed);
    setStep('code');
  };

  // ─────────── שלב 2: אימות קוד ───────────
  const handleVerifyCode = async () => {
    setError('');
    const cleaned = code.replace(/\D/g, ''); // רק ספרות
    if (cleaned.length !== 6) {
      setError('הקוד צריך להיות 6 ספרות');
      return;
    }

    setVerifying(true);
    const { error: verifyErr } = await supabase.auth.verifyOtp({
      email,
      token: cleaned,
      type: 'email',
    });

    if (verifyErr) {
      setVerifying(false);
      const msg = verifyErr.message || '';
      if (/expired|invalid/i.test(msg)) {
        setError('הקוד שגוי או פג תוקף. תבקש.י קוד חדש.');
      } else {
        setError('משהו השתבש: ' + msg);
      }
      return;
    }

    // הסשן נוצר — עכשיו לטעון את המדריך ולעבור ל-/home
    const { data: sess } = await supabase.auth.getSession();
    const userEmail = sess.session?.user.email;
    if (!userEmail) {
      setVerifying(false);
      setError('משהו השתבש בסשן. תנס.י שוב.');
      return;
    }

    const { data: guide, error: guideErr } = await supabase
      .from('guides')
      .select('id, name, city, is_admin')
      .ilike('email', userEmail)
      .single();

    setVerifying(false);

    if (guideErr || !guide) {
      setError('המייל מאומת, אבל לא מצאנו אותך ברשימת המדריכים. דבר.י עם פורטוגו.');
      return;
    }

    try {
      localStorage.setItem('portugo_guide_id', guide.id);
      localStorage.setItem('portugo_guide_name', guide.name);
      localStorage.setItem('portugo_guide_city', guide.city);
      localStorage.setItem('portugo_is_admin', guide.is_admin ? '1' : '0');
    } catch {}

    router.push('/home');
  };

  const handleBackToEmail = () => {
    setStep('email');
    setCode('');
    setError('');
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
          {/* כותרת */}
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
              {step === 'email' ? 'מה המייל שלך?' : 'בדוק.י את המייל'}
            </h2>
          </div>

          {step === 'email' ? (
            // ─────── שלב 1: הזנת מייל ───────
            <div className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendCode()}
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
                onClick={handleSendCode}
                disabled={sending}
                className="w-full bg-green-700 hover:bg-green-800 disabled:bg-gray-400 active:scale-98 transition-all text-white rounded-xl py-3 text-lg font-bold"
              >
                {sending ? 'שולח...' : 'שלח.י לי קוד 💌'}
              </button>
            </div>
          ) : (
            // ─────── שלב 2: הזנת קוד 6-ספרות ───────
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-5xl mb-2">📬</div>
                <p className="text-gray-700 text-sm">
                  שלחנו לך קוד ל-
                </p>
                <p className="font-bold text-green-800 text-sm mb-1" dir="ltr">
                  {email}
                </p>
                <p className="text-gray-600 text-sm leading-relaxed">
                  תקליד.י כאן את הקוד בן 6 הספרות שמופיע באימייל
                </p>
              </div>

              <input
                type="text"
                value={code}
                onChange={(e) => {
                  const cleaned = e.target.value.replace(/\D/g, '').slice(0, 6);
                  setCode(cleaned);
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleVerifyCode()}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                dir="ltr"
                maxLength={6}
                autoFocus
                className="w-full border-2 border-gray-300 rounded-xl px-4 py-4 text-3xl text-center font-bold tracking-[0.5em] focus:border-green-700 focus:outline-none"
              />

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                  {error}
                </div>
              )}

              <button
                onClick={handleVerifyCode}
                disabled={verifying || code.length !== 6}
                className="w-full bg-green-700 hover:bg-green-800 disabled:bg-gray-400 active:scale-98 transition-all text-white rounded-xl py-3 text-lg font-bold"
              >
                {verifying ? 'בודק.ת...' : 'כניסה ←'}
              </button>

              <div className="text-center text-xs text-gray-500 space-y-1 pt-2">
                <p>לא הגיע מייל? תבדוק.י בספאם.</p>
                <p>
                  או{' '}
                  <button
                    onClick={handleBackToEmail}
                    className="text-green-700 underline hover:text-green-800"
                  >
                    תנס.י עם מייל אחר
                  </button>
                </p>
              </div>
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
