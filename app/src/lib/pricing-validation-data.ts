/**
 * Pricing validation data — מקור: portugo-pricing-validation.html (גרסה 3, 4.5.26)
 *
 * הקובץ מכיל את כל הנתונים של דף "רווחיות סיורים יומיים":
 *   - 4 כרטיסי סיכום (מינימום לרווח לכל סיור)
 *   - 4 סיורים מלאים (סינטרה / אראבידה / אובידוש / דורו) עם sennariot, טבלאות רווח/הפסד
 *   - תובנות מרכזיות
 *
 * עדכונים: כשעומר משנה את המודל ב-portugo-pricing-validation.html,
 * צריך לעדכן את הקובץ הזה. הdata-only structure מקלה על update —
 * לא צריך לגעת ב-JSX, רק במספרים.
 */

export type ProfitCell =
  | { kind: 'profit'; amount: number }    // ירוק
  | { kind: 'marginal'; amount: number }  // צהוב
  | { kind: 'loss'; amount: number }      // אדום
  | { kind: 'na'; text: string };         // אפור (ספק לא זמין)

export type ScenarioRow = {
  size: number;
  income: number;
  guideSalary: number;
  attractionCost: number;        // פנה/יקב/מנזר+תצפית
  cruiseCost?: number;           // רק לדורו
  daily: number;
  carText: string;               // "326 / 307" או "280 (ז'ורז')"
  profitA: ProfitCell;
  profitB: ProfitCell;
};

export type Scenario = {
  id: string;
  label: string;
  rows: ScenarioRow[];
};

export type Tour = {
  slug: string;
  name: string;
  priceInfo: string;
  priceInfoExtra?: string;       // שורה משנית באפור
  attractionLabel: string;       // "פנה" / "יקב" / "מנזר+תצפית"
  hasCruise?: boolean;           // דורו = true
  supplierLabelA: string;        // "פרדאוטו" / "איבורבס/ז'ורז'"
  supplierLabelB: string;        // "מורטה" / "אנטורס"
  miniTable: {
    label: string;
    columns: string[];           // ["מינ' לאדם · פרדאוטו", "מינ' לאדם · מורטה"] או ["מינ' לאדם · ז'ורז' (ספק יחיד)"]
    rows: { size: number; values: string[] }[];
  };
  scenarios: Scenario[];
};

// ─── Summary cards (top of page) ───
export type SummaryCard = {
  title: string;
  rows: { label: string; value: string }[];
};

export const SUMMARY_CARDS: SummaryCard[] = [
  {
    title: 'סינטרה — מינימום לרווח',
    rows: [
      { label: 'חורף רגיל (90€) · פ/מ', value: '6 / 6' },
      { label: 'חורף חבילה (85€) · פ/מ', value: '7 / 7' },
      { label: 'קיץ רגיל (95€) · פ/מ', value: '6 / 6' },
      { label: 'קיץ חבילה (90€) · פ/מ', value: '6 / 6' },
    ],
  },
  {
    title: 'אראבידה — מינימום לרווח',
    rows: [
      { label: 'חורף רגיל (90€) · פ/מ', value: '6 / 6' },
      { label: 'חורף חבילה (85€) · פ/מ', value: '6 / 6' },
      { label: 'קיץ רגיל (95€) · פ/מ', value: '5 / 5' },
      { label: 'קיץ חבילה (90€) · פ/מ', value: '6 / 6' },
    ],
  },
  {
    title: 'אובידוש — מינימום לרווח',
    rows: [
      { label: 'רגיל (105€) · פרדאוטו', value: '6 משתתפים' },
      { label: 'רגיל (105€) · מורטה', value: '7 משתתפים' },
      { label: 'חבילה (100€) · פרדאוטו', value: '6 משתתפים' },
      { label: 'חבילה (100€) · מורטה', value: '7 משתתפים' },
    ],
  },
  {
    title: 'דורו — מינימום לרווח',
    rows: [
      { label: 'רגיל (105€) · איבורבס', value: '5 משתתפים' },
      { label: 'רגיל (105€) · אנטורס', value: '11 משתתפים' },
      { label: 'חבילה (100€) · איבורבס', value: '6 משתתפים' },
      { label: 'חבילה (100€) · אנטורס', value: '12 משתתפים' },
    ],
  },
];

// Helper to build cells more readably
const profit = (amount: number): ProfitCell => ({ kind: 'profit', amount });
const marginal = (amount: number): ProfitCell => ({ kind: 'marginal', amount });
const loss = (amount: number): ProfitCell => ({ kind: 'loss', amount });
const na = (text: string): ProfitCell => ({ kind: 'na', text });

// ─── SINTRA ───
const SINTRA_REG_WINTER_ROWS: ScenarioRow[] = [
  { size: 2, income: 180, guideSalary: 75, attractionCost: 40, daily: 15, carText: '326 / 307', profitA: loss(-276), profitB: loss(-257) },
  { size: 4, income: 360, guideSalary: 75, attractionCost: 80, daily: 15, carText: '326 / 307', profitA: loss(-136), profitB: loss(-117) },
  { size: 5, income: 450, guideSalary: 75, attractionCost: 100, daily: 15, carText: '326 / 307', profitA: loss(-66), profitB: loss(-47) },
  { size: 6, income: 540, guideSalary: 75, attractionCost: 120, daily: 15, carText: '326 / 307', profitA: marginal(4), profitB: marginal(23) },
  { size: 7, income: 630, guideSalary: 75, attractionCost: 140, daily: 15, carText: '326 / 307', profitA: profit(75), profitB: profit(93) },
  { size: 8, income: 720, guideSalary: 83, attractionCost: 160, daily: 15, carText: '362 / 364', profitA: profit(100), profitB: profit(98) },
  { size: 10, income: 900, guideSalary: 85, attractionCost: 200, daily: 15, carText: '389 / 364', profitA: profit(212), profitB: profit(236) },
  { size: 12, income: 1080, guideSalary: 87, attractionCost: 240, daily: 15, carText: '389 / 364', profitA: profit(349), profitB: profit(374) },
  { size: 15, income: 1350, guideSalary: 90, attractionCost: 300, daily: 15, carText: '389 / 386', profitA: profit(557), profitB: profit(559) },
  { size: 16, income: 1440, guideSalary: 91, attractionCost: 320, daily: 15, carText: '404 / 431', profitA: profit(610), profitB: profit(583) },
  { size: 20, income: 1800, guideSalary: 95, attractionCost: 400, daily: 15, carText: '404 / 431', profitA: profit(886), profitB: profit(859) },
  { size: 25, income: 2250, guideSalary: 100, attractionCost: 500, daily: 15, carText: '404 / 431', profitA: profit(1231), profitB: profit(1204) },
  { size: 30, income: 2700, guideSalary: 105, attractionCost: 600, daily: 15, carText: '483 / —', profitA: profit(1497), profitB: na('פרדאוטו בלעדי') },
  { size: 34, income: 3060, guideSalary: 109, attractionCost: 680, daily: 15, carText: '483 / —', profitA: profit(1773), profitB: na('פרדאוטו בלעדי') },
];

const SINTRA_REG_SUMMER_ROWS: ScenarioRow[] = [
  { size: 2, income: 190, guideSalary: 75, attractionCost: 40, daily: 15, carText: '326 / 307', profitA: loss(-266), profitB: loss(-247) },
  { size: 4, income: 380, guideSalary: 75, attractionCost: 80, daily: 15, carText: '326 / 307', profitA: loss(-116), profitB: loss(-97) },
  { size: 5, income: 475, guideSalary: 75, attractionCost: 100, daily: 15, carText: '326 / 307', profitA: loss(-41), profitB: loss(-22) },
  { size: 6, income: 570, guideSalary: 75, attractionCost: 120, daily: 15, carText: '326 / 307', profitA: marginal(34), profitB: marginal(53) },
  { size: 7, income: 665, guideSalary: 75, attractionCost: 140, daily: 15, carText: '326 / 307', profitA: profit(109), profitB: profit(128) },
  { size: 8, income: 760, guideSalary: 83, attractionCost: 160, daily: 15, carText: '362 / 364', profitA: profit(140), profitB: profit(138) },
  { size: 10, income: 950, guideSalary: 85, attractionCost: 200, daily: 15, carText: '389 / 364', profitA: profit(261), profitB: profit(286) },
  { size: 12, income: 1140, guideSalary: 87, attractionCost: 240, daily: 15, carText: '389 / 364', profitA: profit(409), profitB: profit(434) },
  { size: 15, income: 1425, guideSalary: 90, attractionCost: 300, daily: 15, carText: '389 / 386', profitA: profit(631), profitB: profit(634) },
  { size: 16, income: 1520, guideSalary: 91, attractionCost: 320, daily: 15, carText: '404 / 431', profitA: profit(690), profitB: profit(663) },
  { size: 20, income: 1900, guideSalary: 95, attractionCost: 400, daily: 15, carText: '404 / 431', profitA: profit(986), profitB: profit(959) },
  { size: 25, income: 2375, guideSalary: 100, attractionCost: 500, daily: 15, carText: '404 / 431', profitA: profit(1356), profitB: profit(1329) },
  { size: 30, income: 2850, guideSalary: 105, attractionCost: 600, daily: 15, carText: '483 / —', profitA: profit(1647), profitB: na('פרדאוטו בלעדי') },
  { size: 34, income: 3230, guideSalary: 109, attractionCost: 680, daily: 15, carText: '483 / —', profitA: profit(1943), profitB: na('פרדאוטו בלעדי') },
];

const SINTRA_PKG_WINTER_ROWS: ScenarioRow[] = [
  { size: 2, income: 170, guideSalary: 75, attractionCost: 40, daily: 15, carText: '326 / 307', profitA: loss(-286), profitB: loss(-267) },
  { size: 4, income: 340, guideSalary: 75, attractionCost: 80, daily: 15, carText: '326 / 307', profitA: loss(-156), profitB: loss(-137) },
  { size: 5, income: 425, guideSalary: 75, attractionCost: 100, daily: 15, carText: '326 / 307', profitA: loss(-91), profitB: loss(-72) },
  { size: 6, income: 510, guideSalary: 75, attractionCost: 120, daily: 15, carText: '326 / 307', profitA: loss(-26), profitB: loss(-7) },
  { size: 7, income: 595, guideSalary: 75, attractionCost: 140, daily: 15, carText: '326 / 307', profitA: marginal(39), profitB: profit(58) },
  { size: 8, income: 680, guideSalary: 83, attractionCost: 160, daily: 15, carText: '362 / 364', profitA: profit(60), profitB: profit(58) },
  { size: 10, income: 850, guideSalary: 85, attractionCost: 200, daily: 15, carText: '389 / 364', profitA: profit(161), profitB: profit(186) },
  { size: 12, income: 1020, guideSalary: 87, attractionCost: 240, daily: 15, carText: '389 / 364', profitA: profit(289), profitB: profit(314) },
  { size: 15, income: 1275, guideSalary: 90, attractionCost: 300, daily: 15, carText: '389 / 386', profitA: profit(481), profitB: profit(484) },
  { size: 16, income: 1360, guideSalary: 91, attractionCost: 320, daily: 15, carText: '404 / 431', profitA: profit(530), profitB: profit(503) },
  { size: 20, income: 1700, guideSalary: 95, attractionCost: 400, daily: 15, carText: '404 / 431', profitA: profit(786), profitB: profit(759) },
  { size: 25, income: 2125, guideSalary: 100, attractionCost: 500, daily: 15, carText: '404 / 431', profitA: profit(1106), profitB: profit(1079) },
  { size: 30, income: 2550, guideSalary: 105, attractionCost: 600, daily: 15, carText: '483 / —', profitA: profit(1347), profitB: na('פרדאוטו בלעדי') },
  { size: 34, income: 2890, guideSalary: 109, attractionCost: 680, daily: 15, carText: '483 / —', profitA: profit(1603), profitB: na('פרדאוטו בלעדי') },
];

// pkg-summer זהה ל-reg-winter בסינטרה (אותם מספרים)
const SINTRA_PKG_SUMMER_ROWS: ScenarioRow[] = SINTRA_REG_WINTER_ROWS;

// ─── ARRABIDA ───
const ARRABIDA_REG_WINTER_ROWS: ScenarioRow[] = [
  { size: 2, income: 180, guideSalary: 75, attractionCost: 20, daily: 15, carText: '331 / 323', profitA: loss(-261), profitB: loss(-253) },
  { size: 4, income: 360, guideSalary: 75, attractionCost: 41, daily: 15, carText: '331 / 323', profitA: loss(-102), profitB: loss(-94) },
  { size: 5, income: 450, guideSalary: 75, attractionCost: 51, daily: 15, carText: '331 / 323', profitA: loss(-22), profitB: loss(-14) },
  { size: 6, income: 540, guideSalary: 75, attractionCost: 61, daily: 15, carText: '331 / 323', profitA: profit(58), profitB: profit(66) },
  { size: 7, income: 630, guideSalary: 75, attractionCost: 71, daily: 15, carText: '331 / 323', profitA: profit(138), profitB: profit(146) },
  { size: 8, income: 720, guideSalary: 83, attractionCost: 82, daily: 15, carText: '368 / 354', profitA: profit(172), profitB: profit(186) },
  { size: 10, income: 900, guideSalary: 85, attractionCost: 102, daily: 15, carText: '394 / 375', profitA: profit(304), profitB: profit(323) },
  { size: 12, income: 1080, guideSalary: 87, attractionCost: 122, daily: 15, carText: '394 / 375', profitA: profit(462), profitB: profit(481) },
  { size: 15, income: 1350, guideSalary: 90, attractionCost: 153, daily: 15, carText: '394 / 399', profitA: profit(698), profitB: profit(693) },
  { size: 16, income: 1440, guideSalary: 91, attractionCost: 163, daily: 15, carText: '415 / 444', profitA: profit(756), profitB: profit(727) },
  { size: 20, income: 1800, guideSalary: 95, attractionCost: 204, daily: 15, carText: '415 / 444', profitA: profit(1071), profitB: profit(1042) },
  { size: 25, income: 2250, guideSalary: 100, attractionCost: 255, daily: 15, carText: '415 / 444', profitA: profit(1465), profitB: profit(1436) },
  { size: 30, income: 2700, guideSalary: 105, attractionCost: 306, daily: 15, carText: '488 / —', profitA: profit(1786), profitB: na('פרדאוטו בלעדי') },
  { size: 34, income: 3060, guideSalary: 109, attractionCost: 347, daily: 15, carText: '488 / —', profitA: profit(2101), profitB: na('פרדאוטו בלעדי') },
];

const ARRABIDA_REG_SUMMER_ROWS: ScenarioRow[] = [
  { size: 2, income: 190, guideSalary: 75, attractionCost: 20, daily: 15, carText: '331 / 323', profitA: loss(-251), profitB: loss(-243) },
  { size: 4, income: 380, guideSalary: 75, attractionCost: 41, daily: 15, carText: '331 / 323', profitA: loss(-82), profitB: loss(-74) },
  { size: 5, income: 475, guideSalary: 75, attractionCost: 51, daily: 15, carText: '331 / 323', profitA: marginal(3), profitB: marginal(11) },
  { size: 6, income: 570, guideSalary: 75, attractionCost: 61, daily: 15, carText: '331 / 323', profitA: profit(88), profitB: profit(96) },
  { size: 7, income: 665, guideSalary: 75, attractionCost: 71, daily: 15, carText: '331 / 323', profitA: profit(173), profitB: profit(181) },
  { size: 8, income: 760, guideSalary: 83, attractionCost: 82, daily: 15, carText: '368 / 354', profitA: profit(212), profitB: profit(226) },
  { size: 10, income: 950, guideSalary: 85, attractionCost: 102, daily: 15, carText: '394 / 375', profitA: profit(354), profitB: profit(373) },
  { size: 12, income: 1140, guideSalary: 87, attractionCost: 122, daily: 15, carText: '394 / 375', profitA: profit(522), profitB: profit(541) },
  { size: 15, income: 1425, guideSalary: 90, attractionCost: 153, daily: 15, carText: '394 / 399', profitA: profit(773), profitB: profit(768) },
  { size: 16, income: 1520, guideSalary: 91, attractionCost: 163, daily: 15, carText: '415 / 444', profitA: profit(836), profitB: profit(807) },
  { size: 20, income: 1900, guideSalary: 95, attractionCost: 204, daily: 15, carText: '415 / 444', profitA: profit(1171), profitB: profit(1142) },
  { size: 25, income: 2375, guideSalary: 100, attractionCost: 255, daily: 15, carText: '415 / 444', profitA: profit(1590), profitB: profit(1561) },
  { size: 30, income: 2850, guideSalary: 105, attractionCost: 306, daily: 15, carText: '488 / —', profitA: profit(1936), profitB: na('פרדאוטו בלעדי') },
  { size: 34, income: 3230, guideSalary: 109, attractionCost: 347, daily: 15, carText: '488 / —', profitA: profit(2271), profitB: na('פרדאוטו בלעדי') },
];

const ARRABIDA_PKG_WINTER_ROWS: ScenarioRow[] = [
  { size: 2, income: 170, guideSalary: 75, attractionCost: 20, daily: 15, carText: '331 / 323', profitA: loss(-271), profitB: loss(-263) },
  { size: 4, income: 340, guideSalary: 75, attractionCost: 41, daily: 15, carText: '331 / 323', profitA: loss(-122), profitB: loss(-114) },
  { size: 5, income: 425, guideSalary: 75, attractionCost: 51, daily: 15, carText: '331 / 323', profitA: loss(-47), profitB: loss(-39) },
  { size: 6, income: 510, guideSalary: 75, attractionCost: 61, daily: 15, carText: '331 / 323', profitA: marginal(28), profitB: marginal(36) },
  { size: 7, income: 595, guideSalary: 75, attractionCost: 71, daily: 15, carText: '331 / 323', profitA: profit(103), profitB: profit(111) },
  { size: 8, income: 680, guideSalary: 83, attractionCost: 82, daily: 15, carText: '368 / 354', profitA: profit(132), profitB: profit(146) },
  { size: 10, income: 850, guideSalary: 85, attractionCost: 102, daily: 15, carText: '394 / 375', profitA: profit(254), profitB: profit(273) },
  { size: 12, income: 1020, guideSalary: 87, attractionCost: 122, daily: 15, carText: '394 / 375', profitA: profit(402), profitB: profit(421) },
  { size: 15, income: 1275, guideSalary: 90, attractionCost: 153, daily: 15, carText: '394 / 399', profitA: profit(623), profitB: profit(618) },
  { size: 16, income: 1360, guideSalary: 91, attractionCost: 163, daily: 15, carText: '415 / 444', profitA: profit(676), profitB: profit(647) },
  { size: 20, income: 1700, guideSalary: 95, attractionCost: 204, daily: 15, carText: '415 / 444', profitA: profit(971), profitB: profit(942) },
  { size: 25, income: 2125, guideSalary: 100, attractionCost: 255, daily: 15, carText: '415 / 444', profitA: profit(1340), profitB: profit(1311) },
  { size: 30, income: 2550, guideSalary: 105, attractionCost: 306, daily: 15, carText: '488 / —', profitA: profit(1636), profitB: na('פרדאוטו בלעדי') },
  { size: 34, income: 2890, guideSalary: 109, attractionCost: 347, daily: 15, carText: '488 / —', profitA: profit(1931), profitB: na('פרדאוטו בלעדי') },
];

const ARRABIDA_PKG_SUMMER_ROWS: ScenarioRow[] = ARRABIDA_REG_WINTER_ROWS;

// ─── OBIDOS ───
const OBIDOS_REG_ROWS: ScenarioRow[] = [
  { size: 2, income: 210, guideSalary: 75, attractionCost: 34, daily: 15, carText: '383 / 449', profitA: loss(-297), profitB: loss(-363) },
  { size: 4, income: 420, guideSalary: 75, attractionCost: 68, daily: 15, carText: '383 / 449', profitA: loss(-121), profitB: loss(-187) },
  { size: 5, income: 525, guideSalary: 75, attractionCost: 85, daily: 15, carText: '383 / 449', profitA: loss(-33), profitB: loss(-99) },
  { size: 6, income: 630, guideSalary: 75, attractionCost: 102, daily: 15, carText: '383 / 449', profitA: profit(55), profitB: loss(-11) },
  { size: 7, income: 735, guideSalary: 75, attractionCost: 119, daily: 15, carText: '383 / 449', profitA: profit(143), profitB: profit(77) },
  { size: 8, income: 840, guideSalary: 83, attractionCost: 136, daily: 15, carText: '401 / 449', profitA: profit(205), profitB: profit(157) },
  { size: 10, income: 1050, guideSalary: 85, attractionCost: 170, daily: 15, carText: '441 / 512', profitA: profit(339), profitB: profit(268) },
  { size: 12, income: 1260, guideSalary: 87, attractionCost: 204, daily: 15, carText: '441 / 512', profitA: profit(513), profitB: profit(442) },
  { size: 15, income: 1575, guideSalary: 90, attractionCost: 255, daily: 15, carText: '441 / 537', profitA: profit(774), profitB: profit(678) },
  { size: 16, income: 1680, guideSalary: 91, attractionCost: 272, daily: 15, carText: '462 / 581', profitA: profit(840), profitB: profit(721) },
  { size: 20, income: 2100, guideSalary: 95, attractionCost: 340, daily: 15, carText: '462 / 581', profitA: profit(1188), profitB: profit(1069) },
  { size: 25, income: 2625, guideSalary: 100, attractionCost: 425, daily: 15, carText: '462 / 581', profitA: profit(1623), profitB: profit(1504) },
  { size: 30, income: 3150, guideSalary: 105, attractionCost: 510, daily: 15, carText: '504 / —', profitA: profit(2016), profitB: na('פרדאוטו בלעדי') },
  { size: 34, income: 3570, guideSalary: 109, attractionCost: 578, daily: 15, carText: '504 / —', profitA: profit(2364), profitB: na('פרדאוטו בלעדי') },
];

const OBIDOS_PKG_ROWS: ScenarioRow[] = [
  { size: 2, income: 200, guideSalary: 75, attractionCost: 34, daily: 15, carText: '383 / 449', profitA: loss(-307), profitB: loss(-373) },
  { size: 4, income: 400, guideSalary: 75, attractionCost: 68, daily: 15, carText: '383 / 449', profitA: loss(-141), profitB: loss(-207) },
  { size: 5, income: 500, guideSalary: 75, attractionCost: 85, daily: 15, carText: '383 / 449', profitA: loss(-58), profitB: loss(-124) },
  { size: 6, income: 600, guideSalary: 75, attractionCost: 102, daily: 15, carText: '383 / 449', profitA: marginal(25), profitB: loss(-41) },
  { size: 7, income: 700, guideSalary: 75, attractionCost: 119, daily: 15, carText: '383 / 449', profitA: profit(108), profitB: marginal(42) },
  { size: 8, income: 800, guideSalary: 83, attractionCost: 136, daily: 15, carText: '401 / 449', profitA: profit(165), profitB: profit(117) },
  { size: 10, income: 1000, guideSalary: 85, attractionCost: 170, daily: 15, carText: '441 / 512', profitA: profit(289), profitB: profit(218) },
  { size: 12, income: 1200, guideSalary: 87, attractionCost: 204, daily: 15, carText: '441 / 512', profitA: profit(453), profitB: profit(382) },
  { size: 15, income: 1500, guideSalary: 90, attractionCost: 255, daily: 15, carText: '441 / 537', profitA: profit(699), profitB: profit(603) },
  { size: 16, income: 1600, guideSalary: 91, attractionCost: 272, daily: 15, carText: '462 / 581', profitA: profit(760), profitB: profit(641) },
  { size: 20, income: 2000, guideSalary: 95, attractionCost: 340, daily: 15, carText: '462 / 581', profitA: profit(1088), profitB: profit(969) },
  { size: 25, income: 2500, guideSalary: 100, attractionCost: 425, daily: 15, carText: '462 / 581', profitA: profit(1498), profitB: profit(1379) },
  { size: 30, income: 3000, guideSalary: 105, attractionCost: 510, daily: 15, carText: '504 / —', profitA: profit(1866), profitB: na('פרדאוטו בלעדי') },
  { size: 34, income: 3400, guideSalary: 109, attractionCost: 578, daily: 15, carText: '504 / —', profitA: profit(2194), profitB: na('פרדאוטו בלעדי') },
];

// ─── DOURO ───
const DOURO_REG_ROWS: ScenarioRow[] = [
  { size: 2, income: 210, guideSalary: 80, attractionCost: 30, cruiseCost: 22, daily: 15, carText: "280 (ז'ורז')", profitA: loss(-217), profitB: na("ז'ורז' בלעדי") },
  { size: 3, income: 315, guideSalary: 80, attractionCost: 45, cruiseCost: 33, daily: 15, carText: "280 (ז'ורז')", profitA: loss(-138), profitB: na("ז'ורז' בלעדי") },
  { size: 4, income: 420, guideSalary: 80, attractionCost: 60, cruiseCost: 44, daily: 15, carText: "280 (ז'ורז')", profitA: loss(-59), profitB: na("ז'ורז' בלעדי") },
  { size: 5, income: 525, guideSalary: 80, attractionCost: 75, cruiseCost: 55, daily: 15, carText: "280 (ז'ורז')", profitA: marginal(20), profitB: na("ז'ורז' בלעדי") },
  { size: 6, income: 630, guideSalary: 80, attractionCost: 90, cruiseCost: 66, daily: 15, carText: "280 (ז'ורז')", profitA: profit(99), profitB: na("ז'ורז' בלעדי") },
  { size: 7, income: 735, guideSalary: 90, attractionCost: 105, cruiseCost: 77, daily: 15, carText: "280 (ז'ורז')", profitA: profit(168), profitB: na("ז'ורז' בלעדי") },
  { size: 8, income: 840, guideSalary: 98, attractionCost: 120, cruiseCost: 88, daily: 15, carText: '475 / 700', profitA: marginal(44), profitB: loss(-181) },
  { size: 9, income: 945, guideSalary: 99, attractionCost: 135, cruiseCost: 99, daily: 15, carText: '475 / 700', profitA: profit(122), profitB: loss(-103) },
  { size: 10, income: 1050, guideSalary: 100, attractionCost: 150, cruiseCost: 110, daily: 15, carText: '475 / 700', profitA: profit(200), profitB: loss(-25) },
  { size: 11, income: 1155, guideSalary: 101, attractionCost: 165, cruiseCost: 121, daily: 15, carText: '475 / 700', profitA: profit(278), profitB: profit(53) },
  { size: 12, income: 1260, guideSalary: 102, attractionCost: 180, cruiseCost: 132, daily: 15, carText: '475 / 700', profitA: profit(356), profitB: profit(131) },
  { size: 13, income: 1365, guideSalary: 103, attractionCost: 195, cruiseCost: 143, daily: 15, carText: '475 / 700', profitA: profit(434), profitB: profit(209) },
  { size: 15, income: 1575, guideSalary: 105, attractionCost: 225, cruiseCost: 165, daily: 15, carText: '475 / 700', profitA: profit(590), profitB: profit(365) },
  { size: 17, income: 1785, guideSalary: 107, attractionCost: 255, cruiseCost: 187, daily: 15, carText: '475 / 700', profitA: profit(746), profitB: profit(521) },
  { size: 19, income: 1995, guideSalary: 109, attractionCost: 285, cruiseCost: 209, daily: 15, carText: '475 / 700', profitA: profit(902), profitB: profit(677) },
];

const DOURO_PKG_ROWS: ScenarioRow[] = [
  { size: 2, income: 200, guideSalary: 80, attractionCost: 30, cruiseCost: 22, daily: 15, carText: "280 (ז'ורז')", profitA: loss(-227), profitB: na("ז'ורז' בלעדי") },
  { size: 3, income: 300, guideSalary: 80, attractionCost: 45, cruiseCost: 33, daily: 15, carText: "280 (ז'ורז')", profitA: loss(-153), profitB: na("ז'ורז' בלעדי") },
  { size: 4, income: 400, guideSalary: 80, attractionCost: 60, cruiseCost: 44, daily: 15, carText: "280 (ז'ורז')", profitA: loss(-79), profitB: na("ז'ורז' בלעדי") },
  { size: 5, income: 500, guideSalary: 80, attractionCost: 75, cruiseCost: 55, daily: 15, carText: "280 (ז'ורז')", profitA: loss(-5), profitB: na("ז'ורז' בלעדי") },
  { size: 6, income: 600, guideSalary: 80, attractionCost: 90, cruiseCost: 66, daily: 15, carText: "280 (ז'ורז')", profitA: profit(69), profitB: na("ז'ורז' בלעדי") },
  { size: 7, income: 700, guideSalary: 90, attractionCost: 105, cruiseCost: 77, daily: 15, carText: "280 (ז'ורז')", profitA: profit(133), profitB: na("ז'ורז' בלעדי") },
  { size: 8, income: 800, guideSalary: 98, attractionCost: 120, cruiseCost: 88, daily: 15, carText: '475 / 700', profitA: marginal(4), profitB: loss(-221) },
  { size: 9, income: 900, guideSalary: 99, attractionCost: 135, cruiseCost: 99, daily: 15, carText: '475 / 700', profitA: profit(77), profitB: loss(-148) },
  { size: 10, income: 1000, guideSalary: 100, attractionCost: 150, cruiseCost: 110, daily: 15, carText: '475 / 700', profitA: profit(150), profitB: loss(-75) },
  { size: 11, income: 1100, guideSalary: 101, attractionCost: 165, cruiseCost: 121, daily: 15, carText: '475 / 700', profitA: profit(223), profitB: loss(-2) },
  { size: 12, income: 1200, guideSalary: 102, attractionCost: 180, cruiseCost: 132, daily: 15, carText: '475 / 700', profitA: profit(296), profitB: profit(71) },
  { size: 13, income: 1300, guideSalary: 103, attractionCost: 195, cruiseCost: 143, daily: 15, carText: '475 / 700', profitA: profit(369), profitB: profit(144) },
  { size: 15, income: 1500, guideSalary: 105, attractionCost: 225, cruiseCost: 165, daily: 15, carText: '475 / 700', profitA: profit(515), profitB: profit(290) },
  { size: 17, income: 1700, guideSalary: 107, attractionCost: 255, cruiseCost: 187, daily: 15, carText: '475 / 700', profitA: profit(661), profitB: profit(436) },
  { size: 19, income: 1900, guideSalary: 109, attractionCost: 285, cruiseCost: 209, daily: 15, carText: '475 / 700', profitA: profit(807), profitB: profit(582) },
];

export const TOURS: Tour[] = [
  {
    slug: 'sintra',
    name: 'סינטרה',
    priceInfo: 'מחיר ללקוח: 90€ חורף · 95€ קיץ (יולי+) · 85€/90€ חבילה · כולל: שכר מדריך + אשל 15€ + כרטיס פנה 20€/אדם + רכב',
    attractionLabel: 'פנה',
    supplierLabelA: 'פרדאוטו',
    supplierLabelB: 'מורטה',
    miniTable: {
      label: "מחיר מינימום לקבוצה 2-5 (לא להפסיד · מעוגל ל-5)",
      columns: ["מינ' לאדם · פרדאוטו", "מינ' לאדם · מורטה"],
      rows: [
        { size: 2, values: ['230€', '220€'] },
        { size: 3, values: ['160€', '155€'] },
        { size: 4, values: ['125€', '120€'] },
        { size: 5, values: ['105€', '100€'] },
      ],
    },
    scenarios: [
      { id: 'reg-winter', label: 'מחיר רגיל · חורף (90€)', rows: SINTRA_REG_WINTER_ROWS },
      { id: 'reg-summer', label: 'מחיר רגיל · קיץ (95€)', rows: SINTRA_REG_SUMMER_ROWS },
      { id: 'pkg-winter', label: 'חבילה · חורף (85€)', rows: SINTRA_PKG_WINTER_ROWS },
      { id: 'pkg-summer', label: 'חבילה · קיץ (90€)', rows: SINTRA_PKG_SUMMER_ROWS },
    ],
  },
  {
    slug: 'arrabida',
    name: 'אראבידה',
    priceInfo: 'מחיר ללקוח: 90€ חורף · 95€ קיץ (יולי+) · 85€/90€ חבילה · כולל: שכר מדריך + אשל 15€ + יקב 10.2€/אדם + רכב',
    attractionLabel: 'יקב',
    supplierLabelA: 'פרדאוטו',
    supplierLabelB: 'מורטה',
    miniTable: {
      label: "מחיר מינימום לקבוצה 2-5 (לא להפסיד · מעוגל ל-5)",
      columns: ["מינ' לאדם · פרדאוטו", "מינ' לאדם · מורטה"],
      rows: [
        { size: 2, values: ['225€', '220€'] },
        { size: 3, values: ['155€', '150€'] },
        { size: 4, values: ['120€', '115€'] },
        { size: 5, values: ['95€', '95€'] },
      ],
    },
    scenarios: [
      { id: 'reg-winter', label: 'מחיר רגיל · חורף (90€)', rows: ARRABIDA_REG_WINTER_ROWS },
      { id: 'reg-summer', label: 'מחיר רגיל · קיץ (95€)', rows: ARRABIDA_REG_SUMMER_ROWS },
      { id: 'pkg-winter', label: 'חבילה · חורף (85€)', rows: ARRABIDA_PKG_WINTER_ROWS },
      { id: 'pkg-summer', label: 'חבילה · קיץ (90€)', rows: ARRABIDA_PKG_SUMMER_ROWS },
    ],
  },
  {
    slug: 'obidos',
    name: 'אובידוש',
    priceInfo: 'מחיר ללקוח: 105€ · 100€ בחבילה · אין שינוי עונתי · כולל: שכר מדריך + אשל 15€ + מנזר 15€ + תצפית גלישה 2€ + רכב',
    attractionLabel: 'מנזר+תצפית',
    supplierLabelA: 'פרדאוטו',
    supplierLabelB: 'מורטה',
    miniTable: {
      label: "מחיר מינימום לקבוצה 2-5 (לא להפסיד · מעוגל ל-5)",
      columns: ["מינ' לאדם · פרדאוטו", "מינ' לאדם · מורטה"],
      rows: [
        { size: 2, values: ['255€', '290€'] },
        { size: 3, values: ['175€', '200€'] },
        { size: 4, values: ['140€', '155€'] },
        { size: 5, values: ['115€', '125€'] },
      ],
    },
    scenarios: [
      { id: 'reg', label: 'מחיר רגיל (105€)', rows: OBIDOS_REG_ROWS },
      { id: 'pkg', label: 'חבילה (100€)', rows: OBIDOS_PKG_ROWS },
    ],
  },
  {
    slug: 'douro',
    name: 'דורו',
    priceInfo: 'מחיר ללקוח: 105€ · 100€ בחבילה · אין שינוי עונתי · כולל: שכר מדריך + אשל 15€ + יקב 15€/אדם + שייט 11€/אדם + רכב (פורטו)',
    priceInfoExtra: "2-7 משתתפים: ז'ורז' וואן 280€ (ספק יחיד) · 8-19: איבורבס 475€ או אנטורס 700€ (קלבר באמצע 635€)",
    attractionLabel: 'יקב',
    hasCruise: true,
    supplierLabelA: "איבורבס/ז'ורז'",
    supplierLabelB: 'אנטורס',
    miniTable: {
      label: "מחיר מינימום לקבוצה 2-5 (לא להפסיד · מעוגל ל-5)",
      columns: ["מינ' לאדם · ז'ורז' (ספק יחיד)"],
      rows: [
        { size: 2, values: ['215€'] },
        { size: 3, values: ['155€'] },
        { size: 4, values: ['120€'] },
        { size: 5, values: ['105€'] },
      ],
    },
    scenarios: [
      { id: 'reg', label: 'מחיר רגיל (105€)', rows: DOURO_REG_ROWS },
      { id: 'pkg', label: 'חבילה (100€)', rows: DOURO_PKG_ROWS },
    ],
  },
];

// ─── Insights (bottom of page) ───
export const INSIGHTS: { html: string }[] = [
  { html: '<strong>סינטרה — יציב.</strong> בכל גודל מ-6 ומעלה (חורף-רגיל) או 7+ (חבילה-חורף) — שני הספקים נשארים רווחיים. אין flip.' },
  { html: '<strong>אראבידה — דומה לסינטרה.</strong> מ-6+ שני הספקים רווחיים. יוצא דופן: בקיץ-רגיל גם 5 משתתפים = רווח קטן (3-11€).' },
  { html: '<strong>אובידוש — flip בקבוצה של 6.</strong> פרדאוטו = +55€/+25€. מורטה = −11€/−41€. <strong>תמיד פרדאוטו.</strong> מ-7+ שני הספקים רווחיים.' },
  { html: '<strong>דורו — flip קריטי בקבוצות 8-11.</strong> איבורבס → רווח (4-278€). אנטורס → הפסד (עד 221€). הפער 225€ בעלות הרכב = ההבדל. <strong>חובה לתאם איבורבס/קלבר מראש.</strong>' },
  { html: '<strong>סינטרה — להעלות מחיר?</strong> בקבוצה של 6 חורף-רגיל הרווח 4-23€ בלבד. שווה לשקול 95€ קבוע לכל השנה.' },
  { html: '<strong>אזורי 13-15 וקטן (2-7) באראבידה ובסינטרה — מורטה זול יותר.</strong> שתחזירו אותה כברירת מחדל לסיורים האלו אם זמינה.' },
];

export const PRICING_VALIDATION_VERSION = 3;
export const PRICING_VALIDATION_UPDATED = '4 במאי 2026';
