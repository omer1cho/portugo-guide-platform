'use client';

/**
 * /admin/guides — ניהול מדריכים.
 *
 * רשימת כל המדריכים והאדמינים. לכל מדריך כרטיס מתקפל עם 5 sections:
 *  1. פרטים אישיים
 *  2. תנאי תשלום
 *  3. קופות (יתרות פתיחה ויעדים)
 *  4. שיבוצים (זמינות וחופשות)
 *  5. מנהלי (פעיל/אדמין)
 *
 * + כפתור "הוסיפי מדריך" שפותח מודאל עם השדות הבסיסיים.
 */

import { useEffect, useRef, useState } from 'react';
import { ADMIN_COLORS } from '@/lib/admin/theme';
import { supabase } from '@/lib/supabase';

type GuideRow = {
  id: string;
  name: string;
  email: string | null;
  city: 'lisbon' | 'porto';
  travel_type: 'monthly' | 'daily';
  has_vat: boolean;
  has_mgmt_bonus: boolean;
  mgmt_bonus_amount: number;
  classic_transfer_per_person: number;
  opening_change_balance: number | null;
  opening_expenses_balance: number | null;
  target_change_balance: number | null;
  target_expenses_balance: number | null;
  birthday: string | null;
  availability_notes: string | null;
  vacation_notes: string | null;
  is_admin: boolean;
  is_active: boolean;
};

const EMPTY_GUIDE: Omit<GuideRow, 'id'> = {
  name: '',
  email: '',
  city: 'lisbon',
  travel_type: 'monthly',
  has_vat: false,
  has_mgmt_bonus: false,
  mgmt_bonus_amount: 0,
  classic_transfer_per_person: 10,
  opening_change_balance: 0,
  opening_expenses_balance: 0,
  target_change_balance: 100,
  target_expenses_balance: 150,
  birthday: '',
  availability_notes: '',
  vacation_notes: '',
  is_admin: false,
  is_active: true,
};

export default function AdminGuidesPage() {
  const [guides, setGuides] = useState<GuideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);

  async function load() {
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('guides')
      .select(
        'id, name, email, city, travel_type, has_vat, has_mgmt_bonus, mgmt_bonus_amount, classic_transfer_per_person, opening_change_balance, opening_expenses_balance, target_change_balance, target_expenses_balance, birthday, availability_notes, vacation_notes, is_admin, is_active',
      )
      .order('name');
    if (error) {
      setError(error.message);
    } else {
      setGuides((data || []) as GuideRow[]);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  // מיון: פעילים-מדריכים → אדמינים → מושבתים
  const activeGuides = guides.filter((g) => g.is_active && !g.is_admin);
  const admins = guides.filter((g) => g.is_admin);
  const inactive = guides.filter((g) => !g.is_active && !g.is_admin);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Header */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16,
        }}
      >
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: ADMIN_COLORS.green800, margin: 0 }}>
            👥 ניהול מדריכים
          </h1>
          <p style={{ fontSize: 14, color: ADMIN_COLORS.gray500, marginTop: 4 }}>
            לחיצה על כרטיס פותחת לעריכה
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          style={{
            background: ADMIN_COLORS.green800,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            padding: '10px 20px',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          + הוסיפי מדריך
        </button>
      </header>

      {loading && (
        <div style={{ background: '#fff', borderRadius: 12, padding: 60, textAlign: 'center', color: ADMIN_COLORS.gray500 }}>
          טוענת מדריכים...
        </div>
      )}

      {error && (
        <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: 12, padding: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* פעילים */}
          <GuideGroup
            title="מדריכים פעילים"
            guides={activeGuides}
            openId={openId}
            setOpenId={setOpenId}
            onSaved={load}
          />

          {/* אדמינים */}
          {admins.length > 0 && (
            <GuideGroup
              title="אדמינים"
              guides={admins}
              openId={openId}
              setOpenId={setOpenId}
              onSaved={load}
            />
          )}

          {/* מושבתים */}
          {inactive.length > 0 && (
            <GuideGroup
              title="מושבתים"
              guides={inactive}
              openId={openId}
              setOpenId={setOpenId}
              onSaved={load}
              dimmed
            />
          )}
        </>
      )}

      {/* מודאל הוספת מדריך */}
      {showAddModal && (
        <AddGuideModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}

// ===========================================================================
// קבוצת מדריכים (פעילים / אדמינים / מושבתים)
// ===========================================================================

function GuideGroup({
  title,
  guides,
  openId,
  setOpenId,
  onSaved,
  dimmed = false,
}: {
  title: string;
  guides: GuideRow[];
  openId: string | null;
  setOpenId: (id: string | null) => void;
  onSaved: () => void;
  dimmed?: boolean;
}) {
  if (guides.length === 0) return null;
  return (
    <section>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: ADMIN_COLORS.green800, margin: '0 0 12px' }}>
        {title} ({guides.length})
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: dimmed ? 0.6 : 1 }}>
        {guides.map((g) => (
          <GuideCard
            key={g.id}
            guide={g}
            isOpen={openId === g.id}
            onToggle={() => setOpenId(openId === g.id ? null : g.id)}
            onSaved={onSaved}
          />
        ))}
      </div>
    </section>
  );
}

// ===========================================================================
// כרטיס מדריך (מקופל/פתוח)
// ===========================================================================

function GuideCard({
  guide,
  isOpen,
  onToggle,
  onSaved,
}: {
  guide: GuideRow;
  isOpen: boolean;
  onToggle: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<GuideRow>(guide);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // אם guide משתנה (אחרי load מחדש), מסנכרנים את הטופס
  useEffect(() => {
    setForm(guide);
  }, [guide]);

  // כשפותחים כרטיס — לגלול אליו ברכות, כדי שלא יוצר תחושת "קפיצה"
  useEffect(() => {
    if (isOpen && cardRef.current) {
      cardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isOpen]);

  async function save() {
    setSaving(true);
    setSaveError(null);
    const { error } = await supabase
      .from('guides')
      .update({
        name: form.name,
        email: form.email || null,
        city: form.city,
        travel_type: form.travel_type,
        has_vat: form.has_vat,
        has_mgmt_bonus: form.has_mgmt_bonus,
        mgmt_bonus_amount: form.has_mgmt_bonus ? form.mgmt_bonus_amount : 0,
        classic_transfer_per_person: form.classic_transfer_per_person,
        opening_change_balance: form.opening_change_balance ?? 0,
        opening_expenses_balance: form.opening_expenses_balance ?? 0,
        target_change_balance: form.target_change_balance ?? 0,
        target_expenses_balance: form.target_expenses_balance ?? 0,
        birthday: form.birthday || null,
        availability_notes: form.availability_notes || null,
        vacation_notes: form.vacation_notes || null,
        is_admin: form.is_admin,
        is_active: form.is_active,
      })
      .eq('id', guide.id);
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    onSaved();
  }

  function cancel() {
    setForm(guide);
    setSaveError(null);
    onToggle();
  }

  return (
    <div
      ref={cardRef}
      style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 1px 3px rgba(0,0,0,.06)',
        border: `1px solid ${ADMIN_COLORS.gray100}`,
        overflow: 'hidden',
        scrollMarginTop: 20,
      }}
    >
      {/* כותרת — תמיד מוצגת */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '14px 16px',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          fontFamily: 'inherit',
          textAlign: 'right',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: ADMIN_COLORS.green800 }}>
            {guide.name}
          </span>
          <span style={{ fontSize: 12, color: ADMIN_COLORS.gray500 }}>
            {guide.city === 'lisbon' ? 'ליסבון' : 'פורטו'}
            {guide.is_admin && ' · אדמין'}
            {!guide.is_active && ' · מושבת'}
          </span>
        </span>
        <span style={{ color: ADMIN_COLORS.gray500, fontSize: 13 }}>
          {isOpen ? '▲ סגור.י' : '▼ ערוך.י'}
        </span>
      </button>

      {/* גוף — רק כשפתוח */}
      {isOpen && (
        <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${ADMIN_COLORS.gray100}`, paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 1. פרטים אישיים */}
          <FormSection title="🆔 פרטים אישיים">
            <Field label="שם">
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="מייל (login)">
              <input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
            </Field>
            <Field label="עיר">
              <select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value as 'lisbon' | 'porto' })} style={inputStyle}>
                <option value="lisbon">ליסבון</option>
                <option value="porto">פורטו</option>
              </select>
            </Field>
            <Field label="יום הולדת (MM-DD)" hint='פורמט "MM-DD" — למשל "04-05"'>
              <input type="text" placeholder="MM-DD" value={form.birthday || ''} onChange={(e) => setForm({ ...form, birthday: e.target.value })} style={inputStyle} />
            </Field>
          </FormSection>

          {/* 2. תנאי תשלום */}
          <FormSection title="💼 תנאי תשלום">
            <Field label="סוג נסיעות">
              <select value={form.travel_type} onChange={(e) => setForm({ ...form, travel_type: e.target.value as 'monthly' | 'daily' })} style={inputStyle}>
                <option value="monthly">חודשי (30€)</option>
                <option value="daily">יומי (3€/יום עבודה)</option>
              </select>
            </Field>
            <Field label="הפרשה לפורטוגו לראש בקלאסי">
              <input type="number" step="1" value={form.classic_transfer_per_person} onChange={(e) => setForm({ ...form, classic_transfer_per_person: parseFloat(e.target.value) || 0 })} style={inputStyle} />
            </Field>
            <Toggle
              label='חייב מע"מ (23%)'
              hint='אם כן — 23% מתווסף לסכום הקבלה ולמשיכת המשכורת'
              checked={form.has_vat}
              onChange={(v) => setForm({ ...form, has_vat: v })}
            />
            <Toggle
              label="רכיב ניהול חודשי"
              hint="תוספת קבועה למשכורת בכל חודש (לדוגמה — מאיה מקבלת רכיב ניהול)"
              checked={form.has_mgmt_bonus}
              onChange={(v) => setForm({ ...form, has_mgmt_bonus: v })}
            />
            {form.has_mgmt_bonus && (
              <Field label="סכום רכיב ניהול (€)">
                <input type="number" step="1" value={form.mgmt_bonus_amount} onChange={(e) => setForm({ ...form, mgmt_bonus_amount: parseFloat(e.target.value) || 0 })} style={inputStyle} />
              </Field>
            )}
          </FormSection>

          {/* 3. קופות */}
          <FormSection title="💰 קופות">
            <Field label="יתרת פתיחה — מעטפת עודף (€)">
              <input type="number" step="0.01" value={form.opening_change_balance ?? 0} onChange={(e) => setForm({ ...form, opening_change_balance: parseFloat(e.target.value) || 0 })} style={inputStyle} />
            </Field>
            <Field label="יתרת פתיחה — מעטפת הוצאות (€)">
              <input type="number" step="0.01" value={form.opening_expenses_balance ?? 0} onChange={(e) => setForm({ ...form, opening_expenses_balance: parseFloat(e.target.value) || 0 })} style={inputStyle} />
            </Field>
            <Field label="יעד חיזוק — מעטפת עודף (€)" hint="0 = לא לחזק">
              <input type="number" step="1" value={form.target_change_balance ?? 0} onChange={(e) => setForm({ ...form, target_change_balance: parseFloat(e.target.value) || 0 })} style={inputStyle} />
            </Field>
            <Field label="יעד חיזוק — מעטפת הוצאות (€)" hint="0 = לא לחזק">
              <input type="number" step="1" value={form.target_expenses_balance ?? 0} onChange={(e) => setForm({ ...form, target_expenses_balance: parseFloat(e.target.value) || 0 })} style={inputStyle} />
            </Field>
          </FormSection>

          {/* 4. שיבוצים */}
          <FormSection title="📅 שיבוצים">
            <Field label="זמינות קבועה" hint='למשל "לא בשבת. מעדיפה ימי קיץ"'>
              <textarea value={form.availability_notes || ''} onChange={(e) => setForm({ ...form, availability_notes: e.target.value })} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
            </Field>
            <Field label="חופשות עתידיות" hint='למשל "10-20.7 בארץ, 25-26.12 חג"'>
              <textarea value={form.vacation_notes || ''} onChange={(e) => setForm({ ...form, vacation_notes: e.target.value })} style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} />
            </Field>
          </FormSection>

          {/* 5. הגדרות */}
          <FormSection title="⚙️ הגדרות">
            <Toggle
              label="פעיל"
              hint="אם לא מסומן — המדריך לא יכול להיכנס לאפליקציה. ההיסטוריה שלו (סיורים, הוצאות) נשמרת"
              checked={form.is_active}
              onChange={(v) => setForm({ ...form, is_active: v })}
            />
            <Toggle
              label="אדמין"
              hint="גישה לדשבורד ניהול /admin (הצד הזה). מדריכים רגילים לא רואים את הדשבורד הזה"
              checked={form.is_admin}
              onChange={(v) => setForm({ ...form, is_admin: v })}
            />
          </FormSection>

          {saveError && (
            <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: 8, padding: 12, fontSize: 13 }}>
              ⚠️ {saveError}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button onClick={cancel} disabled={saving} style={btnSecondaryStyle}>
              ביטול
            </button>
            <button onClick={save} disabled={saving} style={btnPrimaryStyle}>
              {saving ? 'שומרת...' : 'שמירה'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===========================================================================
// מודאל הוספת מדריך
// ===========================================================================

function AddGuideModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState<Omit<GuideRow, 'id'>>({ ...EMPTY_GUIDE });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  async function save() {
    if (!form.name.trim()) {
      setSaveError('צריך לתת שם');
      return;
    }
    setSaving(true);
    setSaveError(null);
    const { error } = await supabase.from('guides').insert({
      name: form.name,
      email: form.email || null,
      city: form.city,
      travel_type: form.travel_type,
      has_vat: form.has_vat,
      has_mgmt_bonus: form.has_mgmt_bonus,
      mgmt_bonus_amount: form.has_mgmt_bonus ? form.mgmt_bonus_amount : 0,
      classic_transfer_per_person: form.classic_transfer_per_person,
      opening_change_balance: form.opening_change_balance ?? 0,
      opening_expenses_balance: form.opening_expenses_balance ?? 0,
      target_change_balance: form.target_change_balance ?? 100,
      target_expenses_balance: form.target_expenses_balance ?? 150,
      birthday: form.birthday || null,
      is_admin: form.is_admin,
      is_active: form.is_active,
    });
    setSaving(false);
    if (error) {
      setSaveError(error.message);
      return;
    }
    onSaved();
  }

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
          borderRadius: 12,
          maxWidth: 500,
          width: '100%',
          maxHeight: '90vh',
          overflowY: 'auto',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <h2 style={{ fontSize: 20, fontWeight: 700, color: ADMIN_COLORS.green800, margin: 0 }}>
          הוספת מדריך חדש
        </h2>

        <FormSection title="🆔 פרטים בסיסיים">
          <Field label="שם" required>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} autoFocus />
          </Field>
          <Field label="מייל (login)">
            <input type="email" value={form.email || ''} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
          </Field>
          <Field label="עיר">
            <select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value as 'lisbon' | 'porto' })} style={inputStyle}>
              <option value="lisbon">ליסבון</option>
              <option value="porto">פורטו</option>
            </select>
          </Field>
          <Field label="יום הולדת (MM-DD)">
            <input type="text" placeholder="MM-DD" value={form.birthday || ''} onChange={(e) => setForm({ ...form, birthday: e.target.value })} style={inputStyle} />
          </Field>
        </FormSection>

        <FormSection title="💼 תנאי תשלום">
          <Field label="סוג נסיעות">
            <select value={form.travel_type} onChange={(e) => setForm({ ...form, travel_type: e.target.value as 'monthly' | 'daily' })} style={inputStyle}>
              <option value="monthly">חודשי (30€)</option>
              <option value="daily">יומי (3€/יום עבודה)</option>
            </select>
          </Field>
          <Field label="הפרשה לפורטוגו לראש בקלאסי">
            <input type="number" step="1" value={form.classic_transfer_per_person} onChange={(e) => setForm({ ...form, classic_transfer_per_person: parseFloat(e.target.value) || 0 })} style={inputStyle} />
          </Field>
          <Toggle
            label='חייב מע"מ (23%)'
            hint="אפשר לעדכן גם בהמשך"
            checked={form.has_vat}
            onChange={(v) => setForm({ ...form, has_vat: v })}
          />
        </FormSection>

        {saveError && (
          <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', color: '#991b1b', borderRadius: 8, padding: 12, fontSize: 13 }}>
            ⚠️ {saveError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} disabled={saving} style={btnSecondaryStyle}>
            ביטול
          </button>
          <button onClick={save} disabled={saving} style={btnPrimaryStyle}>
            {saving ? 'יוצרת...' : 'הוסיפי'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================================
// Helpers
// ===========================================================================

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_COLORS.gray700, borderBottom: `1px solid ${ADMIN_COLORS.gray100}`, paddingBottom: 6 }}>
        {title}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingRight: 4 }}>{children}</div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 13 }}>
      <span style={{ color: ADMIN_COLORS.gray700, fontWeight: 500 }}>
        {label} {required && <span style={{ color: '#dc2626' }}>*</span>}
      </span>
      {children}
      {hint && <span style={{ fontSize: 11, color: ADMIN_COLORS.gray500 }}>{hint}</span>}
    </label>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        fontSize: 13,
        cursor: 'pointer',
        padding: '10px 12px',
        background: checked ? ADMIN_COLORS.green50 : ADMIN_COLORS.gray50,
        border: `1px solid ${checked ? ADMIN_COLORS.green800 : ADMIN_COLORS.gray300}`,
        borderRadius: 6,
        transition: 'all 150ms',
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ width: 18, height: 18, accentColor: ADMIN_COLORS.green800, marginTop: 1, flexShrink: 0 }}
      />
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ color: ADMIN_COLORS.gray700, fontWeight: 500 }}>{label}</span>
        {hint && <span style={{ fontSize: 11, color: ADMIN_COLORS.gray500 }}>{hint}</span>}
      </span>
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  padding: '8px 10px',
  border: `1px solid ${ADMIN_COLORS.gray300}`,
  borderRadius: 6,
  fontSize: 14,
  fontFamily: 'inherit',
  background: '#fff',
  color: ADMIN_COLORS.gray700,
  width: '100%',
  boxSizing: 'border-box',
};

const btnPrimaryStyle: React.CSSProperties = {
  background: ADMIN_COLORS.green800,
  color: '#fff',
  border: 'none',
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
};

const btnSecondaryStyle: React.CSSProperties = {
  background: '#fff',
  color: ADMIN_COLORS.gray700,
  border: `1px solid ${ADMIN_COLORS.gray300}`,
  borderRadius: 8,
  padding: '8px 16px',
  fontSize: 14,
  cursor: 'pointer',
  fontFamily: 'inherit',
};
