'use client';

/**
 * /admin/consultations — רשימת כל פניות הייעוץ.
 *
 * שורה אחת לכל פניה: שם, טלפון, תאריך מילוי, סטטוס.
 * לחיצה על שורה מובילה ל-/admin/consultations/[id].
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { ADMIN_COLORS } from '@/lib/admin/theme';
import { ConsultationRow, statusLabel, statusColor } from '@/lib/consultation';

type FilterStatus = 'all' | ConsultationRow['status'];

export default function ConsultationsListPage() {
  const [rows, setRows] = useState<ConsultationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const { data, error } = await supabase
        .from('consultations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);

      if (cancelled) return;
      if (error) {
        setError(error.message);
      } else {
        setRows((data as ConsultationRow[]) || []);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const filteredRows = rows.filter(r => {
    if (filter !== 'all' && r.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!r.full_name.toLowerCase().includes(q) &&
          !(r.phone || '').toLowerCase().includes(q) &&
          !(r.email || '').toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  const newCount = rows.filter(r => r.status === 'new').length;

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: ADMIN_COLORS.green800, margin: 0 }}>
          פניות ייעוץ מסלול 🌸
        </h1>
        <p style={{ fontSize: 14, color: ADMIN_COLORS.gray500, marginTop: 4 }}>
          {rows.length === 0 ? 'אין פניות עדיין' :
            `סה"כ ${rows.length} פניות · ${newCount > 0 ? `${newCount} חדשות ממתינות` : 'הכל בטיפול'}`}
        </p>
      </header>

      {/* פילטרים */}
      <div style={{
        background: ADMIN_COLORS.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        display: 'flex',
        gap: 12,
        flexWrap: 'wrap',
        alignItems: 'center',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      }}>
        <input
          type="text"
          placeholder="חיפוש לפי שם, טלפון או מייל..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: '1 1 220px',
            padding: '10px 14px',
            border: `1px solid ${ADMIN_COLORS.gray300}`,
            borderRadius: 8,
            fontSize: 14,
            fontFamily: 'inherit',
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'new', 'in_progress', 'scheduled', 'done'] as const).map(s => (
            <FilterChip
              key={s}
              active={filter === s}
              onClick={() => setFilter(s)}
              label={s === 'all' ? 'הכל' : statusLabel(s)}
              count={s === 'all' ? rows.length : rows.filter(r => r.status === s).length}
            />
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: 'center', padding: 60, color: ADMIN_COLORS.gray500 }}>
          טוענים פניות...
        </div>
      )}

      {error && (
        <div style={{
          background: '#fef2f2',
          color: ADMIN_COLORS.red,
          padding: 16,
          borderRadius: 10,
          border: `1px solid ${ADMIN_COLORS.red}`,
        }}>
          שגיאה בטעינה: {error}
        </div>
      )}

      {!loading && !error && filteredRows.length === 0 && (
        <div style={{
          background: ADMIN_COLORS.white,
          borderRadius: 12,
          padding: 60,
          textAlign: 'center',
          color: ADMIN_COLORS.gray500,
          fontSize: 16,
        }}>
          {rows.length === 0
            ? '🌸 עוד אין פניות. ברגע שלקוח ימלא את השאלון, הוא יופיע פה.'
            : 'אין פניות שמתאימות לסינון הנוכחי.'}
        </div>
      )}

      {!loading && !error && filteredRows.length > 0 && (
        <div style={{
          background: ADMIN_COLORS.white,
          borderRadius: 12,
          overflow: 'hidden',
          boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: ADMIN_COLORS.green25 }}>
                <Th>שם</Th>
                <Th>טלפון</Th>
                <Th>אימייל</Th>
                <Th>תאריך מילוי</Th>
                <Th>סטטוס</Th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r, i) => (
                <tr
                  key={r.id}
                  style={{
                    borderTop: i === 0 ? 'none' : `1px solid ${ADMIN_COLORS.gray100}`,
                    cursor: 'pointer',
                    transition: 'background 100ms',
                  }}
                >
                  <Td><Link href={`/admin/consultations/${r.id}`} style={cellLink}>{r.full_name}</Link></Td>
                  <Td><Link href={`/admin/consultations/${r.id}`} style={cellLink}>{r.phone}</Link></Td>
                  <Td><Link href={`/admin/consultations/${r.id}`} style={{ ...cellLink, direction: 'ltr', display: 'inline-block' }}>{r.email}</Link></Td>
                  <Td>
                    <Link href={`/admin/consultations/${r.id}`} style={cellLink}>
                      {formatDate(r.created_at)}
                    </Link>
                  </Td>
                  <Td>
                    <Link href={`/admin/consultations/${r.id}`} style={{ textDecoration: 'none' }}>
                      <span style={{
                        display: 'inline-block',
                        padding: '4px 12px',
                        background: statusColor(r.status),
                        color: '#fff',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                      }}>
                        {statusLabel(r.status)}
                      </span>
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th style={{
      padding: '12px 16px',
      textAlign: 'right',
      fontSize: 13,
      fontWeight: 600,
      color: ADMIN_COLORS.green800,
    }}>
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return (
    <td style={{
      padding: '14px 16px',
      fontSize: 14,
      color: ADMIN_COLORS.gray900,
      verticalAlign: 'middle',
    }}>
      {children}
    </td>
  );
}

const cellLink: React.CSSProperties = {
  color: 'inherit',
  textDecoration: 'none',
  display: 'block',
};

function FilterChip({ active, onClick, label, count }: { active: boolean; onClick: () => void; label: string; count: number }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        background: active ? ADMIN_COLORS.green700 : ADMIN_COLORS.gray100,
        color: active ? '#fff' : ADMIN_COLORS.gray700,
        border: 'none',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {label}
      <span style={{
        background: active ? 'rgba(255,255,255,0.25)' : ADMIN_COLORS.gray300,
        color: active ? '#fff' : ADMIN_COLORS.gray700,
        padding: '1px 8px',
        borderRadius: 999,
        fontSize: 11,
      }}>
        {count}
      </span>
    </button>
  );
}

function formatDate(s: string): string {
  const d = new Date(s);
  return d.toLocaleString('he-IL', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
