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
  TASTING_TOURS,
  CLASSIC_TOURS,
  SUMMARY_CARDS,
  TASTING_SUMMARY_CARDS,
  CLASSIC_SUMMARY_CARDS,
  INSIGHTS,
  PRICING_VALIDATION_VERSION,
  PRICING_VALIDATION_UPDATED,
  type Tour,
  type TastingTour,
  type ClassicTour,
  type Scenario,
  type ScenarioRow,
  type TastingScenarioRow,
  type ClassicScenarioRow,
  type ProfitCell,
} from '@/lib/pricing-validation-data';
import {
  PRIVATE_TOURS,
  type PrivateTour,
  type PrivatePriceTable,
  type CarAddonTable,
  type ComboTable,
  type ChildrenPriceTable,
} from '@/lib/pricing-validation-private-data';

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
      <header className="mb-4">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-1">
          רווחיות סיורים — אימות תמחור
        </h1>
        <p className="text-sm text-gray-500">
          סינטרה · אראבידה · אובידוש · דורו · בלם · קולינרי בוקר · קולינרי צהריים · טעימות פורטו · ליסבון/פורטו הקלאסיות · סיורים פרטיים · עודכן: {PRICING_VALIDATION_UPDATED}
        </p>
      </header>

      {/* Sticky table of contents — קופצים לסקציה הרצויה */}
      <nav className="sticky top-0 z-30 -mx-2 px-2 py-2 mb-5 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm">
        <div className="flex flex-wrap gap-1.5 text-xs md:text-sm">
          <span className="text-gray-400 self-center pl-1">קפיצה ל-</span>
          <a href="#sec-daily" className="px-3 py-1 rounded-full bg-sky-50 text-sky-900 border border-sky-200 hover:bg-sky-100 transition">סיורים יומיים</a>
          <a href="#sec-city" className="px-3 py-1 rounded-full bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 transition">סיורים בעיר</a>
          <a href="#sec-classic" className="px-3 py-1 rounded-full bg-rose-50 text-rose-900 border border-rose-200 hover:bg-rose-100 transition">קלאסיים</a>
          <a href="#sec-private" className="px-3 py-1 rounded-full bg-purple-50 text-purple-900 border border-purple-300 hover:bg-purple-100 transition font-semibold">סיורים פרטיים ⭐</a>
          <a href="#sec-insights" className="px-3 py-1 rounded-full bg-slate-50 text-slate-700 border border-slate-200 hover:bg-slate-100 transition">תובנות</a>
        </div>
      </nav>

      {/* Assumptions */}
      <div className="bg-emerald-50 border-r-4 border-emerald-500 rounded-md p-4 mb-7 text-sm">
        <p className="text-emerald-900">
          <strong>איך לקרוא את הטבלאות:</strong>
        </p>
        <p className="text-emerald-900 mt-1">
          <strong>סיורים יומיים</strong> (סינטרה, אראבידה, אובידוש, דורו): שני ערכי רווח/הפסד זה לצד זה — ספק זול / ספק יקר. כך רואים בעין אחת את שתי האפשרויות.
        </p>
        <p className="text-emerald-900 mt-1">
          <strong>סיורים בעיר</strong> (בלם, קולינרי בוקר/צהריים, טעימות פורטו): טור רווח אחד — אין השוואת ספקים, אבל יש פירוט עלויות (מוצרים לאדם + פריטים משותפים).
        </p>
        <p className="text-emerald-900 mt-1">
          <strong>סיורים קלאסיים</strong> (ליסבון, פורטו): מודל סיור חינמי — אין מחיר ללקוח, רק transfer של המדריך לחברה. שתי עמודות רווח: מדריך רגיל (10€/ראש) ומדריך חדש (11€/ראש).
        </p>
        <p className="text-emerald-900 mt-1">
          <strong>סיורים פרטיים</strong>: כל כרטיס = סיור פרטי אחד עם הכל בפנים — מחיר רגיל, אופציה מקוצרת, תוספת רכב, שילובים, ותמחור ילדים. רכב מתומחר תמיד לפי פרדאוטו (worst case).
        </p>
        <p className="mt-2 text-emerald-900 flex flex-wrap items-center gap-2">
          צביעת תאים:{' '}
          <span className="px-2 py-0.5 rounded bg-red-50 text-red-700 font-semibold text-xs">הפסד (אדום)</span>
          <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-semibold text-xs">רווח שולי (צהוב)</span>
          <span className="px-2 py-0.5 rounded bg-green-50 text-green-800 font-semibold text-xs">רווח (ירוק)</span>
        </p>
      </div>

      {/* ─── Daily tours section ─── */}
      <h2 id="sec-daily" className="text-lg md:text-xl font-bold text-slate-800 border-b-2 border-gray-200 pb-2 mt-2 mb-1 scroll-mt-20">
        סיורים יומיים — תלויי רכב
      </h2>
      <p className="text-xs text-gray-600 mb-5">
        השוואת ספקי רכב (פרדאוטו / מורטה בליסבון · איבורבס-ז&apos;ורז&apos; / אנטורס בפורטו) — בחירת ספק היא הגורם הקריטי לרווחיות
      </p>

      {/* Daily summary cards */}
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

      {/* Daily tour sections */}
      {TOURS.map((tour) => (
        <TourSection key={tour.slug} tour={tour} />
      ))}

      {/* ─── City tours section ─── */}
      <h2 id="sec-city" className="text-lg md:text-xl font-bold text-slate-800 border-b-2 border-gray-200 pb-2 mt-12 mb-1 scroll-mt-20">
        סיורים בעיר
      </h2>
      <p className="text-xs text-gray-600 mb-5">
        בלם · קולינרי בוקר · קולינרי צהריים · טעימות פורטו · ללא רכב, עיקר העלות: שכר + מוצרים לאדם + פריטים משותפים. אין השוואת ספקים, אבל יש רגישות לגודל קבוצה דרך פריטים שמתחלקים (מגש גבינות, פאו דה קז&apos;ו, יין ירוק, גווארנה)
      </p>

      {/* Tasting summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-9">
        {TASTING_SUMMARY_CARDS.map((c, i) => (
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

      {/* Tasting tour sections */}
      {TASTING_TOURS.map((tour) => (
        <TastingSection key={tour.slug} tour={tour} />
      ))}

      {/* ─── Classic tours section ─── */}
      <h2 id="sec-classic" className="text-lg md:text-xl font-bold text-slate-800 border-b-2 border-gray-200 pb-2 mt-12 mb-1 scroll-mt-20">
        סיורים קלאסיים — מודל סיור חינמי
      </h2>
      <p className="text-xs text-gray-600 mb-5">
        ליסבון + פורטו · אותו מודל לשתי הערים. אין מחיר ללקוח, הלקוח משלם רק טיפ. ההכנסה לחברה = transfer של המדריך × N (ילדים מתחת ל-10 חינם). העלות לחברה = שכר בסיס שהחברה משלמת למדריך. שתי עמודות רווח זו לצד זו: מדריך רגיל (10€/ראש) ומדריך חדש (11€/ראש).
      </p>

      {/* Classic summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-9">
        {CLASSIC_SUMMARY_CARDS.map((c, i) => (
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

      {/* Classic tour sections */}
      {CLASSIC_TOURS.map((tour) => (
        <ClassicSection key={tour.slug} tour={tour} />
      ))}

      {/* ─── Private tours section ─── */}
      <h2 id="sec-private" className="text-lg md:text-xl font-bold text-slate-800 border-b-2 border-gray-200 pb-2 mt-12 mb-1 scroll-mt-20">
        סיורים פרטיים
      </h2>
      <p className="text-xs text-gray-600 mb-5">
        תמחור פרטי לפי קטגוריות גודל קבוצה. כל כרטיס מכיל את הכל על אותו סיור: מחיר רגיל, אופציה מקוצרת (אם יש), תוספת רכב (אם רלוונטי), שילובים שכוללים אותו, ותמחור ילדים. בכל מקרה שיש רכב — מתומחר לפי פרדאוטו (worst case) כדי להישאר מכוסים.
      </p>

      {/* Private tour sections */}
      {PRIVATE_TOURS.map((tour) => (
        <PrivateSection key={tour.slug} tour={tour} />
      ))}

      {/* Insights */}
      <div id="sec-insights" className="bg-sky-50 border-r-4 border-sky-600 rounded-md p-4 md:p-5 mt-7 text-sm scroll-mt-20">
        <h3 className="text-base font-bold text-sky-900 mt-0 mb-2">תובנות מרכזיות</h3>
        <ul className="space-y-2 pr-5 list-disc text-gray-800">
          {INSIGHTS.map((ins, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: ins.html }} />
          ))}
        </ul>
      </div>

      <div className="text-center text-xs text-gray-400 mt-7 mb-4">
        פורטוגו · מודל תמחור · גרסה {PRICING_VALIDATION_VERSION} · {PRICING_VALIDATION_UPDATED}
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

// ─── Tasting section (קולינרי / טעימות) ────────────────────────────────────
function TastingSection({ tour }: { tour: TastingTour }) {
  const [activeScenarioId, setActiveScenarioId] = useState(tour.scenarios[0].id);
  const activeScenario = tour.scenarios.find((s) => s.id === activeScenarioId) ?? tour.scenarios[0];

  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 mb-6 shadow-sm">
      <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-1">{tour.name}</h2>
      <p className="text-sm text-gray-600 mb-1">{tour.priceInfo}</p>
      {tour.priceInfoExtra && (
        <p className="text-xs text-gray-500 mb-3">{tour.priceInfoExtra}</p>
      )}

      {/* Scenario tabs */}
      <div className="flex flex-wrap gap-2 mb-3 mt-4">
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

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <TastingTable tour={tour} rows={activeScenario.rows} />
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2 mt-2">
        {activeScenario.rows.map((row) => (
          <TastingMobileCard key={row.size} tour={tour} row={row} />
        ))}
      </div>
    </section>
  );
}

// ─── Tasting desktop table ────────────────────────────────────────────────
function TastingTable({ tour, rows }: { tour: TastingTour; rows: TastingScenarioRow[] }) {
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="text-right text-slate-600">
          <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">גודל</th>
          <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">הכנסה</th>
          <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">שכר</th>
          <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">{tour.perPersonLabel}</th>
          {tour.sharedCostLabels.map((label, i) => (
            <th key={i} className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">{label}</th>
          ))}
          <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">סה&quot;כ עלות</th>
          <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">רווח</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.size} className="border-b border-gray-100">
            <td className="px-2.5 py-2.5 font-bold">{row.size}</td>
            <td className="px-2.5 py-2.5">{fmtEuro(row.income)}</td>
            <td className="px-2.5 py-2.5">{fmtEuro(row.guideSalary)}</td>
            <td className="px-2.5 py-2.5">{fmtEuro(row.perPersonFood)}</td>
            {row.sharedCosts.map((cost, i) => (
              <td key={i} className="px-2.5 py-2.5">{fmtEuro(cost)}</td>
            ))}
            <td className="px-2.5 py-2.5 font-semibold">{fmtEuro(row.totalCost)}</td>
            <td className={`px-2.5 py-2.5 ${profitCellClasses(row.profit)}`}>
              {profitCellText(row.profit)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── Tasting mobile card ──────────────────────────────────────────────────
function TastingMobileCard({ tour, row }: { tour: TastingTour; row: TastingScenarioRow }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
      {/* Header: size + income */}
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

      {/* Single profit cell */}
      <div className={`rounded-lg p-3 text-center ${profitCellClasses(row.profit)}`}>
        <div className="text-[11px] opacity-80 font-normal">רווח</div>
        <div className="text-lg mt-0.5">{profitCellText(row.profit)}</div>
      </div>

      {/* Details — collapsed accordion */}
      <details className="mt-2 text-xs text-gray-600">
        <summary className="cursor-pointer text-gray-500 hover:text-gray-700">פרטי עלויות</summary>
        <div className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-1">
          <div><span className="text-gray-400">שכר:</span> {fmtEuro(row.guideSalary)}</div>
          <div><span className="text-gray-400">{tour.perPersonLabel}:</span> {fmtEuro(row.perPersonFood)}</div>
          {tour.sharedCostLabels.map((label, i) => (
            <div key={i}><span className="text-gray-400">{label}:</span> {fmtEuro(row.sharedCosts[i])}</div>
          ))}
          <div className="col-span-2 border-t border-gray-100 pt-1 mt-1">
            <span className="text-gray-400">סה&quot;כ עלות:</span> <span className="font-semibold">{fmtEuro(row.totalCost)}</span>
          </div>
        </div>
      </details>
    </div>
  );
}

// ─── Classic section (סיורים קלאסיים — מודל סיור חינמי) ────────────────────
function ClassicSection({ tour }: { tour: ClassicTour }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 mb-6 shadow-sm">
      <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-1">{tour.name}</h2>
      <p className="text-sm text-gray-600 mb-3">{tour.priceInfo}</p>

      {/* Desktop table — שתי עמודות רווח זו לצד זו */}
      <div className="hidden md:block overflow-x-auto mt-4">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-right text-slate-600">
              <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">גודל קבוצה</th>
              <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">שכר בסיס</th>
              <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">הכנסה · מדריך 10€</th>
              <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">רווח · מדריך 10€</th>
              <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">הכנסה · מדריך 11€</th>
              <th className="bg-slate-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">רווח · מדריך 11€</th>
            </tr>
          </thead>
          <tbody>
            {tour.rows.map((row) => (
              <tr key={row.size} className="border-b border-gray-100">
                <td className="px-2.5 py-2.5 font-bold">{row.size}</td>
                <td className="px-2.5 py-2.5">{fmtEuro(row.guideSalary)}</td>
                <td className="px-2.5 py-2.5">{fmtEuro(row.income10)}</td>
                <td className={`px-2.5 py-2.5 ${profitCellClasses(row.profit10)}`}>
                  {profitCellText(row.profit10)}
                </td>
                <td className="px-2.5 py-2.5">{fmtEuro(row.income11)}</td>
                <td className={`px-2.5 py-2.5 ${profitCellClasses(row.profit11)}`}>
                  {profitCellText(row.profit11)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2 mt-2">
        {tour.rows.map((row) => (
          <div key={row.size} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm">
            <div className="flex justify-between items-baseline mb-2">
              <div>
                <span className="text-xs text-gray-500">קבוצה</span>{' '}
                <span className="text-2xl font-bold text-slate-800">{row.size}</span>
              </div>
              <div className="text-xs text-gray-500">
                שכר בסיס: <span className="font-semibold text-slate-700">{fmtEuro(row.guideSalary)}</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className={`rounded-lg p-2 text-center ${profitCellClasses(row.profit10)}`}>
                <div className="text-[11px] opacity-80 font-normal">מדריך 10€/ראש</div>
                <div className="text-[10px] opacity-60 font-normal">הכנסה {fmtEuro(row.income10)}</div>
                <div className="text-base mt-0.5">{profitCellText(row.profit10)}</div>
              </div>
              <div className={`rounded-lg p-2 text-center ${profitCellClasses(row.profit11)}`}>
                <div className="text-[11px] opacity-80 font-normal">מדריך 11€/ראש</div>
                <div className="text-[10px] opacity-60 font-normal">הכנסה {fmtEuro(row.income11)}</div>
                <div className="text-base mt-0.5">{profitCellText(row.profit11)}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Helpers for private tour size labels ────────────────────────────────
function sizeLabel(minSize: number, maxSize: number): string {
  return minSize === maxSize ? `${minSize}` : `${minSize}-${maxSize}`;
}

function totalRange(minSize: number, maxSize: number, pricePerPerson: number): string {
  const min = minSize * pricePerPerson;
  const max = maxSize * pricePerPerson;
  return min === max ? `${fmtEuro(min)}` : `${fmtEuro(min)}–${fmtEuro(max)}`;
}

// ─── Private section ─────────────────────────────────────────────────────
function PrivateSection({ tour }: { tour: PrivateTour }) {
  return (
    <section className="bg-white rounded-xl border border-gray-200 p-4 md:p-6 mb-6 shadow-sm">
      <h2 className="text-xl md:text-2xl font-bold text-slate-800 mb-1">{tour.name}</h2>
      <p className="text-sm text-gray-600 mb-1">{tour.priceInfo}</p>
      {tour.priceInfoExtra && (
        <p className="text-xs text-gray-500 mb-1">{tour.priceInfoExtra}</p>
      )}
      <p className="text-xs text-gray-500 mb-4">
        מקסימום משתתפים: <strong className="text-slate-700">{tour.maxParticipants}</strong>
      </p>

      {/* 1. מחיר רגיל */}
      <PricedTableBlock
        title="מחיר רגיל"
        table={tour.regularPrice}
        accent="slate"
      />

      {/* 2. מחיר מקוצר */}
      {tour.shortPrice && (
        <PricedTableBlock
          title="מחיר מקוצר"
          table={tour.shortPrice}
          accent="indigo"
        />
      )}

      {/* 3. תוספת רכב */}
      {tour.carAddons && tour.carAddons.length > 0 && (
        <CarAddonsBlock addons={tour.carAddons} note={tour.carNote} />
      )}

      {/* 4. שילובים */}
      {tour.combos && tour.combos.length > 0 && (
        <CombosBlock combos={tour.combos} />
      )}

      {/* 5. תמחור ילדים */}
      <ChildrenBlock table={tour.children} />

      {/* 6. אזהרה */}
      {tour.warning && (
        <div className="bg-amber-50 border-r-4 border-amber-500 rounded-md p-3 mt-5 text-xs text-amber-900">
          <strong>⚠️ חשוב:</strong> {tour.warning}
        </div>
      )}
    </section>
  );
}

// ─── Block: Price table (regular / short) ─────────────────────────────────
function PricedTableBlock({
  title,
  table,
  accent,
}: {
  title: string;
  table: PrivatePriceTable;
  accent: 'slate' | 'indigo';
}) {
  const headerBg = accent === 'indigo' ? 'bg-indigo-50' : 'bg-slate-50';
  const headerText = accent === 'indigo' ? 'text-indigo-900' : 'text-slate-700';
  const cellBg = accent === 'indigo' ? 'bg-indigo-50/40' : '';

  return (
    <div className="mt-5">
      <h3 className={`text-base font-bold ${headerText} mb-2`}>
        {title} <span className="text-xs text-gray-500 font-normal">· {table.label}</span>
      </h3>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-right text-slate-600">
              <th className={`${headerBg} px-2.5 py-2 text-xs font-semibold border-b border-gray-200`}>גודל קבוצה</th>
              <th className={`${headerBg} px-2.5 py-2 text-xs font-semibold border-b border-gray-200`}>מחיר/אדם</th>
              <th className={`${headerBg} px-2.5 py-2 text-xs font-semibold border-b border-gray-200`}>סה&quot;כ קבוצה</th>
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} className={`border-b border-gray-100 ${cellBg}`}>
                <td className="px-2.5 py-2.5 font-bold">{sizeLabel(row.minSize, row.maxSize)}</td>
                <td className="px-2.5 py-2.5 font-semibold text-slate-800">{fmtEuro(row.pricePerPerson)}</td>
                <td className="px-2.5 py-2.5 text-gray-600">{totalRange(row.minSize, row.maxSize, row.pricePerPerson)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-1.5">
        {table.rows.map((row, i) => (
          <div key={i} className={`flex justify-between items-baseline border border-gray-200 rounded-lg px-3 py-2 ${cellBg}`}>
            <div className="flex items-baseline gap-2">
              <span className="text-base font-bold text-slate-800">{sizeLabel(row.minSize, row.maxSize)}</span>
              <span className="text-xs text-gray-500">אנשים</span>
            </div>
            <div className="text-left">
              <div className="text-base font-semibold text-slate-800">{fmtEuro(row.pricePerPerson)}</div>
              <div className="text-[10px] text-gray-500">סה&quot;כ {totalRange(row.minSize, row.maxSize, row.pricePerPerson)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Block: Car addons ───────────────────────────────────────────────────
function CarAddonsBlock({ addons, note }: { addons: CarAddonTable[]; note?: string }) {
  return (
    <div className="mt-6">
      <h3 className="text-base font-bold text-emerald-900 mb-2">
        תוספת רכב <span className="text-xs text-gray-500 font-normal">· פרדאוטו (worst case)</span>
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {addons.map((addon, i) => (
          <div key={i} className="bg-emerald-50/40 rounded-lg border border-emerald-100 p-3">
            <h4 className="text-sm font-semibold text-emerald-900 mb-2">{addon.label}</h4>
            <table className="w-full text-xs md:text-sm border-collapse">
              <thead>
                <tr className="text-right text-slate-600">
                  <th className="bg-emerald-100/60 px-2 py-1.5 font-semibold rounded-tr">גודל</th>
                  <th className="bg-emerald-100/60 px-2 py-1.5 font-semibold">רכב</th>
                  <th className="bg-emerald-100/60 px-2 py-1.5 font-semibold rounded-tl">עלות רכב</th>
                </tr>
              </thead>
              <tbody>
                {addon.rows.map((r, j) => (
                  <tr key={j} className="border-b border-emerald-100/60 last:border-0">
                    <td className="px-2 py-1.5 font-bold">{r.groupSizeLabel}</td>
                    <td className="px-2 py-1.5 text-slate-700">{r.vehicleLabel}</td>
                    <td className="px-2 py-1.5 font-semibold text-emerald-900">
                      {r.cost === null ? <span className="text-gray-400 italic text-[11px]">הצעה נפרדת</span> : fmtEuro(r.cost)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-500 mt-2 leading-relaxed">
        <strong className="text-slate-700">חישוב לאדם:</strong> עלות רכב ÷ מספר אנשים בפועל (דינמי, לא לפי קטגוריה).
      </p>

      {note && (
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">{note}</p>
      )}
    </div>
  );
}

// ─── Block: Combos ───────────────────────────────────────────────────────
function CombosBlock({ combos }: { combos: ComboTable[] }) {
  const [activeId, setActiveId] = useState(combos[0].slug);
  const active = combos.find((c) => c.slug === activeId) ?? combos[0];

  return (
    <div className="mt-6">
      <h3 className="text-base font-bold text-purple-900 mb-2">
        שילובים <span className="text-xs text-gray-500 font-normal">· סכום פשוט של שני הסיורים</span>
      </h3>

      {/* Combo tabs */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {combos.map((c) => {
          const isActive = c.slug === activeId;
          return (
            <button
              key={c.slug}
              onClick={() => setActiveId(c.slug)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-all ${
                isActive
                  ? 'bg-purple-700 text-white border-purple-700'
                  : 'bg-purple-50 text-purple-900 border-purple-200 hover:bg-purple-100'
              }`}
            >
              {c.name}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 mb-2">
        {active.city} · מקסימום <strong className="text-slate-700">{active.maxParticipants}</strong> משתתפים
        {active.isShort && <span className="text-indigo-700"> · גרסה מקוצרת</span>}
      </p>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-right text-slate-600">
              <th className="bg-purple-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">גודל</th>
              {active.rows[0].parts.map((p, i) => (
                <th key={i} className="bg-purple-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">
                  {p.name}
                </th>
              ))}
              <th className="bg-purple-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">סה&quot;כ/אדם</th>
              <th className="bg-purple-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">סה&quot;כ קבוצה</th>
            </tr>
          </thead>
          <tbody>
            {active.rows.map((row, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="px-2.5 py-2.5 font-bold">{sizeLabel(row.minSize, row.maxSize)}</td>
                {row.parts.map((p, j) => (
                  <td key={j} className="px-2.5 py-2.5 text-gray-600">{fmtEuro(p.price)}</td>
                ))}
                <td className="px-2.5 py-2.5 font-bold text-purple-900">{fmtEuro(row.totalPerPerson)}</td>
                <td className="px-2.5 py-2.5 text-gray-600">{totalRange(row.minSize, row.maxSize, row.totalPerPerson)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-1.5">
        {active.rows.map((row, i) => (
          <div key={i} className="bg-purple-50/40 border border-purple-100 rounded-lg px-3 py-2">
            <div className="flex justify-between items-baseline">
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-slate-800">{sizeLabel(row.minSize, row.maxSize)}</span>
                <span className="text-xs text-gray-500">אנשים</span>
              </div>
              <div className="text-base font-bold text-purple-900">{fmtEuro(row.totalPerPerson)}<span className="text-[10px] text-gray-500 font-normal">/אדם</span></div>
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">
              {row.parts.map((p, j) => (
                <span key={j}>
                  {j > 0 && <span className="mx-1">+</span>}
                  {p.name} {fmtEuro(p.price)}
                </span>
              ))}
              <span className="mx-1">·</span> סה&quot;כ {totalRange(row.minSize, row.maxSize, row.totalPerPerson)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Block: Children pricing ─────────────────────────────────────────────
function ChildrenBlock({ table }: { table: ChildrenPriceTable }) {
  return (
    <div className="mt-6">
      <h3 className="text-base font-bold text-pink-900 mb-2">
        תמחור ילדים
      </h3>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="text-right text-slate-600">
              <th className="bg-pink-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">גיל</th>
              {table.columns.map((c, i) => (
                <th key={i} className="bg-pink-50 px-2.5 py-2 text-xs font-semibold border-b border-gray-200">{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.ageLabels.map((age, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="px-2.5 py-2.5 font-bold text-pink-900">{age}</td>
                {table.columns.map((c, j) => {
                  const v = c.values[i];
                  const display = typeof v === 'number' ? fmtEuro(v) : v;
                  return (
                    <td key={j} className="px-2.5 py-2.5 text-gray-700">{display}</td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {table.note && (
        <p className="text-xs text-gray-500 mt-2 leading-relaxed">{table.note}</p>
      )}
    </div>
  );
}
