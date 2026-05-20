'use client';

/**
 * ConsultationForm — הטופס עצמו.
 *
 * עיצוב: ברנד פורטוגו (ירוק כהה #0d4d25 + לבן + אדום ל-CTA),
 * מותאם לעברית RTL ולמובייל. שאלות חובה: שם, טלפון, מייל.
 * הכל השאר רשות, כדי שהלקוח לא יתייאש באמצע.
 *
 * אחרי שליחה — מציג מסך תודה inline (לא ניווט) כדי לא לאבד גלילה.
 */

import { useState } from 'react';
import Image from 'next/image';
import {
  STYLE_TYPES, PACE_OPTIONS, STRUCTURE_OPTIONS, TRANSPORT_OPTIONS,
  DRIVING_OPTIONS, DAILY_DRIVE_OPTIONS, INTEREST_OPTIONS,
  LODGING_LEVEL_OPTIONS, LODGING_TYPE_OPTIONS, AVOID_OPTIONS,
  SERVICE_FOCUS_OPTIONS,
  type ConsultationSubmission,
} from '@/lib/consultation';

// ============================================================================
// Brand colors
// ============================================================================
const COLORS = {
  green900: '#0d4d25',
  green800: '#145c2e',
  green700: '#1a7a3d',
  green50: '#e0f2e7',
  green25: '#f0fdf4',
  cream: '#fdfaf4',
  red: '#d4351c',
  redHover: '#b82d18',
  text: '#1f2937',
  muted: '#6b7280',
  border: '#d8e6dc',
  white: '#ffffff',
};

type FormState = Partial<ConsultationSubmission>;

export default function ConsultationForm() {
  const [data, setData] = useState<FormState>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setData(d => ({ ...d, [key]: value }));
  }

  function toggleArray(key: keyof FormState, option: string) {
    const current = (data[key] as string[] | undefined) ?? [];
    const next = current.includes(option)
      ? current.filter(o => o !== option)
      : [...current, option];
    update(key, next as never);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const fullName = (data.full_name || '').trim();
    const phone = (data.phone || '').trim();
    const email = (data.email || '').trim();

    if (!fullName || !phone || !email) {
      setError('שמחנו לקבל ממך גם את השם, הטלפון והאימייל — כדי שנוכל לחזור אלייכם.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('האימייל לא נראה תקין — אפשר לבדוק?');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/consultations', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(data),
      });
      const json = await res.json();
      if (!res.ok || !json.ok) {
        setError(json.error || 'משהו השתבש. אפשר לנסות שוב?');
        setSubmitting(false);
        return;
      }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError('אין כרגע חיבור לאינטרנט. אפשר לנסות שוב?');
      setSubmitting(false);
    }
  }

  // ===========================================================================
  // מסך תודה
  // ===========================================================================
  if (submitted) {
    return (
      <main style={pageStyle}>
        <div style={cardStyle}>
          <div style={{ textAlign: 'center', padding: '20px 8px' }}>
            <div style={{ fontSize: 60, marginBottom: 16 }}>🌸</div>
            <h1 style={{
              fontSize: 32,
              fontWeight: 700,
              color: COLORS.green900,
              margin: 0,
              marginBottom: 20,
            }}>
              תודה רבה!
            </h1>
            <p style={{
              fontSize: 18,
              color: COLORS.text,
              lineHeight: 1.7,
              marginBottom: 16,
            }}>
              תשובותיכם עוברות אלינו להמשך טיפול.<br />
              בימים הקרובים נחזור אליכם לתיאום פגישת הייעוץ.
            </p>
            <div style={{
              marginTop: 28,
              padding: '18px 22px',
              background: COLORS.green25,
              borderRadius: 12,
              color: COLORS.green800,
              fontSize: 15,
              lineHeight: 1.6,
            }}>
              בינתיים, אם יש משהו דחוף — אפשר לכתוב לנו במייל:<br />
              <a href="mailto:info.portugo@gmail.com" style={{
                color: COLORS.green900,
                fontWeight: 700,
                textDecoration: 'none',
                borderBottom: `2px solid ${COLORS.green700}`,
              }}>
                info.portugo@gmail.com
              </a>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ===========================================================================
  // הטופס
  // ===========================================================================
  return (
    <main style={pageStyle}>
      <div style={cardStyle}>
        {/* Header עם לוגו */}
        <header style={headerStyle}>
          <div style={{ background: '#fff', borderRadius: 10, padding: 8, display: 'inline-block', marginBottom: 16 }}>
            <Image src="/logo.png" alt="פורטוגו" width={160} height={56} style={{ height: 'auto', maxWidth: '100%' }} priority />
          </div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, marginTop: 6 }}>
            שאלון היכרות לתכנון הטיול שלכם בפורטוגל
          </h1>
          <p style={{ fontSize: 15, color: '#cfe9d8', lineHeight: 1.7, marginTop: 14, marginBottom: 0 }}>
            ענו רק על מה שמתאים לכם — שדות מסומנים ב־<span style={{ color: '#ffd6cf' }}>*</span> הם היחידים שבאמת חובה.
            <br />
            אנחנו נקרא את הכל ונחזור אליכם בקרוב.
          </p>
        </header>

        <form onSubmit={handleSubmit} style={{ padding: '4px 4px 0' }}>
          {error && (
            <div style={errorBoxStyle}>{error}</div>
          )}

          {/* 1. פרטים בסיסיים */}
          <Section title="🔹 פרטים בסיסיים">
            <Field label="שם מלא" required>
              <input type="text" value={data.full_name || ''} onChange={e => update('full_name', e.target.value)} style={inputStyle} autoComplete="name" />
            </Field>
            <Field label="טלפון / וואטסאפ" required>
              <input type="tel" value={data.phone || ''} onChange={e => update('phone', e.target.value)} style={inputStyle} autoComplete="tel" />
            </Field>
            <Field label="אימייל" required>
              <input type="email" value={data.email || ''} onChange={e => update('email', e.target.value)} style={inputStyle} autoComplete="email" dir="ltr" />
            </Field>
            <Field label="כמה אנשים מטיילים">
              <input type="text" value={data.party_size || ''} onChange={e => update('party_size', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="גילאי המשתתפים">
              <input type="text" value={data.ages || ''} onChange={e => update('ages', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="מועד טיול משוער">
              <input type="text" value={data.travel_date || ''} onChange={e => update('travel_date', e.target.value)} style={inputStyle} placeholder="לדוגמה: ספטמבר 2026, או 'בקיץ הבא'" />
            </Field>
            <Field label="משך הטיול המשוער">
              <input type="text" value={data.trip_length || ''} onChange={e => update('trip_length', e.target.value)} style={inputStyle} placeholder="לדוגמה: 10 ימים" />
            </Field>
            <Field label="כבר יש טיסות?">
              <input type="text" value={data.has_flights || ''} onChange={e => update('has_flights', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="אם כן — איפה נוחתים ומאיפה חוזרים?">
              <input type="text" value={data.airports || ''} onChange={e => update('airports', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="שעות נחיתה והמראה, אם ידועות">
              <input type="text" value={data.flight_times || ''} onChange={e => update('flight_times', e.target.value)} style={inputStyle} />
            </Field>
          </Section>

          {/* 2. הרכב המטיילים */}
          <Section title="🔹 הרכב המטיילים">
            <Field label="האם יש ילדים? אם כן, פרטו גילאים">
              <textarea value={data.has_kids || ''} onChange={e => update('has_kids', e.target.value)} style={textareaStyle} rows={2} />
            </Field>
            <Field label="האם יש תינוקות / עגלות?">
              <input type="text" value={data.has_babies || ''} onChange={e => update('has_babies', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="האם יש משתתפים עם קושי בהליכה, מגבלה פיזית, או צורך בקצב איטי יותר?">
              <textarea value={data.mobility_limit || ''} onChange={e => update('mobility_limit', e.target.value)} style={textareaStyle} rows={2} />
            </Field>
            <Field label="האם יש צרכים מיוחדים שחשוב לקחת בחשבון?">
              <textarea value={data.special_needs || ''} onChange={e => update('special_needs', e.target.value)} style={textareaStyle} rows={2} />
            </Field>
          </Section>

          {/* 3. ניסיון קודם וציפיות */}
          <Section title="🔹 ניסיון קודם וציפיות">
            <Field label="האם זו הפעם הראשונה שלכם בפורטוגל?">
              <input type="text" value={data.first_time_portugal || ''} onChange={e => update('first_time_portugal', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="האם טיילתם בעבר באירופה?">
              <input type="text" value={data.prior_europe || ''} onChange={e => update('prior_europe', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="איזה טיול קודם אהבתם במיוחד, ולמה?">
              <textarea value={data.prior_loved || ''} onChange={e => update('prior_loved', e.target.value)} style={textareaStyle} rows={3} />
            </Field>
            <Field label="האם יש משהו מטיולים קודמים שפחות עבד לכם ותרצו להימנע ממנו הפעם?">
              <textarea value={data.prior_avoid || ''} onChange={e => update('prior_avoid', e.target.value)} style={textareaStyle} rows={3} />
            </Field>
          </Section>

          {/* 4. סגנון הטיול */}
          <Section title="🔹 סגנון הטיול המועדף">
            <Field label="איזה סוג טיול הכי מתאים לכם? אפשר לבחור כמה תשובות">
              <CheckGrid options={STYLE_TYPES} selected={data.style_types || []} onToggle={o => toggleArray('style_types', o)} />
            </Field>
            <Field label="איזה קצב טיול אתם מעדיפים?">
              <RadioGroup name="pace" options={PACE_OPTIONS} value={data.pace} onChange={v => update('pace', v)} />
            </Field>
          </Section>

          {/* 5. מבנה הטיול */}
          <Section title="🔹 מבנה הטיול">
            <Field label="איזה מבנה טיול אתם מעדיפים?">
              <RadioGroup name="structure" options={STRUCTURE_OPTIONS} value={data.structure} onChange={v => update('structure', v)} />
            </Field>
            <Field label="האם אתם מעדיפים להחליף כמה שפחות מקומות לינה?">
              <input type="text" value={data.prefer_less_hotels || ''} onChange={e => update('prefer_less_hotels', e.target.value)} style={inputStyle} />
            </Field>
            <Field label="האם יש לכם כבר לינות סגורות? אם כן — איפה ובאילו תאריכים?">
              <textarea value={data.existing_bookings || ''} onChange={e => update('existing_bookings', e.target.value)} style={textareaStyle} rows={3} />
            </Field>
          </Section>

          {/* 6. התניידות */}
          <Section title="🔹 התניידות ונהיגה">
            <Field label="איך אתם מתכננים להתנייד?">
              <CheckGrid options={TRANSPORT_OPTIONS} selected={data.transport || []} onToggle={o => toggleArray('transport', o)} />
            </Field>
            <Field label="האם נוח לכם לנהוג בפורטוגל?">
              <RadioGroup name="driving" options={DRIVING_OPTIONS} value={data.comfortable_driving} onChange={v => update('comfortable_driving', v)} />
            </Field>
            <Field label="מהו משך נסיעה יומי שנוח לכם איתו?">
              <RadioGroup name="dailyDrive" options={DAILY_DRIVE_OPTIONS} value={data.daily_drive_time} onChange={v => update('daily_drive_time', v)} />
            </Field>
            <Field label="האם חשוב לכם להימנע מנהיגה בערים גדולות / כבישים צרים / אזורים הרריים?">
              <textarea value={data.avoid_driving || ''} onChange={e => update('avoid_driving', e.target.value)} style={textareaStyle} rows={2} />
            </Field>
          </Section>

          {/* 7. אזורים ומקומות */}
          <Section title="🔹 אזורים, מקומות ורצונות מיוחדים">
            <Field label="האם יש מקומות שחשוב לכם לכלול בטיול?" hint="לדוגמה: ליסבון, פורטו, סינטרה, עמק הדורו, אלגרבה, מדיירה, אזור המרכז, כפרים, חופים וכו'.">
              <textarea value={data.must_include_areas || ''} onChange={e => update('must_include_areas', e.target.value)} style={textareaStyle} rows={3} />
            </Field>
            <Field label="האם ראיתם מקומות, מלונות, מסעדות או אטרקציות שתרצו לשלב?" hint="אפשר לצרף קישורים / שמות.">
              <textarea value={data.recommended_places || ''} onChange={e => update('recommended_places', e.target.value)} style={textareaStyle} rows={4} />
            </Field>
            <Field label="האם יש אזורים שאתם לא בטוחים לגביהם ותרצו שנעזור להחליט?">
              <textarea value={data.uncertain_areas || ''} onChange={e => update('uncertain_areas', e.target.value)} style={textareaStyle} rows={3} />
            </Field>
          </Section>

          {/* 8. תחומי עניין */}
          <Section title="🔹 תחומי עניין">
            <Field label="מה מעניין אתכם במיוחד?">
              <CheckGrid options={INTEREST_OPTIONS} selected={data.interests || []} onToggle={o => toggleArray('interests', o)} />
            </Field>
          </Section>

          {/* 9. אוכל וכשרות */}
          <Section title="🔹 אוכל, כשרות וצרכים תזונתיים">
            <Field label="האם יש העדפות קולינריות מיוחדות?">
              <textarea value={data.food_preferences || ''} onChange={e => update('food_preferences', e.target.value)} style={textareaStyle} rows={2} />
            </Field>
            <Field label="האם יש רגישויות / אלרגיות / צמחונות / טבעונות?">
              <textarea value={data.allergies || ''} onChange={e => update('allergies', e.target.value)} style={textareaStyle} rows={2} />
            </Field>
            <Field label="האם נדרשת כשרות או התאמות בנושא אוכל?">
              <textarea value={data.kashrut || ''} onChange={e => update('kashrut', e.target.value)} style={textareaStyle} rows={2} />
            </Field>
            <Field label="האם חשוב לכם לשלב מסעדות מומלצות כחלק מהמסלול?">
              <input type="text" value={data.include_restaurants || ''} onChange={e => update('include_restaurants', e.target.value)} style={inputStyle} />
            </Field>
          </Section>

          {/* 10. לינה ותקציב */}
          <Section title="🔹 לינה ותקציב">
            <Field label="איזו רמת לינה מתאימה לכם?">
              <CheckGrid options={LODGING_LEVEL_OPTIONS} selected={data.lodging_level || []} onToggle={o => toggleArray('lodging_level', o)} />
            </Field>
            <Field label="איזה סוג לינה אתם מעדיפים?">
              <CheckGrid options={LODGING_TYPE_OPTIONS} selected={data.lodging_type || []} onToggle={o => toggleArray('lodging_type', o)} />
            </Field>
            <Field label="האם חשוב שהלינה תהיה במרכז העניינים, או שאין בעיה להיות מחוץ לעיר עם רכב?">
              <textarea value={data.lodging_location || ''} onChange={e => update('lodging_location', e.target.value)} style={textareaStyle} rows={2} />
            </Field>
            <Field label="מה מסגרת התקציב המשוערת לטיול, לא כולל טיסות?" hint="אפשר לענות גם בטווח כללי.">
              <input type="text" value={data.budget || ''} onChange={e => update('budget', e.target.value)} style={inputStyle} />
            </Field>
          </Section>

          {/* 11. מגבלות */}
          <Section title="🔹 מגבלות ודברים שחשוב להימנע מהם">
            <Field label="האם יש מגבלות פיזיות שחשוב לקחת בחשבון?">
              <textarea value={data.physical_limits || ''} onChange={e => update('physical_limits', e.target.value)} style={textareaStyle} rows={2} />
            </Field>
            <Field label="האם יש דברים שאתם מעדיפים להימנע מהם?">
              <CheckGrid options={AVOID_OPTIONS} selected={data.avoid_list || []} onToggle={o => toggleArray('avoid_list', o)} />
            </Field>
            <Field label="אחר — משהו נוסף שתרצו שנימנע ממנו?">
              <input type="text" value={data.avoid_other || ''} onChange={e => update('avoid_other', e.target.value)} style={inputStyle} />
            </Field>
          </Section>

          {/* 12. אופי השירות */}
          <Section title="🔹 אופי השירות הרצוי">
            <Field label="במה תרצו שנתמקד בפגישה?">
              <CheckGrid options={SERVICE_FOCUS_OPTIONS} selected={data.service_focus || []} onToggle={o => toggleArray('service_focus', o)} />
            </Field>
            <Field label="האם כבר יש לכם מסלול ראשוני? אם כן — אפשר לפרט.">
              <textarea value={data.existing_itinerary || ''} onChange={e => update('existing_itinerary', e.target.value)} style={textareaStyle} rows={4} />
            </Field>
          </Section>

          {/* 13. שאלות עומק */}
          <Section title="🔹 שאלות עומק">
            <Field label="מה הכי חשוב לכם בטיול הזה?">
              <textarea value={data.most_important || ''} onChange={e => update('most_important', e.target.value)} style={textareaStyle} rows={3} />
            </Field>
            <Field label="איך נראה בעיניכם טיול מושלם?">
              <textarea value={data.perfect_trip || ''} onChange={e => update('perfect_trip', e.target.value)} style={textareaStyle} rows={3} />
            </Field>
            <Field label='בסוף הטיול, מה יגרום לכם להגיד: "זה היה בול בשבילנו"?'>
              <textarea value={data.bull_in_target || ''} onChange={e => update('bull_in_target', e.target.value)} style={textareaStyle} rows={3} />
            </Field>
            <Field label="האם יש אירוע מיוחד סביב הטיול?" hint="יום הולדת, ירח דבש, בר/בת מצווה, חגיגה משפחתית וכו'.">
              <textarea value={data.special_event || ''} onChange={e => update('special_event', e.target.value)} style={textareaStyle} rows={2} />
            </Field>
          </Section>

          {/* 14. סיום */}
          <Section title="🔹 לסיום">
            <Field label="האם יש משהו נוסף שחשוב שנדע לפני הפגישה?">
              <textarea value={data.anything_else || ''} onChange={e => update('anything_else', e.target.value)} style={textareaStyle} rows={3} />
            </Field>
            <Field label="האם יש שאלות שתרצו שנגיע איתן מוכנים לזום?">
              <textarea value={data.questions_for_us || ''} onChange={e => update('questions_for_us', e.target.value)} style={textareaStyle} rows={3} />
            </Field>
          </Section>

          {/* כפתור שליחה */}
          <div style={{ padding: '24px 4px 8px' }}>
            {error && <div style={errorBoxStyle}>{error}</div>}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: '100%',
                padding: '18px 24px',
                background: submitting ? COLORS.muted : COLORS.red,
                color: '#fff',
                border: 'none',
                borderRadius: 12,
                fontSize: 18,
                fontWeight: 700,
                cursor: submitting ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 4px 14px rgba(212, 53, 28, 0.25)',
                transition: 'background 150ms',
              }}
              onMouseEnter={e => { if (!submitting) e.currentTarget.style.background = COLORS.redHover; }}
              onMouseLeave={e => { if (!submitting) e.currentTarget.style.background = COLORS.red; }}
            >
              {submitting ? 'שולחים...' : 'שולחים את השאלון 🌸'}
            </button>
            <p style={{ textAlign: 'center', fontSize: 13, color: COLORS.muted, marginTop: 16 }}>
              אנחנו נחזור אליכם בימים הקרובים לתיאום פגישת הייעוץ.
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{
      padding: '20px 0 4px',
      borderTop: `1px solid ${COLORS.border}`,
      marginTop: 8,
    }}>
      <h2 style={{
        fontSize: 18,
        fontWeight: 700,
        color: COLORS.green800,
        margin: 0,
        marginBottom: 14,
        paddingTop: 4,
      }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {children}
      </div>
    </section>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: COLORS.text }}>
        {label}
        {required && <span style={{ color: COLORS.red, marginRight: 4 }}> *</span>}
      </span>
      {hint && (
        <span style={{ fontSize: 12, color: COLORS.muted, lineHeight: 1.5 }}>{hint}</span>
      )}
      {children}
    </label>
  );
}

function CheckGrid({ options, selected, onToggle }: { options: string[]; selected: string[]; onToggle: (o: string) => void }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
      gap: 8,
    }}>
      {options.map(opt => {
        const checked = selected.includes(opt);
        return (
          <button
            type="button"
            key={opt}
            onClick={() => onToggle(opt)}
            style={{
              padding: '10px 14px',
              background: checked ? COLORS.green700 : COLORS.white,
              color: checked ? COLORS.white : COLORS.text,
              border: `1.5px solid ${checked ? COLORS.green700 : COLORS.border}`,
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 14,
              textAlign: 'right',
              fontFamily: 'inherit',
              transition: 'all 120ms',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span style={{
              width: 18,
              height: 18,
              borderRadius: 4,
              border: `1.5px solid ${checked ? COLORS.white : COLORS.border}`,
              background: checked ? COLORS.white : 'transparent',
              color: COLORS.green700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 14,
              fontWeight: 700,
              flexShrink: 0,
            }}>
              {checked ? '✓' : ''}
            </span>
            <span>{opt}</span>
          </button>
        );
      })}
    </div>
  );
}

function RadioGroup({ name, options, value, onChange }: { name: string; options: string[]; value?: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {options.map(opt => {
        const checked = value === opt;
        return (
          <button
            type="button"
            key={opt}
            onClick={() => onChange(opt)}
            style={{
              padding: '10px 14px',
              background: checked ? COLORS.green700 : COLORS.white,
              color: checked ? COLORS.white : COLORS.text,
              border: `1.5px solid ${checked ? COLORS.green700 : COLORS.border}`,
              borderRadius: 10,
              cursor: 'pointer',
              fontSize: 14,
              textAlign: 'right',
              fontFamily: 'inherit',
              transition: 'all 120ms',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{
              width: 18, height: 18, borderRadius: '50%',
              border: `2px solid ${checked ? COLORS.white : COLORS.border}`,
              background: checked ? COLORS.white : 'transparent',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              {checked && <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS.green700 }} />}
            </span>
            <span>{opt}</span>
          </button>
        );
      })}
    </div>
  );
}

// ============================================================================
// Styles
// ============================================================================

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  background: `linear-gradient(180deg, ${COLORS.cream} 0%, ${COLORS.green25} 100%)`,
  padding: '24px 12px 48px',
  fontFamily: 'inherit',
  color: COLORS.text,
};

const cardStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: '0 auto',
  background: COLORS.white,
  borderRadius: 16,
  boxShadow: '0 6px 24px rgba(13, 77, 37, 0.10)',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  background: `linear-gradient(135deg, ${COLORS.green900} 0%, ${COLORS.green800} 100%)`,
  color: COLORS.white,
  padding: '28px 28px 24px',
  textAlign: 'center',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '11px 14px',
  border: `1.5px solid ${COLORS.border}`,
  borderRadius: 10,
  fontSize: 15,
  fontFamily: 'inherit',
  color: COLORS.text,
  background: COLORS.white,
  outline: 'none',
  boxSizing: 'border-box',
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  resize: 'vertical',
  minHeight: 60,
  lineHeight: 1.6,
};

const errorBoxStyle: React.CSSProperties = {
  background: '#fef2f2',
  border: `1.5px solid ${COLORS.red}`,
  color: COLORS.red,
  padding: '12px 16px',
  borderRadius: 10,
  fontSize: 14,
  marginBottom: 16,
  fontWeight: 500,
};
