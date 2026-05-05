'use client';

/**
 * /admin layout — בודק שהמשתמש אדמין, ואם כן מציג את הסיידבר + content.
 *
 * RTL מוגדר ברמת ה-html (root layout). כאן אנחנו רק שמים סיידבר ימני קבוע
 * + תוכן עם margin-right של 250px (60px במצב מצומצם).
 */

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ADMIN_COLORS, ADMIN_SPACING } from '@/lib/admin/theme';
import AdminSidebar from '@/components/admin/AdminSidebar';

const COLLAPSED_WIDTH = 60;
const STORAGE_KEY = 'admin-sidebar-collapsed';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [authState, setAuthState] = useState<'checking' | 'authorized' | 'denied'>('checking');
  const [collapsed, setCollapsed] = useState(false);

  // לטעון את ההעדפה האחרונה מ-localStorage (סנכרון מ-external store; pattern נדרש כדי
  // למנוע hydration mismatch — שרת לא מחזיר ערך, לקוח קורא מ-localStorage אחרי mount)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const saved = localStorage.getItem(STORAGE_KEY);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved === '1') setCollapsed(true);
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
      }
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // ─── שלב 1: יש סשן? ───
      const { data: sess } = await supabase.auth.getSession();
      if (cancelled) return;
      if (!sess.session?.user.email) {
        router.push('/');
        return;
      }

      // ─── שלב 2: האם המשתמש אדמין לפי DB (לא רק localStorage)? ───
      // אנחנו לא סומכים על localStorage כי הוא יכול להיות מזויף.
      // הבדיקה האמיתית היא דרך RLS, אבל לבטחון נקבל את is_admin מה-DB.
      const { data: guide } = await supabase
        .from('guides')
        .select('is_admin')
        .ilike('email', sess.session.user.email)
        .single();

      if (cancelled) return;
      if (!guide?.is_admin) {
        // לא אדמין — חזרה לצד מדריך
        router.push('/home');
        return;
      }

      setAuthState('authorized');
    })();

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (authState === 'checking') {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: ADMIN_COLORS.gray500,
          background: ADMIN_COLORS.gray50,
        }}
      >
        רגע, בודקים הרשאות...
      </div>
    );
  }

  if (authState === 'denied') return null;

  return (
    <div style={{ minHeight: '100vh', background: ADMIN_COLORS.gray50 }}>
      <AdminSidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
      <main
        data-admin-main
        style={{
          marginRight: collapsed ? COLLAPSED_WIDTH : ADMIN_SPACING.sidebarWidth,
          padding: ADMIN_SPACING.contentPadding,
          minHeight: '100vh',
          transition: 'margin-right 200ms ease',
        }}
      >
        {children}
      </main>
    </div>
  );
}
