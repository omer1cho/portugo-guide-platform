'use client';

/**
 * MonthSwitcher — בורר חודש פשוט: ◀ חודש שנה ▶
 *
 * קולט year+month (0-indexed), שומר ב-URL כ-?year=&month= (1-indexed).
 * הכפתור "החודש" קופץ לחודש הנוכחי.
 */

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ADMIN_COLORS, monthName } from '@/lib/admin/theme';

type Props = {
  year: number;
  month: number; // 0-indexed
};

export default function MonthSwitcher({ year, month }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigate = (newYear: number, newMonth: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('year', String(newYear));
    params.set('month', String(newMonth + 1)); // 1-indexed in URL
    router.push(`${pathname}?${params.toString()}`);
  };

  const goPrev = () => {
    if (month === 0) navigate(year - 1, 11);
    else navigate(year, month - 1);
  };
  const goNext = () => {
    if (month === 11) navigate(year + 1, 0);
    else navigate(year, month + 1);
  };
  const goCurrent = () => {
    const now = new Date();
    navigate(now.getFullYear(), now.getMonth());
  };

  const now = new Date();
  const isCurrent = year === now.getFullYear() && month === now.getMonth();

  const btnStyle: React.CSSProperties = {
    padding: '8px 14px',
    border: `1px solid ${ADMIN_COLORS.gray300}`,
    background: '#fff',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14,
    color: ADMIN_COLORS.gray700,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={goPrev} style={btnStyle} aria-label="חודש קודם">
        ▶
      </button>
      <div
        style={{
          minWidth: 160,
          textAlign: 'center',
          padding: '8px 16px',
          background: '#fff',
          border: `1px solid ${ADMIN_COLORS.gray300}`,
          borderRadius: 8,
          fontWeight: 600,
          color: ADMIN_COLORS.green800,
        }}
      >
        {monthName(year, month)}
      </div>
      <button onClick={goNext} style={btnStyle} aria-label="חודש הבא">
        ◀
      </button>
      {!isCurrent && (
        <button
          onClick={goCurrent}
          style={{
            ...btnStyle,
            background: ADMIN_COLORS.green25,
            borderColor: ADMIN_COLORS.green700,
            color: ADMIN_COLORS.green700,
            fontWeight: 600,
          }}
        >
          החודש
        </button>
      )}
    </div>
  );
}
