'use client';

/**
 * /admin/quotes/new — מסך יצירת הצעת מחיר (עומר/רונה).
 * ממלאים פרטים → תצוגה מקדימה חיה של המחירים → שמירה → לינק ללקוח.
 * (מוגן ע"י admin/layout שבודק is_admin.)
 */
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import PriceBlock from '@/components/quote/PriceBlock';
import { buildColumns, tourDisplayName } from '@/lib/quote-build';
import type { QuoteColumn, QuoteTourSel, QuoteSelection } from '@/lib/quote-types';

const C = {
  forest: '#0a3d22',
  terra: '#c4602f',
  ink: '#23281f',
  inkSoft: '#5b5f54',
  inkMute: '#8a8d82',
  band: '#f0e9da',
  border: '#e3ddcf',
  bg: '#faf6ee',
  surface: '#ffffff',
  greenDeep: '#0d6e34',
};

type Item = { key: string; label: string; sel: QuoteTourSel; canCar?: boolean; carType?: 'half' | 'full' };

const ITEMS: Item[] = [
  // ליסבון
  { key: 'classic-lisbon', label: 'ליסבון הקלאסית', sel: { tourSlug: 'classic-private', variant: 'regular', card: 'classic-lisbon' }, canCar: true },
  { key: 'belem', label: 'בלם', sel: { tourSlug: 'belem-private', card: 'belem' }, canCar: true },
  { key: 'culinary', label: 'קולינרי (ליסבון)', sel: { tourSlug: 'culinary-tastings-private', card: 'culinary' } },
  { key: 'sintra', label: 'סינטרה', sel: { tourSlug: 'sintra-arrabida-private', card: 'sintra' } },
  { key: 'arrabida', label: 'אראבידה', sel: { tourSlug: 'sintra-arrabida-private', card: 'arrabida' } },
  { key: 'obidos', label: 'אובידוש', sel: { tourSlug: 'obidos-private', card: 'obidos' } },
  // פורטו
  { key: 'porto-classic', label: 'פורטו הקלאסית', sel: { tourSlug: 'classic-private', variant: 'regular', card: 'porto-classic' }, canCar: true },
  { key: 'porto-tastings', label: 'טעימות (פורטו)', sel: { tourSlug: 'culinary-tastings-private', card: 'porto-tastings' } },
  { key: 'douro', label: 'דורו (פורטו)', sel: { tourSlug: 'douro-private', card: 'douro' } },
  // שילובים
  { key: 'combo-classic-belem', label: 'שילוב: קלאסי + בלם (יום מלא)', sel: { tourSlug: 'classic-private', comboSlug: 'combo-classic-belem' }, canCar: true, carType: 'full' },
  { key: 'combo-classic-culinary', label: 'שילוב: קלאסי + קולינרי', sel: { tourSlug: 'classic-private', comboSlug: 'combo-classic-culinary' } },
  { key: 'combo-classic-tastings', label: 'שילוב: פורטו קלאסית + טעימות', sel: { tourSlug: 'classic-private', comboSlug: 'combo-classic-tastings' } },
];

// סיורים שאינם תואמים לרכב צמוד (קולינרי/טעימות) — מושבתים כשנבחר "הצעה עם רכב"
const CAR_INCOMPATIBLE = new Set(['culinary', 'porto-tastings', 'combo-classic-culinary', 'combo-classic-tastings']);

type Comp = { adults: number; ages: number[] };
type Band = { min: number; max: number };
type Mode = 'one' | 'two' | 'band';

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 13, fontWeight: 700, color: C.forest, marginBottom: 6 };
const inputStyle: React.CSSProperties = {
  border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 15, background: '#fff', color: C.ink,
};
const cardStyle: React.CSSProperties = {
  background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 18, marginBottom: 16,
};

export default function NewQuotePage() {
  const [customerName, setCustomerName] = useState('');
  const [requestedDate, setRequestedDate] = useState('');
  const [mode, setMode] = useState<Mode>('one');
  const [compA, setCompA] = useState<Comp>({ adults: 2, ages: [] });
  const [compB, setCompB] = useState<Comp>({ adults: 4, ages: [] });
  const [bandA, setBandA] = useState<Band>({ min: 8, max: 11 });
  const [bandB, setBandB] = useState<Band>({ min: 12, max: 15 });
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [withCar, setWithCar] = useState(false);
  const [overrides, setOverrides] = useState<Record<string, string>>({}); // key → מחיר מיוחד לאדם (טקסט)
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);   // מצב עריכה של הצעה קיימת
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  // ─── מצב עריכה: אם יש ?edit=<id> בכתובת, טוענים את ההצעה וממלאים מחדש ───
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('edit');
    if (!id) return;
    setEditId(id);
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) { setErr('צריך להתחבר מחדש'); return; }
      try {
        const res = await fetch(`/api/quotes/get?id=${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (!data.ok) { setErr(data.error || 'שגיאה בטעינת ההצעה'); return; }
        prefillFromSelection(data.quote.selection as QuoteSelection);
      } catch {
        setErr('שגיאה בטעינת ההצעה');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function prefillFromSelection(sel: QuoteSelection) {
    setCustomerName(sel.customerName || '');
    setRequestedDate(sel.requestedDate || '');
    setNotes(sel.notes || '');
    // עמודות → מצב כמות
    const cols = sel.columns || [];
    if (cols.length && cols.every((c) => c.type === 'band')) {
      setMode('band');
      const b = cols.filter((c): c is Extract<QuoteColumn, { type: 'band' }> => c.type === 'band');
      if (b[0]) setBandA({ min: b[0].minSize, max: b[0].maxSize });
      if (b[1]) setBandB({ min: b[1].minSize, max: b[1].maxSize });
    } else {
      const e = cols.filter((c): c is Extract<QuoteColumn, { type: 'exact' }> => c.type === 'exact');
      setMode(e.length >= 2 ? 'two' : 'one');
      if (e[0]) setCompA({ adults: e[0].adults, ages: e[0].childrenAges });
      if (e[1]) setCompB({ adults: e[1].adults, ages: e[1].childrenAges });
    }
    // סיורים → מפתחות נבחרים + רכב + מחירים מיוחדים
    const keys = new Set<string>();
    const ov: Record<string, string> = {};
    let anyCar = false;
    for (const t of sel.tours || []) {
      const item = ITEMS.find((it) =>
        t.comboSlug ? it.sel.comboSlug === t.comboSlug : it.sel.card === t.card,
      );
      if (!item) continue;
      keys.add(item.key);
      if (t.car) anyCar = true;
      if (t.priceOverride != null) ov[item.key] = String(t.priceOverride);
    }
    setSelectedKeys(keys);
    setWithCar(anyCar);
    setOverrides(ov);
  }

  const columns: QuoteColumn[] = useMemo(() => {
    if (mode === 'one') return [{ type: 'exact', adults: compA.adults, childrenAges: compA.ages }];
    if (mode === 'two')
      return [
        { type: 'exact', adults: compA.adults, childrenAges: compA.ages },
        { type: 'exact', adults: compB.adults, childrenAges: compB.ages },
      ];
    return [
      { type: 'band', minSize: bandA.min, maxSize: bandA.max },
      { type: 'band', minSize: bandB.min, maxSize: bandB.max },
    ];
  }, [mode, compA, compB, bandA, bandB]);

  const selectedTours: QuoteTourSel[] = useMemo(
    () =>
      ITEMS.filter((it) => selectedKeys.has(it.key)).map((it) => {
        const raw = overrides[it.key];
        const ov = raw != null && raw.trim() !== '' ? Number(raw) : undefined;
        return {
          ...it.sel,
          car: withCar && it.canCar ? (it.carType || 'half') : null,
          priceOverride: ov != null && !Number.isNaN(ov) ? ov : undefined,
        };
      }),
    [selectedKeys, withCar, overrides],
  );

  function toggleSel(key: string) {
    setSelectedKeys((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  }
  function toggleWithCar() {
    setWithCar((v) => {
      const next = !v;
      if (next) {
        // בהצעה עם רכב — קולינרי/טעימות אינם זמינים, מנקים אותם אם נבחרו
        setSelectedKeys((s) => {
          const n = new Set(s);
          CAR_INCOMPATIBLE.forEach((k) => n.delete(k));
          return n;
        });
      }
      return next;
    });
  }
  function selectAll() {
    setSelectedKeys(new Set(ITEMS.filter((it) => !(withCar && CAR_INCOMPATIBLE.has(it.key))).map((it) => it.key)));
  }
  function clearAll() {
    setSelectedKeys(new Set());
  }

  function quoteLink(slugOrId: string): string {
    // הלינק ללקוח נבנה מהדומיין הנקי portugo-proposal.vercel.app (חי ומאומת).
    // אפשר לדרוס דרך NEXT_PUBLIC_QUOTE_BASE_URL; אם שום דבר זמין — נופל לכתובת הנוכחית.
    const base =
      (process.env.NEXT_PUBLIC_QUOTE_BASE_URL || 'https://portugo-proposal.vercel.app').replace(/\/+$/, '') ||
      window.location.origin;
    return `${base}/quote/${slugOrId}`;
  }

  async function save() {
    setErr(null);
    setLink(null);
    setSavedMsg(null);
    if (!customerName.trim()) { setErr('צריך למלא שם מקבל'); return; }
    if (selectedTours.length === 0) { setErr('צריך לבחור לפחות סיור אחד'); return; }
    setSaving(true);
    const selection: QuoteSelection = { customerName: customerName.trim(), columns, tours: selectedTours, notes: notes.trim() || undefined, requestedDate: requestedDate.trim() || undefined };
    try {
      if (editId) {
        // עדכון הצעה קיימת (אותו לינק)
        const { data: sess } = await supabase.auth.getSession();
        const token = sess.session?.access_token;
        const res = await fetch('/api/quotes/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token || ''}` },
          body: JSON.stringify({ id: editId, customerName: customerName.trim(), selection }),
        });
        const data = await res.json();
        if (!data.ok) { setErr(data.error || 'שגיאה בשמירה'); setSaving(false); return; }
        setSavedMsg('ההצעה עודכנה. הלינק שכבר נשלח ללקוח מציג עכשיו את הגרסה המעודכנת.');
        setLink(quoteLink(editId));
      } else {
        // יצירת הצעה חדשה
        let createdBy = '';
        try { createdBy = localStorage.getItem('portugo_guide_name') || ''; } catch {}
        const res = await fetch('/api/quotes/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ customerName: customerName.trim(), selection, createdBy }),
        });
        const data = await res.json();
        if (!data.ok) { setErr(data.error || 'שגיאה בשמירה'); setSaving(false); return; }
        setLink(quoteLink(data.slug || data.id));
      }
    } catch {
      setErr('שגיאה בשמירה, נסו שוב');
    }
    setSaving(false);
  }

  function copyLink() {
    if (!link) return;
    navigator.clipboard?.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto', color: C.ink, fontFamily: 'Assistant, system-ui, sans-serif' }}>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: C.forest, marginBottom: 4 }}>{editId ? 'עריכת הצעת מחיר' : 'הצעת מחיר חדשה'}</h1>
      <p style={{ color: C.inkSoft, marginTop: 0, marginBottom: 20 }}>
        {editId
          ? 'עורכים את הפרטים ושומרים. הלינק נשאר אותו לינק, כך שמה שכבר נשלח ללקוח יתעדכן.'
          : 'ממלאים את הפרטים, רואים תצוגה מקדימה חיה, ויוצרים לינק לשליחה ללקוח.'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,420px) 1fr', gap: 24, alignItems: 'start' }}>
        {/* ── טופס ── */}
        <div>
          <div style={cardStyle}>
            <label style={labelStyle}>שם המקבל</label>
            <input
              style={{ ...inputStyle, width: '100%' }}
              placeholder="למשל: משפחת סימאי"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <label style={{ ...labelStyle, marginTop: 14 }}>מועד מבוקש</label>
            <input
              style={{ ...inputStyle, width: '100%' }}
              placeholder="למשל: יוני 2026 / השבוע השני של אוגוסט"
              value={requestedDate}
              onChange={(e) => setRequestedDate(e.target.value)}
            />
            <div style={{ fontSize: 12, color: C.inkMute, marginTop: 4 }}>מופיע בראש ההצעה. אפשר להשאיר ריק.</div>
          </div>

          {/* הרכב / כמות */}
          <div style={cardStyle}>
            <label style={labelStyle}>כמות משתתפים</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
              {([['one', 'כמות אחת'], ['two', 'שתי כמויות'], ['band', 'טווח']] as [Mode, string][]).map(([m, lbl]) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    padding: '7px 14px', borderRadius: 100, fontSize: 14, cursor: 'pointer',
                    border: `1px solid ${mode === m ? C.terra : C.border}`,
                    background: mode === m ? C.terra : '#fff',
                    color: mode === m ? '#fff' : C.inkSoft, fontWeight: 600,
                  }}
                >
                  {lbl}
                </button>
              ))}
            </div>

            {mode === 'band' ? (
              <div style={{ display: 'grid', gap: 12 }}>
                <BandEditor label="עמודה 1" band={bandA} onChange={setBandA} />
                <BandEditor label="עמודה 2" band={bandB} onChange={setBandB} />
              </div>
            ) : (
              <div style={{ display: 'grid', gap: 14 }}>
                <CompEditor label={mode === 'two' ? 'כמות 1' : undefined} comp={compA} onChange={setCompA} />
                {mode === 'two' && <CompEditor label="כמות 2" comp={compB} onChange={setCompB} />}
              </div>
            )}
          </div>

          {/* רכב צמוד — אלמנט נפרד */}
          <div style={cardStyle}>
            <label style={labelStyle}>רכב צמוד</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 15 }}>
              <input type="checkbox" checked={withCar} onChange={toggleWithCar} />
              ההצעה כוללת רכב צמוד (לסיורי העיר: ליסבון הקלאסית / בלם / פורטו הקלאסית)
            </label>
            {withCar && (
              <div style={{ fontSize: 13, color: C.inkSoft, marginTop: 8, background: C.band, borderRadius: 8, padding: '8px 10px' }}>
                בהצעה עם רכב, ליסבון הקלאסית, בלם ופורטו הקלאסית מוצגים עם רכב צמוד, וקולינרי / טעימות אינם זמינים.
              </div>
            )}
          </div>

          {/* סיורים */}
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>אילו סיורים נכנסים?</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={selectAll} style={miniBtn(C.terra, true)}>בחר הכל</button>
                <button onClick={clearAll} style={miniBtn(C.inkMute, false)}>נקה</button>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 6 }}>
              {ITEMS.map((it) => {
                const on = selectedKeys.has(it.key);
                const disabled = withCar && CAR_INCOMPATIBLE.has(it.key);
                return (
                  <div key={it.key} style={{ border: `1px solid ${on ? C.terra : C.border}`, borderRadius: 8, padding: '8px 10px', background: disabled ? '#f4f4f2' : on ? '#fff7f2' : '#fff', opacity: disabled ? 0.55 : 1 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: disabled ? 'not-allowed' : 'pointer', fontSize: 15 }}>
                      <input type="checkbox" checked={on} disabled={disabled} onChange={() => toggleSel(it.key)} />
                      <span>{it.label}</span>
                      {withCar && it.canCar && (
                        <span style={{ fontSize: 12, color: C.terra, marginInlineStart: 'auto', fontWeight: 600 }}>🚐 עם רכב</span>
                      )}
                      {disabled && (
                        <span style={{ fontSize: 11, color: C.inkMute, marginInlineStart: 'auto' }}>לא זמין עם רכב</span>
                      )}
                    </label>
                    {on && !disabled && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, paddingTop: 8, borderTop: `1px dashed ${C.border}` }}>
                        <span style={{ fontSize: 13, color: C.inkSoft }}>מחיר מיוחד לאדם:</span>
                        <input
                          type="number" min={0} inputMode="numeric"
                          placeholder="רגיל"
                          value={overrides[it.key] ?? ''}
                          onChange={(e) => setOverrides((o) => ({ ...o, [it.key]: e.target.value }))}
                          style={{ ...inputStyle, width: 90, padding: '5px 8px', fontSize: 14 }}
                        />
                        <span style={{ fontSize: 13, color: C.inkMute }}>€ (ריק = מחיר הטבלה)</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={cardStyle}>
            <label style={labelStyle}>הערות (אופציונלי)</label>
            <textarea
              style={{ ...inputStyle, width: '100%', minHeight: 70, resize: 'vertical' }}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <button
            onClick={save}
            disabled={saving}
            style={{
              width: '100%', padding: '13px', borderRadius: 10, border: 'none', cursor: saving ? 'default' : 'pointer',
              background: C.greenDeep, color: '#fff', fontSize: 16, fontWeight: 700, opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'שומר...' : editId ? 'שמור שינויים' : 'צור לינק להצעה'}
          </button>
          {err && <div style={{ color: C.terra, marginTop: 10, fontSize: 14 }}>⚠ {err}</div>}
          {savedMsg && <div style={{ color: C.greenDeep, marginTop: 10, fontSize: 14, fontWeight: 600 }}>✓ {savedMsg}</div>}
          {link && (
            <div style={{ marginTop: 14, padding: 14, background: '#eef7f0', border: `1px solid #cfe3d4`, borderRadius: 10 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.greenDeep, marginBottom: 8 }}>{editId ? 'הלינק ללקוח (ללא שינוי):' : '✓ ההצעה נוצרה! הלינק ללקוח:'}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input readOnly value={link} style={{ ...inputStyle, flex: 1, fontSize: 13 }} />
                <button onClick={copyLink} style={miniBtn(C.terra, true)}>{copied ? 'הועתק ✓' : 'העתק'}</button>
                <a href={link} target="_blank" rel="noopener" style={{ ...miniBtn(C.greenDeep, true), textDecoration: 'none', display: 'inline-block' }}>פתח</a>
              </div>
            </div>
          )}
        </div>

        {/* ── תצוגה מקדימה ── */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.inkMute, marginBottom: 10 }}>תצוגה מקדימה</div>
          {selectedTours.length === 0 ? (
            <div style={{ ...cardStyle, color: C.inkMute, textAlign: 'center', padding: 40 }}>
              בחרו סיורים כדי לראות את המחירים כאן
            </div>
          ) : (
            selectedTours.map((tour, i) => (
              <div key={i} style={cardStyle}>
                <h3 style={{ fontSize: 19, color: C.forest, margin: '0 0 14px', fontWeight: 800 }}>
                  {tourDisplayName(tour)}
                  {tour.car ? <span style={{ fontSize: 13, color: C.terra, fontWeight: 600 }}> · עם רכב צמוד</span> : null}
                </h3>
                <PriceBlock columns={buildColumns(tour, columns)} />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function miniBtn(color: string, filled: boolean): React.CSSProperties {
  return {
    padding: '6px 12px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
    border: `1px solid ${color}`, background: filled ? color : '#fff', color: filled ? '#fff' : color,
  };
}

function CompEditor({ label, comp, onChange }: { label?: string; comp: Comp; onChange: (c: Comp) => void }) {
  return (
    <div style={{ border: `1px solid #eee`, borderRadius: 8, padding: 10 }}>
      {label && <div style={{ fontSize: 12, fontWeight: 700, color: '#8a8d82', marginBottom: 8 }}>{label}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 14, color: '#5b5f54' }}>מבוגרים</span>
        <input
          type="number" min={0} value={comp.adults}
          onChange={(e) => onChange({ ...comp, adults: Math.max(0, Number(e.target.value) || 0) })}
          style={{ ...inputStyle, width: 70 }}
        />
      </div>
      <div style={{ fontSize: 13, color: '#5b5f54', marginBottom: 6 }}>ילדים (גילאים):</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {comp.ages.map((age, idx) => (
          <span key={idx} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#f0e9da', borderRadius: 6, padding: '3px 6px' }}>
            <input
              type="number" min={0} max={17} value={age}
              onChange={(e) => {
                const ages = [...comp.ages];
                ages[idx] = Math.max(0, Math.min(17, Number(e.target.value) || 0));
                onChange({ ...comp, ages });
              }}
              style={{ ...inputStyle, width: 52, padding: '4px 6px' }}
            />
            <button
              onClick={() => onChange({ ...comp, ages: comp.ages.filter((_, i) => i !== idx) })}
              style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#c4602f', fontSize: 16, lineHeight: 1 }}
            >
              ×
            </button>
          </span>
        ))}
        <button
          onClick={() => onChange({ ...comp, ages: [...comp.ages, 8] })}
          style={{ border: `1px dashed #c4602f`, background: '#fff', color: '#c4602f', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: 13 }}
        >
          + ילד
        </button>
      </div>
    </div>
  );
}

function BandEditor({ label, band, onChange }: { label: string; band: Band; onChange: (b: Band) => void }) {
  return (
    <div style={{ border: `1px solid #eee`, borderRadius: 8, padding: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#8a8d82', minWidth: 56 }}>{label}</span>
      <span style={{ fontSize: 14, color: '#5b5f54' }}>מ-</span>
      <input type="number" min={2} value={band.min} onChange={(e) => onChange({ ...band, min: Number(e.target.value) || 0 })} style={{ ...inputStyle, width: 64 }} />
      <span style={{ fontSize: 14, color: '#5b5f54' }}>עד</span>
      <input type="number" min={2} value={band.max} onChange={(e) => onChange({ ...band, max: Number(e.target.value) || 0 })} style={{ ...inputStyle, width: 64 }} />
    </div>
  );
}
