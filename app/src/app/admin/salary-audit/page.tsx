'use client';

/**
 * /admin/salary-audit — בדיקת פערי שכר בסיורים פרטיים.
 *
 * משווה לכל סיור פרטי שנרשם: מה המערכת שילמה בפועל מול מה שכתוב במסמכים
 * שהמדריכים מחזיקים בתיקיות שלהם. העמוד לא מחשב כלום בעצמו — הוא מציג את
 * מה שהשרת החזיר, כדי שלא ייווצר שוב העתק שלישי של המספרים.
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

type AuditRow = {
  tour_id: string;
  tour_date: string;
  guide: string;
  notes: string;
  people: number;
  matched: string[];
  system: number;
  declared: number | null;
  diff: number | null;
  unmatched: boolean;
  outsideRange: boolean;
};

type Summary = {
  total_private_tours: number;
  tours_with_gap: number;
  unmatched: number;
  overpaid_count: number;
  overpaid_total: number;
  underpaid_count: number;
  underpaid_total: number;
  net_total: number;
};

function eur(n: number): string {
  return `${n.toLocaleString('he-IL')}€`;
}

function signedEur(n: number): string {
  return `${n > 0 ? '+' : ''}${n.toLocaleString('he-IL')}€`;
}

function heDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function Card({
  label,
  value,
  tone = 'neutral',
  hint,
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'good' | 'warn' | 'bad';
  hint?: string;
}) {
  const toneClass =
    tone === 'good' ? 'text-green-700'
    : tone === 'warn' ? 'text-amber-700'
    : tone === 'bad' ? 'text-red-700'
    : 'text-gray-900';
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="text-sm text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
      {hint && <div className="text-xs text-gray-400 mt-1">{hint}</div>}
    </div>
  );
}

export default function SalaryAuditPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [unmatchedRows, setUnmatchedRows] = useState<AuditRow[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      if (!token) {
        if (!cancelled) {
          setError('נדרשת התחברות מחדש');
          setLoading(false);
        }
        return;
      }

      try {
        const res = await fetch('/api/admin/salary-audit', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (cancelled) return;
        if (!json.ok) {
          setError(json.error || 'לא הצלחנו לטעון את הבדיקה');
        } else {
          setSummary(json.summary);
          setRows(json.rows || []);
          setUnmatchedRows(json.unmatchedRows || []);
        }
      } catch {
        if (!cancelled) setError('לא הצלחנו לטעון את הבדיקה');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-green-900 mb-1">בדיקת פערי שכר בסיורים פרטיים</h1>
      <p className="text-sm text-gray-600 mb-6 leading-relaxed">
        משווה כל סיור פרטי שנרשם במערכת מול הטבלאות שבמסמכים שהמדריכים מחזיקים
        בתיקיות שלהם (הקבצים מ-4.12.2025). מוצגים רק סיורים שבהם יש פער.
      </p>

      {loading && <div className="text-gray-500">רגע, בודקת את כל הסיורים...</div>}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4">{error}</div>
      )}

      {summary && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card label="סיורים פרטיים שנבדקו" value={String(summary.total_private_tours)} />
            <Card
              label="סיורים עם פער"
              value={String(summary.tours_with_gap)}
              tone={summary.tours_with_gap > 0 ? 'warn' : 'good'}
            />
            <Card
              label="שולם ביתר"
              value={eur(summary.overpaid_total)}
              tone={summary.overpaid_total > 0 ? 'warn' : 'good'}
              hint={`${summary.overpaid_count} סיורים`}
            />
            <Card
              label="שולם בחסר"
              value={eur(Math.abs(summary.underpaid_total))}
              tone={summary.underpaid_total < 0 ? 'bad' : 'good'}
              hint={`${summary.underpaid_count} סיורים`}
            />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 mb-6">
            <div className="text-sm text-gray-500 mb-1">סך הכל, ההפרש המצטבר</div>
            <div className="text-3xl font-bold text-gray-900">{signedEur(summary.net_total)}</div>
            <div className="text-xs text-gray-400 mt-1">
              מספר חיובי = המערכת שילמה יותר ממה שהובטח במסמכים. שלילי = שילמה פחות.
            </div>
          </div>

          {rows.length === 0 ? (
            <div className="bg-green-50 border border-green-200 text-green-900 rounded-xl p-4">
              לא נמצא אף פער. המערכת והמסמכים מסכימים על כל סיור.
            </div>
          ) : (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-6">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-right font-semibold px-4 py-3">תאריך</th>
                      <th className="text-right font-semibold px-4 py-3">מדריך</th>
                      <th className="text-right font-semibold px-4 py-3">סוג הסיור</th>
                      <th className="text-right font-semibold px-4 py-3">אנשים</th>
                      <th className="text-right font-semibold px-4 py-3">לפי המסמך</th>
                      <th className="text-right font-semibold px-4 py-3">מה ששולם</th>
                      <th className="text-right font-semibold px-4 py-3">הפרש</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr key={r.tour_id} className="border-t border-gray-100">
                        <td className="px-4 py-3 whitespace-nowrap">{heDate(r.tour_date)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{r.guide}</td>
                        <td className="px-4 py-3">
                          {r.matched.join(' + ')}
                          {r.outsideRange && (
                            <span className="text-xs text-amber-700 mr-2">(מחוץ לטווח המסמך)</span>
                          )}
                        </td>
                        <td className="px-4 py-3">{r.people}</td>
                        <td className="px-4 py-3">{r.declared === null ? '—' : eur(r.declared)}</td>
                        <td className="px-4 py-3">{eur(r.system)}</td>
                        <td
                          className={`px-4 py-3 font-bold ${
                            (r.diff || 0) > 0 ? 'text-amber-700' : 'text-red-700'
                          }`}
                        >
                          {r.diff === null ? '—' : signedEur(r.diff)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {unmatchedRows.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
              <h2 className="text-lg font-bold text-green-900 mb-1">
                סיורים שלא זוהה בהם סוג ({unmatchedRows.length})
              </h2>
              <p className="text-sm text-gray-600 mb-4">
                בהערות של הסיורים האלה אין אף מילה שהמערכת מזהה, ולכן היא שילמה
                לפי טבלת הקלאסי כברירת מחדל. שווה לעבור עליהם ידנית.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-right font-semibold px-4 py-3">תאריך</th>
                      <th className="text-right font-semibold px-4 py-3">מדריך</th>
                      <th className="text-right font-semibold px-4 py-3">מה נכתב בהערות</th>
                      <th className="text-right font-semibold px-4 py-3">אנשים</th>
                      <th className="text-right font-semibold px-4 py-3">מה ששולם</th>
                    </tr>
                  </thead>
                  <tbody>
                    {unmatchedRows.map((r) => (
                      <tr key={r.tour_id} className="border-t border-gray-100">
                        <td className="px-4 py-3 whitespace-nowrap">{heDate(r.tour_date)}</td>
                        <td className="px-4 py-3 whitespace-nowrap">{r.guide}</td>
                        <td className="px-4 py-3 text-gray-500">{r.notes || '(ריק)'}</td>
                        <td className="px-4 py-3">{r.people}</td>
                        <td className="px-4 py-3">{eur(r.system)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
