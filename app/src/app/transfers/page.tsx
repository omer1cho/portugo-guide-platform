'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAuthGuard } from '@/lib/auth';

type Transfer = {
  id: string;
  transfer_date: string;
  amount: number;
  transfer_type: string;
  notes: string;
};

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function formatMonthLabel(year: number, month: number) {
  return new Date(year, month, 1).toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
}

function TransfersContent() {
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
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const [date, setDate] = useState(todayISO());
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const id = localStorage.getItem('portugo_guide_id');
    if (!id) {
      router.push('/');
      return;
    }
    setGuideId(id);

    // Pre-fill form when arriving from close-month flow
    const prefillAmount = searchParams.get('prefill');
    const prefillNote = searchParams.get('note');
    if (prefillAmount) {
      setAmount(prefillAmount);
      setShowForm(true);
      if (prefillNote) setNotes(prefillNote);
    }

    loadTransfers(id);
  }, [router, year, month, searchParams]);

  async function loadTransfers(id: string) {
    setLoading(true);
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month + 1, 0).getDate();
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    const { data } = await supabase
      .from('transfers')
      .select('*')
      .eq('guide_id', id)
      .eq('transfer_type', 'to_portugo')
      .gte('transfer_date', start)
      .lte('transfer_date', end)
      .order('transfer_date', { ascending: false });
    setTransfers((data as Transfer[]) || []);
    setLoading(false);
  }

  const handleSave = async () => {
    if (!guideId) return;
    setFormError('');
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) {
      setFormError('נשאר להזין סכום 🙂');
      return;
    }
    setSaving(true);
    const { error } = await supabase.from('transfers').insert({
      guide_id: guideId,
      transfer_date: date,
      amount: amt,
      transfer_type: 'to_portugo',
      notes,
    });
    setSaving(false);
    if (error) {
      setFormError('משהו השתבש: ' + error.message);
      return;
    }
    setShowForm(false);
    setAmount('');
    setNotes('');
    loadTransfers(guideId);
  };

  const total = transfers.reduce((s, t) => s + (t.amount || 0), 0);

  return (
    <div className="min-h-screen pb-20 bg-gray-50">
      <header className="bg-green-800 text-white p-4 shadow-md sticky top-0 z-10">
        <div className="max-w-md mx-auto flex justify-between items-center">
          <button onClick={() => router.back()} className="text-sm bg-green-900 hover:bg-green-950 active:scale-95 transition-transform px-3 py-2 rounded-md">
            ← חזרה
          </button>
          <h1 className="text-lg font-bold">העברות שלי</h1>
        </div>
      </header>

      <main className="max-w-md mx-auto p-4 space-y-3">
        <div className="bg-white rounded-xl shadow p-4">
          <div className="text-xs text-gray-500 mb-1">📅 {formatMonthLabel(year, month)}</div>
          <div className="text-sm text-gray-600">סה"כ הועבר 💰</div>
          <div className="text-2xl font-bold text-green-800">{total.toLocaleString('he-IL')}€</div>
        </div>

        {!showForm && isCurrent && (
          <button
            onClick={() => setShowForm(true)}
            className="w-full bg-red-600 hover:bg-red-700 active:scale-98 transition-all text-white rounded-2xl shadow-lg py-4 text-lg font-bold"
          >
            דווח.י העברה +
          </button>
        )}

        {showForm && (
          <div className="bg-white rounded-xl shadow p-4 space-y-3">
            <h3 className="font-semibold">העברה חדשה</h3>
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
            <div>
              <label className="block text-sm font-semibold mb-1">סכום (€)</label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold mb-1">הערות (לא חובה)</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2"
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
                className="flex-1 bg-green-700 text-white rounded-lg py-3 font-semibold"
              >
                {saving ? 'שומר...' : 'שמור'}
              </button>
              <button
                onClick={() => {
                  setShowForm(false);
                  setFormError('');
                }}
                className="px-4 bg-gray-200 rounded-lg font-semibold"
              >
                ביטול
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8 text-gray-500">רגע, מושך נתונים...</div>
        ) : transfers.length === 0 ? (
          <div className="text-center py-8 text-gray-500 bg-white rounded-xl shadow">
            {isCurrent ? 'עדיין לא העברת כסף החודש. נגיע לזה.' : 'לא נרשמו העברות בחודש זה.'}
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow">
            <div className="p-4 border-b font-semibold">היסטוריית העברות</div>
            {transfers.map((t) => (
              <div key={t.id} className="p-4 border-b last:border-b-0 flex justify-between">
                <div>
                  <div className="font-semibold">
                    {new Date(t.transfer_date).toLocaleDateString('he-IL')}
                  </div>
                  {t.notes && <div className="text-xs text-gray-500">{t.notes}</div>}
                </div>
                <div className="font-bold text-green-800">{t.amount}€</div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

export default function TransfersPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-gray-500">טוען...</div>}>
      <TransfersContent />
    </Suspense>
  );
}
