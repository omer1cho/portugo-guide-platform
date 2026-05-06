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
  { href: '/admin/cashflow', label: 'קשפלו חודשי', icon: '💸' },
  { href: '/admin/catalog', label: 'קטלוג הוצאות', icon: '📋', comingSoon: true },
  { href: '/admin/pricing-validation', label: 'רווחיות סיורים יומיים', icon: '💰' },
];

export default function AdminSidebar({
  collapsed = false,
  onToggleCollapsed,
}: {
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  // סוגרים את התפריט אוטומטית כשעוברים דף (במובייל) — סנכרון מ-URL כ-external state
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
        data-collapsed={collapsed ? 'true' : 'false'}
        style={{
          width: collapsed ? 60 : 250,
          position: 'fixed',
          right: 0,
          top: 0,
          bottom: 0,
          background: ADMIN_COLORS.green900,
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 36,
          transition: 'width 200ms ease',
        }}
      >
        {/* כפתור צמצום/הרחבה — מוצג רק בדסק (לא במובייל). מאפשר לעומר להגדיל את שטח התוכן. */}
        {onToggleCollapsed && (
          <button
            data-admin-collapse
            onClick={onToggleCollapsed}
            aria-label={collapsed ? 'הרחיבי תפריט' : 'צמצמי תפריט'}
            title={collapsed ? 'הרחיבי תפריט' : 'צמצמי תפריט'}
            style={{
              position: 'absolute',
              top: 14,
              left: -14,
              width: 28,
              height: 28,
              borderRadius: '50%',
              background: '#fff',
              border: `2px solid ${ADMIN_COLORS.green900}`,
              color: ADMIN_COLORS.green900,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              zIndex: 2,
              fontFamily: 'inherit',
            }}
          >
            {/* בעברית RTL: כשפתוח חץ ימינה (לכווץ ימינה לתוך הסיידבר); כשמכווץ חץ שמאלה (לפתוח שמאלה) */}
            {collapsed ? '◀' : '▶'}
          </button>
        )}
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

        {/* Header — לוגו ושם. במצב מצומצם: רק אייקון/לוגו זעיר ממורכז. */}
        <div
          style={{
            padding: collapsed ? '14px 8px 12px' : '24px 20px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            textAlign: 'center',
          }}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 8,
              padding: collapsed ? 4 : 8,
              display: 'inline-block',
            }}
          >
            <Image
              src="/logo.png"
              alt="פורטוגו"
              width={collapsed ? 36 : 140}
              height={collapsed ? 36 : 50}
              style={{ height: 'auto', maxWidth: '100%' }}
            />
          </div>
          {!collapsed && (
            <div style={{ marginTop: 12, fontSize: 13, color: '#cfe9d8', letterSpacing: 0.5 }}>
              ניהול פורטוגו · 2026
            </div>
          )}
        </div>

        {/* Nav. במצב מצומצם: רק אייקונים, ממורכז, עם title-tooltip לטקסט המלא. */}
        <nav
          style={{
            flex: 1,
            padding: collapsed ? '12px 6px' : '16px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            overflowY: 'auto',
          }}
        >
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.href);
            const disabled = item.comingSoon;
            const content = (
              <div
                title={collapsed ? item.label + (disabled ? ' (בקרוב)' : '') : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  gap: 10,
                  padding: collapsed ? '12px 0' : '12px 16px',
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
                <span style={{ fontSize: collapsed ? 22 : 18 }}>{item.icon}</span>
                {!collapsed && <span style={{ flex: 1 }}>{item.label}</span>}
                {!collapsed && disabled && (
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

        {/* Footer — חזרה לצד מדריך + יציאה. במצומצם: רק אייקונים עם title. */}
        <div
          style={{
            padding: collapsed ? 8 : 12,
            borderTop: '1px solid rgba(255,255,255,0.08)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <Link
            href="/home"
            title={collapsed ? 'חזרה לצד המדריך' : undefined}
            style={{
              textAlign: 'center',
              padding: collapsed ? '8px 0' : '10px',
              background: 'rgba(255,255,255,0.06)',
              color: '#fff',
              borderRadius: 8,
              fontSize: collapsed ? 18 : 13,
              textDecoration: 'none',
            }}
          >
            {collapsed ? '↩' : '↩ חזרה לצד המדריך'}
          </Link>
          <button
            onClick={handleLogout}
            title={collapsed ? 'יציאה מהמערכת' : undefined}
            style={{
              padding: collapsed ? '8px 0' : '10px',
              background: 'transparent',
              border: '1px solid rgba(255,255,255,0.18)',
              color: '#cfe9d8',
              borderRadius: 8,
              fontSize: collapsed ? 16 : 12,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {collapsed ? '⏻' : 'יציאה מהמערכת'}
          </button>
        </div>
      </aside>
    </>
  );
}
