'use client';

/**
 * /admin/pricing-validation — דף "רווחיות סיורים יומיים".
 *
 * המקור: portugo-pricing-validation.html (גרסה 3, 4.5.26).
 * הdata יושבת ב-lib/pricing-validation-data.ts כדי שעדכוני מודל
 * (שינוי מספרים, תוספת סיור) יהיו בקובץ אחד נפרד מהתצוגה.
 *
 * תצוגה:
 *   - דסקטופ: טבלאות מלאות עם 8-9 עמודות
 *   - מובייל: כרטיסיות (כל שורה = כרטיס עם רווח לכל ספק + accordion לפרטים)
 */

import { useState } from 'react';
import {
  TOURS,
  SUMMARY_CARDS,
  INSIGHTS,
  PRICING_VALIDATION_VERSION,
  PRICING_VALIDATION_UPDATED,
  type Tour,
  type Scenario,
  type ScenarioRow,
  type ProfitCell,
} from '@/lib/pricing-validation-data';

function fmtEuro(n: number): string {
  return `${n.toLocaleString('he-IL')}€`;
}

function fmtSignedEuro(n: number): string {
  if (n > 0) return `+${n.toLocaleString('he-IL')}€`;
  if (n < 0) return `−${Math.abs(n).toLocaleString('he-IL')}€`;
  return '0€';
}

function profitCellClasses(cell: ProfitCell): string {
  if (cell.kind === 'profit') return 'bg-green-50 text-green-800 font-bold';
  if (cell.kind === 'marginal') return 'bg-amber-50 text-amber-700 font-bold';
  if (cell.kind === 'loss') return 'bg-red-50 text-red-700 font-bold';
  return 'text-gray-400 italic'; // na
}

function profitCellText(cell: ProfitCell): string {
  if (cell.kind === 'na') return cell.text;
  return fmtSignedEuro(cell.amount);
}

export default function PricingValidationPage() {
  return (
    <div className="max-w-[1200px] mx-auto" dir="rtl">
      {/* Header */}
      <header className="mb-6">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-1">
          רווחיות סיורים יומיים — שני ספקים בעין אחת
        </h1>
        <p className="text-sm text-gray-500">
          סינטרה · אראבידה · אובידוש · דורו · עודכן: {PRICING_VALIDATION_UPDATED}
        </p>
      </header>

      {/* Assumptions */}
      <div className="bg-emerald-50 border-r-4 border-emerald-500 rounded-md p-4 mb-7 text-sm">
        <p className="text-emerald-900">
          <strong>איך לקרוא את הטבלאות:</strong>{' '}
          בכל שורה תראי <strong>שני ערכי רווח/הפסד זה לצד זה</strong> — אחד עם הספק הזול, אחד עם הספק היקר.
          ככה רואים בעין אחת את שתי האפשרויות: כשהזול זמין → רווח גבוה. כשרק היקר זמין → רווח נמוך או הפסד.
        </p>
        <p className="mt-2 text-emerald-900 flex flex-wrap items-center gap-2">
          צביעת תאים:{' '}
          <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-semibold text-xs">הפסד (אדום)</span>
          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold text-xs">רווח שולי (צהוב)</span>
          <span className="px-2 py-0.5 rounded bg-green-50 text-green-800 font-semibold text-xs">רווח (ירוק)</span>
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-9">
        {SUMMARY_CARDS.map((c, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
            <h3 className="text-base font-bold text-slate-800 mb-3">{c.title}</h3>
            <div className="space-y-1">
              {c.rows.map((r, j) => (
                <div key={j} className="flex justify-between text-xs">
                  <span className="text-gray-500">{r.label}</span>
                  <span className="font-semibold text-gray-900">{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Tour sections */}
      {TOURS.map((tour) => (
        <TourSection key={tour.slug} tour={tour} />
      ))}

      {/* Insights */}
      <div className="bg-sky-50 border-r-4 border-sky-600 rounded-md p-4 md:p-5 mt-7 text-sm">
        <h3 className="text-base font-bold text-sky-900 mt-0 mb-2">תובנות מרכזיות</h3>
        <ul className="space-y-2 pr-5 list-disc text-gray-800">
          {INSIGHTS.map((ins, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: ins.html }} />
          ))}
        </ul>
      </div>

      <div className="text-center text-xs text-gray-400 mt-7 mb-4">
        פורטוגו · מודל תמחור · גרסה {PRICING_VALIDATION_VERSION} (שני ספקים גלוי) · {PRICING_VALIDATION_UPDATED}
      </div>
    </div>
  );
}

// ─── Tour section ─────────────────────────────────────────────────────────
function TourSection({ tour }: { tour: Tour }) {
  const [activeScenarioId, setActiveScenarioId] = useState(tour.scenarios[0].id);
  const activeScenario = tour.scenarios.find((s) => s.id === activeScenarioId) ?? tour.scenarios[0];

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 mb-6 shadow-sm">
      <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-1">{tour.name}</h2>
      <p className="text-sm text-gray-600 mb-1">{tour.priceInfo}</p>
      {tour.priceInfoExtra && (
        <p className="text-xs text-gray-500 mb-3">{tour.priceInfoExtra}</p>
      )}

      {/* Mini table */}
      <div className="my-4">
        <h4 className="text-sm font-semibold text-slate-600 mb-2">{tour.miniTable.label}</h4>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 max-w-2xl overflow-x-auto">
          <table className="text-xs md:text-sm w-full">
            <thead>
              <tr className="text-right text-slate-600">
                <th className="bg-slate-100 px-2 py-1.5 font-semibold">גודל</th>
                {tour.miniTable.columns.map((c, i) => (
                  <th key={i} className="bg-slate-100 px-2 py-1.5 font-semibold">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tour.miniTable.rows.map((r, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-2 py-1.5 font-bold">{r.size}</td>
                  {r.values.map((v, j) => (
                    <td key={j} className="px-2 py-1.5">{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scenario tabs */}
      <div className="flex flex-wrap gap-2 mb-3">
        {tour.scenarios.map((s) => {
          const active = s.id === activeScenarioId;
          return (
            <button
              key={s.id}
              onClick={() => setActiveScenarioId(s.id)}
              className={`px-3 py-1.5 text-xs md:text-sm rounded-full border transition-all ${
                active
                  ? 'bg-slate-700 text-white border-slate-700'
                  : 'bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200'
              }`}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      {/* Scenario table — desktop */}
      <div className="hidden md:block overflow-x-auto">
        <ScenarioTable tour={tour} scenario={activeScenario} />
      </div>

      {/* Scenario cards — mobile */}
      <div className="md:hidden space-y-2 mt-2">
        {activeScenario.rows.map((row) => (
          <ScenarioMobileCard key={row.size} tour={tour} row={row} />
        ))}
      </div>
    </section>
  );
}

// ─── Desktop table ────────────────────────────────────────────────────────
function ScenarioTable({ tour, scenario }: { tour: Tour; scenario: Scenario }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="text-right text-slate-600">
          <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">גודל</th>
          <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">הכנסה</th>
          <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">שכר</th>
          <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">{tour.attractionLabel}</th>
          {tour.hasCruise && (
            <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">שייט</th>
          )}
          <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">אשל</th>
          <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">{tour.hasCruise ? 'רכב' : 'רכב פ / מ'}</th>
          <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">רווח · {tour.supplierLabelA}</th>
          <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">רווח · {tour.supplierLabelB}</th>
        </tr>
      </thead>
      <tbody>
        {scenario.rows.map((row) => (
          <tr key={row.size} className="border-b border-gray-100">
            <td className="px-2.5 py-2.5 font-bold">{row.size}</td>
            <td className="px-2.5 py-2.5">{fmtEuro(row.income)}</td>
            <td className="px-2.5 py-2.5">{fmtEuro(row.guideSalary)}</td>
            <td className="px-2.5 py-2.5">{fmtEuro(row.attractionCost)}</td>
            {tour.hasCruise && (
              <td className="px-2.5 py-2.5">{row.cruiseCost !== undefined ? fmtEuro(row.cruiseCost) : '—'}</td>
            )}
            <td className="px-2.5 py-2.5">{fmtEuro(row.daily)}</td>
            <td className="px-2.5 py-2.5 text-xs text-slate-600 ltr text-right" dir="ltr">{row.carText}</td>
            <td className={`px-2.5 py-2.5 ${profitCellClasses(row.profitA)}`}>
              {row.profitA.kind === 'na' ? (
                <span className="text-center block">{row.profitA.text}</span>
              ) : (
                profitCellText(row.profitA)
              )}
            </td>
            <td className={`px-2.5 py-2.5 ${profitCellClasses(row.profitB)}`}>
              {row.profitB.kind === 'na' ? (
                <span className="text-center block">{row.profitB.text}</span>
              ) : (
                profitCellText(row.profitB)
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Mobile card (one per row) ────────────────────────────────────────────
function ScenarioMobileCard({ tour, row }: { tour: Tour; row: ScenarioRow }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
      {/* Header row: size + income */}
      <div className="flex justify-between items-baseline mb-2">
        <div>
          <span className="text-xs text-gray-500">קבוצה</span>{' '}
          <span className="text-2xl font-bold text-slate-800">{row.size}</span>
        </div>
        <div className="text-sm">
          <span className="text-gray-500">הכנסה </span>
          <span className="font-bold text-slate-800">{fmtEuro(row.income)}</span>
        </div>
      </div>

      {/* Two profit cells */}
      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-lg p-2 text-center ${profitCellClasses(row.profitA)}`}>
          <div className="text-[11px] opacity-80 font-normal">{tour.supplierLabelA}</div>
          <div className="text-base mt-0.5">{profitCellText(row.profitA)}</div>
        </div>
        <div className={`rounded-lg p-2 text-center ${profitCellClasses(row.profitB)}`}>
          <div className="text-[11px] opacity-80 font-normal">{tour.supplierLabelB}</div>
          <div className="text-base mt-0.5">{profitCellText(row.profitB)}</div>
        </div>
      </div>

      {/* Details — collapsed accordion */}
      <details className="mt-2 text-xs text-gray-600">
        <summary className="cursor-pointer text-gray-500 hover:text-gray-700">פרטי עלויות</summary>
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
          <div><span className="text-gray-400">שכר:</span> {fmtEuro(row.guideSalary)}</div>
          <div><span className="text-gray-400">{tour.attractionLabel}:</span> {fmtEuro(row.attractionCost)}</div>
          {tour.hasCruise && row.cruiseCost !== undefined && (
            <div><span className="text-gray-400">שייט:</span> {fmtEuro(row.cruiseCost)}</div>
          )}
          <div><span className="text-gray-400">אשל:</span> {fmtEuro(row.daily)}</div>
          <div className="col-span-2" dir="ltr">
            <span className="text-gray-400">רכב:</span> {row.carText}
          </div>
        </div>
      </details>
    </div>
  );
}
