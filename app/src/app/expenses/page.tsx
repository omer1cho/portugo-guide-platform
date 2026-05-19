'use client';

import { useEffect, useState, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  supabase,
  SYSTEM_START_DATE,
  TOUR_TYPES,
  TOURS_WITH_EXPENSE_CATALOG,
  type ExpenseCatalogItem,
} from '@/lib/supabase';
import { uploadExpenseReceipt } from '@/lib/storage';
import PhotoPicker from '@/components/PhotoPicker';
import { useAuthGuard } from '@/lib/auth';
import {
  canEditMonth,
  checkSalaryClosed,
  getMonthEditExplanation,
} from '@/lib/month-policy';

type Expense = {
  id: string;
  expense_date: string;
  item: string;
  amount: number;
  notes: string;
  receipt_url?: string | null;
  tour_type?: string | null;
  catalog_item_id?: string | null;
  quantity?: number | null;
  expected_amount?: number | null;
  price_mismatch?: boolean | null;
  /** מקור התשלום: 'expenses_box' = קופת הוצאות, 'food_market_card' = כרטיס טיים אאוט */
  payment_source?: 'expenses_box' | 'food_market_card';
};

type PaymentSource = 'expenses_box' | 'food_market_card';

const OTHER_OPTION_VALUE = '__other__';
const GENERAL_TOUR_VALUE = '__general__'; // הוצאה שלא קשורה לסיור ספציפי

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatMonthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
}

function ExpensesContent() {
  useAuthGuard();
  const router = useRouter();
  const searchParams = useSearchParams();
  const now = new Date();
  const urlYear = searchParams.get('year');
  const urlMonth = searchParams.get('month');
  const year = urlYear ? parseInt(urlYear) : now.getFullYear();
  const month = urlMonth ? parseInt(urlMonth) - 1 : now.getMonth();
  const isCurrent = year === now.getFullYear() && month === now.getMonth();

  const [guideId, setGuideId] = useState<string | null>(null);
  const [guideCity, setGuideCity] = useState<'lisbon' | 'porto'>('lisbon');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [catalog, setCatalog] = useState<ExpenseCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  // האם החודש הנבחר נסגר (יש salary_withdrawal). משפיע על האפשרות להוסיף/לערוך.
  const [salaryClosed, setSalaryClosed] = useState(false);
  const editable = canEditMonth(year, month, salaryClosed);
  const lockReason = getMonthEditExplanation(year, month, salaryClosed);

  // form state
  const [date, setDate] = useState(todayISO());
  const [tourType, setTourType] = useState<string>('');
  const [selectedItemValue, setSelectedItemValue] = useState<string>(''); // catalog id or OTHER_OPTION_VALUE
  const [otherDescription, setOtherDescription] = useState('');
  const [quantity, setQuantity] = useState<string>('');
  const [amount, setAmount] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  // edit / delete state
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [expenseToDelete, setExpenseToDelete] = useState<Expense | null>(null);
  const [deletingExpense, setDeletingExpense] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // ─── תת-קופת "כרטיס טיים אאוט" — רק למדריכי קולינרי ───
  // hasCulinaryHistory = יש לו ולו סיור קולינרי אחד בעבר (בדיקה דינמית)
  // cardBalance = יתרה נוכחית בכרטיס (sum(card_load) − sum(expenses from card))
  const [hasCulinaryHistory, setHasCulinaryHistory] = useState(false);
  const [cardBalance, setCardBalance] = useState(0);
  // מקור התשלום של ההוצאה הנוכחית בטופס
  const [paymentSource, setPaymentSource] = useState<PaymentSource>('expenses_box');

  useEffect(() => {
    const id = localStorage.getItem('portugo_guide_id');
    const city = localStorage.getItem('portugo_guide_city') as 'lisbon' | 'porto' | null;
    if (!id) {
      router.push('/');
      return;
    }
    setGuideId(id);
    setGuideCity(city || 'lisbon');
    loadExpenses(id);
    loadCatalog();
    loadCardState(id);
    // טעינת סטטוס סגירת משכורת כדי לדעת אם להציג כפתור הוספה
    checkSalaryClosed(supabase, id, year, month).then(setSalaryClosed);
  }, [router, year, month]);

  /**
   * טוען את מצב תת-קופת "כרטיס טיים אאוט":
   * 1. בודק אם המדריך עשה אי פעם סיור קולינרי
   * 2. מחשב יתרה נוכחית: sum(card_load) − sum(expenses where payment_source='food_market_card')
   *    מ-SYSTEM_START_DATE ועד סוף החודש הנבחר (היתרה ממשיכה לחודש הבא כמו כסף פיזי).
   *
   * נופל ל-fallback אם המיגרציה עדיין לא רצה — מציג 0 בלי לשבור את המסך.
   */
  async function loadCardState(id: string) {
    // ─ זיהוי "מדריך קולינרי" ─
    const culinaryCheck = await supabase
      .from('tours')
      .select('id', { count: 'exact', head: true })
      .eq('guide_id', id)
      .eq('tour_type', 'קולינרי');
    const isCulinary = (culinaryCheck.count || 0) > 0;
    setHasCulinaryHistory(isCulinary);

    // ─ יתרה: סוכמים card_load ב-transfers ומורידים expenses מהכרטיס ─
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    const cardLoadRes = await supabase
      .from('transfers')
      .select('amount')
      .eq('guide_id', id)
      .eq('transfer_type', 'card_load')
      .gte('transfer_date', SYSTEM_START_DATE)
      .lte('transfer_date', end);
    const cardLoadSum = (cardLoadRes.data || []).reduce(
      (s: number, t: { amount: number }) => s + (t.amount || 0),
      0,
    );

    let cardExpSum = 0;
    const cardExpRes = await supabase
      .from('expenses')
      .select('amount')
      .eq('guide_id', id)
      .eq('payment_source', 'food_market_card')
      .gte('expense_date', SYSTEM_START_DATE)
      .lte('expense_date', end);
    if (!cardExpRes.error) {
      cardExpSum = (cardExpRes.data || []).reduce(
        (s: number, e: { amount: number }) => s + (e.amount || 0),
        0,
      );
    }
    // אם הקולומה לא קיימת — cardExpSum נשאר 0 → balance = cardLoadSum (סביר ל-fallback)
    setCardBalance(cardLoadSum - cardExpSum);
  }

  async function loadExpenses(id: string) {
    setLoading(true);
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const { data } = await supabase
      .from('expenses')
      .select('*')
      .eq('guide_id', id)
      .gte('expense_date', start)
      .lte('expense_date', end)
      .order('expense_date', { ascending: false });
    setExpenses((data as Expense[]) || []);
    setLoading(false);
  }

  async function loadCatalog() {
    const { data } = await supabase
      .from('expense_catalog')
      .select('*')
      .eq('is_active', true)
      .order('tour_type')
      .order('sort_order');
    setCatalog((data as ExpenseCatalogItem[]) || []);
  }

  // אפשרויות סוג סיור — מסוננות לפי עיר
  const tourOptions = useMemo(() => {
    return TOUR_TYPES[guideCity].filter((t) => t.category !== 'private' || true);
  }, [guideCity]);

  // הפריטים הזמינים לסיור הנבחר (מהקטלוג). "ללא סיור" => אין קטלוג, רק "אחר".
  const itemsForTour = useMemo(() => {
    if (!tourType || tourType === GENERAL_TOUR_VALUE) return [];
    return catalog.filter((c) => c.tour_type === tourType);
  }, [tourType, catalog]);

  const selectedCatalogItem = useMemo(() => {
    if (!selectedItemValue || selectedItemValue === OTHER_OPTION_VALUE) return null;
    return catalog.find((c) => c.id === selectedItemValue) || null;
  }, [selectedItemValue, catalog]);

  // חישוב צפוי לפי הקטלוג + הכמות
  const expectedAmount = useMemo(() => {
    if (!selectedCatalogItem || !selectedCatalogItem.unit_price) return null;
    const q = parseFloat(quantity);
    if (!q || q <= 0) return null;
    return Number((q * selectedCatalogItem.unit_price).toFixed(2));
  }, [selectedCatalogItem, quantity]);

  // מילוי אוטומטי של הסכום כשהצפוי משתנה
  useEffect(() => {
    if (expectedAmount !== null) {
      setAmount(expectedAmount.toFixed(2));
    }
  }, [expectedAmount]);

  const isOther = selectedItemValue === OTHER_OPTION_VALUE;
  const calcType = selectedCatalogItem?.calc_type || null;

  // איפוס בחירת פריט כשמשתנה סוג הסיור.
  // ב"ללא סיור / הוצאה כללית" — אין קטלוג, אז מדלגים אוטומטית לבחירת "אחר"
  // כדי לחסוך למדריך שלב מיותר של בחירה מתפריט.
  useEffect(() => {
    if (tourType === GENERAL_TOUR_VALUE) {
      setSelectedItemValue(OTHER_OPTION_VALUE);
    } else {
      setSelectedItemValue('');
    }
    setQuantity('');
    setAmount('');
    setOtherDescription('');
    // איפוס מקור תשלום כשמחליפים סיור — חוץ מקולינרי לא רלוונטי הכרטיס
    setPaymentSource('expenses_box');
  }, [tourType]);

  // איפוס מקור תשלום כשמחליפים פריט — אם הפריט החדש לא קרוקט, הבחירה
  // לא רלוונטית. מונע מצב שבו המדריך בחר קרוקט+כרטיס, החליף לפריט אחר,
  // והשמירה תהיה עדיין 'food_market_card' בלי שתוצג בחירה.
  useEffect(() => {
    setPaymentSource('expenses_box');
  }, [selectedItemValue]);

  // האם יש אי-התאמה (רק לפריטים מחושבים)
  const hasMismatch = useMemo(() => {
    if (!expectedAmount) return false;
    const a = parseFloat(amount);
    if (!a) return false;
    return Math.abs(a - expectedAmount) > 0.01;
  }, [expectedAmount, amount]);

  const resetForm = () => {
    setShowForm(false);
    setFormError('');
    setTourType('');
    setSelectedItemValue('');
    setOtherDescription('');
    setQuantity('');
    setAmount('');
    setNotes('');
    setReceipt(null);
    setEditingExpense(null);
    setPaymentSource('expenses_box');
  };

  /** טעינת הוצאה לטופס לעריכה — פותחת את הטופס ממולא */
  const handleEdit = (e: Expense) => {
    setEditingExpense(e);
    setShowForm(true);
    setFormError('');
    setDate(e.expense_date);
    // אם יש tour_type → בוחרים אותו; אחרת → "כללי"
    setTourType(e.tour_type || GENERAL_TOUR_VALUE);
    // אם יש catalog_item_id → בוחרים את הפריט; אחרת → "אחר"
    setSelectedItemValue(e.catalog_item_id || OTHER_OPTION_VALUE);
    if (!e.catalog_item_id) {
      setOtherDescription(e.item || '');
    } else {
      setOtherDescription('');
    }
    setQuantity(e.quantity ? String(e.quantity) : '');
    setAmount(String(e.amount || ''));
    setNotes(e.notes || '');
    setPaymentSource(e.payment_source || 'expenses_box');
    setReceipt(null); // אם רוצים להחליף קבלה — יבחרו חדשה. אחרת — נשארת הקיימת.
    // Scroll to top so the form is visible
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /** מחיקת הוצאה — מאשרים במודאל, אז מוחקים מ-DB. הקבלה ב-Storage נשארת יתומה ולא מוצגת. */
  const handleDeleteConfirmed = async () => {
    if (!expenseToDelete) return;
    setDeletingExpense(true);
    setDeleteError('');
    const { error } = await supabase.from('expenses').delete().eq('id', expenseToDelete.id);
    setDeletingExpense(false);
    if (error) {
      setDeleteError('משהו השתבש: ' + error.message);
      return;
    }
    setExpenseToDelete(null);
    if (guideId) loadExpenses(guideId);
  };

  const handleSave = async () => {
    if (!guideId) return;
    setFormError('');

    if (!tourType) {
      setFormError('נשאר לבחור לאיזה סיור זה היה');
      return;
    }
    if (!selectedItemValue) {
      setFormError('נשאר לבחור פריט');
      return;
    }

    let itemName = '';
    let qtyValue: number | null = null;
    let expectedValue: number | null = null;
    let catalogId: string | null = null;

    if (isOther) {
      if (!otherDescription.trim()) {
        setFormError('נשאר לכתוב תיאור הפריט');
        return;
      }
      itemName = otherDescription.trim();
    } else if (selectedCatalogItem) {
      itemName = selectedCatalogItem.item_name;
      catalogId = selectedCatalogItem.id;
      if (calcType === 'unit' || calcType === 'per_person') {
        const q = parseFloat(quantity);
        if (!q || q <= 0) {
          setFormError(calcType === 'per_person' ? 'נשאר להזין כמה אנשים' : 'נשאר להזין כמות');
          return;
        }
        qtyValue = q;
        expectedValue = expectedAmount;
      }
    }

    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setFormError('נשאר להזין סכום');
      return;
    }
    // ─ ולידציה למקור התשלום: הוצאה מכרטיס לא יכולה לעלות על היתרה ─
    if (paymentSource === 'food_market_card') {
      // אם זו עריכה והסכום הקודם היה גם מהכרטיס — היתרה הזמינה כוללת אותו
      const oldFromCard =
        editingExpense?.payment_source === 'food_market_card'
          ? editingExpense.amount || 0
          : 0;
      const availableInCard = cardBalance + oldFromCard;
      if (amt > availableInCard + 0.001) {
        setFormError(
          `אין מספיק בכרטיס טיים אאוט (יש ${availableInCard.toFixed(2)}€, ביקשת ${amt.toFixed(2)}€). אפשר להטעין את הכרטיס מהקופות.`,
        );
        return;
      }
    }
    // קבלה — חובה אלא אם הפריט מסומן כ-requires_receipt=false.
    // בעריכה: אם כבר יש קבלה קיימת והמדריך לא צירף חדשה — בסדר.
    const requiresReceipt = selectedCatalogItem?.requires_receipt !== false;
    const hasExistingReceipt = editingExpense?.receipt_url ? true : false;
    if (requiresReceipt && !receipt && !hasExistingReceipt) {
      setFormError('נשאר לצרף צילום של הקבלה');
      return;
    }

    setSaving(true);

    // ללא סיור → tour_type = null ב-DB (לא הערך הסנטינלי שמשמש את ה-UI)
    const tourTypeToSave = tourType === GENERAL_TOUR_VALUE ? null : tourType;

    let savedId: string | null = null;
    // אובייקט עם payment_source — אם המיגרציה עוד לא רצה והקולומה לא קיימת,
    // ננסה שוב בלעדיה כדי לא לשבור הזנת הוצאות רגילות.
    const payloadBase = {
      expense_date: date,
      item: itemName,
      amount: amt,
      notes,
      tour_type: tourTypeToSave,
      catalog_item_id: catalogId,
      quantity: qtyValue,
      expected_amount: expectedValue,
      price_mismatch: hasMismatch,
    };
    const payloadWithSource = { ...payloadBase, payment_source: paymentSource };

    if (editingExpense) {
      // ─── מצב עריכה: UPDATE ───
      let updErr = (await supabase
        .from('expenses')
        .update(payloadWithSource)
        .eq('id', editingExpense.id)).error;
      if (updErr && updErr.message?.toLowerCase().includes('payment_source')) {
        // fallback בלי payment_source — אם המיגרציה עדיין לא רצה
        updErr = (await supabase
          .from('expenses')
          .update(payloadBase)
          .eq('id', editingExpense.id)).error;
      }
      if (updErr) {
        setSaving(false);
        setFormError('משהו השתבש: ' + updErr.message);
        return;
      }
      savedId = editingExpense.id;
    } else {
      // ─── מצב יצירה: INSERT ───
      let inserted: { id: string } | null = null;
      let error = null as null | { message?: string };
      {
        const r = await supabase
          .from('expenses')
          .insert({ ...payloadWithSource, guide_id: guideId })
          .select('id')
          .single();
        inserted = r.data as { id: string } | null;
        error = r.error;
      }
      if (error && error.message?.toLowerCase().includes('payment_source')) {
        // fallback בלי payment_source
        const r = await supabase
          .from('expenses')
          .insert({ ...payloadBase, guide_id: guideId })
          .select('id')
          .single();
        inserted = r.data as { id: string } | null;
        error = r.error;
      }

      if (error) {
        setSaving(false);
        setFormError('משהו השתבש: ' + error.message);
        return;
      }
      savedId = inserted?.id || null;
    }

    // העלאת קבלה רק אם הוצמדה — יש פריטים פטורים (בירה בטעימות) שמותרים בלי
    if (savedId && receipt) {
      try {
        const url = await uploadExpenseReceipt({
          file: receipt,
          expenseId: savedId,
          expenseDate: date,
          tourType: tourTypeToSave,
        });
        await supabase.from('expenses').update({ receipt_url: url }).eq('id', savedId);
      } catch (uploadErr) {
        // rollback רק במצב יצירה — בעריכה לא נמחק את הרשומה אם רק החלפת קבלה נכשלה
        if (!editingExpense) {
          await supabase.from('expenses').delete().eq('id', savedId);
        }
        setSaving(false);
        const msg = uploadErr instanceof Error ? uploadErr.message : 'משהו השתבש בהעלאת הקבלה';
        setFormError(`העלאת הקבלה נכשלה: ${msg}. נסי שוב.`);
        return;
      }
    }

    setSaving(false);
    resetForm();
    loadExpenses(guideId);
    loadCardState(guideId); // עדכון יתרת הכרטיס אחרי שמירה
  };

  // ─── סיכומים מפוצלים: מקופת הוצאות / מהכרטיס / סה"כ ───
  const totalFromCard = expenses
    .filter((e) => e.payment_source === 'food_market_card')
    .reduce((s, e) => s + (e.amount || 0), 0);
  const totalFromExpensesBox = expenses
    .filter((e) => e.payment_source !== 'food_market_card')
    .reduce((s, e) => s + (e.amount || 0), 0);
  const total = totalFromCard + totalFromExpensesBox;
  const tourHasCatalog = TOURS_WITH_EXPENSE_CATALOG.has(tourType);
  // האם להציג בחירת מקור תשלום בטופס:
  //   מדריך קולינרי + סיור 'קולינרי' + הפריט הנבחר הוא קרוקט (Croqueteria
  //   Mercado Ribeira) — זה הפריט היחיד שמשלמים עליו עם כרטיס טיים אאוט.
  // הזיהוי לפי שם הפריט (גמיש — תופס "קרוקט" / "קרוקטים" / "Croquettes").
  const selectedItemName = (selectedCatalogItem?.item_name || '').toLowerCase();
  const isCroquetteItem =
    selectedItemName.includes('קרוק') || selectedItemName.includes('croq');
  const showPaymentSourcePicker =
    hasCulinaryHistory && tourType === 'קולינרי' && isCroquetteItem;

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <header className="bg-green-800 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <div className="flex gap-2">
            <button onClick={() => router.back()} className="text-sm bg-green-900 hover:bg-green-950 active:scale-95 transition-transform px-3 py-2 rounded-md">
              ← חזרה
            </button>
            <Link
              href="/home"
              aria-label="מסך הבית"
              className="text-base bg-green-900 hover:bg-green-950 active:scale-95 transition-transform px-3 py-2 rounded-md"
            >
              🏠
            </Link>
          </div>
          <h1 className="text-lg font-bold">הוצאות שלי</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-3">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-xs text-gray-500 mb-1">📅 {formatMonthLabel(year, month)}</div>
          {showPaymentSourcePicker && (totalFromCard > 0 || totalFromExpensesBox > 0) ? (
            <>
              <div className="text-sm text-gray-600 mb-1">סה"כ הוצאות החודש</div>
              <div className="text-2xl font-bold text-amber-700 mb-2">{total.toFixed(2)}€</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                  <div className="text-gray-600">מקופת הוצאות</div>
                  <div className="font-bold text-amber-800">{totalFromExpensesBox.toFixed(2)}€</div>
                </div>
                <div className="bg-orange-50 border border-orange-200 rounded-lg p-2">
                  <div className="text-gray-600">🍴 מכרטיס טיים אאוט</div>
                  <div className="font-bold text-orange-800">{totalFromCard.toFixed(2)}€</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="text-sm text-gray-600">סה"כ הוצאות (מקופת הוצאות)</div>
              <div className="text-2xl font-bold text-amber-700">{total.toFixed(2)}€</div>
            </>
          )}
        </div>

        {!showForm && editable && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-red-600 hover:bg-red-700 active:scale-98 transition-all text-white rounded-2xl shadow-lg py-4 text-lg font-bold"
          >
            הוסף.י הוצאה +
          </button>
        )}
        {!showForm && !editable && lockReason && (
          <div className="bg-gray-100 border border-gray-300 rounded-xl p-3 text-sm text-gray-700 text-center">
            🔒 {lockReason}
          </div>
        )}

        {showForm && (
          <div className="bg-white rounded-xl shadow p-4 space-y-3">
            <h3 className="font-semibold">{editingExpense ? 'עריכת הוצאה' : 'הוצאה חדשה'}</h3>

            {/* תאריך */}
            <div>
              <label className="block text-sm font-semibold mb-1">תאריך</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg box-border"
              />
              {date && (
                <p className="text-sm text-green-700 mt-1 font-medium">
                  📅 {new Date(date + 'T00:00:00').toLocaleDateString('he-IL', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </p>
              )}
            </div>

            {/* באיזה סיור */}
            <div>
              <label className="block text-sm font-semibold mb-1">
                לאיזה סיור זה היה? <span className="text-red-600">*</span>
              </label>
              <select
                value={tourType}
                onChange={(e) => setTourType(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
              >
                <option value="">-- בחר.י --</option>
                <option value={GENERAL_TOUR_VALUE}>ללא סיור / הוצאה כללית</option>
                {tourOptions.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* בחירת פריט — מוסתר ב"ללא סיור / הוצאה כללית" כי שם אין קטלוג */}
            {tourType && tourType !== GENERAL_TOUR_VALUE && (
              <div>
                <label className="block text-sm font-semibold mb-1">
                  פריט <span className="text-red-600">*</span>
                </label>
                <select
                  value={selectedItemValue}
                  onChange={(e) => setSelectedItemValue(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                >
                  <option value="">-- בחר.י --</option>
                  {itemsForTour.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.item_name}
                      {item.calc_type === 'unit' && item.unit_price ? ` · ${item.unit_price}€/יחידה` : ''}
                      {item.calc_type === 'per_person' && item.unit_price ? ` · ${item.unit_price}€/אדם` : ''}
                      {item.calc_type === 'manual_amount' ? ' · סכום ידני' : ''}
                    </option>
                  ))}
                  <option value={OTHER_OPTION_VALUE}>
                    {tourHasCatalog ? 'אחר (פריט שלא ברשימה)' : 'אחר · סכום ידני'}
                  </option>
                </select>
              </div>
            )}

            {/* תיאור — רק ב"אחר" */}
            {selectedItemValue && isOther && (
              <div>
                <label className="block text-sm font-semibold mb-1">
                  תיאור הפריט <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  value={otherDescription}
                  onChange={(e) => setOtherDescription(e.target.value)}
                  placeholder="פרט.י מה קנית"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            )}

            {/* כמות — רק ב-unit/per_person */}
            {selectedCatalogItem && (calcType === 'unit' || calcType === 'per_person') && (
              <div>
                <label className="block text-sm font-semibold mb-1">
                  {calcType === 'per_person' ? 'כמה אנשים?' : 'כמות'} <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9.,]*"
                  value={quantity}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                    const parts = cleaned.split('.');
                    const final = parts.length > 2
                      ? parts[0] + '.' + parts.slice(1).join('')
                      : cleaned;
                    setQuantity(final);
                  }}
                  placeholder={calcType === 'per_person' ? '8' : '5'}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg"
                />
                {expectedAmount !== null && (
                  <p className="text-xs text-blue-700 mt-1">
                    💡 חישוב: {quantity} × {selectedCatalogItem.unit_price}€ ={' '}
                    <span className="font-bold">{expectedAmount.toFixed(2)}€</span>
                  </p>
                )}
              </div>
            )}

            {/* סכום בפועל (תמיד מופיע אחרי שיש פריט) */}
            {selectedItemValue && (
              <div>
                <label className="block text-sm font-semibold mb-1">
                  סכום בפועל (מהקבלה) <span className="text-red-600">*</span>
                </label>
                {/*
                  type=text + inputMode=decimal: על Android יש מקלדות שלא
                  מציגות נקודה ב-type=number. עם text המקלדת הדצימלית
                  מובטחת. מקבלים גם נקודה וגם פסיק כמפריד דצימלי.
                */}
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="[0-9.,]*"
                  value={amount}
                  onChange={(e) => {
                    const cleaned = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                    // מסיר נקודות מרובות (לא יכול להיות 6.2.3)
                    const parts = cleaned.split('.');
                    const final = parts.length > 2
                      ? parts[0] + '.' + parts.slice(1).join('')
                      : cleaned;
                    setAmount(final);
                  }}
                  placeholder="0.00"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg"
                />
                {hasMismatch && expectedAmount !== null && (
                  <div className="mt-2 bg-amber-50 border border-amber-300 rounded-lg p-3 text-sm text-amber-900">
                    ⚠️ הסכום שונה מהחישוב ({expectedAmount.toFixed(2)}€).
                    <br />
                    בבקשה <span className="font-bold">תעדכני את פורטוגו</span> שמחיר הפריט השתנה — את.ה יכול.ה לשמור את הסכום בפועל ולהמשיך.
                  </div>
                )}
              </div>
            )}

            {/* מקור התשלום — רק למדריכי קולינרי (כרטיס טיים אאוט).
                מוצג תמיד בטופס פתוח, כדי שהמדריך יראה את האפשרות גם לפני בחירת פריט. */}
            {showPaymentSourcePicker && (
              <div>
                <label className="block text-sm font-semibold mb-2">
                  מאיפה שולם?
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentSource('expenses_box')}
                    className={`text-sm py-2.5 rounded-lg border-2 font-semibold transition-all ${
                      paymentSource === 'expenses_box'
                        ? 'border-amber-600 bg-amber-50 text-amber-900'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    💼 קופת הוצאות
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentSource('food_market_card')}
                    className={`text-sm py-2.5 rounded-lg border-2 font-semibold transition-all ${
                      paymentSource === 'food_market_card'
                        ? 'border-orange-600 bg-orange-50 text-orange-900'
                        : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    🍴 כרטיס טיים אאוט
                  </button>
                </div>
                {paymentSource === 'food_market_card' && (
                  <p className="text-xs text-orange-700 mt-1.5">
                    יש בכרטיס: <span className="font-bold">{cardBalance.toFixed(2)}€</span>
                  </p>
                )}
              </div>
            )}

            {/* הערות */}
            <div>
              <label className="block text-sm font-semibold mb-1">הערות (לא חובה)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>

            {/* קבלה — חובה אלא אם הפריט מסומן כפטור (למשל בירה בטעימות) */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                צילום קבלה
                {selectedCatalogItem?.requires_receipt === false ? (
                  <span className="text-gray-400 text-xs font-normal"> (לא חובה)</span>
                ) : (
                  <span className="text-red-600"> *</span>
                )}
              </label>
              <PhotoPicker
                label="צרף.י קבלה"
                emoji="🧾"
                value={receipt}
                onChange={setReceipt}
              />
            </div>

            {formError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
                {formError}
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-green-700 disabled:bg-gray-400 text-white rounded-lg py-3 font-semibold"
              >
                {saving
                  ? (editingExpense ? 'מעדכנ.ת...' : 'שומר.ת...')
                  : (editingExpense ? 'עדכן.י' : 'שמור.י')}
              </button>
              <button
                onClick={resetForm}
                className="px-4 bg-gray-200 rounded-lg font-semibold"
              >
                ביטול
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-500">רגע, מושך נתונים...</div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-white rounded-xl shadow">
            {isCurrent ? 'ריק בינתיים. כשתוסיף.י הוצאה — היא תופיע כאן.' : 'לא נרשמו הוצאות בחודש זה.'}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow">
            <div className="p-4 border-b font-semibold">היסטוריית הוצאות</div>
            {expenses.map((e) => (
              <div key={e.id} className="p-4 border-b last:border-b-0">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex-1">
                    <div className="font-semibold flex items-center gap-2 flex-wrap">
                      <span>{e.item}</span>
                      {e.quantity ? (
                        <span className="text-xs text-gray-500">× {e.quantity}</span>
                      ) : null}
                      {e.receipt_url && (
                        <a
                          href={e.receipt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium hover:bg-blue-100"
                        >
                          🧾 קבלה
                        </a>
                      )}
                      {e.price_mismatch && (
                        <span
                          title="הסכום בפועל לא תאם את החישוב"
                          className="text-[11px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded-full font-medium"
                        >
                          ⚠️ אי-התאמה
                        </span>
                      )}
                      {e.payment_source === 'food_market_card' && (
                        <span
                          title="הוצאה מכרטיס טיים אאוט (לא מקופת הוצאות)"
                          className="text-[11px] bg-orange-100 text-orange-900 px-2 py-0.5 rounded-full font-medium"
                        >
                          🍴 מהכרטיס
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-500">
                      {new Date(e.expense_date).toLocaleDateString('he-IL')}
                      {e.notes && ' · ' + e.notes}
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="font-bold text-amber-700">{e.amount.toFixed(2)}€</div>
                    {e.expected_amount && e.price_mismatch && (
                      <div className="text-[11px] text-gray-400 line-through">
                        {e.expected_amount.toFixed(2)}€
                      </div>
                    )}
                  </div>
                </div>
                {/* כפתורי עריכה ומחיקה — רק כשהחודש פתוח לעריכה */}
                {editable && (
                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <button
                      onClick={() => handleEdit(e)}
                      className="flex-1 bg-amber-50 hover:bg-amber-100 active:scale-95 transition-transform text-amber-800 text-sm font-semibold px-3 py-2 rounded-md"
                    >
                      עריכה
                    </button>
                    <button
                      onClick={() => setExpenseToDelete(e)}
                      className="text-red-600 text-sm px-3 py-2 rounded-md hover:bg-red-50"
                    >
                      מחיקה
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete confirmation modal — מודאל מעוצב במקום window.confirm */}
      {expenseToDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 animate-[fadeIn_200ms_ease-out]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-[slideUp_300ms_ease-out]">
            <div className="text-center">
              <div className="text-4xl mb-2">🗑</div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">למחוק את ההוצאה?</h3>
              <p className="text-sm text-gray-600 mb-4">
                <span className="font-semibold">{expenseToDelete.item}</span>
                {' · '}
                <span>{expenseToDelete.amount.toFixed(2)}€</span>
                <br />
                <span className="text-xs text-gray-500">
                  {new Date(expenseToDelete.expense_date).toLocaleDateString('he-IL')}
                </span>
              </p>
            </div>
            {deleteError && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm mb-3">
                {deleteError}
              </div>
            )}
            <div className="flex flex-col gap-2">
              <button
                onClick={handleDeleteConfirmed}
                disabled={deletingExpense}
                className="w-full bg-red-600 hover:bg-red-700 active:scale-98 disabled:bg-gray-400 transition-all text-white rounded-xl py-3 font-bold"
              >
                {deletingExpense ? 'מוחק.ת...' : 'כן, למחוק'}
              </button>
              <button
                onClick={() => {
                  setExpenseToDelete(null);
                  setDeleteError('');
                }}
                disabled={deletingExpense}
                className="w-full bg-gray-100 hover:bg-gray-200 active:scale-98 transition-all text-gray-700 rounded-xl py-3 font-medium text-sm"
              >
                ביטול
              </button>
            </div>
          </div>
          <style jsx global>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
          `}</style>
        </div>
      )}
    </div>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">טוען...</div>}>
      <ExpensesContent />
    </Suspense>
  );
}
