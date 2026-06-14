/**
 * טיפוסים משותפים להצעת מחיר — נשמרים בעמודת selection (jsonb) בטבלת quotes,
 * ונקראים גם ע"י מסך ההזנה (אדמין) וגם ע"י עמוד הלקוח /quote/[uuid].
 */

/** עמודת תרחיש אחת בהצעה (1 = בלוק יחיד, 2 = שתי עמודות זו לצד זו). */
export type QuoteColumn =
  | { type: 'exact'; adults: number; childrenAges: number[] }   // כמות מדויקת → מציג סה"כ
  | { type: 'band'; minSize: number; maxSize: number };          // טווח/מדרגה → רק מחיר לאדם

/** בחירת סיור בהצעה. */
export type QuoteTourSel = {
  tourSlug: string;                // לתמחור (מהטבלאות; קולינרי=טעימות, סינטרה=אראבידה חולקים טבלה)
  card?: string;                   // data-tour של הכרטיס במוקאפ להצגה (מבחין קולינרי↔טעימות, סינטרה↔אראבידה, ליסבון↔פורטו קלאסית)
  variant?: 'regular' | 'short';   // קלאסי בלבד
  comboSlug?: string;              // אם זו הצעת שילוב
  car?: 'half' | 'full' | null;    // רכב צמוד (קלאסי/בלם)
};

/** כל ההצעה (נשמר ב-selection jsonb). */
export type QuoteSelection = {
  customerName: string;
  columns: QuoteColumn[];   // 1 או 2
  tours: QuoteTourSel[];
  notes?: string;
};
