'use client';

/**
 * AdminEnvelopeTopupModal — מאפשר לאדמין להוסיף כסף למעטפת עודף או הוצאות
 * של מדריך, **מבלי שהסכום ייגרע מהקופה הראשית** (כי הכסף הגיע מפורטוגו).
 *
 * מתעד transfer חדש:
 *   - admin_topup_change   → מתווסף ליתרת מעטפת עודף
 *   - admin_topup_expenses → מתווסף ליתרת מעטפת הוצאות
 *
 * שני הסוגים לא משפיעים על חישוב הקופה הראשית.
 */

import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { ADMIN_COLORS } from '@/lib/admin/theme';

type Envelope = 'change' | 'expenses';

type Props = {
  guideId: string;
  guideName: string;
  onClose: () => void;
  onSaved: () => void; // קריאה אחרי שמירה מוצלחת — כדי לרענן את הסיכום
};

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function AdminEnvelopeTopupModal({ guideId, guideName, onClose, onSaved }: Props) {
  const [envelope, setEnvelope] = useState<Envelope>('expenses');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const envelopeLabel = envelope === 'change' ? 'מעטפת עודף' : 'מעטפת הוצאות';

  const handleSave = async () => {
    setError('');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setError('נשאר להזין סכום');
      return;
    }
    setSaving(true);
    const transferType = envelope === 'change' ? 'admin_topup_change' : 'admin_topup_expenses';
    const { error: insErr } = await supabase.from('transfers').insert({
      guide_id: guideId,
      transfer_date: date,
      amount: amt,
      transfer_type: transferType,
      notes: notes.trim() || `תוספת מפורטוגו ל${envelopeLabel}`,
    });
    setSaving(false);
    if (insErr) {
      setError('משהו השתבש: ' + insErr.message);
      return;
    }
    onSaved();
    onClose();
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 16,
          padding: 24,
          maxWidth: 480,
          width: '100%',
          boxShadow: '0 20px 50px rgba(0,0,0,0.2)',
          direction: 'rtl',
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700, color: ADMIN_COLORS.green800, marginBottom: 4 }}>
          הוספת כסף למעטפה
        </h2>
        <p style={{ fontSize: 14, color: ADMIN_COLORS.gray500, marginBottom: 20 }}>
          הכסף הזה יתווסף ליתרת המעטפת של <strong>{guideName}</strong> מבלי שייגרע מהקופה הראשית.
        </p>

        {/* בורר מעטפה */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            לאיזו מעטפה?
          </label>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={() => setEnvelope('expenses')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 8,
                border: `2px solid ${envelope === 'expenses' ? ADMIN_COLORS.green700 : ADMIN_COLORS.gray300}`,
                background: envelope === 'expenses' ? ADMIN_COLORS.green25 : '#fff',
                color: envelope === 'expenses' ? ADMIN_COLORS.green800 : ADMIN_COLORS.gray700,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              📋 מעטפת הוצאות
            </button>
            <button
              onClick={() => setEnvelope('change')}
              style={{
                flex: 1,
                padding: '12px',
                borderRadius: 8,
                border: `2px solid ${envelope === 'change' ? ADMIN_COLORS.green700 : ADMIN_COLORS.gray300}`,
                background: envelope === 'change' ? ADMIN_COLORS.green25 : '#fff',
                color: envelope === 'change' ? ADMIN_COLORS.green800 : ADMIN_COLORS.gray700,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              💵 מעטפת עודף
            </button>
          </div>
        </div>

        {/* סכום */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            סכום (€)
          </label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="100"
            autoFocus
            style={{
              width: '100%',
              padding: '12px',
              fontSize: 18,
              border: `1px solid ${ADMIN_COLORS.gray300}`,
              borderRadius: 8,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* תאריך */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            תאריך
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              width: '100%',
              padding: '12px',
              fontSize: 14,
              border: `1px solid ${ADMIN_COLORS.gray300}`,
              borderRadius: 8,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* הערה */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
            הערה (לא חובה)
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="לדוגמה: נתתי במזומן ב-15.4"
            style={{
              width: '100%',
              padding: '12px',
              fontSize: 14,
              border: `1px solid ${ADMIN_COLORS.gray300}`,
              borderRadius: 8,
              fontFamily: 'inherit',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <div
            style={{
              background: '#fee2e2',
              border: '1px solid #fca5a5',
              color: '#991b1b',
              borderRadius: 8,
              padding: 12,
              fontSize: 13,
              marginBottom: 12,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '14px',
              background: saving ? ADMIN_COLORS.gray300 : ADMIN_COLORS.green700,
              color: '#fff',
              border: 'none',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 16,
              cursor: saving ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {saving ? 'שומר...' : 'שמור'}
          </button>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '12px',
              background: ADMIN_COLORS.gray100,
              color: ADMIN_COLORS.gray700,
              border: 'none',
              borderRadius: 10,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            ביטול
          </button>
        </div>
      </div>
    </div>
  );
}
