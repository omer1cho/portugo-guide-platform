'use client';

import { useEffect, useState, Suspense, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  supabase,
  TOUR_TYPES,
  TOURS_WITH_EXPENSE_CATALOG,
  type ExpenseCatalogItem,
} from '@/lib/supabase';
import { uploadExpenseReceipt } from '@/lib/storage';
import PhotoPicker from '@/components/PhotoPicker';
import { useAuthGuard } from '@/lib/auth';

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
};

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
  }, [router, year, month]);

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

  // איפוס בחירת פריט כשמשתנה סוג הסיור
  useEffect(() => {
    setSelectedItemValue('');
    setQuantity('');
    setAmount('');
    setOtherDescription('');
  }, [tourType]);

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
    if (!receipt) {
      setFormError('נשאר לצרף צילום של הקבלה');
      return;
    }

    setSaving(true);

    // ללא סיור → tour_type = null ב-DB (לא הערך הסנטינלי שמשמש את ה-UI)
    const tourTypeToSave = tourType === GENERAL_TOUR_VALUE ? null : tourType;

    const { data: inserted, error } = await supabase
      .from('expenses')
      .insert({
        guide_id: guideId,
        expense_date: date,
        item: itemName,
        amount: amt,
        notes,
        tour_type: tourTypeToSave,
        catalog_item_id: catalogId,
        quantity: qtyValue,
        expected_amount: expectedValue,
        price_mismatch: hasMismatch,
      })
      .select('id')
      .single();

    if (error) {
      setSaving(false);
      setFormError('משהו השתבש: ' + error.message);
      return;
    }

    if (inserted?.id) {
      try {
        const url = await uploadExpenseReceipt({
          file: receipt,
          expenseId: inserted.id,
          expenseDate: date,
          tourType: tourTypeToSave,
        });
        await supabase.from('expenses').update({ receipt_url: url }).eq('id', inserted.id);
      } catch (uploadErr) {
        // rollback
        await supabase.from('expenses').delete().eq('id', inserted.id);
        setSaving(false);
        const msg = uploadErr instanceof Error ? uploadErr.message : 'משהו השתבש בהעלאת הקבלה';
        setFormError(`העלאת הקבלה נכשלה: ${msg}. נסי שוב.`);
        return;
      }
    }

    setSaving(false);
    resetForm();
    loadExpenses(guideId);
  };

  const total = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const tourHasCatalog = TOURS_WITH_EXPENSE_CATALOG.has(tourType);

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <header className="bg-green-800 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <button onClick={() => router.back()} className="text-sm bg-green-900 hover:bg-green-950 active:scale-95 transition-transform px-3 py-2 rounded-md">
            ← חזרה
          </button>
          <h1 className="text-lg font-bold">הוצאות שלי</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-3">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-xs text-gray-500 mb-1">📅 {formatMonthLabel(year, month)}</div>
          <div className="text-sm text-gray-600">סה"כ הוצאות (מקופת הוצאות)</div>
          <div className="text-2xl font-bold text-amber-700">{total.toFixed(2)}€</div>
        </div>

        {!showForm && isCurrent && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-red-600 hover:bg-red-700 active:scale-98 transition-all text-white rounded-2xl shadow-lg py-4 text-lg font-bold"
          >
            הוסיפ.י הוצאה +
          </button>
        )}

        {showForm && (
          <div className="bg-white rounded-xl shadow p-4 space-y-3">
            <h3 className="font-semibold">הוצאה חדשה</h3>

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

            {/* בחירת פריט (אחרי שנבחר סיור) */}
            {tourType && (
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
                  type="number"
                  min="0"
                  step={calcType === 'per_person' ? '1' : '0.01'}
                  inputMode="decimal"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
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
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
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

            {/* קבלה */}
            <div>
              <label className="block text-sm font-semibold mb-2">
                צילום קבלה <span className="text-red-600">*</span>
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
                {saving ? 'שומר...' : 'שמור'}
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
              <div key={e.id} className="p-4 border-b last:border-b-0 flex justify-between">
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
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(e.expense_date).toLocaleDateString('he-IL')}
                    {e.notes && ' · ' + e.notes}
                  </div>
                </div>
                <div className="text-left">
                  <div className="font-bold text-amber-700">{e.amount.toFixed(2)}€</div>
                  {e.expected_amount && e.price_mismatch && (
                    <div className="text-[11px] text-gray-400 line-through">
                      {e.expected_amount.toFixed(2)}€
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
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
