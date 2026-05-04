'use client';

/**
 * AdminSidebar — תפריט הצד הירוק (250px) של דשבורד הניהול.
 *
 * מבוסס על portugo-dashboard-designer SKILL.md:
 *   - רוחב 250px קבוע, מיקום ימין (RTL)
 *   - רקע ירוק כהה #0d4d25
 *   - לוגו פורטוגו + שם, פריטי תפריט, אינדיקטור פעיל אדום, פוטר
 *
 * במובייל (< 768px) הסיידבר נסתר ומוצג ע"י כפתור hamburger צף.
 * המעבר בין דסקטופ למובייל מנוהל ב-globals.css דרך media queries
 * שדורסים את ה-inline styles עם `!important`.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import Image from 'next/image';
import { ADMIN_COLORS } from '@/lib/admin/theme';
import { logout } from '@/lib/auth';

type NavItem = {
  href: string;
  label: string;
  icon: string;
  /** Beta — סימון שהפיצ'ר עוד לא מוכן */
  comingSoon?: boolean;
};

const NAV_ITEMS: NavItem[] = [
  { href: '/admin', label: 'דשבורד ראשי', icon: '🏠' },
  { href: '/admin/guides', label: 'מדריכים', icon: '👥' },
  { href: '/admin/customers', label: 'ניתוח לקוחות', icon: '📊' },
  { href: '/admin/shifts', label: 'לוח שיבוצים', icon: '🗓️' },
  { href: '/admin/catalog', label: 'קטלוג הוצאות', icon: '📋', comingSoon: true },
  { href: '/admin/pricing-validation', label: 'רווחיות סיורים יומיים', icon: '💰' },
];

export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // סוגרים את התפריט אוטומטית כשעוברים דף (במובייל)
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  const handleLogout = async () => {
    await logout();
    router.push('/');
  };

  return (
    <>
      {/* Hamburger — מוצג רק במובייל (CSS) */}
      <button
        data-admin-hamburger
        onClick={() => setIsOpen(true)}
        aria-label="פתחי תפריט"
        style={{
          display: 'none',
          position: 'fixed',
          top: 12,
          right: 12,
          zIndex: 40,
          width: 44,
          height: 44,
          borderRadius: 8,
          background: ADMIN_COLORS.green900,
          color: '#fff',
          border: 'none',
          cursor: 'pointer',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 22,
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}
      >
        ☰
      </button>

      {/* Overlay — מוצג רק במובייל כשהתפריט פתוח */}
      <div
        data-admin-overlay
        data-visible={isOpen ? 'true' : 'false'}
        onClick={() => setIsOpen(false)}
        style={{
          display: 'none',
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.5)',
          zIndex: 35,
        }}
      />

      <aside
        data-admin-sidebar
        data-open={isOpen ? 'true' : 'false'}
        style={{
          width: 250,
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          background: ADMIN_COLORS.green900,
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 36,
        }}
      >
        {/* כפתור סגירה — רק במובייל */}
        <button
          data-admin-close
          onClick={() => setIsOpen(false)}
          aria-label="סגרי תפריט"
          style={{
            display: 'none',
            position: 'absolute',
            top: 12,
            left: 12,
            width: 36,
            height: 36,
            borderRadius: 8,
            background: 'rgba(255,255,255,0.1)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            zIndex: 1,
          }}
        >
          ✕
        </button>

        {/* Header — לוגו ושם */}
        <div
          style={{
            padding: '24px 20px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            textAlign: 'center',
          }}
        >
          <div style={{ background: '#fff', borderRadius: 8, padding: 8, display: 'inline-block' }}>
            <Image src="/logo.png" alt="פורטוגו" width={140} height={50} style={{ height: 'auto', maxWidth: '100%' }} />
          </div>
          <div style={{ marginTop: 12, fontSize: 13, color: '#cfe9d8', letterSpacing: 0.5 }}>
            ניהול פורטוגו · 2026
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: 4, overflowY: 'auto' }}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const disabled = item.comingSoon;
            const content = (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '12px 16px',
                  borderRadius: 8,
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  background: active ? ADMIN_COLORS.red : 'transparent',
                  color: disabled ? 'rgba(255,255,255,0.45)' : '#fff',
                  fontWeight: active ? 600 : 400,
                  fontSize: 15,
                  transition: 'background 200ms',
                  position: 'relative',
                }}
                onMouseEnter={(e) => {
                  if (!active && !disabled) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                }}
                onMouseLeave={(e) => {
                  if (!active && !disabled) e.currentTarget.style.background = 'transparent';
                }}
              >
                <span style={{ fontSize: 18 }}>{item.icon}</span>
                <span style={{ flex: 1 }}>{item.label}</span>
                {disabled && (
                  <span
                    style={{
                      fontSize: 10,
                      background: 'rgba(255,255,255,0.12)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      color: '#cfe9d8',
                    }}
                  >
                    בקרוב
                  </span>
                )}
              </div>
            );
            return disabled ? (
              <div key={item.href} aria-disabled="true">{content}</div>
            ) : (
              <Link key={item.href} href={item.href} style={{ textDecoration: 'none' }}>
                {content}
              </Link>
            );
          })}
        </nav>

        {/* Footer — חזרה לצד מדריך + יציאה */}
        <div style={{ padding: 12, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Link
            href="/home"
            style={{
              textAlign: 'center',
              padding: '10px',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              borderRadius: 8,
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            ↩ חזרה לצד המדריך
          </Link>
          <button
            onClick={handleLogout}
            style={{
              padding: '10px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.18)',
              color: '#cfe9d8',
              borderRadius: 8,
              fontSize: 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            יציאה מהמערכת
          </button>
        </div>
      </aside>
    </>
  );
}
