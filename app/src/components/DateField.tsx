'use client';

import React, { forwardRef } from 'react';

/**
 * DateField — שדה תאריך אחיד לכל פורטוגו.
 *
 * מציג תאריך בפורמט ישראלי dd/mm/yyyy (החודש באמצע), ולחיצה פותחת לוח שנה.
 * מבחינת הנתונים זה זהה לחלוטין לשדה תאריך רגיל: value הוא תמיד ISO (yyyy-mm-dd)
 * ו-onChange מקבל אירוע רגיל. רק התצוגה משתנה.
 *
 * הטכניקה: מציירים "פנים" משלנו (טקסט dd/mm/yyyy + 📅) ומניחים מעליהן שדה
 * type="date" אמיתי שקוף לגמרי (opacity:0) שתופס את הלחיצה. שום דבר מהשדה
 * המקורי (הטקסט בפורמט אמריקאי, האייקון, הדגשת הפוקוס) לא נראה.
 */

function isoToHe(iso?: string): string {
  if (!iso) return '';
  const p = iso.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

type DateFieldProps = {
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
  min?: string;
  max?: string;
  onClick?: (e: React.MouseEvent<HTMLInputElement>) => void;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'onClick' | 'style' | 'className'>;

const DateField = forwardRef<HTMLInputElement, DateFieldProps>(function DateField(
  { value, onChange, className, style, placeholder, min, max, onClick, ...rest },
  ref
) {
  const he = isoToHe(value);

  return (
    <span
      className={className}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        cursor: 'pointer',
        ...style,
      }}
    >
      <input
        ref={ref}
        type="date"
        value={value ?? ''}
        onChange={onChange}
        min={min}
        max={max}
        onClick={(e) => {
          const t = e.currentTarget as HTMLInputElement & { showPicker?: () => void };
          if (t.showPicker) {
            try {
              t.showPicker();
            } catch {
              /* showPicker may throw if not user-activated; ignore */
            }
          }
          onClick?.(e);
        }}
        {...rest}
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          margin: 0,
          padding: 0,
          border: 0,
          opacity: 0,
          cursor: 'pointer',
          fontSize: 16,
          minHeight: 0,
          zIndex: 2,
        }}
      />
      <span
        aria-hidden
        style={{
          flex: 1,
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          color: he ? 'inherit' : '#9aa0a6',
        }}
      >
        {he || placeholder || 'בחרו תאריך'}
      </span>
      <span aria-hidden style={{ fontSize: 16, lineHeight: 1, opacity: 0.7, flexShrink: 0 }}>
        📅
      </span>
    </span>
  );
});

export default DateField;
