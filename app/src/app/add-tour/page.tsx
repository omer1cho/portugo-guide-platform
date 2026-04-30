'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  supabase,
  TOUR_TYPES,
  CUSTOMER_TYPES,
  SOURCES,
  SENIOR_TRAINING_GUIDES,
  TRAINING_LEAD_TOUR_OPTIONS,
  TRAINING_LEAD_TOUR_OPTIONS_BY_CITY,
  TOURS_WITH_EXPENSE_CATALOG,
  type TrainingLeadKind,
  type TrainingLeadTour,
  trainingLeadBase,
  trainingLeadIsFullDay,
  trainingLeadKindLabel,
} from '@/lib/supabase';
import { uploadTourPhoto } from '@/lib/storage';
import PhotoPicker from '@/components/PhotoPicker';
import { useAuthGuard } from '@/lib/auth';

type Booking = {
  people: number;
  kids: number;
  price: number;
  tip: number;
  change_given: number;
  customer_type: string;
  source: string;
  notes: string;
};

function emptyBooking(): Booking {
  return {
    people: 2,
    kids: 0,
    price: 0,
    tip: 0,
    change_given: 0,
    customer_type: '',
    source: '',
    notes: '',
  };
}

function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatHebrewDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('he-IL', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });
}

function AddTourContent() {
  useAuthGuard();
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const isEditMode = !!editId;
  const editActivityId = searchParams.get('editActivity');
  const isEditActivityMode = !!editActivityId;
  // ב-מצב עריכת פעילות אנחנו טוענים את הפעילות, מפענחים את ה-notes
  // ומאכלסים את שדות הטופס. המדריך יכול לערוך כל שדה בתוך אותו סוג פעילות
  // (תצפות/נסיון, איזה סיור, וכו'). בשמירה — UPDATE לרשומה הקיימת.
  // editActivity שומר את הרשומה המקורית כדי שנוכל לדעת את ה-id ואת ה-type
  // המקורי (לאסור החלפת סוג ברמת ה-checkbox).
  const [editActivity, setEditActivity] = useState<{
    id: string;
    activity_type: string;
    activity_date: string;
    amount: number;
    notes: string;
  } | null>(null);
  const [guideId, setGuideId] = useState<string | null>(null);
  const [guideName, setGuideName] = useState<string>('');
  const [guideCity, setGuideCity] = useState<'lisbon' | 'porto'>('lisbon');
  const [mode, setMode] = useState<'tour' | 'activity'>('tour');
  const isSeniorGuide = SENIOR_TRAINING_GUIDES.includes(guideName);

  // Tour state
  const [date, setDate] = useState(todayISO());
  const [tourType, setTourType] = useState('');
  const [tourCategory, setTourCategory] = useState<'classic' | 'fixed' | 'private'>('classic');
  const [notes, setNotes] = useState('');
  const [startTime, setStartTime] = useState('');
  const [totalPeopleExpected, setTotalPeopleExpected] = useState('');
  const [totalPriceExpected, setTotalPriceExpected] = useState('');
  const [bookings, setBookings] = useState<Booking[]>([emptyBooking()]);
  const [tourPhoto, setTourPhoto] = useState<File | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);

  // Activity state — multiple independent activity sections
  const [hasHabraza, setHasHabraza] = useState(false);
  const [hasTraining, setHasTraining] = useState(false);
  const [hasExternal, setHasExternal] = useState(false);
  const [trainingSubtype, setTrainingSubtype] = useState('');
  const [trainingForTour, setTrainingForTour] = useState('');
  // הכשרה שהמדריך הבכיר העביר (training_lead)
  const [isTrainingLead, setIsTrainingLead] = useState(false);
  const [trainingLeadKind, setTrainingLeadKind] = useState<TrainingLeadKind | ''>('');
  const [trainingLeadTour, setTrainingLeadTour] = useState<TrainingLeadTour | ''>('');
  const [externalDescription, setExternalDescription] = useState('');
  const [externalAmount, setExternalAmount] = useState<number>(0);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showMismatchModal, setShowMismatchModal] = useState(false);
  // מודאלים של "שכחת תמונה?"
  const [showPhotoPromptModal, setShowPhotoPromptModal] = useState(false);
  const [showForgotPhotoModal, setShowForgotPhotoModal] = useState(false);

  useEffect(() => {
    const id = localStorage.getItem('portugo_guide_id');
    const name = localStorage.getItem('portugo_guide_name') || '';
    const city = localStorage.getItem('portugo_guide_city') as 'lisbon' | 'porto' | null;
    if (!id) {
      router.push('/');
      return;
    }
    setGuideId(id);
    setGuideName(name);
    setGuideCity(city || 'lisbon');
  }, [router]);

  // Load activity data in edit-activity mode — מפענחים את ה-notes לחזרה לשדות המקוריים
  useEffect(() => {
    if (!editActivityId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('id, activity_type, activity_date, amount, notes')
        .eq('id', editActivityId)
        .single();
      if (cancelled) return;
      if (error || !data) {
        setError('לא מצאנו את הפעילות לעריכה');
        return;
      }
      setEditActivity(data);
      setMode('activity');
      setDate(data.activity_date);

      // ─── פענוח לפי סוג פעילות ───
      const rawNotes = data.notes || '';
      const tokens = rawNotes.split(' · ');

      // נצטרך את העיר של המדריך כדי לפענח tour labels
      const cityFromStorage = (localStorage.getItem('portugo_guide_city') as 'lisbon' | 'porto' | null) || 'lisbon';

      if (data.activity_type === 'habraza') {
        setHasHabraza(true);
        setNotes(rawNotes);
      } else if (data.activity_type === 'training') {
        // פורמט: "${trainingSubtype} · ${tourLabel} · ${notes}"
        setHasTraining(true);
        setIsTrainingLead(false);
        const subtype = tokens[0] || '';
        if (subtype === 'תצפות' || subtype === 'נסיון דפים') {
          setTrainingSubtype(subtype);
        }
        const tourLabel = tokens[1] || '';
        const cityOptions = TOUR_TYPES[cityFromStorage] || [];
        const matchedTour = cityOptions.find((t) => t.label === tourLabel);
        if (matchedTour) {
          setTrainingForTour(matchedTour.value);
        }
        setNotes(tokens.slice(2).join(' · '));
      } else if (data.activity_type === 'training_lead') {
        // פורמט: "${kindLabel} · ${tourLabel}${eshelSuffix} · ${notes}"
        setHasTraining(true);
        setIsTrainingLead(true);
        const kindLabel = tokens[0] || '';
        if (kindLabel === 'תצפות') setTrainingLeadKind('observation');
        else if (kindLabel === 'נסיון דפים') setTrainingLeadKind('paper');
        // tour label עשוי לכלול " (כולל אשל)" — מסירים
        const rawTourLabel = (tokens[1] || '').replace(' (כולל אשל)', '');
        const cityLeadOptions = TRAINING_LEAD_TOUR_OPTIONS_BY_CITY[cityFromStorage] || [];
        const matchedLead = cityLeadOptions.find((t) => t.label === rawTourLabel);
        if (matchedLead) {
          setTrainingLeadTour(matchedLead.value);
        } else {
          // fallback: ננסה לחפש גם ברשימה הכללית (לאחור-תאימות עם רשומות ישנות)
          const legacyMatch = TRAINING_LEAD_TOUR_OPTIONS.find((t) => t.label === rawTourLabel);
          if (legacyMatch) setTrainingLeadTour(legacyMatch.value);
        }
        setNotes(tokens.slice(2).join(' · '));
      } else if (data.activity_type === 'external') {
        // פורמט: "${description} · ${notes}" — אבל description לפעמים נכנס כל הטקסט
        setHasExternal(true);
        setExternalAmount(data.amount || 0);
        // לא ניתן באופן אמין להפריד description מ-notes — הכל נכנס ל-description
        setExternalDescription(rawNotes);
        setNotes('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editActivityId]);

  // Load tour data in edit mode
  useEffect(() => {
    if (!editId) return;
    async function loadTour() {
      const { data: tour, error: tErr } = await supabase
        .from('tours')
        .select('*, bookings(*)')
        .eq('id', editId)
        .single();
      if (tErr || !tour) {
        setError('לא מצאנו את הסיור לעריכה');
        return;
      }
      setMode('tour');
      setDate(tour.tour_date);
      setTourType(tour.tour_type);
      setTourCategory(tour.category as 'classic' | 'fixed' | 'private');
      setNotes(tour.notes || '');
      setStartTime(tour.start_time ? tour.start_time.slice(0, 5) : '');
      setExistingPhotoUrl(tour.photo_url || null);
      const loadedBookings = (tour.bookings || []).map((b: Booking) => ({
        people: b.people || 0,
        kids: b.kids || 0,
        price: b.price || 0,
        tip: b.tip || 0,
        change_given: b.change_given || 0,
        customer_type: b.customer_type || '',
        source: b.source || '',
        notes: b.notes || '',
      }));
      setBookings(loadedBookings.length > 0 ? loadedBookings : [emptyBooking()]);
      // Pre-fill expected totals from summed bookings (so user can verify)
      const totPeople = loadedBookings.reduce((s: number, b: Booking) => s + (b.people || 0), 0);
      const totPrice = loadedBookings.reduce((s: number, b: Booking) => s + (b.price || 0), 0);
      setTotalPeopleExpected(String(totPeople));
      setTotalPriceExpected(String(totPrice));
    }
    loadTour();
  }, [editId]);

  const availableTours = TOUR_TYPES[guideCity];

  const handleTourTypeChange = (val: string) => {
    setTourType(val);
    const t = availableTours.find((x) => x.value === val);
    if (t) setTourCategory(t.category);
  };

  const updateBooking = (idx: number, field: keyof Booking, val: string | number) => {
    const updated = [...bookings];
    updated[idx] = { ...updated[idx], [field]: val };
    setBookings(updated);
  };

  const addBooking = () => setBookings([...bookings, emptyBooking()]);
  const removeBooking = (idx: number) => setBookings(bookings.filter((_, i) => i !== idx));

  /**
   * נקרא כשהמדריך לוחץ "שמור" בטופס סיור.
   * אם בסיור חדש (לא עריכה) חסרה תמונה — מציגים מודאל "שכחת לצרף תמונה?"
   * לפני שמתחילים את השמירה האמיתית.
   */
  const onSaveClicked = () => {
    setError('');
    // רק לסיורים חדשים (לא בעריכה) ורק אם אין תמונה ואין תמונה קיימת
    const noPhoto = !tourPhoto && !existingPhotoUrl;
    if (mode === 'tour' && !isEditMode && noPhoto) {
      setShowPhotoPromptModal(true);
      return;
    }
    handleSave(false, false);
  };

  const handleSave = async (skipMismatchCheck = false, photoSkipped = false) => {
    setError('');
    if (!guideId) return;

    setSaving(true);
    try {
      if (mode === 'activity') {
        // Validate at least one section is checked
        if (!hasHabraza && !hasTraining && !hasExternal) {
          setError('סמן.י לפחות פעילות אחת שקרתה');
          setSaving(false);
          return;
        }

        const activitiesToInsert: Array<{
          guide_id: string;
          activity_date: string;
          activity_type: string;
          amount: number;
          notes: string;
        }> = [];

        if (hasHabraza) {
          activitiesToInsert.push({
            guide_id: guideId,
            activity_date: date,
            activity_type: 'habraza',
            amount: 8,
            notes: notes,
          });
        }

        if (hasTraining) {
          if (isTrainingLead) {
            // הכשרה שאני העברתי (מדריך בכיר)
            if (!trainingLeadKind) {
              setError('בחר.י סוג הכשרה (תצפות / נסיון דפים)');
              setSaving(false);
              return;
            }
            if (!trainingLeadTour) {
              setError('בחר.י על איזה סיור הכשרת');
              setSaving(false);
              return;
            }
            const base = trainingLeadBase(trainingLeadKind, trainingLeadTour);
            const fullDay = trainingLeadIsFullDay(trainingLeadTour);
            const total = base + (fullDay ? 15 : 0);
            const kindLabel = trainingLeadKindLabel(trainingLeadKind);
            // משתמשים ברשימה הספציפית לעיר של המדריך, כדי שהתווית תהיה
            // מדויקת ("ליסבון הקלאסית" ולא "ליסבון / פורטו הקלאסית")
            const cityLeadOptions = TRAINING_LEAD_TOUR_OPTIONS_BY_CITY[guideCity] || [];
            const tourLabel =
              cityLeadOptions.find((t) => t.value === trainingLeadTour)?.label ||
              TRAINING_LEAD_TOUR_OPTIONS.find((t) => t.value === trainingLeadTour)?.label ||
              trainingLeadTour;
            const eshelSuffix = fullDay ? ' (כולל אשל)' : '';
            activitiesToInsert.push({
              guide_id: guideId,
              activity_date: date,
              activity_type: 'training_lead',
              amount: total,
              notes:
                `${kindLabel} · ${tourLabel}${eshelSuffix}` +
                (notes ? ' · ' + notes : ''),
            });
          } else {
            // המדריך כצד המתלמד
            if (!trainingSubtype) {
              setError('בחר.י את סוג ההכשרה');
              setSaving(false);
              return;
            }
            if (!trainingForTour) {
              setError('בחר.י באיזה סיור מדובר ההכשרה');
              setSaving(false);
              return;
            }
            const tourLabel = availableTours.find((t) => t.value === trainingForTour)?.label || trainingForTour;
            activitiesToInsert.push({
              guide_id: guideId,
              activity_date: date,
              activity_type: 'training',
              amount: 10,
              notes: `${trainingSubtype} · ${tourLabel}` + (notes ? ' · ' + notes : ''),
            });
          }
        }

        if (hasExternal) {
          if (!externalDescription) {
            setError('פרט.י את סוג הפעילות ב"אחר"');
            setSaving(false);
            return;
          }
          if (!externalAmount || externalAmount <= 0) {
            setError('נשאר להזין סכום ב"אחר"');
            setSaving(false);
            return;
          }
          activitiesToInsert.push({
            guide_id: guideId,
            activity_date: date,
            activity_type: 'external',
            amount: externalAmount,
            notes: externalDescription + (notes ? ' · ' + notes : ''),
          });
        }

        if (isEditActivityMode && editActivity) {
          // ─── מצב עריכה: UPDATE את השורה הקיימת ───
          // מצופה שיהיה item יחיד ב-activitiesToInsert (כי מסתירים את שאר ה-checkboxes בעריכה)
          if (activitiesToInsert.length !== 1) {
            setError('בעריכה אפשר לערוך פעילות אחת בלבד');
            setSaving(false);
            return;
          }
          const a = activitiesToInsert[0];
          const { error: updErr } = await supabase
            .from('activities')
            .update({
              activity_date: a.activity_date,
              activity_type: a.activity_type, // יכול להשתנות בין 'training' ל-'training_lead'
              amount: a.amount,
              notes: a.notes,
            })
            .eq('id', editActivity.id);
          if (updErr) throw updErr;
        } else {
          const { error: actErr } = await supabase.from('activities').insert(activitiesToInsert);
          if (actErr) throw actErr;
        }
      } else {
        if (!tourType) {
          setError('נשאר לבחור סוג סיור 🙂');
          setSaving(false);
          return;
        }
        if (bookings.length === 0 || bookings.every((b) => b.people === 0)) {
          setError('נשאר להוסיף לפחות תת-קבוצה אחת עם משתתפים');
          setSaving(false);
          return;
        }

        // Customer type + source — required for every booking with people
        const activeBookings = bookings.filter((b) => b.people > 0);
        const missingCustomerType = activeBookings.findIndex((b) => !b.customer_type || !b.customer_type.trim());
        if (missingCustomerType !== -1) {
          setError(`נשאר לבחור סוג לקוח בתת-קבוצה ${missingCustomerType + 1}`);
          setSaving(false);
          return;
        }
        const missingSource = activeBookings.findIndex((b) => !b.source || !b.source.trim());
        if (missingSource !== -1) {
          setError(`נשאר לבחור מקור הגעה בתת-קבוצה ${missingSource + 1}`);
          setSaving(false);
          return;
        }

        // Safety check: warn on mismatch with expected totals
        if (hasMismatch && !skipMismatchCheck) {
          setSaving(false);
          setShowMismatchModal(true);
          return;
        }

        let tourId: string;
        if (isEditMode && editId) {
          // Update existing tour
          const { error: updErr } = await supabase
            .from('tours')
            .update({
              tour_date: date,
              tour_type: tourType,
              category: tourCategory,
              notes,
              start_time: startTime || null,
              updated_at: new Date().toISOString(),
            })
            .eq('id', editId);
          if (updErr) throw updErr;
          // Delete old bookings — will re-insert below
          await supabase.from('bookings').delete().eq('tour_id', editId);
          tourId = editId;
        } else {
          // Insert new tour
          const { data: tour, error: tourErr } = await supabase
            .from('tours')
            .insert({
              guide_id: guideId,
              tour_date: date,
              tour_type: tourType,
              category: tourCategory,
              notes,
              start_time: startTime || null,
              photo_skipped: photoSkipped,
            })
            .select()
            .single();
          if (tourErr) throw tourErr;
          tourId = tour.id;
        }

        // Insert bookings
        const bookingRows = bookings
          .filter((b) => b.people > 0)
          .map((b) => ({
            tour_id: tourId,
            people: b.people,
            kids: b.kids || 0,
            price: b.price || 0,
            tip: b.tip || 0,
            change_given: b.change_given || 0,
            customer_type: b.customer_type,
            source: b.source,
            notes: b.notes,
          }));
        const { error: bkErr } = await supabase.from('bookings').insert(bookingRows);
        if (bkErr) throw bkErr;

        // העלאת תמונת סיור (אם נבחרה) — לאחר שיש לנו tourId
        if (tourPhoto) {
          try {
            const url = await uploadTourPhoto({
              file: tourPhoto,
              tourId,
              tourDate: date,
              tourType,
            });
            await supabase.from('tours').update({ photo_url: url }).eq('id', tourId);
          } catch (photoErr) {
            // לא חוסמים את השמירה — מתעדים לקונסול וממשיכים
            console.error('Photo upload failed:', photoErr);
          }
        }

        // אם הסיור הוא מסוג עם קטלוג הוצאות — נוביל את המדריך לרישום הוצאות
        if (!isEditMode && TOURS_WITH_EXPENSE_CATALOG.has(tourType)) {
          router.push(`/post-tour-expenses?tourId=${tourId}`);
          return;
        }
      }
      // עריכת סיור או פעילות → חזרה ל-/my-tours; הוספה חדשה → /home עם הודעה
      router.push((isEditMode || isEditActivityMode) ? '/my-tours' : '/home?saved=1');
    } catch (e) {
      // Supabase errors are plain objects (not Error instances). Try to surface
      // .message / .details / .hint / .code so we actually see what went wrong.
      let msg = 'משהו השתבש, ננסה שוב?';
      if (e instanceof Error) {
        msg = e.message;
      } else if (e && typeof e === 'object') {
        const obj = e as { message?: string; details?: string; hint?: string; code?: string };
        msg =
          obj.message ||
          obj.details ||
          obj.hint ||
          (obj.code ? `קוד שגיאה: ${obj.code}` : msg);
      }
      console.error('Save failed:', e);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  const totalPeople = bookings.reduce((s, b) => s + (b.people || 0), 0);
  const totalPrice = bookings.reduce((s, b) => s + (b.price || 0), 0);

  // Mismatch detection (only flag when user actually filled the expected totals)
  // אנשים יכולים להיות עשרוניים בקלאסי — משתמשים ב-parseFloat
  const expectedPeople = totalPeopleExpected !== '' ? parseFloat(totalPeopleExpected) : null;
  const expectedPrice = totalPriceExpected !== '' ? parseFloat(totalPriceExpected) : null;
  const peopleMismatch = expectedPeople !== null && totalPeople > 0 && Math.abs(totalPeople - expectedPeople) > 0.01;
  const priceMismatch = expectedPrice !== null && totalPrice > 0 && Math.abs(totalPrice - expectedPrice) > 0.01;
  const hasMismatch = peopleMismatch || priceMismatch;

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      {/* Header */}
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
          <h1 className="text-lg font-bold">
            {isEditMode ? 'עריכת סיור' : isEditActivityMode ? 'עריכת פעילות' : 'מה מוסיפים?'}
          </h1>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-4">
        {/* Mode switcher — hidden in edit mode */}
        {!isEditMode && !isEditActivityMode && (
          <div className="bg-white rounded-xl shadow p-2 flex gap-2">
            <button
              onClick={() => setMode('tour')}
              className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                mode === 'tour' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              סיור
            </button>
            <button
              onClick={() => setMode('activity')}
              className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
                mode === 'activity' ? 'bg-green-700 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              פעילות אחרת
            </button>
          </div>
        )}

        {mode === 'tour' && (
          <>
            {/* Date & Tour type */}
            <div className="bg-white rounded-xl shadow p-4 space-y-3">
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
                    📅 {formatHebrewDate(date)}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">סוג סיור</label>
                <select
                  value={tourType}
                  onChange={(e) => handleTourTypeChange(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg"
                >
                  <option value="">-- בחר --</option>
                  {availableTours.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold mb-1">
                  שעת התחלה <span className="text-xs text-gray-500 font-normal">(נדרש בכפולה של אותו סיור)</span>
                </label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg box-border"
                />
              </div>

              {tourCategory === 'private' && (
                <div>
                  <label className="block text-sm font-semibold mb-1">איזה סוג סיור פרטי? (חובה)</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="לדוגמה: סינטרה / אראבידה / קלאסי+בלם"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  />
                  <p className="text-xs text-gray-500 mt-1">חשוב: זה משפיע על חישוב השכר</p>
                </div>
              )}
            </div>

            {/* Totals (safety check) */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl shadow-sm p-4 space-y-3">
              <h3 className="font-semibold text-blue-900">רגע לפני הפירוט — הסיכום הכולל</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold mb-1">👥 סה״כ משתתפים</label>
                  <input
                    type="number"
                    min="0"
                    step={tourCategory === 'classic' ? '0.5' : '1'}
                    inputMode={tourCategory === 'classic' ? 'decimal' : 'numeric'}
                    value={totalPeopleExpected}
                    onChange={(e) => setTotalPeopleExpected(e.target.value)}
                    placeholder="לדוגמה: 10"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold mb-1">💰 סה״כ גבייה (€)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    inputMode="decimal"
                    value={totalPriceExpected}
                    onChange={(e) => setTotalPriceExpected(e.target.value)}
                    placeholder="לדוגמה: 250"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg"
                  />
                </div>
              </div>
            </div>

            {/* Bookings */}
            <div className="bg-white rounded-xl shadow p-4 space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-semibold">פירוט תת-קבוצות</h3>
                <span className="text-sm text-gray-500">
                  {totalPeople} אנשים · {totalPrice}€
                </span>
              </div>

              {bookings.map((b, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold">תת-קבוצה #{idx + 1}</span>
                    {bookings.length > 1 && (
                      <button
                        onClick={() => removeBooking(idx)}
                        className="text-red-600 text-sm"
                      >
                        הסר
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        כמה אנשים
                        {tourCategory === 'classic' && (
                          <span className="text-gray-400"> (אפשר חצאים: 1.5, 2.5...)</span>
                        )}
                      </label>
                      <input
                        type="number"
                        min="0"
                        // ב-קלאסי מאפשרים חצאים (0.5 step), בכל השאר רק שלמים (1).
                        step={tourCategory === 'classic' ? '0.5' : '1'}
                        value={b.people || ''}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value) || 0;
                          // בקלאסי — מעגלים לחצי הקרוב; באחרים — מעגלים למעלה לשלם
                          const rounded = tourCategory === 'classic'
                            ? Math.round(v * 2) / 2
                            : Math.ceil(v);
                          updateBooking(idx, 'people', rounded);
                        }}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg"
                      />
                    </div>
                    {tourCategory === 'classic' && (
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">מתוכם ילדים &lt;10</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={b.kids || ''}
                          onChange={(e) => updateBooking(idx, 'kids', parseInt(e.target.value) || 0)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg"
                        />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        סך ששולם (€)
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={b.price || ''}
                        onChange={(e) => updateBooking(idx, 'price', parseFloat(e.target.value) || 0)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg"
                      />
                    </div>
                    {tourCategory !== 'classic' && (
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">קיבלת טיפ? (€)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={b.tip || ''}
                          onChange={(e) => updateBooking(idx, 'tip', parseFloat(e.target.value) || 0)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">נתת עודף? (€)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={b.change_given || ''}
                      onChange={(e) => updateBooking(idx, 'change_given', parseFloat(e.target.value) || 0)}
                      placeholder="0"
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      סוג לקוח <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={CUSTOMER_TYPES.includes(b.customer_type) || b.customer_type === '' ? b.customer_type : 'אחר'}
                      onChange={(e) => updateBooking(idx, 'customer_type', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="">-- בחר --</option>
                      {CUSTOMER_TYPES.map((ct) => (
                        <option key={ct} value={ct}>
                          {ct}
                        </option>
                      ))}
                    </select>
                    {(b.customer_type === 'אחר' || (b.customer_type !== '' && !CUSTOMER_TYPES.includes(b.customer_type))) && (
                      <input
                        type="text"
                        value={b.customer_type === 'אחר' ? '' : b.customer_type}
                        onChange={(e) => updateBooking(idx, 'customer_type', e.target.value || 'אחר')}
                        placeholder="פרט.י את סוג הלקוח"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-2"
                      />
                    )}
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      איך הגיעו אלינו? <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={SOURCES.includes(b.source) || b.source === '' ? b.source : 'אחר'}
                      onChange={(e) => updateBooking(idx, 'source', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="">-- בחר --</option>
                      {SOURCES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                    {(b.source === 'אחר' || (b.source !== '' && !SOURCES.includes(b.source))) && (
                      <input
                        type="text"
                        value={b.source === 'אחר' ? '' : b.source}
                        onChange={(e) => updateBooking(idx, 'source', e.target.value || 'אחר')}
                        placeholder="פרט.י מאיפה הגיעו"
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 mt-2"
                      />
                    )}
                  </div>
                </div>
              ))}

              <button
                onClick={addBooking}
                className="w-full border-2 border-dashed border-green-600 text-green-700 py-3 rounded-lg font-semibold hover:bg-green-50"
              >
                הוסיפ.י תת-קבוצה +
              </button>
            </div>

            {/* General notes */}
            {tourCategory !== 'private' && (
              <div className="bg-white rounded-xl shadow p-4">
                <label className="block text-sm font-semibold mb-1">הערות (לא חובה)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2"
                />
              </div>
            )}

            {/* Tour photo */}
            <div id="tour-photo-section" className="bg-white rounded-xl shadow p-4">
              <label className="block text-sm font-semibold mb-2">תמונת הסיור</label>
              {existingPhotoUrl && !tourPhoto ? (
                <div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={existingPhotoUrl}
                    alt="תמונת סיור קיימת"
                    className="w-full max-h-64 object-cover rounded-lg border border-gray-200"
                  />
                  <button
                    type="button"
                    onClick={() => setExistingPhotoUrl(null)}
                    className="w-full mt-2 bg-gray-100 hover:bg-gray-200 active:scale-98 transition-all text-gray-700 rounded-lg py-2 text-sm font-medium"
                  >
                    ↻ החלף.י תמונה
                  </button>
                </div>
              ) : (
                <PhotoPicker
                  label="צרף.י תמונה מהסיור"
                  emoji="📸"
                  value={tourPhoto}
                  onChange={setTourPhoto}
                />
              )}
            </div>
          </>
        )}

        {mode === 'activity' && (
          <div className="bg-white rounded-xl shadow p-4 space-y-3">
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
                  📅 {formatHebrewDate(date)}
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold mb-2">
                {isEditActivityMode ? 'עריכת פעילות' : 'מה קרה היום? (אפשר לסמן יותר מאחד)'}
              </label>
              <div className="space-y-3">
                {/* הברזה — בעריכה מציגים רק אם זה הסוג שעורכים */}
                {(!isEditActivityMode || editActivity?.activity_type === 'habraza') && (
                  <label className={`block rounded-lg border-2 p-3 ${isEditActivityMode ? '' : 'cursor-pointer'} transition-colors ${
                    hasHabraza ? 'border-green-700 bg-green-50' : 'border-gray-200 bg-white'
                  }`}>
                    <div className="flex items-center gap-3">
                      {!isEditActivityMode && (
                        <input
                          type="checkbox"
                          checked={hasHabraza}
                          onChange={(e) => setHasHabraza(e.target.checked)}
                          className="w-5 h-5 accent-green-700"
                        />
                      )}
                      <span className="font-semibold flex-1">הברזה בכיכר</span>
                      <span className="text-gray-600 text-sm">8€</span>
                    </div>
                  </label>
                )}

                {/* הכשרה — בעריכה מציגים רק אם הסוג training/training_lead */}
                {(!isEditActivityMode ||
                  editActivity?.activity_type === 'training' ||
                  editActivity?.activity_type === 'training_lead') && (
                <div className={`rounded-lg border-2 p-3 transition-colors ${
                  hasTraining ? 'border-green-700 bg-green-50' : 'border-gray-200 bg-white'
                }`}>
                  <label className={`flex items-center gap-3 ${isEditActivityMode ? '' : 'cursor-pointer'}`}>
                    {!isEditActivityMode && (
                      <input
                        type="checkbox"
                        checked={hasTraining}
                        onChange={(e) => setHasTraining(e.target.checked)}
                        className="w-5 h-5 accent-green-700"
                      />
                    )}
                    <span className="font-semibold flex-1">פעילות הכשרה</span>
                    <span className="text-gray-600 text-sm">
                      {isTrainingLead && trainingLeadKind && trainingLeadTour
                        ? `${(
                            trainingLeadBase(trainingLeadKind, trainingLeadTour) +
                            (trainingLeadIsFullDay(trainingLeadTour) ? 15 : 0)
                          ).toFixed(0)}€`
                        : '10€'}
                    </span>
                  </label>
                  {hasTraining && (
                    <div className="space-y-3 mt-3 pt-3 border-t border-green-200">
                      {/* טוגל בכיר: "אני המתלמד.ת" / "העברתי הכשרה" */}
                      {isSeniorGuide && (
                        <div>
                          <label className="block text-sm font-semibold mb-2">מי את.ה בהכשרה?</label>
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setIsTrainingLead(false)}
                              className={`rounded-lg py-2 px-3 text-sm font-semibold border-2 transition-colors ${
                                !isTrainingLead
                                  ? 'bg-green-700 text-white border-green-700'
                                  : 'bg-white text-gray-700 border-gray-300'
                              }`}
                            >
                              אני המתלמד.ת
                            </button>
                            <button
                              type="button"
                              onClick={() => setIsTrainingLead(true)}
                              className={`rounded-lg py-2 px-3 text-sm font-semibold border-2 transition-colors ${
                                isTrainingLead
                                  ? 'bg-green-700 text-white border-green-700'
                                  : 'bg-white text-gray-700 border-gray-300'
                              }`}
                            >
                              העברתי הכשרה
                            </button>
                          </div>
                        </div>
                      )}

                      {isTrainingLead ? (
                        // טופס "העברתי הכשרה" (מדריך בכיר)
                        <>
                          <div>
                            <label className="block text-sm font-semibold mb-1">סוג ההכשרה</label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setTrainingLeadKind('paper')}
                                className={`rounded-lg py-2 px-3 text-sm font-semibold border-2 transition-colors ${
                                  trainingLeadKind === 'paper'
                                    ? 'bg-blue-700 text-white border-blue-700'
                                    : 'bg-white text-gray-700 border-gray-300'
                                }`}
                              >
                                נסיון דפים
                              </button>
                              <button
                                type="button"
                                onClick={() => setTrainingLeadKind('observation')}
                                className={`rounded-lg py-2 px-3 text-sm font-semibold border-2 transition-colors ${
                                  trainingLeadKind === 'observation'
                                    ? 'bg-blue-700 text-white border-blue-700'
                                    : 'bg-white text-gray-700 border-gray-300'
                                }`}
                              >
                                תצפות
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold mb-1">על איזה סיור?</label>
                            <select
                              value={trainingLeadTour}
                              onChange={(e) => setTrainingLeadTour(e.target.value as TrainingLeadTour | '')}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                            >
                              <option value="">-- בחר.י --</option>
                              {TRAINING_LEAD_TOUR_OPTIONS_BY_CITY[guideCity].map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </div>
                          {trainingLeadKind && trainingLeadTour && (
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm space-y-1">
                              <div className="flex justify-between">
                                <span className="text-gray-700">שכר על ההכשרה:</span>
                                <span className="font-bold text-blue-900">
                                  {trainingLeadBase(trainingLeadKind, trainingLeadTour).toFixed(0)}€
                                </span>
                              </div>
                              {trainingLeadIsFullDay(trainingLeadTour) && (
                                <div className="flex justify-between">
                                  <span className="text-gray-700">+ אשל יום מלא:</span>
                                  <span className="font-bold text-blue-900">15€</span>
                                </div>
                              )}
                              <div className="flex justify-between pt-1 border-t border-blue-200">
                                <span className="text-blue-900 font-semibold">סה"כ:</span>
                                <span className="font-bold text-blue-900">
                                  {(
                                    trainingLeadBase(trainingLeadKind, trainingLeadTour) +
                                    (trainingLeadIsFullDay(trainingLeadTour) ? 15 : 0)
                                  ).toFixed(0)}€
                                </span>
                              </div>
                              <p className="text-xs text-blue-800 pt-1">
                                💡 הסכום נכנס לקבלה החודשית.
                              </p>
                            </div>
                          )}
                        </>
                      ) : (
                        // טופס "אני המתלמד.ת"
                        <>
                          <div>
                            <label className="block text-sm font-semibold mb-1">סוג ההכשרה</label>
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                onClick={() => setTrainingSubtype('נסיון דפים')}
                                className={`rounded-lg py-2 px-3 text-sm font-semibold border-2 transition-colors ${
                                  trainingSubtype === 'נסיון דפים'
                                    ? 'bg-blue-700 text-white border-blue-700'
                                    : 'bg-white text-gray-700 border-gray-300'
                                }`}
                              >
                                נסיון דפים
                              </button>
                              <button
                                type="button"
                                onClick={() => setTrainingSubtype('תצפות')}
                                className={`rounded-lg py-2 px-3 text-sm font-semibold border-2 transition-colors ${
                                  trainingSubtype === 'תצפות'
                                    ? 'bg-blue-700 text-white border-blue-700'
                                    : 'bg-white text-gray-700 border-gray-300'
                                }`}
                              >
                                תצפות
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="block text-sm font-semibold mb-1">על איזה סיור?</label>
                            <select
                              value={trainingForTour}
                              onChange={(e) => setTrainingForTour(e.target.value)}
                              className="w-full border border-gray-300 rounded-lg px-3 py-2 bg-white"
                            >
                              <option value="">-- בחר.י --</option>
                              {availableTours.map((t) => (
                                <option key={t.value} value={t.value}>
                                  {t.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                )}

                {/* אחר — בעריכה מציגים רק אם הסוג external */}
                {(!isEditActivityMode || editActivity?.activity_type === 'external') && (
                <div className={`rounded-lg border-2 p-3 transition-colors ${
                  hasExternal ? 'border-green-700 bg-green-50' : 'border-gray-200 bg-white'
                }`}>
                  <label className={`flex items-center gap-3 ${isEditActivityMode ? '' : 'cursor-pointer'}`}>
                    {!isEditActivityMode && (
                      <input
                        type="checkbox"
                        checked={hasExternal}
                        onChange={(e) => setHasExternal(e.target.checked)}
                        className="w-5 h-5 accent-green-700"
                      />
                    )}
                    <span className="font-semibold flex-1">אחר</span>
                    <span className="text-gray-600 text-sm">סכום ידני</span>
                  </label>
                  {hasExternal && (
                    <div className="space-y-3 mt-3 pt-3 border-t border-green-200">
                      <div>
                        <label className="block text-sm font-semibold mb-1">פרט.י את סוג הפעילות</label>
                        <input
                          type="text"
                          value={externalDescription}
                          onChange={(e) => setExternalDescription(e.target.value)}
                          placeholder="פרט.י את סוג הפעילות"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-semibold mb-1">סכום (€)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          inputMode="decimal"
                          value={externalAmount || ''}
                          onChange={(e) => setExternalAmount(parseFloat(e.target.value) || 0)}
                          placeholder="כמה?"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg"
                        />
                      </div>
                    </div>
                  )}
                </div>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-1">הערות (לא חובה)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
              />
            </div>
          </div>
        )}

        {/* Save button + error: גם לסיור רגיל וגם לעריכת פעילות */}
        <>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              {error}
            </div>
          )}

          <button
            onClick={onSaveClicked}
            disabled={saving}
            className="w-full bg-green-700 hover:bg-green-800 active:scale-98 disabled:bg-gray-400 text-white rounded-2xl shadow-lg py-4 text-lg font-bold transition-all"
          >
            {saving
              ? (isEditMode || isEditActivityMode ? 'מעדכן...' : 'שומר...')
              : (isEditMode ? 'עדכן סיור' : isEditActivityMode ? 'עדכן פעילות' : 'שמור')}
          </button>
        </>
      </main>

      {/* Mismatch confirmation modal */}
      {showMismatchModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 animate-[fadeIn_200ms_ease-out]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-[slideUp_300ms_ease-out]">
            <div className="flex items-start gap-3 mb-4">
              <div className="text-3xl">⚠️</div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-gray-900 mb-1">רגע, יש פער קטן</h3>
                <p className="text-sm text-gray-600">
                  הסיכום שציינת בהתחלה לא מסתדר עם הפירוט של תתי-הקבוצות:
                </p>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-2 mb-4">
              {peopleMismatch && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">👥 משתתפים:</span>
                  <span className="font-semibold">
                    <span className="text-amber-800">{totalPeople}</span>
                    <span className="text-gray-500 mx-1">במקום</span>
                    <span className="text-green-700">{expectedPeople}</span>
                  </span>
                </div>
              )}
              {priceMismatch && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">💰 גבייה:</span>
                  <span className="font-semibold">
                    <span className="text-amber-800">{totalPrice}€</span>
                    <span className="text-gray-500 mx-1">במקום</span>
                    <span className="text-green-700">{expectedPrice}€</span>
                  </span>
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <button
                onClick={() => setShowMismatchModal(false)}
                className="w-full bg-green-700 hover:bg-green-800 active:scale-98 transition-all text-white rounded-xl py-3 font-bold"
              >
                חזרה לתיקון
              </button>
              <button
                onClick={() => {
                  setShowMismatchModal(false);
                  handleSave(true);
                }}
                className="w-full bg-gray-100 hover:bg-gray-200 active:scale-98 transition-all text-gray-700 rounded-xl py-3 font-medium text-sm"
              >
                זה בסדר, לשמור בכל זאת
              </button>
            </div>
          </div>

          <style jsx global>{`
            @keyframes fadeIn {
              from { opacity: 0; }
              to { opacity: 1; }
            }
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(20px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>
        </div>
      )}

      {/* Photo prompt modal — שלב 1: שואלים אם רוצה לצרף תמונה */}
      {showPhotoPromptModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 animate-[fadeIn_200ms_ease-out]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-[slideUp_300ms_ease-out]">
            <div className="text-center mb-4">
              <div className="text-5xl mb-2">📸</div>
              <h3 className="text-lg font-bold text-gray-900">שכחת לצרף תמונה?</h3>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setShowPhotoPromptModal(false);
                  // גלילה לטופס תמונה — המשתמש כבר נמצא במסך, ה-PhotoPicker בתוך הטופס
                  setTimeout(() => {
                    const el = document.getElementById('tour-photo-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }, 200);
                }}
                className="w-full bg-green-700 hover:bg-green-800 active:scale-98 transition-all text-white rounded-xl py-3 font-bold"
              >
                כן, קח.י אותי להעלות 📷
              </button>
              <button
                onClick={() => {
                  setShowPhotoPromptModal(false);
                  setShowForgotPhotoModal(true);
                }}
                className="w-full bg-gray-100 hover:bg-gray-200 active:scale-98 transition-all text-gray-700 rounded-xl py-3 font-medium text-sm"
              >
                שכחתי לצלם :/
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Photo "forgot" modal — שלב 2: חמוד אבל כועס */}
      {showForgotPhotoModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4 animate-[fadeIn_200ms_ease-out]">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 animate-[slideUp_300ms_ease-out]">
            <div className="text-center mb-4">
              <div className="text-5xl mb-2">😤</div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">אוףףףףףףף</h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                אנחנו זוכרים שהפעם שכחת, אבל <span className="font-bold">בפעם הבאה — לצלם!</span>
              </p>
            </div>
            <button
              onClick={() => {
                setShowForgotPhotoModal(false);
                handleSave(false, true); // שמירה עם photo_skipped=true
              }}
              className="w-full bg-amber-600 hover:bg-amber-700 active:scale-98 transition-all text-white rounded-xl py-3 font-bold"
            >
              זה לא יקרה שוב! בואו נשמור את הסיור
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AddTourPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">טוען...</div>}>
      <AddTourContent />
    </Suspense>
  );
}
