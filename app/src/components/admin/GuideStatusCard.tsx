'use client';

/**
 * GuideStatusCard — כרטיס מדריך לעמוד הראשי של אדמין.
 *
 * מציג: שם, עיר, מס׳ סיורים, סטטוס סגירה, סה"כ משכורת,
 * וכפתור "צפה כמו..." שעובד דרך localStorage (כמו AdminGuideSwitcher).
 * וכפתור "💰 הוסף למעטפה" שמוסיף כסף שלא מהקופה הראשית.
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ADMIN_COLORS, cityLabel, fmtEuro } from '@/lib/admin/theme';
import type { GuideMonthSummary, GuideStatus } from '@/lib/admin/data';
import AdminEnvelopeTopupModal from './AdminEnvelopeTopupModal';

type Props = {
  summary: GuideMonthSummary;
  onChange?: () => void; // קוראים אחרי שינוי (כמו topup) — כדי לרענן את הסיכום
};

const STATUS_META: Record<
  GuideStatus,
  { label: string; color: string; bg: string; icon: string }
> = {
  empty: {
    label: 'בלי פעילות',
    color: ADMIN_COLORS.gray500,
    bg: ADMIN_COLORS.gray100,
    icon: '🌱',
  },
  open: {
    label: 'פעיל.ה החודש',
    color: ADMIN_COLORS.green700,
    bg: ADMIN_COLORS.green25,
    icon: '🟢',
  },
  closed: {
    label: 'סגר.ה את החודש',
    color: ADMIN_COLORS.gray700,
    bg: ADMIN_COLORS.gray50,
    icon: '✅',
  },
  awaiting_deposit: {
    label: 'מחכה להפקדה',
    color: '#a37b00',
    bg: '#fff8d4',
    icon: '💰',
  },
};

export default function GuideStatusCard({ summary, onChange }: Props) {
  const router = useRouter();
  const meta = STATUS_META[summary.status];
  const { guide } = summary;
  const [showTopupModal, setShowTopupModal] = useState(false);

  const handleViewAs = () => {
    try {
      localStorage.setItem('portugo_guide_id', guide.id);
      localStorage.setItem('portugo_guide_name', guide.name);
      localStorage.setItem('portugo_guide_city', guide.city);
      // is_admin נשאר 1 — את עדיין אדמין, רק רואה את הנתונים שלה
    } catch {}
    router.push('/home');
  };

  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 12,
        padding: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        border: `1px solid ${ADMIN_COLORS.gray100}`,
      }}
    >
      {/* Top row — שם וסטטוס */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: ADMIN_COLORS.green800 }}>
            {guide.name}
          </div>
          <div style={{ fontSize: 12, color: ADMIN_COLORS.gray500, marginTop: 2 }}>
            {cityLabel(guide.city)}
          </div>
        </div>
        <div
          style={{
            padding: '6px 10px',
            borderRadius: 999,
            background: meta.bg,
            color: meta.color,
            fontSize: 12,
            fontWeight: 600,
            whiteSpace: 'nowrap',
          }}
        >
          {meta.icon} {meta.label}
        </div>
      </div>

      {/* Stats row */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 8,
          padding: '12px 0',
          borderTop: `1px solid ${ADMIN_COLORS.gray100}`,
          borderBottom: `1px solid ${ADMIN_COLORS.gray100}`,
        }}
      >
        <Stat label="סיורים" value={summary.tours_count.toString()} />
        <Stat label="משתתפים" value={summary.people_count.toString()} />
        <Stat label="ימי עבודה" value={summary.salary.work_days.toString()} />
      </div>

      {/* Salary row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div style={{ fontSize: 13, color: ADMIN_COLORS.gray500 }}>סה"כ משכורת</div>
        <div style={{ fontSize: 22, fontWeight: 700, color: ADMIN_COLORS.green700 }}>
          {fmtEuro(summary.salary.total_with_tips)}
        </div>
      </div>

      {/* Warnings — תמונות חסרות */}
      {summary.missing_photos > 0 && (
        <div
          style={{
            padding: '8px 10px',
            background: '#fff8d4',
            color: '#a37b00',
            borderRadius: 6,
            fontSize: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          📷 {summary.missing_photos} סיור{summary.missing_photos > 1 ? 'ים' : ''} בלי תמונה
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          onClick={handleViewAs}
          style={{
            padding: '10px',
            background: ADMIN_COLORS.green700,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 600,
            transition: 'background 200ms',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = ADMIN_COLORS.green800)}
          onMouseLeave={(e) => (e.currentTarget.style.background = ADMIN_COLORS.green700)}
        >
          👁️ צפ.י כמו {guide.name.split(' ')[0]}
        </button>
        <button
          onClick={() => setShowTopupModal(true)}
          style={{
            padding: '8px',
            background: 'transparent',
            color: ADMIN_COLORS.green800,
            border: `1px solid ${ADMIN_COLORS.green700}`,
            borderRadius: 8,
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          💰 הוספת כסף למעטפה
        </button>
      </div>

      {showTopupModal && (
        <AdminEnvelopeTopupModal
          guideId={guide.id}
          guideName={guide.name}
          onClose={() => setShowTopupModal(false)}
          onSaved={() => {
            if (onChange) onChange();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 18, fontWeight: 700, color: ADMIN_COLORS.green800 }}>{value}</div>
      <div style={{ fontSize: 11, color: ADMIN_COLORS.gray500, marginTop: 2 }}>{label}</div>
    </div>
  );
}
