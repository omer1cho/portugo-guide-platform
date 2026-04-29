'use client';

/**
 * /post-tour-expenses?tourId=...
 *
 * עמוד שאחרי שמירת סיור (לסיורים עם קטלוג הוצאות), מאפשר למדריך לרשום
 * הוצאות הקשורות לסיור — בלי לצאת מהזרימה. כל הוצאה נשמרת בנפרד עם קבלה.
 *
 * המדריך יכול להוסיף כמה הוצאות שצריך, או לסגור עם "לא היו הוצאות".
 */

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  supabase,
  TOUR_TYPES,
  type ExpenseCatalogItem,
} from '@/lib/supabase';
import { uploadExpenseReceipt } from '@/lib/storage';
import PhotoPicker from '@/components/PhotoPicker';
import { useAuthGuard } from '@/lib/auth';

const OTHER_OPTION_VALUE = '__other__';

type SavedExpense = {
  id: string;
  item: string;
  amount: number;
  quantity?: number | null;
  price_mismatch?: boolean | null;
  receipt_url?: string | null;
};

type TourSummary = {
  id: string;
  tour_date: string;
  tour_type: string;
  totalPeople: number;
};

function PostTourExpensesContent() {
  useAuthGuard();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tourId = searchParams.get('tourId');

  const [guideId, setGuideId] = useState<string | null>(null);
  const [tour, setTour] = useState<TourSummary | null>(null);
  const [tourLabel, setTourLabel] = useState<string>('');
  const [catalog, setCatalog] = useState<ExpenseCatalogItem[]>([]);
  const [savedExpenses, setSavedExpenses] = useState<SavedExpense[]>([]);
  const [loading, setLoading] = useState(true);

  // form state
  const [selectedItemValue, setSelectedItemValue] = useState<string>('');
  const [otherDescription, setOtherDescription] = useState('');
  const [quantity, setQuantity] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [showSavedToast, setShowSavedToast] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem('portugo_guide_id');
    const city = localStorage.getItem('portugo_guide_city') as 'lisbon' | 'porto' | null;
    if (!id) {
      router.push('/');
      return;
    }
    if (!tourId) {
      router.push('/home');
      return;
    }
    setGuideId(id);

    (async () => {
      // טעינת פרטי הסיור
      const { data: t } = await supabase
        .from('tours')
        .select('id, tour_date, tour_type, bookings(people)')
        .eq('id', tourId)
        .single();
      if (t) {
        const totalPeople = ((t.bookings as { people: number }[]) || []).reduce((s, b) => s + (b.people || 0), 0);
        setTour({
          id: t.id,
          tour_date: t.tour_date,
          tour_type: t.tour_type,
          totalPeople,
        });
        const allTours = [...(TOUR_TYPES[city || 'lisbon'] || []), ...(TOUR_TYPES.lisbon || []), ...(TOUR_TYPES.porto || [])];
        const found = allTours.find((x) => x.value === t.tour_type);
        setTourLabel(found?.label || t.tour_type);
      }

      // טעינת קטלוג לסוג הסיור הספציפי
      if (t) {
        const { data: cat } = await supabase
          .from('expense_catalog')
          .select('*')
          .eq('is_active', true)
          .eq('tour_type', t.tour_type)
          .order('sort_order');
        setCatalog((cat as ExpenseCatalogItem[]) || []);
      }
      setLoading(false);
    })();
  }, [router, tourId]);

  const selectedCatalogItem = useMemo(() => {
    if (!selectedItemValue || selectedItemValue === OTHER_OPTION_VALUE) return null;
    return catalog.find((c) => c.id === selectedItemValue) || null;
  }, [selectedItemValue, catalog]);

  const isOther = selectedItemValue === OTHER_OPTION_VALUE;
  const calcType = selectedCatalogItem?.calc_type || null;

  const expectedAmount = useMemo(() => {
    if (!selectedCatalogItem || !selectedCatalogItem.unit_price) return null;
    const q = parseFloat(quantity);
    if (!q || q <= 0) return null;
    return Number((q * selectedCatalogItem.unit_price).toFixed(2));
  }, [selectedCatalogItem, quantity]);

  // הצעה אוטומטית למספר אנשים — רק אם זה per_person ועוד לא הוזנה כמות
  useEffect(() => {
    if (calcType === 'per_person' && !quantity && tour?.totalPeople) {
      setQuantity(String(tour.totalPeople));
    }
  }, [calcType, tour?.totalPeople, quantity]);

  // מילוי אוטומטי של הסכום
  useEffect(() => {
    if (expectedAmount !== null) {
      setAmount(expectedAmount.toFixed(2));
    }
  }, [expectedAmount]);

  const hasMismatch = useMemo(() => {
    if (!expectedAmount) return false;
    const a = parseFloat(amount);
    if (!a) return false;
    return Math.abs(a - expectedAmount) > 0.01;
  }, [expectedAmount, amount]);

  const resetForm = () => {
    setSelectedItemValue('');
    setOtherDescription('');
    setQuantity('');
    setAmount('');
    setNotes('');
    setReceipt(null);
    setFormError('');
  };

  const handleSaveExpense = async () => {
    if (!guideId || !tour) return;
    setFormError('');

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

    const { data: inserted, error } = await supabase
      .from('expenses')
      .insert({
        guide_id: guideId,
        expense_date: tour.tour_date,
        item: itemName,
        amount: amt,
        notes,
        tour_type: tour.tour_type,
        catalog_item_id: catalogId,
        quantity: qtyValue,
        expected_amount: expectedValue,
        price_mismatch: hasMismatch,
      })
      .select('id')
      .single();

    if (error || !inserted?.id) {
      setSaving(false);
      setFormError('משהו השתבש: ' + (error?.message || ''));
      return;
    }

    // העלאת קבלה
    let receiptUrl: string | null = null;
    try {
      receiptUrl = await uploadExpenseReceipt({
        file: receipt,
        expenseId: inserted.id,
        expenseDate: tour.tour_date,
        tourType: tour.tour_type,
      });
      await supabase.from('expenses').update({ receipt_url: receiptUrl }).eq('id', inserted.id);
    } catch (uploadErr) {
      // rollback
      await supabase.from('expenses').delete().eq('id', inserted.id);
      setSaving(false);
      const msg = uploadErr instanceof Error ? uploadErr.message : 'משהו השתבש';
      setFormError(`העלאת הקבלה נכשלה: ${msg}. נסי שוב.`);
      return;
    }

    setSavedExpenses((prev) => [
      ...prev,
      {
        id: inserted.id,
        item: itemName,
        amount: amt,
        quantity: qtyValue,
        price_mismatch: hasMismatch,
        receipt_url: receiptUrl,
      },
    ]);

    setSaving(false);
    resetForm();
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 3500);
  };

  const handleFinish = () => {
    router.push('/home?saved=1');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 bg-gray-50">
        רגע, טוען את הסיור...
      </div>
    );
  }

  if (!tour) {
    return (
      <div className="min-h-screen flex items-center justify-center text-gray-500 bg-gray-50">
        לא מצאנו את הסיור.
      </div>
    );
  }

  const tourDateLabel = new Date(tour.tour_date + 'T00:00:00').toLocaleDateString('he-IL', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
  });
  const finishCount = savedExpenses.length;
  const finishButtonText =
    finishCount === 0 ? 'לא היו לי הוצאות בסיור' : 'סיימתי, חזרה למסך הבית';

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* Toast: expense saved */}
      {showSavedToast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-green-700 text-white px-6 py-3 rounded-2xl shadow-lg font-semibold text-center animate-[toastIn_400ms_ease-out]">
          <div>נרשם! 💰</div>
          <div className="text-sm font-medium opacity-90">תוסיף.י עוד או סיים.י</div>
        </div>
      )}

      <header className="bg-green-800 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-md mx-auto">
          <h1 className="text-lg font-bold">הוצאות בסיור</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* כותרת חמה */}
        <div className="bg-white rounded-2xl shadow p-5 text-center border-2 border-green-200">
          <div className="text-4xl mb-2">🎉</div>
          <h2 className="text-lg font-bold text-green-900">הסיור כמעט נשמר!</h2>
          <p className="text-sm text-gray-600 mt-1">
            רגע רגע — כדי לשמור נשאר למלא את ההוצאות מהסיור
          </p>
          <div className="mt-3 bg-green-50 rounded-lg p-2 text-sm">
            <span className="font-semibold">{tourLabel}</span>
            <span className="text-gray-500 mx-1">·</span>
            <span className="text-gray-700">{tourDateLabel}</span>
            {tour.totalPeople > 0 && (
              <>
                <span className="text-gray-500 mx-1">·</span>
                <span className="text-gray-700">{tour.totalPeople} אנשים</span>
              </>
            )}
          </div>
        </div>

        {/* רשימת הוצאות שכבר נרשמו */}
        {savedExpenses.length > 0 && (
          <div className="bg-white rounded-xl shadow">
            <div className="p-3 border-b font-semibold text-sm">
              נרשמו {savedExpenses.length} הוצאות
            </div>
            {savedExpenses.map((e) => (
              <div key={e.id} className="p-3 border-b last:border-b-0 flex justify-between text-sm">
                <div className="flex-1">
                  <div className="font-medium flex items-center gap-2 flex-wrap">
                    <span>{e.item}</span>
                    {e.quantity ? (
                      <span className="text-xs text-gray-500">× {e.quantity}</span>
                    ) : null}
                    {e.receipt_url && <span className="text-xs">🧾</span>}
                    {e.price_mismatch && (
                      <span className="text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded-full">
                        ⚠️
                      </span>
                    )}
                  </div>
                </div>
                <div className="font-bold text-amber-700">{e.amount.toFixed(2)}€</div>
              </div>
            ))}
          </div>
        )}

        {/* טופס הוספת הוצאה */}
        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <h3 className="font-semibold">
            {savedExpenses.length === 0 ? 'הוצאה ראשונה' : 'הוצאה נוספת'}
          </h3>

          {/* בחירת פריט */}
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
              {catalog.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.item_name}
                  {item.calc_type === 'unit' && item.unit_price ? ` · ${item.unit_price}€/יחידה` : ''}
                  {item.calc_type === 'per_person' && item.unit_price ? ` · ${item.unit_price}€/אדם` : ''}
                  {item.calc_type === 'manual_amount' ? ' · סכום ידני' : ''}
                </option>
              ))}
              <option value={OTHER_OPTION_VALUE}>אחר (פריט שלא ברשימה)</option>
            </select>
          </div>

          {/* תיאור — אחר */}
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

          {/* כמות */}
          {selectedCatalogItem && (calcType === 'unit' || calcType === 'per_person') && (
            <div>
              <label className="block text-sm font-semibold mb-1">
                {calcType === 'per_person' ? 'כמה אנשים?' : 'כמות'}{' '}
                <span className="text-red-600">*</span>
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
              {calcType === 'per_person' && tour.totalPeople > 0 && (
                <p className="text-[11px] text-gray-500 mt-1">
                  💡 בסיור היו {tour.totalPeople} אנשים — תשנ.י אם הכמות שונה
                </p>
              )}
              {expectedAmount !== null && (
                <p className="text-xs text-blue-700 mt-1">
                  💡 חישוב: {quantity} × {selectedCatalogItem.unit_price}€ ={' '}
                  <span className="font-bold">{expectedAmount.toFixed(2)}€</span>
                </p>
              )}
            </div>
          )}

          {/* סכום */}
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
          {selectedItemValue && (
            <div>
              <label className="block text-sm font-semibold mb-1">הערות (לא חובה)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          )}

          {/* קבלה */}
          {selectedItemValue && (
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
          )}

          {formError && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              {formError}
            </div>
          )}

          {selectedItemValue && (
            <button
              onClick={handleSaveExpense}
              disabled={saving}
              className="w-full bg-green-700 hover:bg-green-800 active:scale-98 disabled:bg-gray-400 transition-all text-white rounded-xl py-3 font-bold"
            >
              {saving ? 'שומר...' : 'שמור הוצאה והמשך'}
            </button>
          )}
        </div>

        {/* כפתור סיום */}
        <button
          onClick={handleFinish}
          className={`w-full py-3 rounded-xl font-semibold transition-all active:scale-98 ${
            finishCount === 0
              ? 'bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300'
              : 'bg-green-700 hover:bg-green-800 text-white shadow-lg'
          }`}
        >
          {finishButtonText}
        </button>
      </main>

      <style jsx global>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translate(-50%, -10px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}

export default function PostTourExpensesPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-gray-500">טוען...</div>
      }
    >
      <PostTourExpensesContent />
    </Suspense>
  );
}
