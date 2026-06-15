'use client';

/**
 * /admin/quotes — היסטוריית הצעות המחיר.
 *
 * שורה לכל הצעה: שם הלקוח, מי יצר, תאריך, סטטוס (נשלחה / הלקוח הגיב).
 * לחיצה על שורה פותחת את תגובת הלקוח (אם הגיב) + לינק לעמוד ההצעה.
 * הנתונים נטענים דרך /api/quotes/list (service key + אימות אדמין).
 */
import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ADMIN_COLORS } from '@/lib/admin/theme';
import type { QuoteResponse, QuoteStatus } from '@/lib/quote-types';

type QuoteListItem = {
  id: string;
  slug: string | null;
  customer_name: string;
  created_by: string | null;
  status: QuoteStatus;
  created_at: string;
  responded_at: string | null;
  response: QuoteResponse | null;
};

function formatDate(s: string | null): string {
  if (!s) return '';
  return new Date(s).toLocaleString('he-IL', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function isoToHe(iso?: string): string {
  if (!iso) return '';
  const p = iso.split('-');
  return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : iso;
}

export default function QuotesHistoryPage() {
  const [rows, setRows] = useState<QuoteListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | QuoteStatus>('all');
  const [search, setSearch] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) { if (!cancelled) { setError('צריך להתחבר מחדש'); setLoading(false); } return; }
      try {
        const res = await fetch('/api/quotes/list', { headers: { Authorization: `Bearer ${token}` } });
        const data = await res.json();
        if (cancelled) return;
        if (!data.ok) setError(data.error || 'שגיאה בטעינה');
        else setRows(data.quotes as QuoteListItem[]);
      } catch {
        if (!cancelled) setError('שגיאה בטעינה, נסו שוב');
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filtered = rows.filter((r) => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.customer_name.toLowerCase().includes(q) && !(r.created_by || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const respondedCount = rows.filter((r) => r.status === 'responded').length;

  return (
    <div>
      <header style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: ADMIN_COLORS.green800, margin: 0 }}>הצעות מחיר 🧾</h1>
          <p style={{ fontSize: 14, color: ADMIN_COLORS.gray500, marginTop: 4 }}>
            {rows.length === 0 ? 'עוד לא נוצרו הצעות' : `סה"כ ${rows.length} הצעות · ${respondedCount > 0 ? `${respondedCount} לקוחות הגיבו` : 'אף לקוח עדיין לא הגיב'}`}
          </p>
        </div>
        <Link href="/admin/quotes/new" style={{
          background: ADMIN_COLORS.green700, color: '#fff', textDecoration: 'none',
          padding: '10px 18px', borderRadius: 10, fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap',
        }}>+ הצעה חדשה</Link>
      </header>

      <div style={{ background: ADMIN_COLORS.white, borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
        <input
          type="text" placeholder="חיפוש לפי שם לקוח או מי יצר..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: '1 1 220px', padding: '10px 14px', border: `1px solid ${ADMIN_COLORS.gray300}`, borderRadius: 8, fontSize: 14, fontFamily: 'inherit', outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'sent', 'responded'] as const).map((s) => (
            <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}
              label={s === 'all' ? 'הכל' : s === 'sent' ? 'נשלחה' : 'הלקוח הגיב'}
              count={s === 'all' ? rows.length : rows.filter((r) => r.status === s).length} />
          ))}
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', padding: 60, color: ADMIN_COLORS.gray500 }}>טוענים הצעות...</div>}

      {error && (
        <div style={{ background: '#fef2f2', color: ADMIN_COLORS.red, padding: 16, borderRadius: 10, border: `1px solid ${ADMIN_COLORS.red}` }}>
          שגיאה: {error}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div style={{ background: ADMIN_COLORS.white, borderRadius: 12, padding: 60, textAlign: 'center', color: ADMIN_COLORS.gray500, fontSize: 16 }}>
          {rows.length === 0 ? '🧾 עוד אין הצעות. צרו הצעה ראשונה עם הכפתור למעלה.' : 'אין הצעות שמתאימות לסינון.'}
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div style={{ background: ADMIN_COLORS.white, borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: ADMIN_COLORS.green25 }}>
                <Th>לקוח</Th><Th>נוצר ע"י</Th><Th>תאריך יצירה</Th><Th>סטטוס</Th><Th></Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => {
                const isOpen = openId === r.id;
                const responded = r.status === 'responded';
                return (
                  <Fragment key={r.id}>
                    <tr onClick={() => setOpenId(isOpen ? null : r.id)}
                      style={{ borderTop: i === 0 ? 'none' : `1px solid ${ADMIN_COLORS.gray100}`, cursor: 'pointer', background: isOpen ? ADMIN_COLORS.green25 : undefined }}>
                      <Td><strong style={{ color: ADMIN_COLORS.gray900 }}>{r.customer_name}</strong></Td>
                      <Td>{r.created_by || '—'}</Td>
                      <Td>{formatDate(r.created_at)}</Td>
                      <Td>
                        <span style={{ display: 'inline-block', padding: '4px 12px', background: responded ? '#0d6e34' : ADMIN_COLORS.gray300, color: responded ? '#fff' : ADMIN_COLORS.gray700, borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                          {responded ? 'הלקוח הגיב' : 'נשלחה'}
                        </span>
                      </Td>
                      <Td><span style={{ color: ADMIN_COLORS.gray500, fontSize: 13 }}>{isOpen ? '▲' : '▼'}</span></Td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={5} style={{ padding: '0 16px 18px', background: ADMIN_COLORS.green25 }}>
                          <QuoteDetail item={r} isoToHe={isoToHe} formatDate={formatDate} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function QuoteDetail({ item, isoToHe, formatDate }: { item: QuoteListItem; isoToHe: (s?: string) => string; formatDate: (s: string | null) => string }) {
  const link = `/quote/${item.slug || item.id}`;
  const resp = item.response;
  return (
    <div style={{ background: '#fff', borderRadius: 10, padding: 16, border: `1px solid ${ADMIN_COLORS.gray100}` }}>
      {item.status === 'responded' && resp ? (
        <>
          <div style={{ fontSize: 13, fontWeight: 700, color: ADMIN_COLORS.green800, marginBottom: 8 }}>
            הלקוח הגיב {item.responded_at ? `· ${formatDate(item.responded_at)}` : ''}
          </div>
          {resp.tours.length > 0 ? (
            <ul style={{ margin: '0 0 10px', paddingInlineStart: 18, color: ADMIN_COLORS.gray900, fontSize: 14, lineHeight: 1.8 }}>
              {resp.tours.map((t, idx) => (
                <li key={idx}>{t.name}{t.date ? ` — 📅 ${isoToHe(t.date)}` : ' — ללא תאריך'}</li>
              ))}
            </ul>
          ) : (
            <div style={{ color: ADMIN_COLORS.gray500, fontSize: 14, marginBottom: 10 }}>הלקוח לא סימן סיורים ספציפיים.</div>
          )}
          {resp.notes && (
            <div style={{ background: '#fff7ed', borderRadius: 8, padding: 12, color: '#9a3412', fontSize: 14, marginBottom: 10, whiteSpace: 'pre-wrap' }}>
              <strong>הערות הלקוח:</strong> {resp.notes}
            </div>
          )}
        </>
      ) : (
        <div style={{ color: ADMIN_COLORS.gray500, fontSize: 14, marginBottom: 10 }}>ההצעה נשלחה. הלקוח עדיין לא הגיב.</div>
      )}
      <a href={link} target="_blank" rel="noopener" style={{ color: '#c4602f', fontWeight: 700, fontSize: 14, textDecoration: 'none' }}>
        פתיחת עמוד ההצעה ←
      </a>
    </div>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, fontWeight: 600, color: ADMIN_COLORS.green800 }}>{children}</th>;
}
function Td({ children }: { children: React.ReactNode }) {
  return <td style={{ padding: '14px 16px', fontSize: 14, color: ADMIN_COLORS.gray900, verticalAlign: 'middle' }}>{children}</td>;
}
function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button onClick={onClick} style={{ padding: '8px 14px', background: active ? ADMIN_COLORS.green700 : ADMIN_COLORS.gray100, color: active ? '#fff' : ADMIN_COLORS.gray700, border: 'none', borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', gap: 6 }}>
      {label}
      <span style={{ background: active ? 'rgba(255,255,255,0.25)' : ADMIN_COLORS.gray300, color: active ? '#fff' : ADMIN_COLORS.gray700, padding: '1px 8px', borderRadius: 999, fontSize: 11 }}>{count}</span>
    </button>
  );
}
