'use client';

/**
 * /admin/consultations/[id] — פרטים מלאים על פניה אחת.
 *
 * מציג את כל התשובות בקבוצות, מאפשר לעומר לשנות סטטוס ולהוסיף הערה פנימית.
 */

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ADMIN_COLORS } from '@/lib/admin/theme';
import {
  ConsultationRow, ConsultationSubmission,
  FIELD_LABELS, SECTION_GROUPS,
  statusLabel, statusColor,
} from '@/lib/consultation';

export default function ConsultationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [row, setRow] = useState<ConsultationRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('consultations')
        .select('*')
        .eq('id', id)
        .single();

      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else {
        const r = data as ConsultationRow;
        setRow(r);
        setNotes(r.admin_notes || '');
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [id]);

  async function updateStatus(newStatus: ConsultationRow['status']) {
    if (!row) return;
    setSaving(true);
    const { error } = await supabase
      .from('consultations')
      .update({ status: newStatus })
      .eq('id', row.id);
    setSaving(false);
    if (error) {
      alert('שגיאה בעדכון: ' + error.message);
      return;
    }
    setRow({ ...row, status: newStatus });
    flashSaved();
  }

  async function saveNotes() {
    if (!row) return;
    setSaving(true);
    const { error } = await supabase
      .from('consultations')
      .update({ admin_notes: notes })
      .eq('id', row.id);
    setSaving(false);
    if (error) {
      alert('שגיאה בשמירת הערה: ' + error.message);
      return;
    }
    setRow({ ...row, admin_notes: notes });
    flashSaved();
  }

  function flashSaved() {
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  }

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: ADMIN_COLORS.gray500 }}>טוענים...</div>;
  }

  if (error || !row) {
    return (
      <div>
        <Link href="/admin/consultations" style={backLinkStyle}>← חזרה לרשימה</Link>
        <div style={{ marginTop: 16, color: ADMIN_COLORS.red }}>
          לא הצלחנו לטעון את הפניה. {error}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Back link + saved flash */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <Link href="/admin/consultations" style={backLinkStyle}>← חזרה לרשימה</Link>
        {savedFlash && (
          <span style={{
            color: ADMIN_COLORS.green700,
            fontSize: 14,
            fontWeight: 600,
            opacity: savedFlash ? 1 : 0,
            transition: 'opacity 200ms',
          }}>
            ✓ נשמר
          </span>
        )}
      </div>

      {/* Header card — שם + סטטוס */}
      <div style={{
        background: ADMIN_COLORS.white,
        borderRadius: 12,
        padding: 24,
        marginBottom: 16,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 700, color: ADMIN_COLORS.green800, margin: 0 }}>
              {row.full_name}
            </h1>
            <div style={{ fontSize: 13, color: ADMIN_COLORS.gray500, marginTop: 6 }}>
              התקבל: {new Date(row.created_at).toLocaleString('he-IL', {
                year: 'numeric', month: 'long', day: 'numeric',
                hour: '2-digit', minute: '2-digit',
              })}
            </div>
            <div style={{ marginTop: 14, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <a href={`tel:${row.phone}`} style={contactPillStyle}>📞 {row.phone}</a>
              <a href={`https://wa.me/${row.phone.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" style={{...contactPillStyle, background: '#25D366', color: '#fff'}}>💬 WhatsApp</a>
              <a href={`mailto:${row.email}`} style={{ ...contactPillStyle, direction: 'ltr' }}>✉️ {row.email}</a>
            </div>
          </div>

          {/* בורר סטטוס */}
          <div>
            <div style={{ fontSize: 12, color: ADMIN_COLORS.gray500, marginBottom: 6 }}>סטטוס</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(['new', 'in_progress', 'scheduled', 'done', 'cancelled'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => updateStatus(s)}
                  disabled={saving || row.status === s}
                  style={{
                    padding: '6px 12px',
                    background: row.status === s ? statusColor(s) : ADMIN_COLORS.gray100,
                    color: row.status === s ? '#fff' : ADMIN_COLORS.gray700,
                    border: 'none',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: row.status === s ? 'default' : 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {statusLabel(s)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* הערה פנימית */}
      <div style={{
        background: '#fffbeb',
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        border: `1px solid #fde68a`,
      }}>
        <label style={{ fontSize: 14, fontWeight: 600, color: '#92400e', display: 'block', marginBottom: 8 }}>
          📝 הערה פנימית (רק את רואה)
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder="הערות, סיכומים מהשיחה, החלטות..."
          style={{
            width: '100%',
            padding: '10px 14px',
            border: `1px solid #fde68a`,
            borderRadius: 8,
            fontSize: 14,
            fontFamily: 'inherit',
            resize: 'vertical',
            background: '#fff',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {notes !== (row.admin_notes || '') && (
          <button
            onClick={saveNotes}
            disabled={saving}
            style={{
              marginTop: 8,
              padding: '8px 16px',
              background: ADMIN_COLORS.green700,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {saving ? 'שומר...' : 'שמרי הערה'}
          </button>
        )}
      </div>

      {/* תוכן השאלון — לפי קבוצות */}
      {SECTION_GROUPS.map(section => {
        const populatedFields = section.fields.filter(f => {
          const v = (row as unknown as Record<string, unknown>)[f as string];
          if (v === null || v === undefined || v === '') return false;
          if (Array.isArray(v) && v.length === 0) return false;
          return true;
        });

        if (populatedFields.length === 0) return null;

        return (
          <div key={section.title} style={{
            background: ADMIN_COLORS.white,
            borderRadius: 12,
            padding: 24,
            marginBottom: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <h2 style={{
              fontSize: 16,
              fontWeight: 700,
              color: ADMIN_COLORS.green800,
              margin: 0,
              marginBottom: 14,
              paddingBottom: 10,
              borderBottom: `1px solid ${ADMIN_COLORS.green25}`,
            }}>
              {section.title}
            </h2>
            <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '180px 1fr', gap: '10px 16px' }}>
              {populatedFields.map(f => {
                const v = (row as unknown as Record<string, unknown>)[f as string];
                const label = FIELD_LABELS[f as keyof ConsultationSubmission];
                return (
                  <div key={f as string} style={{ display: 'contents' }}>
                    <dt style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: ADMIN_COLORS.gray500,
                      paddingTop: 2,
                    }}>
                      {label}
                    </dt>
                    <dd style={{
                      margin: 0,
                      fontSize: 14,
                      color: ADMIN_COLORS.gray900,
                      lineHeight: 1.6,
                      whiteSpace: 'pre-wrap',
                    }}>
                      {Array.isArray(v) ? (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {(v as string[]).map(item => (
                            <span key={item} style={{
                              padding: '3px 10px',
                              background: ADMIN_COLORS.green25,
                              color: ADMIN_COLORS.green800,
                              borderRadius: 999,
                              fontSize: 13,
                            }}>
                              {item}
                            </span>
                          ))}
                        </div>
                      ) : (
                        String(v)
                      )}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        );
      })}
    </div>
  );
}

const backLinkStyle: React.CSSProperties = {
  color: ADMIN_COLORS.green700,
  textDecoration: 'none',
  fontSize: 14,
  fontWeight: 600,
};

const contactPillStyle: React.CSSProperties = {
  display: 'inline-block',
  padding: '7px 14px',
  background: ADMIN_COLORS.green25,
  color: ADMIN_COLORS.green800,
  borderRadius: 999,
  fontSize: 14,
  fontWeight: 500,
  textDecoration: 'none',
};
