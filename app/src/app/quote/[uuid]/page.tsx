/**
 * /quote/[uuid] — עמוד ההצעה שהלקוח מקבל (ציבורי, ללא לוגין).
 *
 * Server component: שולף את ההצעה מ-Supabase עם service key (RLS חוסם anon),
 * מחשב את המחירים מהטבלאות המאושרות, ומציג הירו + בלוק מחיר לכל סיור.
 *
 * שלב א': מציג את שלד ההצעה (הירו + מחירים). תוכן עשיר של הסיורים (תיאורים,
 * תמונות, "כלול"/"חשוב לדעת") יתווסף בשלב הבא מתוך quote-mockup.html.
 */
import { createClient } from '@supabase/supabase-js';
import PriceBlock from '@/components/quote/PriceBlock';
import { buildColumns, tourDisplayName } from '@/lib/quote-build';
import type { QuoteSelection } from '@/lib/quote-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const C = {
  forest: '#0a3d22',
  terra: '#c4602f',
  ink: '#23281f',
  inkSoft: '#5b5f54',
  inkMute: '#8a8d82',
  band: '#f0e9da',
  border: '#e3ddcf',
  bg: '#faf6ee',
  surface: '#ffffff',
};

type QuoteRow = {
  id: string;
  customer_name: string;
  selection: QuoteSelection;
  expires_at: string;
};

async function fetchQuote(id: string): Promise<QuoteRow | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase
    .from('quotes')
    .select('id, customer_name, selection, expires_at')
    .eq('id', id)
    .single();
  if (error || !data) return null;
  return data as QuoteRow;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', background: C.bg, color: C.ink, fontFamily: 'Assistant, system-ui, sans-serif' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 18px 80px' }}>{children}</div>
    </div>
  );
}

export default async function QuotePage({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params;
  const quote = await fetchQuote(uuid);

  if (!quote) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', padding: '120px 0', color: C.inkSoft }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.forest, marginBottom: 10 }}>ההצעה לא נמצאה</div>
          <div>ייתכן שהקישור שגוי. אפשר לפנות אלינו ונשמח לעזור.</div>
        </div>
      </Shell>
    );
  }

  const expired = new Date(quote.expires_at).getTime() < Date.now();
  if (expired) {
    return (
      <Shell>
        <div style={{ textAlign: 'center', padding: '120px 0', color: C.inkSoft }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: C.forest, marginBottom: 10 }}>
            ההצעה פגה 🌿
          </div>
          <div>תוקף ההצעה הזו הסתיים. נשמח להכין לכם הצעה מעודכנת, פשוט פנו אלינו.</div>
        </div>
      </Shell>
    );
  }

  const sel = quote.selection;

  return (
    <Shell>
      {/* הירו */}
      <header style={{ textAlign: 'center', padding: '56px 0 40px' }}>
        <div style={{ fontSize: 13, color: C.inkMute, fontWeight: 600, letterSpacing: '.04em' }}>פורטוגו</div>
        <h1 style={{ fontSize: 'clamp(28px,5vw,40px)', color: C.forest, margin: '14px 0 8px', fontWeight: 800 }}>
          היי {quote.customer_name} 💚
        </h1>
        <p style={{ fontSize: 18, color: C.terra, margin: 0 }}>הצעה אישית מפורטוגו</p>
        <p style={{ fontSize: 14, color: C.inkSoft, marginTop: 14 }}>
          הצעה זו בתוקף ל-3 חודשים. בחירת סיור אינה התחייבות, נשמח לבדוק זמינות יחד.
        </p>
      </header>

      {/* סיורים */}
      {sel.tours.map((tour, i) => {
        const cols = buildColumns(tour, sel.columns);
        return (
          <section
            key={i}
            style={{
              background: C.surface,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              padding: '22px 22px 8px',
              marginBottom: 20,
            }}
          >
            <h2 style={{ fontSize: 22, color: C.forest, margin: '0 0 16px', fontWeight: 800 }}>
              {tourDisplayName(tour)}
              {tour.car ? <span style={{ fontSize: 14, color: C.terra, fontWeight: 600 }}> · עם רכב צמוד</span> : null}
            </h2>
            <PriceBlock columns={cols} />
          </section>
        );
      })}

      {sel.notes ? (
        <section
          style={{
            background: C.band,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            padding: '16px 18px',
            marginTop: 8,
            fontSize: 15,
            color: C.inkSoft,
          }}
        >
          {sel.notes}
        </section>
      ) : null}

      <footer style={{ textAlign: 'center', marginTop: 40, color: C.inkMute, fontSize: 14 }}>
        אובריגדו 🌿 פורטוגו · סיורים בעברית בפורטוגל
      </footer>
    </Shell>
  );
}
