'use client';

/**
 * KpiCard — כרטיס KPI לפי מפרט הסקיל:
 *   - רקע לבן, פינה 12px, צל עדין
 *   - גבול ימני 4px ירוק (אדום אם קריטי, צהוב אם תזכורת)
 *   - תווית קטנה אפורה, ערך גדול ירוק, תת-טקסט אפור
 */

import { ADMIN_COLORS } from '@/lib/admin/theme';

type Variant = 'default' | 'red' | 'yellow' | 'gray';

type Props = {
  label: string;
  value: string | number;
  sub?: string;
  variant?: Variant;
};

const VARIANT_BORDER: Record<Variant, string> = {
  default: ADMIN_COLORS.green700,
  red: ADMIN_COLORS.red,
  yellow: ADMIN_COLORS.yellow,
  gray: ADMIN_COLORS.gray500,
};

const VARIANT_VALUE: Record<Variant, string> = {
  default: ADMIN_COLORS.green700,
  red: ADMIN_COLORS.red,
  yellow: '#a37b00', // צהוב על לבן קריא יותר בכהה
  gray: ADMIN_COLORS.gray700,
};

export default function KpiCard({ label, value, sub, variant = 'default' }: Props) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: '20px',
        borderRight: `4px solid ${VARIANT_BORDER[variant]}`,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        textAlign: 'right',
        minHeight: 100,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <div style={{ fontSize: 13, color: ADMIN_COLORS.gray500, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: VARIANT_VALUE[variant], lineHeight: 1.2 }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: ADMIN_COLORS.gray500, marginTop: 4 }}>{sub}</div>}
    </div>
  );
}
