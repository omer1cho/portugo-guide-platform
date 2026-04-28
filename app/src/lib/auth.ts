/**
 * Auth helpers — Magic Link login + הגנה על דפים פנימיים.
 *
 * הזרימה:
 *   1. משתמש לא מחובר נכנס לדף פנימי → useAuthGuard מנותב ל-/.
 *   2. נכנס מייל → /auth/callback → לוקאל-סטורג' מתעדכן עם guide_id ו-name.
 *   3. כל הדפים הפנימיים משתמשים ב-localStorage כמו קודם, אבל בנוסף
 *      וודא ש-Supabase Auth Session פעיל. אם לא — מנתב ל-/.
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabase';

export type AuthGuideInfo = {
  id: string;
  name: string;
  email: string;
  city: 'lisbon' | 'porto';
  is_admin: boolean;
};

/**
 * Hook לדפים פנימיים: מבטיח שהמשתמש מחובר.
 * אם אין session — מנותב ל-/.
 *
 * שימוש:
 *   const { ready } = useAuthGuard();
 *   if (!ready) return null; // או skeleton
 */
export function useAuthGuard() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        // אין סשן פעיל — חוזרים למסך הכניסה
        // וגם מנקים את ה-localStorage כדי שלא יהיה מצב חצוי
        try {
          localStorage.removeItem('portugo_guide_id');
          localStorage.removeItem('portugo_guide_name');
          localStorage.removeItem('portugo_guide_city');
        } catch {}
        router.push('/');
        return;
      }
      if (mounted) setReady(true);
    })();
    return () => {
      mounted = false;
    };
  }, [router]);

  return { ready };
}

/** התנתקות: מבטל סשן, מנקה localStorage, חוזר למסך הכניסה */
export async function logout() {
  await supabase.auth.signOut();
  try {
    localStorage.removeItem('portugo_guide_id');
    localStorage.removeItem('portugo_guide_name');
    localStorage.removeItem('portugo_guide_city');
    localStorage.removeItem('portugo_admin_email');
  } catch {}
}

/** עוזר לבדוק אם המשתמש המחובר הוא אדמין (לפי localStorage) */
export function isAdminFromStorage(): boolean {
  try {
    return localStorage.getItem('portugo_is_admin') === '1';
  } catch {
    return false;
  }
}
