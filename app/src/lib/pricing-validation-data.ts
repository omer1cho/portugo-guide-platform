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
  { html: '<strong>בלם — אזור הפסד יחיד: חבילה N=2.</strong> רווח של רגיל מ-N=2 (+7€) ועד +666€ ב-N=40. בחבילה: <strong>זוג מפסיד 3€, שלישייה כבר רווחית +10€</strong>. שווה לזכור כשמציעים חבילה לזוג.' },
  { html: '<strong>קולינרי וטעימות — רווחיים בכל גודל קבוצה.</strong> אין אזורי הפסד. אפילו זוג בחבילה (40€/42€/28€ רווח) מכסה את העלויות. הסיכון בסיורים האלה הוא תפעולי, לא רווחיות.' },
  { html: '<strong>קלאסיים — מדריך חדש = רווח גדול יותר לחברה.</strong> מדריך מפריש 11€/ראש במקום 10€ מוסיף ~10% לרווח (כי שכר הבסיס לא משתנה). N=15 = +130€/+145€. N=30 = +275€/+305€.' },
  { html: '<strong>טעימות פורטו — רגישות לקפיצות "פר-3 / פר-4".</strong> מעבר מ-3 ל-4 לקוחות = +12€ (מגש גבינות שני). מעבר מ-4 ל-5 = +8€ (קופסת פאו שניה). הקפיצות מתפזרות על קבוצה גדולה יותר.' },
  { html: '<strong>סרדינים — אנומליה מובנית.</strong> זוג עולה 10€/אדם (פותחים קופסה במיוחד), קבוצה 8.5€/אדם. זה מסביר חלק מהפער ברווח בקבוצה של 2 לעומת 3 בקולינרי.' },
];

// ──────────────────────────────────────────────────────────────────────────
// TASTING TOURS — קולינרי בוקר, קולינרי צהריים, טעימות פורטו
// ──────────────────────────────────────────────────────────────────────────
// שונה מסיורים יומיים: אין רכב, אין השוואת ספקים. עיקר העלות = שכר + מזון.
// עלות מורכבת מ:
//   1. שכר מדריך
//   2. מזון פר-אדם (משתנה לפי N — סרדינים שונים בזוג)
//   3. פריטים משותפים (מספר משתנה לפי N — מגש לכל 3, פאו לכל 4 וכו')
// כל הסיורים האלה רווחיים בכל גודל קבוצה — אין flips.

export type TastingScenarioRow = {
  size: number;
  income: number;
  guideSalary: number;
  perPersonFood: number;        // מזון פר-אדם × N (כבר מוכפל)
  sharedCosts: number[];        // לפי tour.sharedCostLabels
  totalCost: number;
  profit: ProfitCell;           // תמיד profit, marginal, or loss (אין na)
};

export type TastingTour = {
  slug: string;
  name: string;
  priceInfo: string;
  priceInfoExtra?: string;
  perPersonLabel: string;       // "מזון פר-אדם"
  sharedCostLabels: string[];   // ["גווארנה"] או ["גבינות","פאו","יין ירוק"]
  scenarios: {
    id: string;
    label: string;
    rows: TastingScenarioRow[];
  }[];
};

// ─── CULINARY MORNING (gravana = 1 בקבוק לכל 7 אנשים) ───
const CULINARY_MORNING_REG_ROWS: TastingScenarioRow[] = [
  { size: 2, income: 130, guideSalary: 35, perPersonFood: 40, sharedCosts: [3], totalCost: 78, profit: profit(52) },
  { size: 3, income: 195, guideSalary: 40, perPersonFood: 56, sharedCosts: [3], totalCost: 98, profit: profit(97) },
  { size: 4, income: 260, guideSalary: 40, perPersonFood: 75, sharedCosts: [3], totalCost: 117, profit: profit(143) },
  { size: 5, income: 325, guideSalary: 40, perPersonFood: 93, sharedCosts: [3], totalCost: 136, profit: profit(189) },
  { size: 6, income: 390, guideSalary: 46, perPersonFood: 112, sharedCosts: [3], totalCost: 160, profit: profit(230) },
  { size: 7, income: 455, guideSalary: 47, perPersonFood: 130, sharedCosts: [3], totalCost: 180, profit: profit(275) },
  { size: 8, income: 520, guideSalary: 48, perPersonFood: 149, sharedCosts: [5], totalCost: 202, profit: profit(318) },
  { size: 10, income: 650, guideSalary: 50, perPersonFood: 186, sharedCosts: [5], totalCost: 241, profit: profit(409) },
  { size: 12, income: 780, guideSalary: 52, perPersonFood: 224, sharedCosts: [5], totalCost: 281, profit: profit(499) },
  { size: 15, income: 975, guideSalary: 55, perPersonFood: 280, sharedCosts: [8], totalCost: 342, profit: profit(633) },
  { size: 20, income: 1300, guideSalary: 60, perPersonFood: 373, sharedCosts: [8], totalCost: 440, profit: profit(860) },
];

const CULINARY_MORNING_PKG_ROWS: TastingScenarioRow[] = [
  { size: 2, income: 120, guideSalary: 35, perPersonFood: 40, sharedCosts: [3], totalCost: 78, profit: profit(42) },
  { size: 3, income: 180, guideSalary: 40, perPersonFood: 56, sharedCosts: [3], totalCost: 98, profit: profit(82) },
  { size: 4, income: 240, guideSalary: 40, perPersonFood: 75, sharedCosts: [3], totalCost: 117, profit: profit(123) },
  { size: 5, income: 300, guideSalary: 40, perPersonFood: 93, sharedCosts: [3], totalCost: 136, profit: profit(164) },
  { size: 6, income: 360, guideSalary: 46, perPersonFood: 112, sharedCosts: [3], totalCost: 160, profit: profit(200) },
  { size: 7, income: 420, guideSalary: 47, perPersonFood: 130, sharedCosts: [3], totalCost: 180, profit: profit(240) },
  { size: 8, income: 480, guideSalary: 48, perPersonFood: 149, sharedCosts: [5], totalCost: 202, profit: profit(278) },
  { size: 10, income: 600, guideSalary: 50, perPersonFood: 186, sharedCosts: [5], totalCost: 241, profit: profit(359) },
  { size: 12, income: 720, guideSalary: 52, perPersonFood: 224, sharedCosts: [5], totalCost: 281, profit: profit(439) },
  { size: 15, income: 900, guideSalary: 55, perPersonFood: 280, sharedCosts: [8], totalCost: 342, profit: profit(558) },
  { size: 20, income: 1200, guideSalary: 60, perPersonFood: 373, sharedCosts: [8], totalCost: 440, profit: profit(760) },
];

// ─── CULINARY LUNCH (gravana = 1 בקבוק לכל 7 אנשים) ───
const CULINARY_LUNCH_REG_ROWS: TastingScenarioRow[] = [
  { size: 2, income: 130, guideSalary: 35, perPersonFood: 43, sharedCosts: [3], totalCost: 80, profit: profit(50) },
  { size: 3, income: 195, guideSalary: 40, perPersonFood: 60, sharedCosts: [3], totalCost: 102, profit: profit(93) },
  { size: 4, income: 260, guideSalary: 40, perPersonFood: 79, sharedCosts: [3], totalCost: 122, profit: profit(138) },
  { size: 5, income: 325, guideSalary: 40, perPersonFood: 99, sharedCosts: [3], totalCost: 142, profit: profit(183) },
  { size: 6, income: 390, guideSalary: 46, perPersonFood: 119, sharedCosts: [3], totalCost: 168, profit: profit(222) },
  { size: 7, income: 455, guideSalary: 47, perPersonFood: 139, sharedCosts: [3], totalCost: 189, profit: profit(266) },
  { size: 8, income: 520, guideSalary: 48, perPersonFood: 159, sharedCosts: [5], totalCost: 212, profit: profit(308) },
  { size: 10, income: 650, guideSalary: 50, perPersonFood: 199, sharedCosts: [5], totalCost: 254, profit: profit(396) },
  { size: 12, income: 780, guideSalary: 52, perPersonFood: 238, sharedCosts: [5], totalCost: 295, profit: profit(485) },
  { size: 15, income: 975, guideSalary: 55, perPersonFood: 298, sharedCosts: [8], totalCost: 360, profit: profit(615) },
  { size: 20, income: 1300, guideSalary: 60, perPersonFood: 397, sharedCosts: [8], totalCost: 465, profit: profit(835) },
];

const CULINARY_LUNCH_PKG_ROWS: TastingScenarioRow[] = [
  { size: 2, income: 120, guideSalary: 35, perPersonFood: 43, sharedCosts: [3], totalCost: 80, profit: profit(40) },
  { size: 3, income: 180, guideSalary: 40, perPersonFood: 60, sharedCosts: [3], totalCost: 102, profit: profit(78) },
  { size: 4, income: 240, guideSalary: 40, perPersonFood: 79, sharedCosts: [3], totalCost: 122, profit: profit(118) },
  { size: 5, income: 300, guideSalary: 40, perPersonFood: 99, sharedCosts: [3], totalCost: 142, profit: profit(158) },
  { size: 6, income: 360, guideSalary: 46, perPersonFood: 119, sharedCosts: [3], totalCost: 168, profit: profit(192) },
  { size: 7, income: 420, guideSalary: 47, perPersonFood: 139, sharedCosts: [3], totalCost: 189, profit: profit(231) },
  { size: 8, income: 480, guideSalary: 48, perPersonFood: 159, sharedCosts: [5], totalCost: 212, profit: profit(268) },
  { size: 10, income: 600, guideSalary: 50, perPersonFood: 199, sharedCosts: [5], totalCost: 254, profit: profit(346) },
  { size: 12, income: 720, guideSalary: 52, perPersonFood: 238, sharedCosts: [5], totalCost: 295, profit: profit(425) },
  { size: 15, income: 900, guideSalary: 55, perPersonFood: 298, sharedCosts: [8], totalCost: 360, profit: profit(540) },
  { size: 20, income: 1200, guideSalary: 60, perPersonFood: 397, sharedCosts: [8], totalCost: 465, profit: profit(735) },
];

// ─── BELEM (פשטל בלם 1.6€/אדם · אין פריטים משותפים) ───
const BELEM_REG_ROWS: TastingScenarioRow[] = [
  { size: 2, income: 40, guideSalary: 30, perPersonFood: 3, sharedCosts: [], totalCost: 33, profit: profit(7) },
  { size: 3, income: 60, guideSalary: 30, perPersonFood: 5, sharedCosts: [], totalCost: 35, profit: profit(25) },
  { size: 4, income: 80, guideSalary: 34, perPersonFood: 6, sharedCosts: [], totalCost: 40, profit: profit(40) },
  { size: 5, income: 100, guideSalary: 35, perPersonFood: 8, sharedCosts: [], totalCost: 43, profit: profit(57) },
  { size: 6, income: 120, guideSalary: 36, perPersonFood: 10, sharedCosts: [], totalCost: 46, profit: profit(74) },
  { size: 7, income: 140, guideSalary: 37, perPersonFood: 11, sharedCosts: [], totalCost: 48, profit: profit(92) },
  { size: 8, income: 160, guideSalary: 38, perPersonFood: 13, sharedCosts: [], totalCost: 51, profit: profit(109) },
  { size: 10, income: 200, guideSalary: 40, perPersonFood: 16, sharedCosts: [], totalCost: 56, profit: profit(144) },
  { size: 15, income: 300, guideSalary: 45, perPersonFood: 24, sharedCosts: [], totalCost: 69, profit: profit(231) },
  { size: 20, income: 400, guideSalary: 50, perPersonFood: 32, sharedCosts: [], totalCost: 82, profit: profit(318) },
  { size: 30, income: 600, guideSalary: 60, perPersonFood: 48, sharedCosts: [], totalCost: 108, profit: profit(492) },
  { size: 40, income: 800, guideSalary: 70, perPersonFood: 64, sharedCosts: [], totalCost: 134, profit: profit(666) },
];

const BELEM_PKG_ROWS: TastingScenarioRow[] = [
  { size: 2, income: 30, guideSalary: 30, perPersonFood: 3, sharedCosts: [], totalCost: 33, profit: loss(-3) },
  { size: 3, income: 45, guideSalary: 30, perPersonFood: 5, sharedCosts: [], totalCost: 35, profit: marginal(10) },
  { size: 4, income: 60, guideSalary: 34, perPersonFood: 6, sharedCosts: [], totalCost: 40, profit: profit(20) },
  { size: 5, income: 75, guideSalary: 35, perPersonFood: 8, sharedCosts: [], totalCost: 43, profit: profit(32) },
  { size: 6, income: 90, guideSalary: 36, perPersonFood: 10, sharedCosts: [], totalCost: 46, profit: profit(44) },
  { size: 7, income: 105, guideSalary: 37, perPersonFood: 11, sharedCosts: [], totalCost: 48, profit: profit(57) },
  { size: 8, income: 120, guideSalary: 38, perPersonFood: 13, sharedCosts: [], totalCost: 51, profit: profit(69) },
  { size: 10, income: 150, guideSalary: 40, perPersonFood: 16, sharedCosts: [], totalCost: 56, profit: profit(94) },
  { size: 15, income: 225, guideSalary: 45, perPersonFood: 24, sharedCosts: [], totalCost: 69, profit: profit(156) },
  { size: 20, income: 300, guideSalary: 50, perPersonFood: 32, sharedCosts: [], totalCost: 82, profit: profit(218) },
  { size: 30, income: 450, guideSalary: 60, perPersonFood: 48, sharedCosts: [], totalCost: 108, profit: profit(342) },
  { size: 40, income: 600, guideSalary: 70, perPersonFood: 64, sharedCosts: [], totalCost: 134, profit: profit(466) },
];

// ─── TASTINGS PORTO ───
const TASTINGS_REG_ROWS: TastingScenarioRow[] = [
  { size: 2, income: 130, guideSalary: 30, perPersonFood: 39, sharedCosts: [12, 8, 4], totalCost: 92, profit: profit(38) },
  { size: 3, income: 195, guideSalary: 30, perPersonFood: 58, sharedCosts: [12, 8, 4], totalCost: 112, profit: profit(83) },
  { size: 4, income: 260, guideSalary: 34, perPersonFood: 78, sharedCosts: [24, 8, 4], totalCost: 147, profit: profit(113) },
  { size: 5, income: 325, guideSalary: 35, perPersonFood: 97, sharedCosts: [24, 16, 4], totalCost: 175, profit: profit(150) },
  { size: 6, income: 390, guideSalary: 36, perPersonFood: 116, sharedCosts: [24, 16, 4], totalCost: 196, profit: profit(194) },
  { size: 7, income: 455, guideSalary: 37, perPersonFood: 136, sharedCosts: [37, 16, 7], totalCost: 232, profit: profit(223) },
  { size: 8, income: 520, guideSalary: 38, perPersonFood: 155, sharedCosts: [37, 16, 7], totalCost: 252, profit: profit(268) },
  { size: 10, income: 650, guideSalary: 40, perPersonFood: 194, sharedCosts: [49, 23, 7], totalCost: 313, profit: profit(337) },
  { size: 12, income: 780, guideSalary: 42, perPersonFood: 233, sharedCosts: [49, 23, 7], totalCost: 354, profit: profit(426) },
  { size: 15, income: 975, guideSalary: 45, perPersonFood: 291, sharedCosts: [61, 31, 11], totalCost: 438, profit: profit(537) },
  { size: 18, income: 1170, guideSalary: 48, perPersonFood: 349, sharedCosts: [73, 39, 11], totalCost: 519, profit: profit(651) },
  { size: 22, income: 1430, guideSalary: 52, perPersonFood: 426, sharedCosts: [98, 47, 14], totalCost: 636, profit: profit(794) },
];

const TASTINGS_PKG_ROWS: TastingScenarioRow[] = [
  { size: 2, income: 120, guideSalary: 30, perPersonFood: 39, sharedCosts: [12, 8, 4], totalCost: 92, profit: profit(28) },
  { size: 3, income: 180, guideSalary: 30, perPersonFood: 58, sharedCosts: [12, 8, 4], totalCost: 112, profit: profit(68) },
  { size: 4, income: 240, guideSalary: 34, perPersonFood: 78, sharedCosts: [24, 8, 4], totalCost: 147, profit: profit(93) },
  { size: 5, income: 300, guideSalary: 35, perPersonFood: 97, sharedCosts: [24, 16, 4], totalCost: 175, profit: profit(125) },
  { size: 6, income: 360, guideSalary: 36, perPersonFood: 116, sharedCosts: [24, 16, 4], totalCost: 196, profit: profit(164) },
  { size: 7, income: 420, guideSalary: 37, perPersonFood: 136, sharedCosts: [37, 16, 7], totalCost: 232, profit: profit(188) },
  { size: 8, income: 480, guideSalary: 38, perPersonFood: 155, sharedCosts: [37, 16, 7], totalCost: 252, profit: profit(228) },
  { size: 10, income: 600, guideSalary: 40, perPersonFood: 194, sharedCosts: [49, 23, 7], totalCost: 313, profit: profit(287) },
  { size: 12, income: 720, guideSalary: 42, perPersonFood: 233, sharedCosts: [49, 23, 7], totalCost: 354, profit: profit(366) },
  { size: 15, income: 900, guideSalary: 45, perPersonFood: 291, sharedCosts: [61, 31, 11], totalCost: 438, profit: profit(462) },
  { size: 18, income: 1080, guideSalary: 48, perPersonFood: 349, sharedCosts: [73, 39, 11], totalCost: 519, profit: profit(561) },
  { size: 22, income: 1320, guideSalary: 52, perPersonFood: 426, sharedCosts: [98, 47, 14], totalCost: 636, profit: profit(684) },
];

export const TASTING_TOURS: TastingTour[] = [
  {
    slug: 'belem',
    name: 'בלם',
    priceInfo: 'מחיר ללקוח: 20€ רגיל · 15€ חבילה · כולל: שכר מדריך + פשטל בלם 1.6€/אדם',
    perPersonLabel: 'פשטל',
    sharedCostLabels: [],
    scenarios: [
      { id: 'reg', label: 'מחיר רגיל (20€)', rows: BELEM_REG_ROWS },
      { id: 'pkg', label: 'חבילה (15€)', rows: BELEM_PKG_ROWS },
    ],
  },
  {
    slug: 'culinary-morning',
    name: 'קולינרי בוקר',
    priceInfo: 'מחיר ללקוח: 65€ רגיל · 60€ חבילה · כולל: שכר מדריך + מוצרים לאדם + גווארנה משותפת',
    priceInfoExtra: 'לאדם: קפה ומאפה ~2.5€, פשטל 2€, מרק 1.92€, ויטור ~2.15€, סרדינים 8.5€/10€, ז\'ינז\'יניה 1.5€, כוס · משותף: גווארנה 2.5€/בקבוק לכל 7',
    perPersonLabel: 'מוצרים לאדם',
    sharedCostLabels: ['גווארנה'],
    scenarios: [
      { id: 'reg', label: 'מחיר רגיל (65€)', rows: CULINARY_MORNING_REG_ROWS },
      { id: 'pkg', label: 'חבילה (60€)', rows: CULINARY_MORNING_PKG_ROWS },
    ],
  },
  {
    slug: 'culinary-lunch',
    name: 'קולינרי צהריים',
    priceInfo: 'מחיר ללקוח: 65€ רגיל · 60€ חבילה · כולל: שכר מדריך + מוצרים לאדם + גווארנה משותפת',
    priceInfoExtra: 'לאדם: בקלאו 4€, ויטור ~2.15€, סרדינים 8.5€/10€, ז\'ינז\'יניה 1.5€, אמפדה 1.7€, קרוקט 1.95€, כוס · משותף: גווארנה 2.5€/בקבוק לכל 7',
    perPersonLabel: 'מוצרים לאדם',
    sharedCostLabels: ['גווארנה'],
    scenarios: [
      { id: 'reg', label: 'מחיר רגיל (65€)', rows: CULINARY_LUNCH_REG_ROWS },
      { id: 'pkg', label: 'חבילה (60€)', rows: CULINARY_LUNCH_PKG_ROWS },
    ],
  },
  {
    slug: 'tastings-porto',
    name: 'טעימות פורטו',
    priceInfo: 'מחיר ללקוח: 65€ רגיל · 60€ חבילה · כולל: שכר מדריך + מוצרים לאדם + פריטים משותפים',
    priceInfoExtra: 'לאדם: לביבה 2.7€, יקב 10€, יין אדום 3.5€, בריגדיירו 2.12€, בירה 1€, כוס · משותף: מגש גבינות 12.19€ לכל 3 · פאו דה קז\'ו ~7.75€ לכל 4 · יין ירוק ~3.5€ לכל 6',
    perPersonLabel: 'מוצרים לאדם',
    sharedCostLabels: ['גבינות', 'פאו', 'יין ירוק'],
    scenarios: [
      { id: 'reg', label: 'מחיר רגיל (65€)', rows: TASTINGS_REG_ROWS },
      { id: 'pkg', label: 'חבילה (60€)', rows: TASTINGS_PKG_ROWS },
    ],
  },
];

// ──────────────────────────────────────────────────────────────────────────
// CLASSIC TOURS — קלאסי ליסבון + קלאסי פורטו (אותו מודל סיור חינמי)
// ──────────────────────────────────────────────────────────────────────────
// סיור חינמי (free tour) — אין מחיר ללקוח, הלקוח משלם רק טיפ. הכסף שנכנס
// לחברה הוא ה-transfer של המדריך:
//   • מדריך רגיל מפריש 10€ לראש
//   • מדריך חדש (כמו ניר) מפריש 11€ לראש
// ילדים מתחת ל-10 חינם. העלות לחברה: שכר בסיס שהמדריך מקבל לפי גודל קבוצה.
// רווח לחברה = transfer × N - שכר בסיס.

export type ClassicScenarioRow = {
  size: number;
  guideSalary: number;
  income10: number;     // 10 × N
  income11: number;     // 11 × N
  profit10: ProfitCell; // רווח עם מדריך מפריש 10€
  profit11: ProfitCell; // רווח עם מדריך מפריש 11€
};

export type ClassicTour = {
  slug: string;
  name: string;
  priceInfo: string;
  rows: ClassicScenarioRow[];
};

const CLASSIC_ROWS: ClassicScenarioRow[] = [
  { size: 1, guideSalary: 5, income10: 10, income11: 11, profit10: profit(5), profit11: profit(6) },
  { size: 2, guideSalary: 10, income10: 20, income11: 22, profit10: profit(10), profit11: profit(12) },
  { size: 3, guideSalary: 15, income10: 30, income11: 33, profit10: profit(15), profit11: profit(18) },
  { size: 4, guideSalary: 15, income10: 40, income11: 44, profit10: profit(25), profit11: profit(29) },
  { size: 5, guideSalary: 15, income10: 50, income11: 55, profit10: profit(35), profit11: profit(40) },
  { size: 6, guideSalary: 15, income10: 60, income11: 66, profit10: profit(45), profit11: profit(51) },
  { size: 8, guideSalary: 15, income10: 80, income11: 88, profit10: profit(65), profit11: profit(73) },
  { size: 10, guideSalary: 15, income10: 100, income11: 110, profit10: profit(85), profit11: profit(95) },
  { size: 12, guideSalary: 15, income10: 120, income11: 132, profit10: profit(105), profit11: profit(117) },
  { size: 15, guideSalary: 20, income10: 150, income11: 165, profit10: profit(130), profit11: profit(145) },
  { size: 20, guideSalary: 20, income10: 200, income11: 220, profit10: profit(180), profit11: profit(200) },
  { size: 25, guideSalary: 25, income10: 250, income11: 275, profit10: profit(225), profit11: profit(250) },
  { size: 30, guideSalary: 25, income10: 300, income11: 330, profit10: profit(275), profit11: profit(305) },
  { size: 40, guideSalary: 30, income10: 400, income11: 440, profit10: profit(370), profit11: profit(410) },
];

export const CLASSIC_TOURS: ClassicTour[] = [
  {
    slug: 'classic-lisbon-porto',
    name: 'ליסבון הקלאסית + פורטו הקלאסית',
    priceInfo: 'מודל סיור חינמי — אותו חישוב לשתי הערים. ההכנסה לחברה = transfer של המדריך × N (ילדים מתחת ל-10 חינם). העלות = שכר בסיס שהמדריך מקבל מהחברה. שתי עמודות רווח זו לצד זו: מדריך רגיל (10€/ראש) ומדריך חדש כמו ניר (11€/ראש).',
    rows: CLASSIC_ROWS,
  },
];

export const CLASSIC_SUMMARY_CARDS: SummaryCard[] = [
  {
    title: 'סיורים קלאסיים — רווח לחברה לפי גודל קבוצה',
    rows: [
      { label: 'מדריך 10€ · 5 אנשים', value: '+35€' },
      { label: 'מדריך 11€ · 5 אנשים', value: '+40€' },
      { label: 'מדריך 10€ · 15 אנשים', value: '+130€' },
      { label: 'מדריך 11€ · 15 אנשים', value: '+145€' },
      { label: 'מדריך 10€ · 30 אנשים', value: '+275€' },
      { label: 'מדריך 11€ · 30 אנשים', value: '+305€' },
    ],
  },
];

export const TASTING_SUMMARY_CARDS: SummaryCard[] = [
  {
    title: 'בלם — רווח לפי גודל קבוצה',
    rows: [
      { label: 'רגיל (20€) · 2 אנשים', value: '+7€' },
      { label: '⚠️ חבילה (15€) · 2 אנשים', value: '−3€' },
      { label: '⚠️ חבילה (15€) · 3 אנשים', value: '+10€' },
      { label: 'רגיל (20€) · 10 אנשים', value: '+144€' },
      { label: 'חבילה (15€) · 10 אנשים', value: '+94€' },
    ],
  },
  {
    title: 'קולינרי בוקר — רווח מינימלי',
    rows: [
      { label: 'רגיל (65€) · 2 אנשים', value: '+52€' },
      { label: 'חבילה (60€) · 2 אנשים', value: '+42€' },
      { label: 'רגיל (65€) · 6 אנשים', value: '+230€' },
      { label: 'חבילה (60€) · 6 אנשים', value: '+200€' },
    ],
  },
  {
    title: 'קולינרי צהריים — רווח מינימלי',
    rows: [
      { label: 'רגיל (65€) · 2 אנשים', value: '+50€' },
      { label: 'חבילה (60€) · 2 אנשים', value: '+40€' },
      { label: 'רגיל (65€) · 6 אנשים', value: '+222€' },
      { label: 'חבילה (60€) · 6 אנשים', value: '+192€' },
    ],
  },
  {
    title: 'טעימות פורטו — רווח מינימלי',
    rows: [
      { label: 'רגיל (65€) · 2 אנשים', value: '+38€' },
      { label: 'חבילה (60€) · 2 אנשים', value: '+28€' },
      { label: 'רגיל (65€) · 6 אנשים', value: '+194€' },
      { label: 'חבילה (60€) · 6 אנשים', value: '+164€' },
    ],
  },
];

export const PRICING_VALIDATION_VERSION = 6;
export const PRICING_VALIDATION_UPDATED = '8 במאי 2026';
