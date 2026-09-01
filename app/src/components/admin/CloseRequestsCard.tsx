'use client';

/**
 * כרטיס "בקשות סגירת חודש" בדשבורד האדמין.
 *
 * שער האישור של עומר (הנחיה 14.8.26): מדריך.ה לא סוגר.ת חודש בלי אישור.
 * הבקשות נוצרות ב-/api/close-requests (שגם שולח מייל לעומר), וכאן עומר
 * מאשרת/דוחה. מוצג **רק לעומר** (לא לרונה) — לפי שם המשתמש המחובר.
 *
 * אישור ננעל על expected_total של רגע הבקשה; מסך הסגירה של המדריך.ה
 * מפקיע אישור אוטומטית אם המשכורת הצפויה השתנתה ביותר מ-1€.
 */

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { ADMIN_COLORS, fmtEuro, monthName } from '@/lib/admin/theme';

type CloseRequest = {
  id: string;
  guide_id: string;
  year: number;
  month: number; // 1-12
  expected_total: number;
  status: string;
  requested_at: string;
};

export default function CloseRequestsCard({ onChange }: { onChange?: () => void }) {
  const [isOmer, setIsOmer] = useState(false);
  const [requests, setRequests] = useState<CloseRequest[]>([]);
  const [guideNames, setGuideNames] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    // "רק אני מאשרת" — הכרטיס מוצג רק כשהמשתמש המחובר הוא עומר
    const myId = localStorage.getItem('portugo_guide_id');
    const myName = localStorage.getItem('portugo_guide_name');
    if (!myId || myName !== 'עומר') {
      setIsOmer(false);
      return;
    }
    setIsOmer(true);

    const { data: reqs, error } = await supabase
      .from('close_requests')
      .select('id, guide_id, year, month, expected_total, status, requested_at')
      .eq('status', 'pending')
      .order('requested_at', { ascending: true });
    if (error) {
      // הטבלה עוד לא קיימת (המיגרציה לא רצה) — לא מציגים כלום ולא שוברים את הדף
      setRequests([]);
      return;
    }
    setRequests((reqs || []) as CloseRequest[]);

    const { data: guides } = await supabase.from('guides').select('id, name');
    const map: Record<string, string> = {};
    (guides || []).forEach((g: { id: string; name: string }) => { map[g.id] = g.name; });
    setGuideNames(map);
  }, []);

  useEffect(() => {
    load();
    // בקשה שמגיעה כשהדשבורד כבר פתוח צריכה להופיע בלי רענון ידני
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  async function decide(req: CloseRequest, status: 'approved' | 'rejected') {
    setBusy(req.id);
    setErr('');
    // ההחלטה עוברת דרך השרת כדי שהמדריך.ה יקבל.תקבל מייל עדכון באותה פעולה
    try {
      const res = await fetch('/api/close-requests/decide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request_id: req.id,
          status,
          admin_note: notes[req.id]?.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'ההחלטה לא נשמרה');
      }
    } catch (e) {
      setBusy(null);
      setErr('משהו השתבש: ' + (e instanceof Error ? e.message : ''));
      return;
    }
    setBusy(null);
    await load();
    onChange?.();
  }

  if (!isOmer || requests.length === 0) return null;

  return (
    <section
      style={{
        background: '#eff6ff',
        border: '2px solid #93c5fd',
        borderRadius: 12,
        padding: 16,
        marginBottom: 8,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 15, color: '#1d4ed8', marginBottom: 10 }}>
        🔔 בקשות סגירת חודש ({requests.length})
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {requests.map((r) => (
          <div
            key={r.id}
            style={{
              background: '#fff',
              border: `1px solid ${ADMIN_COLORS.gray300}`,
              borderRadius: 10,
              padding: '10px 12px',
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div style={{ flex: '1 1 220px', minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 14 }}>
                {guideNames[r.guide_id] || '?'} · {monthName(r.year, r.month - 1)}
              </div>
              <div style={{ fontSize: 12, color: ADMIN_COLORS.gray500 }}>
                משכורת צפויה: <strong>{fmtEuro(r.expected_total)}</strong>
                {' · '}
                <a
                  href={`/admin/guides/${r.guide_id}/months/${r.year}/${r.month}`}
                  style={{ color: '#1d4ed8', textDecoration: 'underline' }}
                >
                  לפרטי החודש
                </a>
              </div>
            </div>
            <input
              type="text"
              value={notes[r.id] || ''}
              onChange={(e) => setNotes((p) => ({ ...p, [r.id]: e.target.value }))}
              placeholder="הערה (אופציונלי)"
              style={{
                flex: '2 1 160px',
                border: `1px solid ${ADMIN_COLORS.gray300}`,
                borderRadius: 8,
                padding: '6px 10px',
                fontSize: 13,
              }}
            />
            <button
              onClick={() => decide(r, 'approved')}
              disabled={busy === r.id}
              style={{
                background: '#15803d', color: '#fff', border: 'none', borderRadius: 8,
                padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              {busy === r.id ? '...' : 'אשרי ✓'}
            </button>
            <button
              onClick={() => decide(r, 'rejected')}
              disabled={busy === r.id}
              style={{
                background: '#fff', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 8,
                padding: '8px 14px', fontWeight: 700, fontSize: 13, cursor: 'pointer',
              }}
            >
              לא עכשיו
            </button>
          </div>
        ))}
      </div>
      {err && (
        <div style={{ marginTop: 8, fontSize: 13, color: '#b91c1c' }}>{err}</div>
      )}
    </section>
  );
}
