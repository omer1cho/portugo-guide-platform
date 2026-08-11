'use client';

/**
 * /admin/salary-tables — טבלאות שכר מדריכים (צד מנהל בלבד).
 *
 * העיקרון: העמוד לא מחזיק העתק של המספרים — הוא מפעיל את מחשבון השכר
 * האמיתי (calcClassicSalary / calcFixedSalary / טבלאות הפרטיים / תעריפי
 * ההכשרות) ומציג את התוצאות. שינוי כלל במחשבון מתעדכן כאן אוטומטית.
 *
 * נתונים פר-מדריך (תעריף הפרשה, נסיעות, מע"מ, רכיב ניהול) נטענים חי
 * מטבלת המדריכים.
 */

import { useEffect, useState } from 'react';
import {
  calcClassicSalary,
  calcFixedSalary,
  PRIVATE_SALARY_TABLES,
} from '@/lib/salary';
import {
  supabase,
  trainingLeadBase,
  trainingLeadIsFullDay,
  TRAINING_LEAD_TOUR_OPTIONS,
  type TrainingLeadKind,
} from '@/lib/supabase';

type GuideRow = {
  id: string;
  name: string;
  city: 'lisbon' | 'porto';
  is_active: boolean | null;
  classic_transfer_per_person: number | null;
  travel_type: string | null;
  travel_monthly_amount: number | null;
  travel_daily_amount: number | null;
  has_vat: boolean | null;
  has_mgmt_bonus: boolean | null;
  mgmt_bonus_amount: number | null;
};

const CLASSIC_SIZES = [1, 2, 3, 4, 5, 8, 10, 12, 13, 16, 20, 22, 23, 28, 32, 33, 40];
const FIXED_SIZES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 15];
const FIXED_TOURS: Array<{ type: string; label: string }> = [
  { type: 'בלם_1', label: 'בלם' },
  { type: 'סינטרה', label: 'סינטרה / אראבידה / אובידוש' },
  { type: 'קולינרי', label: 'קולינרי' },
  { type: 'טעימות', label: 'טעימות' },
  { type: 'יינות', label: 'יינות (ישן)' },
  { type: 'דורו', label: 'דורו' },
];

function eur(n: number): string {
  return `${n.toLocaleString('he-IL')}€`;
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
      <h2 className="text-xl font-bold text-green-900 mb-1">{title}</h2>
      {sub && <p className="text-sm text-gray-500 mb-4">{sub}</p>}
      {children}
    </section>
  );
}

const th = 'px-3 py-2 text-right text-xs font-bold text-gray-600 bg-gray-50';
const td = 'px-3 py-2 text-sm text-gray-800 font-mono';

export default function SalaryTablesPage() {
  const [guides, setGuides] = useState<GuideRow[]>([]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('guides')
        .select('id, name, city, is_active, classic_transfer_per_person, travel_type, travel_monthly_amount, travel_daily_amount, has_vat, has_mgmt_bonus, mgmt_bonus_amount')
        .eq('is_active', true)
        .order('name');
      setGuides((data || []) as GuideRow[]);
    }
    load();
  }, []);

  const veterans = guides.filter((g) => (g.classic_transfer_per_person ?? 10) === 10);
  const newRate = guides.filter((g) => (g.classic_transfer_per_person ?? 10) !== 10);
  const monthlyTravel = guides.filter((g) => g.travel_type === 'monthly');
  const dailyTravel = guides.filter((g) => g.travel_type !== 'monthly');
  const vatGuides = guides.filter((g) => g.has_vat);
  const mgmtGuides = guides.filter((g) => g.has_mgmt_bonus);

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 p-4 sm:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <a href="/admin" className="text-sm text-green-700 hover:underline">← חזרה לדשבורד</a>
        <h1 className="text-2xl font-bold text-green-900 mt-2">💶 טבלאות שכר מדריכים</h1>
        <p className="text-sm text-gray-500">
          העמוד מציג את התוצאות של מחשבון השכר עצמו — כל שינוי בכללים מתעדכן כאן אוטומטית. צד מנהל בלבד.
        </p>
      </div>

      <Section
        title="🎫 קלאסי (ליסבון + פורטו — אותה נוסחה)"
        sub='free tour: הלקוח משלם טיפ. המדריך מפריש לפורטוגו לפי מספר המשלמים (ילדים עד 10 חינם) ומקבל בסיס. שכר המדריך = טיפים − הפרשה + בסיס.'
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>משלמים</th>
                <th className={th}>הפרשה · ותיקים (10€)</th>
                <th className={th}>הפרשה · חדשים (11€)</th>
                <th className={th}>בסיס למדריך</th>
              </tr>
            </thead>
            <tbody>
              {CLASSIC_SIZES.map((n) => {
                const r10 = calcClassicSalary(n, 0, 10, 100000);
                const r11 = calcClassicSalary(n, 0, 11, 100000);
                return (
                  <tr key={n} className="border-b border-gray-100">
                    <td className={`${td} font-bold`}>{n}</td>
                    <td className={td}>{eur(r10.transfer)}</td>
                    <td className={td}>{eur(r11.transfer)}</td>
                    <td className={td}>{r10.base > 0 ? eur(r10.base) : '— אין בסיס'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-sm text-gray-700 space-y-1 bg-green-50 rounded-xl p-4">
          <p><strong>בודד:</strong> הפרשה 5€ קבועה לכולם, בלי בסיס. <strong>זוג:</strong> התעריף פעם אחת, בלי בסיס.</p>
          <p><strong>בסיס מובטח:</strong> אם הטיפים שנאספו נמוכים מההפרשה — ההפרשה נחתכת למה שנאסף, והבסיס משולם במלואו.</p>
          <p>
            <strong>תעריף 10€ (ותיקים):</strong> {veterans.map((g) => g.name).join(', ') || '—'}
            {' · '}
            <strong>תעריף 11€ (חדשים):</strong> {newRate.map((g) => `${g.name} (${g.classic_transfer_per_person}€)`).join(', ') || '—'}
          </p>
        </div>
      </Section>

      <Section
        title="🚌 סיורים בשכר קבוע"
        sub="שכר המדריך לפי סוג הסיור וגודל הקבוצה. טיפים בסיורים אלה הולכים ישירות למדריך (לא דרך הקופה)."
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>משתתפים</th>
                {FIXED_TOURS.map((t) => (
                  <th key={t.type} className={th}>{t.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIXED_SIZES.map((n) => (
                <tr key={n} className="border-b border-gray-100">
                  <td className={`${td} font-bold`}>{n}</td>
                  {FIXED_TOURS.map((t) => (
                    <td key={t.type} className={td}>{eur(calcFixedSalary(t.type, n))}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-500">מעל הגדלים המוצגים הנוסחה ממשיכה (1€ נוסף לאדם). הברזה בכיכר: 8€.</p>
      </Section>

      <Section
        title="⭐ סיורים פרטיים — טבלאות לוקאפ"
        sub='שכר המדריך לפי גודל הקבוצה. שילוב (למשל קלאסי+בלם) = סכום שתי הטבלאות. סיור יהדות פרטי משלם לפי טבלת בלם.'
      >
        <div className="grid sm:grid-cols-2 gap-6">
          {PRIVATE_SALARY_TABLES.map((tbl) => (
            <div key={tbl.label}>
              <h3 className="font-bold text-sm text-gray-800 mb-2">{tbl.label}</h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className={th}>עד … משתתפים</th>
                    <th className={th}>שכר</th>
                  </tr>
                </thead>
                <tbody>
                  {tbl.tiers.map(([maxP, sal], i) => {
                    const prev = i === 0 ? 0 : tbl.tiers[i - 1][0];
                    return (
                      <tr key={maxP} className="border-b border-gray-100">
                        <td className={td}>{prev + 1 === maxP ? maxP : `${prev + 1}-${maxP}`}</td>
                        <td className={td}>{eur(sal)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </Section>

      <Section
        title="🎓 הכשרות שהעברתי (מדריכים בכירים)"
        sub="התעריף למדריך בכיר שמעביר הכשרה. בסיורי יום מלא (סינטרה/אראבידה/אובידוש/דורו) מתווסף אשל 15€ אוטומטית."
      >
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className={th}>סיור</th>
                <th className={th}>נסיון דפים</th>
                <th className={th}>תצפות</th>
                <th className={th}>אשל</th>
              </tr>
            </thead>
            <tbody>
              {TRAINING_LEAD_TOUR_OPTIONS.map((opt) => (
                <tr key={opt.value} className="border-b border-gray-100">
                  <td className={`${td} font-bold`}>{opt.label}</td>
                  <td className={td}>{eur(trainingLeadBase('paper' as TrainingLeadKind, opt.value))}</td>
                  <td className={td}>{eur(trainingLeadBase('observation' as TrainingLeadKind, opt.value))}</td>
                  <td className={td}>{trainingLeadIsFullDay(opt.value) ? '+15€' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-gray-500">צד החניך.ה: פעילות הכשרה = 10€.</p>
      </Section>

      <Section title="➕ תוספות קבועות" sub="">
        <div className="space-y-2 text-sm text-gray-700">
          <p><strong>אשל יומי:</strong> 15€ ליום עבודה מלא (סיור יום מלא, או שני סיורים באותו יום). מחושב אוטומטית.</p>
          <p><strong>הברזה בכיכר:</strong> 8€ · <strong>פעילות הכשרה (חניך.ה):</strong> 10€ · <strong>פעילות חיצונית:</strong> סכום ידני.</p>
          <p>
            <strong>חופשי חודשי:</strong> {monthlyTravel.map((g) => `${g.name} (${eur(g.travel_monthly_amount ?? 30)})`).join(', ') || '—'}
            {' · '}
            <strong>נסיעות ליום עבודה:</strong> {dailyTravel.map((g) => `${g.name} (${eur(g.travel_daily_amount ?? 3)})`).join(', ') || '—'}
          </p>
          <p>
            <strong>רכיב ניהול:</strong> {mgmtGuides.map((g) => `${g.name} (${eur(g.mgmt_bonus_amount || 0)}/חודש)`).join(', ') || '—'}
            {' · '}
            <strong>מע"מ 23% על הקבלה:</strong> {vatGuides.map((g) => g.name).join(', ') || '—'}
          </p>
        </div>
      </Section>

      <Section
        title="🧾 מה נכנס לקבלת המס (Fatura-Recibo)"
        sub=""
      >
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div className="bg-green-50 rounded-xl p-4">
            <p className="font-bold text-green-900 mb-2">✓ כן על הקבלה</p>
            <ul className="list-disc pr-5 space-y-1 text-gray-700">
              <li>בסיס מהקלאסי (רק הבסיס!)</li>
              <li>שכר סיורים קבועים ופרטיים</li>
              <li>אשל יומי, הברזה, הכשרות (שני הצדדים)</li>
              <li>החזרי נסיעות ורכיב ניהול</li>
            </ul>
          </div>
          <div className="bg-red-50 rounded-xl p-4">
            <p className="font-bold text-red-900 mb-2">✗ לא על הקבלה</p>
            <ul className="list-disc pr-5 space-y-1 text-gray-700">
              <li>ההפרשה מהקלאסי (כסף של פורטוגו)</li>
              <li>טיפים — מהקלאסי ומכל סיור אחר</li>
              <li>החזרי הוצאות (ממעטפת ההוצאות)</li>
            </ul>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-500">למדריכים עם מע"מ: הקבלה + 23%, ופורטוגו מחזירה את המע"מ בהעברה.</p>
      </Section>
    </div>
  );
}
