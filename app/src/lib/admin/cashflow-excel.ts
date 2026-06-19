/**
 * cashflow-excel — יצירת גליון הקשפלו החודשי (Excel) בצד הלקוח.
 *
 * דרך א' (מאושרת ע"י עומר): מייצרים **קובץ נפרד עם גליון בודד** (apr26),
 * בנוי לפי מבנה גיליון המזומן של PIRO LDA. עומר גוררת את הגליון לקובץ הראשי
 * שלה ב-Excel. כך הגליונות הקיימים לא נוגעים בכלל — אפס סיכון.
 *
 * המבנה לפי docs/cashflow-knowledge.md §2.
 * exceljs נטען בצורת dynamic import כדי לא להכביד על שאר הדשבורד.
 */

import { monthSheetName } from './cashflow-data';

const MONTH_NAMES_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const EUR_FMT = '#,##0.00" €"';
const DATE_FMT = 'mm-dd-yy';

export type CashflowExcelRow = {
  /** ISO yyyy-mm-dd */
  date: string;
  /** עמודה D */
  entity: string;
  /** עמודה F */
  description: string;
  /** עמודה E (לרוב ריק) */
  docNum?: string | null;
  /** עמודה G */
  inflow: number;
  /** עמודה H */
  outflow: number;
  /** רקע צהוב על תא Entity (הפקדות לבנק) */
  isDeposit?: boolean;
};

/** ISO yyyy-mm-dd → Date מקומי (בלי הזזת timezone) */
function isoToLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * מייצר את גליון הקשפלו ומוריד אותו כקובץ.
 * מחזיר את היתרה הסוגרת ומספר התנועות (לשמירת רשומת cashflow_runs).
 */
export async function generateCashflowExcel(opts: {
  year: number;
  month: number; // 1-12
  prevBalance: number;
  rows: CashflowExcelRow[];
}): Promise<{ finalBalance: number; transactionsCount: number; sheetName: string }> {
  const { year, month, prevBalance, rows } = opts;
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const sheetName = monthSheetName(year, month); // apr26
  const ws = wb.addWorksheet(sheetName);

  // רוחבי עמודות (A שוליים, G/H/I רחבים אחרת מציג ########)
  ws.getColumn(1).width = 3;   // A
  ws.getColumn(2).width = 5;   // B  Nº
  ws.getColumn(3).width = 11;  // C  Date
  ws.getColumn(4).width = 28;  // D  Entity
  ws.getColumn(5).width = 10;  // E  Doc. Nº
  ws.getColumn(6).width = 22;  // F  Description
  ws.getColumn(7).width = 16;  // G  Cash inflow
  ws.getColumn(8).width = 16;  // H  Cash Outflow
  ws.getColumn(9).width = 17;  // I  Balance

  // ── כותרות (1-14) ───────────────────────────────────────────
  ws.mergeCells('B2:I2');
  ws.getCell('B2').value = 'CASH SHEET';
  ws.getCell('B2').font = { bold: true, size: 14 };
  ws.getCell('B2').alignment = { horizontal: 'center' };

  ws.mergeCells('B4:C4');
  ws.getCell('B4').value = 'Entity:';
  ws.getCell('B4').font = { bold: true };
  ws.mergeCells('D4:I4');
  ws.getCell('D4').value = 'PIRO, LDA';

  ws.mergeCells('G6:H6');
  ws.getCell('G6').value = 'Year:';
  ws.getCell('G6').font = { bold: true };
  ws.getCell('I6').value = year;

  ws.mergeCells('G8:H8');
  ws.getCell('G8').value = 'Month';
  ws.getCell('G8').font = { bold: true };
  ws.getCell('I8').value = MONTH_NAMES_EN[month - 1];

  ws.getCell('H10').value = 'Cash Fund:';
  ws.getCell('H10').font = { bold: true };

  ws.mergeCells('G12:H12');
  ws.getCell('G12').value = 'Balance Previous Month:';
  ws.getCell('G12').font = { bold: true };
  ws.getCell('I12').value = prevBalance;
  ws.getCell('I12').numFmt = EUR_FMT;

  // שורת כותרות הטבלה (14)
  const headers = ['Nº', 'Date', 'Entity', 'Doc. Nº', 'Description', 'Cash inflow', 'Cash Outflow', 'Balance'];
  headers.forEach((h, i) => {
    const cell = ws.getCell(14, 2 + i); // B..I
    cell.value = h;
    cell.font = { bold: true };
    cell.border = { bottom: { style: 'thin' } };
  });

  // ── שורות הנתונים (15+) ─────────────────────────────────────
  const DATA_START = 15;
  let inflowSum = 0;
  let outflowSum = 0;

  rows.forEach((r, idx) => {
    const rowNum = DATA_START + idx;
    inflowSum += r.inflow || 0;
    outflowSum += r.outflow || 0;

    ws.getCell(rowNum, 2).value = idx + 1; // Nº (income=1, אח"כ 2,3...)
    const dateCell = ws.getCell(rowNum, 3);
    dateCell.value = isoToLocalDate(r.date);
    dateCell.numFmt = DATE_FMT;

    const entityCell = ws.getCell(rowNum, 4);
    entityCell.value = r.entity || '';
    if (r.isDeposit) {
      entityCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    }

    if (r.docNum) ws.getCell(rowNum, 5).value = r.docNum;
    ws.getCell(rowNum, 6).value = r.description || '';

    if (r.inflow > 0) {
      const c = ws.getCell(rowNum, 7);
      c.value = r.inflow;
      c.numFmt = EUR_FMT;
    }
    if (r.outflow > 0) {
      const c = ws.getCell(rowNum, 8);
      c.value = r.outflow;
      c.numFmt = EUR_FMT;
    }
  });

  const lastDataRow = DATA_START + rows.length - 1;
  // היתרה הרצה ממשיכה עד שורה 88 (או מעבר אם יש הרבה תנועות) — כך I88 מחזיק תמיד את היתרה הסוגרת
  const balEnd = Math.max(88, lastDataRow);

  for (let rowNum = DATA_START; rowNum <= balEnd; rowNum++) {
    const balCell = ws.getCell(rowNum, 9); // I
    balCell.numFmt = EUR_FMT;
    if (rowNum === DATA_START) {
      balCell.value = { formula: `G${rowNum}-H${rowNum}+I12` };
    } else {
      balCell.value = { formula: `I${rowNum - 1}+G${rowNum}-H${rowNum}` };
    }
  }

  // פוטר: Balance: = +I{balEnd}
  const footerRow = balEnd + 2;
  ws.mergeCells(`G${footerRow}:H${footerRow}`);
  ws.getCell(`G${footerRow}`).value = 'Balance:';
  ws.getCell(`G${footerRow}`).font = { bold: true };
  const footerBal = ws.getCell(`I${footerRow}`);
  footerBal.value = { formula: `I${balEnd}` };
  footerBal.numFmt = EUR_FMT;
  footerBal.font = { bold: true };

  const finalBalance = prevBalance + inflowSum - outflowSum;

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerDownload(blob, `cashflow ${sheetName}.xlsx`);

  return { finalBalance, transactionsCount: rows.length, sheetName };
}
