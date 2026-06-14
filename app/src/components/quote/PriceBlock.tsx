/**
 * PriceBlock — מציג את בלוק המחיר של סיור בהצעה, בדיוק כמו במוקאפ.
 * רכיב טהור (ללא hooks) — משמש גם במסך ההזנה (תצוגה מקדימה) וגם בעמוד הלקוח (שרת).
 *
 * עמודה אחת → בלוק קבלה יחיד ("המחיר עבור הקבוצה שלכם" + סה"כ לקבוצתכם).
 * שתי עמודות → תצוגת מדרגות זו לצד זו ("המחיר לפי מספר המשתתפים").
 */
import type { DisplayColumn } from '@/lib/quote-build';
import { eur } from '@/lib/quote-build';
import type { LineItem } from '@/lib/quote-pricing';

const C = {
  terra: '#c4602f',
  ink: '#23281f',
  inkSoft: '#5b5f54',
  inkMute: '#8a8d82',
  greenDeep: '#0d6e34',
  band: '#f0e9da',
  border: '#e3ddcf',
  bg: '#faf6ee',
};

function lineText(l: LineItem): React.ReactNode {
  const unitLabel = `ל${l.label}${l.ageText ? ` ${l.ageText}` : ''}`;
  if (l.free) {
    return (
      <>
        <span style={{ fontSize: 17, fontWeight: 700, color: C.greenDeep }}>ללא עלות</span>{' '}
        <span style={{ fontSize: 15, color: C.inkSoft }}>{unitLabel}</span>
      </>
    );
  }
  return (
    <>
      <span style={{ fontSize: 20, fontWeight: 700, color: C.terra }}>{eur(l.unitPrice)}</span>{' '}
      <span style={{ fontSize: 15, color: C.inkSoft }}>{unitLabel}</span>
    </>
  );
}

function ErrorNote({ msg }: { msg: string }) {
  return <div style={{ color: C.terra, fontSize: 14, padding: '8px 0' }}>⚠ {msg}</div>;
}

export default function PriceBlock({ columns }: { columns: DisplayColumn[] }) {
  // ── עמודה אחת: בלוק קבלה יחיד ──
  if (columns.length === 1) {
    const col = columns[0];
    if (col.result.error) {
      return (
        <div style={{ marginBottom: 22 }}>
          <ErrorNote msg={col.result.error} />
        </div>
      );
    }
    return (
      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 13, color: C.inkMute, fontWeight: 600, marginBottom: 12 }}>
          המחיר עבור הקבוצה שלכם
        </div>
        {col.result.lines.map((l, i) => (
          <div
            key={i}
            style={{ padding: '9px 0', borderBottom: i < col.result.lines.length - 1 ? `1px solid ${C.band}` : 'none' }}
          >
            {lineText(l)}
          </div>
        ))}
        <div
          style={{
            display: 'flex',
            flexDirection: 'row-reverse',
            justifyContent: 'flex-end',
            gap: 8,
            alignItems: 'baseline',
            marginTop: 14,
            paddingTop: 16,
            borderTop: `2px solid ${C.border}`,
          }}
        >
          <span style={{ fontSize: 17, fontWeight: 700, color: C.ink }}>סה"כ לקבוצתכם</span>
          <span style={{ fontSize: 24, fontWeight: 800, color: C.ink, lineHeight: 1 }}>
            {eur(col.result.total)}
          </span>
        </div>
      </div>
    );
  }

  // ── שתי עמודות: מדרגות / תרחישים זו לצד זו ──
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 13, color: C.inkMute, fontWeight: 600, marginBottom: 12 }}>
        המחיר לפי מספר המשתתפים
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns.length}, 1fr)`, gap: 14 }}>
        {columns.map((col, ci) => (
          <div
            key={ci}
            style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 16px', background: C.bg }}
          >
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: C.ink,
                textAlign: 'center',
                paddingBottom: 10,
                marginBottom: 4,
                borderBottom: `1px solid ${C.band}`,
              }}
            >
              {col.headLabel}
              {col.subLabel && (
                <span style={{ display: 'block', fontSize: 12, fontWeight: 400, color: C.inkMute, marginTop: 3 }}>
                  {col.subLabel}
                </span>
              )}
            </div>
            {col.result.error ? (
              <ErrorNote msg={col.result.error} />
            ) : (
              <>
                {col.result.lines.map((l, i) => (
                  <div key={i} style={{ padding: '8px 0 2px', textAlign: 'center' }}>
                    {lineText(l)}
                  </div>
                ))}
                {col.showTotal && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'row-reverse',
                      justifyContent: 'center',
                      gap: 8,
                      alignItems: 'baseline',
                      marginTop: 4,
                      paddingTop: 8,
                      borderTop: `1px solid ${C.band}`,
                    }}
                  >
                    <span style={{ fontSize: 15, fontWeight: 700, color: C.ink }}>סה"כ</span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: C.ink, lineHeight: 1 }}>
                      {eur(col.result.total)}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
