/**
 * Storage helpers — תמונות סיור + קבלות
 *
 * המבנה ב-Supabase Storage (ASCII בלבד! Supabase Storage לא תומך בנתיבים בעברית):
 *   tour-photos/<year>/<tour_slug>/<YYYY-MM-DD>_<tour_id>.jpg
 *   expense-receipts/<year>/<MM-month>/<tour_slug>/<expense_id>.jpg
 *
 * כשנוסיף סנכרון ל-Drive בעתיד — נמיר את ה-slugs לשמות תיקיות בעברית
 * דרך הפונקציה tourTypeFolderLabel ו-monthLabel.
 */

import { supabase } from './supabase';

const HE_MONTH_LABELS = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
];

const EN_MONTH_SLUGS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

const TOUR_TYPE_SLUGS: Record<string, string> = {
  'קלאסי_1':  'lisbon-classic',
  'פורטו_1':  'porto-classic',
  'בלם_1':    'belem',
  'קולינרי':  'culinary',
  'סינטרה':   'sintra',
  'אראבידה':  'arabida',
  'אובידוש':  'obidos',
  'יינות':    'wines',
  'טעימות':   'tastings',
  'דורו':     'douro',
  'פרטי_1':   'private',
  'פרטי_2':   'private',
};

const TOUR_TYPE_LABELS: Record<string, string> = {
  'קלאסי_1':  'ליסבון הקלאסית',
  'פורטו_1':  'פורטו הקלאסית',
  'בלם_1':    'בלם',
  'קולינרי':  'קולינרי',
  'סינטרה':   'סינטרה',
  'אראבידה':  'אראבידה',
  'אובידוש':  'אובידוש',
  'יינות':    'יינות',
  'טעימות':   'טעימות',
  'דורו':     'דורו',
  'פרטי_1':   'סיורים פרטיים',
  'פרטי_2':   'סיורים פרטיים',
};

/** ASCII slug לחודש: "04-april" וכדומה — לשימוש ב-Supabase Storage */
export function monthSlug(dateIso: string): string {
  const d = new Date(dateIso + 'T00:00:00');
  const m = d.getMonth();
  const mm = String(m + 1).padStart(2, '0');
  return `${mm}-${EN_MONTH_SLUGS[m]}`;
}

/** תווית עברית לחודש: "04-אפריל" — לסנכרון עתידי ל-Drive */
export function monthLabel(dateIso: string): string {
  const d = new Date(dateIso + 'T00:00:00');
  const m = d.getMonth();
  const mm = String(m + 1).padStart(2, '0');
  return `${mm}-${HE_MONTH_LABELS[m]}`;
}

/** ASCII slug לסוג סיור: "lisbon-classic" וכדומה — לשימוש ב-Supabase Storage */
export function tourTypeFolderSlug(tourType: string | null | undefined): string {
  if (!tourType) return 'general';
  return TOUR_TYPE_SLUGS[tourType] || tourType.replace(/[^\w-]/g, '_');
}

/** תווית עברית לסוג סיור: "ליסבון הקלאסית" וכדומה — לסנכרון עתידי ל-Drive */
export function tourTypeFolderLabel(tourType: string | null | undefined): string {
  if (!tourType) return 'כללי';
  return TOUR_TYPE_LABELS[tourType] || tourType;
}

/**
 * דוחס תמונה לפני העלאה — חוסך נפח אחסון ומאיץ העלאה במובייל.
 * מקסימום 1600px בצד הארוך, JPEG באיכות 0.85.
 * אם הדפדפן לא תומך — מחזיר את הקובץ המקורי בלי טיפול.
 */
export async function compressImage(file: File): Promise<File> {
  if (typeof window === 'undefined' || !window.createImageBitmap) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const MAX_DIM = 1600;
    let { width, height } = bitmap;
    if (width > MAX_DIM || height > MAX_DIM) {
      const ratio = MAX_DIM / Math.max(width, height);
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob: Blob | null = await new Promise((res) =>
      canvas.toBlob((b) => res(b), 'image/jpeg', 0.85),
    );
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, '.jpg'), { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

/**
 * מעלה תמונת סיור.
 * מבנה ב-Supabase Storage (ASCII): <year>/<tour_slug>/<YYYY-MM-DD>_<tour_id>.jpg
 */
export async function uploadTourPhoto(opts: {
  file: File;
  tourId: string;
  tourDate: string;
  tourType: string;
}): Promise<string> {
  const compressed = await compressImage(opts.file);
  const year = opts.tourDate.slice(0, 4);
  const folder = tourTypeFolderSlug(opts.tourType);
  const path = `${year}/${folder}/${opts.tourDate}_${opts.tourId}.jpg`;

  const { error } = await supabase.storage
    .from('tour-photos')
    .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });

  if (error) throw error;

  const { data } = supabase.storage.from('tour-photos').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * מעלה אסמכתא להעברה לפורטוגו.
 * מבנה ב-Supabase Storage (ASCII): <year>/<MM-month>/<transfer_id>.jpg
 *
 * זה רלוונטי רק ל-transfer_type = 'to_portugo' (העברות יזומות מהמדריך).
 * חיזוקי מעטפות (cash_refill / expenses_refill / salary_withdrawal) לא
 * דורשים אסמכתא — הם פעולות פנימיות של המדריך.
 */
export async function uploadTransferReceipt(opts: {
  file: File;
  transferId: string;
  transferDate: string;
}): Promise<string> {
  const compressed = await compressImage(opts.file);
  const year = opts.transferDate.slice(0, 4);
  const month = monthSlug(opts.transferDate);
  const path = `${year}/${month}/${opts.transferId}.jpg`;

  const { error } = await supabase.storage
    .from('transfer-receipts')
    .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });

  if (error) throw error;

  const { data } = supabase.storage.from('transfer-receipts').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * מעלה קבלה חודשית — קבלת מס שהמדריך מוציא לפורטוגו על המשכורת.
 *
 * תיקיית האחסון נקבעת לפי **חודש ההוצאה בפועל** (היום). כך, אם המדריך
 * הוציא קבלה במאי על משכורת אפריל — היא תיכנס לתיקיית מאי.
 * שם הקובץ כולל את תקופת המשכורת ("for_YYYY-MM") כדי שיהיה ברור לאיזה חודש.
 *
 * מבנה (ASCII): <upload_year>/<MM-upload_month>/<guide_id>_for_<period_year>-<period_month>.jpg
 */
export async function uploadMonthlyReceipt(opts: {
  file: File;
  guideId: string;
  /** החודש שעבורו הקבלה (תקופת המשכורת) — לא חודש ההעלאה */
  receiptYear: number;
  receiptMonth: number; // 1-12
}): Promise<string> {
  const isPdf = opts.file.type === 'application/pdf';
  // PDF — להעלות כמו שהוא (אסמכתא חשבונאית, לא לדחוס).
  // תמונה — לדחוס לפני העלאה.
  const payload = isPdf ? opts.file : await compressImage(opts.file);
  const ext = isPdf ? 'pdf' : 'jpg';
  const contentType = isPdf ? 'application/pdf' : 'image/jpeg';

  const today = new Date();
  const uploadYear = today.getFullYear();
  const uploadMonthIdx = today.getMonth(); // 0-11
  const mm = String(uploadMonthIdx + 1).padStart(2, '0');
  const folderMonth = `${mm}-${EN_MONTH_SLUGS[uploadMonthIdx]}`;
  const periodMm = String(opts.receiptMonth).padStart(2, '0');
  const path = `${uploadYear}/${folderMonth}/${opts.guideId}_for_${opts.receiptYear}-${periodMm}.${ext}`;

  const { error } = await supabase.storage
    .from('monthly-receipts')
    .upload(path, payload, { upsert: true, contentType });

  if (error) throw error;

  const { data } = supabase.storage.from('monthly-receipts').getPublicUrl(path);
  return data.publicUrl;
}

/**
 * מעלה קבלה.
 * מבנה ב-Supabase Storage (ASCII): <year>/<MM-month>/<tour_slug>/<expense_id>.jpg
 */
export async function uploadExpenseReceipt(opts: {
  file: File;
  expenseId: string;
  expenseDate: string;
  tourType: string | null | undefined;
}): Promise<string> {
  const compressed = await compressImage(opts.file);
  const year = opts.expenseDate.slice(0, 4);
  const month = monthSlug(opts.expenseDate);
  const folder = tourTypeFolderSlug(opts.tourType);
  const path = `${year}/${month}/${folder}/${opts.expenseId}.jpg`;

  const { error } = await supabase.storage
    .from('expense-receipts')
    .upload(path, compressed, { upsert: true, contentType: 'image/jpeg' });

  if (error) throw error;

  const { data } = supabase.storage.from('expense-receipts').getPublicUrl(path);
  return data.publicUrl;
}
