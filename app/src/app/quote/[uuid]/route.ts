/**
 * /quote/[uuid] — עמוד ההצעה שהלקוח מקבל (ציבורי, ללא לוגין).
 *
 * Route handler (GET): שולף את ההצעה מ-Supabase עם service key (RLS חוסם anon),
 * טוען את חוברת המוקאפ המלאה (quote-mockup.html), ומתאים אותה להצעה הספציפית:
 * שם הלקוח, שורת הרכב בהירו, הצגת הסיורים שנבחרו בלבד, ובלוקי המחיר המחושבים.
 *
 * הקופי, התמונות וה-CSS של החוברת נשמרים מילה במילה — מזריקים רק את הנתונים.
 */
import { createClient } from '@supabase/supabase-js';
import { buildColumns, eur, compositionLabel, type DisplayColumn } from '@/lib/quote-build';
import type { QuoteSelection, QuoteColumn, QuoteTourSel } from '@/lib/quote-types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type QuoteRow = {
  id: string;
  customer_name: string;
  selection: QuoteSelection;
  expires_at: string;
};

// ─── מיפוי slug של ההצעה → data-tour של כרטיס במוקאפ ───
// קלאסי = ליסבון כברירת מחדל (אין מידע עיר בבחירה הבודדת).
const TOUR_SLUG_TO_DATA_TOUR: Record<string, string> = {
  'classic-private': 'classic-lisbon',
  'belem-private': 'belem',
  'culinary-tastings-private': 'culinary',
  'sintra-arrabida-private': 'sintra',
  'obidos-private': 'obidos',
  'douro-private': 'douro',
};

const COMBO_SLUG_TO_DATA_TOUR: Record<string, string> = {
  'combo-classic-belem': 'combo-classic-belem',
  'combo-classic-belem-short': 'combo-classic-belem',
  'combo-classic-tastings': 'combo-porto-classic-tastings',
  'combo-classic-tastings-short': 'combo-porto-classic-tastings',
  // השילוב קלאסי+קולינרי בליסבון אינו כרטיס עם data-tour יחיד במוקאפ
  // (הכרטיס הוא no-select עם שתי גרסאות opt-pick). מטופל דרך data-tour-name למטה.
};

// השילוב קלאסי+קולינרי בליסבון: הכרטיס במוקאפ מזוהה לפי data-tour-name.
const COMBO_SLUG_TO_DATA_TOUR_NAME: Record<string, string> = {
  'combo-classic-culinary': 'שילוב: קולינרי + קלאסית',
  'combo-classic-culinary-short': 'שילוב: קולינרי + קלאסית',
};

/** מחזיר את מזהה הכרטיס במוקאפ (data-tour) או null, ואת שם-הכרטיס (data-tour-name) אם רלוונטי. */
function mapToCardSelector(tour: QuoteTourSel): { dataTour?: string; dataTourName?: string } {
  if (tour.comboSlug) {
    const dt = COMBO_SLUG_TO_DATA_TOUR[tour.comboSlug];
    if (dt) return { dataTour: dt };
    const name = COMBO_SLUG_TO_DATA_TOUR_NAME[tour.comboSlug];
    if (name) return { dataTourName: name };
    // TODO mapping: comboSlug ללא כרטיס תואם במוקאפ
    return {};
  }
  const dt = TOUR_SLUG_TO_DATA_TOUR[tour.tourSlug];
  if (dt) return { dataTour: dt };
  // TODO city/mapping: slug ללא כרטיס תואם במוקאפ
  return {};
}

async function fetchQuote(idOrSlug: string): Promise<QuoteRow | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return null;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const cols = 'id, customer_name, selection, expires_at';

  // 1) חיפוש לפי קוד קצר (slug). אם העמודה לא קיימת — שגיאה תיתפס ונמשיך ל-id.
  const bySlug = await supabase.from('quotes').select(cols).eq('slug', idOrSlug).maybeSingle();
  if (bySlug.data) return bySlug.data as QuoteRow;

  // 2) תאימות לאחור: לינקים ישנים עם uuid מלא
  if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(idOrSlug)) {
    const byId = await supabase.from('quotes').select(cols).eq('id', idOrSlug).maybeSingle();
    if (byId.data) return byId.data as QuoteRow;
  }
  return null;
}

function htmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function simplePage(title: string, body: string): Response {
  const html = `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${htmlEscape(title)}</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    background:#faf6ee;color:#23281f;font-family:Assistant,system-ui,sans-serif;text-align:center;padding:24px}
  .box{max-width:520px}
  h1{font-size:24px;color:#0a3d22;margin:0 0 12px;font-weight:800}
  p{font-size:16px;color:#5b5f54;margin:0}
</style></head><body><div class="box">${body}</div></body></html>`;
  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}

// ─── בניית HTML של בלוק מחיר (אותם class-ים כמו במוקאפ) ───

function lineRow(label: 'מבוגר' | 'ילד' | 'פעוט', free: boolean, unit: number, ageText?: string): string {
  const unitWord = `ל${label}${ageText ? ` ${ageText}` : ''}`;
  if (free) {
    return `<div class="pf-row"><span class="pf-free">ללא עלות</span> <span class="pf-unit">${unitWord}</span></div>`;
  }
  return `<div class="pf-row"><span class="pf-amt">${eur(unit)}</span> <span class="pf-unit">${unitWord}</span></div>`;
}

/** בלוק מחיר לעמודה יחידה (.price-family). */
function priceFamilyHtml(col: DisplayColumn): string {
  const rows = col.result.lines.map((l) => lineRow(l.label, l.free, l.unitPrice, l.ageText)).join('\n              ');
  const total = `<div class="pf-total"><span class="pf-total-label">סה"כ לקבוצתכם</span><span class="pf-total-amt">${eur(col.result.total)}</span></div>`;
  return `<div class="price-family">
              <div class="price-family-cap">המחיר עבור הקבוצה שלכם</div>
              ${rows}
              ${total}
            </div>`;
}

/** כותרת עמודה בפורמט המוקאפ: "בקבוצה של <b><bdi>N</bdi></b> משתתפים" / טווח. */
function rangeHeadHtml(col: QuoteColumn): string {
  if (col.type === 'band') {
    return `בקבוצה של <b><bdi>${col.minSize}</bdi> עד <bdi>${col.maxSize}</bdi></b> משתתפים`;
  }
  const total = col.adults + col.childrenAges.length;
  return `בקבוצה של <b><bdi>${total}</bdi></b> משתתפים`;
}

/** בלוק מחיר לשתי עמודות (.price-range). */
function priceRangeHtml(cols: DisplayColumn[], rawCols: QuoteColumn[]): string {
  const colsHtml = cols
    .map((col, i) => {
      const head = rangeHeadHtml(rawCols[i]);
      const sub = col.subLabel
        ? `<span class="price-range-sub">${htmlEscape(col.subLabel)}</span>`
        : '';
      const rows = col.result.lines
        .map((l) => lineRow(l.label, l.free, l.unitPrice, l.ageText))
        .join('\n                ');
      const total = col.showTotal
        ? `\n                <div class="pf-total"><span class="pf-total-label">סה"כ</span><span class="pf-total-amt">${eur(col.result.total)}</span></div>`
        : '';
      return `<div class="price-range-col">
                <div class="price-range-head">${head}${sub}</div>
                ${rows}${total}
              </div>`;
    })
    .join('\n              ');
  return `<div class="price-range">
              ${colsHtml}
            </div>`;
}

/** בלוק מחיר מלא לכרטיס לפי מספר העמודות. */
function priceBlockHtml(cols: DisplayColumn[], rawCols: QuoteColumn[]): string {
  if (cols.length <= 1) {
    return priceFamilyHtml(cols[0]);
  }
  return priceRangeHtml(cols, rawCols);
}

/** שורת הרכב בהירו לפי העמודה הראשונה. */
function heroBreakdown(col: QuoteColumn): { total: number; breakdown: string } {
  if (col.type === 'band') {
    return {
      total: col.minSize,
      breakdown: ` (קבוצה של ${col.minSize} עד ${col.maxSize} משתתפים)`,
    };
  }
  const total = col.adults + col.childrenAges.length;
  const hasChildren = col.childrenAges.length > 0;
  const breakdown = hasChildren
    ? ` מתוכם: ${compositionLabel(col.adults, col.childrenAges)}`
    : '';
  return { total, breakdown };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ uuid: string }> },
) {
  const { uuid } = await params;
  const quote = await fetchQuote(uuid);

  if (!quote) {
    return simplePage(
      'ההצעה לא נמצאה',
      `<h1>ההצעה לא נמצאה</h1><p>ייתכן שהקישור שגוי. אפשר לפנות אלינו ונשמח לעזור.</p>`,
    );
  }

  const expired = new Date(quote.expires_at).getTime() < Date.now();
  if (expired) {
    return simplePage(
      'ההצעה פגה',
      `<h1>ההצעה פגה 🌿</h1><p>תוקף ההצעה הזו הסתיים. נשמח להכין לכם הצעה מעודכנת, פשוט פנו אלינו.</p>`,
    );
  }

  const sel = quote.selection;

  // ─── טעינת חוברת המוקאפ (קובץ סטטי מאותו origin) ───
  const mres = await fetch(new URL('/quote-mockup.html', req.url));
  if (!mres.ok) {
    return simplePage(
      'שגיאה',
      `<h1>משהו השתבש</h1><p>לא הצלחנו לטעון את ההצעה כרגע. נסו שוב בעוד רגע או פנו אלינו.</p>`,
    );
  }
  let html = await mres.text();

  // ─── טרנספורם 1: שם הלקוח ───
  const name = quote.customer_name || sel.customerName || '';
  if (name) {
    html = html.split('משפחת סימאי').join(name);
  }

  // ─── טרנספורם 2: שורת ההרכב בהירו (לפי העמודה הראשונה) ───
  const firstCol = sel.columns[0];
  if (firstCol) {
    const { total, breakdown } = heroBreakdown(firstCol);
    // משמרים בדיוק את מבנה המוקאפ: המספר בתוך <b><bdi>..</bdi></b>, ה-breakdown בתוך span.
    const newStat =
      `<span class="hero-stat">כמות משתתפים <b><bdi>${total}</bdi></b>` +
      (breakdown ? `<span class="hero-breakdown">${htmlEscape(breakdown)}</span>` : '') +
      `</span>`;
    html = html.replace(
      /<span class="hero-stat">כמות משתתפים <b><bdi>11<\/bdi><\/b><span class="hero-breakdown">[^<]*<\/span><\/span>/,
      newStat,
    );
  }

  // ─── טרנספורם 3+4: אילו כרטיסים מציגים + בלוקי המחיר ───
  const shownDataTours = new Set<string>();
  const shownDataTourNames = new Set<string>();
  // מפה: מזהה כרטיס → HTML של בלוק המחיר להזרקה
  const priceByDataTour: Record<string, string> = {};
  const priceByDataTourName: Record<string, string> = {};

  for (const tour of sel.tours) {
    const target = mapToCardSelector(tour);
    const cols = buildColumns(tour, sel.columns);
    const block = priceBlockHtml(cols, sel.columns);
    if (target.dataTour) {
      shownDataTours.add(target.dataTour);
      priceByDataTour[target.dataTour] = block;
    } else if (target.dataTourName) {
      shownDataTourNames.add(target.dataTourName);
      priceByDataTourName[target.dataTourName] = block;
    }
  }

  // כרטיסי עיר (קלאסי/בלם) שנבחרו בלי רכב — להסיר מהם את תוכן הרכב
  // (אייקון "סיור עם רכב צמוד" + הערת אלפמה + שורת "כלול: רכב צמוד"),
  // כדי שכל הצעה תציג רק את מה שרלוונטי לה.
  const noCarStrip = new Set<string>();
  for (const tour of sel.tours) {
    const isCity = !tour.comboSlug && (tour.tourSlug === 'classic-private' || tour.tourSlug === 'belem-private');
    if (isCity && !tour.car) {
      const t = mapToCardSelector(tour);
      if (t.dataTour) noCarStrip.add(t.dataTour);
    }
  }

  // הזרקת JS שמסתיר כרטיסים שלא נבחרו ומחליף את בלוקי המחיר ב-DOM.
  // גישת DOM (script) נבחרה כי היא עמידה למבנה הכרטיסים (כולל combo עם opt-pick).
  const noCarArr = JSON.stringify(Array.from(noCarStrip));
  const dataTourArr = JSON.stringify(Array.from(shownDataTours));
  const dataTourNameArr = JSON.stringify(Array.from(shownDataTourNames));
  const priceByDataTourJson = JSON.stringify(priceByDataTour);
  const priceByDataTourNameJson = JSON.stringify(priceByDataTourName);

  const injectScript = `
<script>
(function(){
  var shownTours = ${dataTourArr};
  var shownNames = ${dataTourNameArr};
  var priceByTour = ${priceByDataTourJson};
  var priceByName = ${priceByDataTourNameJson};
  var noCarStrip = ${noCarArr};

  function isShownCard(card){
    var dt = card.getAttribute('data-tour');
    if (dt && shownTours.indexOf(dt) !== -1) return true;
    var dn = card.getAttribute('data-tour-name');
    if (dn && shownNames.indexOf(dn) !== -1) return true;
    return false;
  }

  // 1) הסתרת כרטיסי סיור / שילוב שלא נבחרו
  var allCards = document.querySelectorAll('.card, .combo-card');
  allCards.forEach(function(card){
    if (!isShownCard(card)) { card.style.display = 'none'; }
  });

  // 2) החלפת בלוק המחיר בכל כרטיס שמוצג
  function replacePrice(card, newHtml){
    var el = card.querySelector('.price-range') || card.querySelector('.price-family');
    if (el) {
      var wrap = document.createElement('div');
      wrap.innerHTML = newHtml.trim();
      var node = wrap.firstElementChild;
      if (node) el.parentNode.replaceChild(node, el);
    }
  }
  Object.keys(priceByTour).forEach(function(dt){
    var card = document.querySelector('[data-tour="' + dt + '"]');
    if (card) replacePrice(card, priceByTour[dt]);
  });
  Object.keys(priceByName).forEach(function(dn){
    var cards = document.querySelectorAll('[data-tour-name]');
    cards.forEach(function(card){
      if (card.getAttribute('data-tour-name') === dn) replacePrice(card, priceByName[dn]);
    });
  });

  // 2.5) הסרת תוכן רכב מכרטיסי עיר שנבחרו בלי רכב
  function stripCar(card){
    var carIcon = card.querySelector('.card-meta-strip use[href="#icon-bus"]');
    if (carIcon){
      carIcon.setAttribute('href','#icon-walking');
      var mi = carIcon.closest ? carIcon.closest('.meta-item') : null;
      var strong = mi && mi.querySelector('strong');
      if (strong) strong.textContent = 'סיור רגלי';
    }
    card.querySelectorAll('.desc-note li').forEach(function(li){
      if (/רכב/.test(li.textContent)) li.style.display='none';
    });
    card.querySelectorAll('.desc-note').forEach(function(dn){
      var anyVisible=false;
      dn.querySelectorAll('li').forEach(function(li){ if(li.style.display!=='none') anyVisible=true; });
      if (!anyVisible) dn.style.display='none';
    });
    card.querySelectorAll('.coverage-list li').forEach(function(li){
      if (/רכב/.test(li.textContent)) li.style.display='none';
    });
    // אם נשארה תיבת "כלול"/"לא כלול" ריקה אחרי ההסרה — להסתיר אותה
    card.querySelectorAll('.coverage-block').forEach(function(b){
      var anyLi=false;
      b.querySelectorAll('.coverage-list li').forEach(function(li){ if(li.style.display!=='none') anyLi=true; });
      if(!anyLi) b.style.display='none';
    });
    card.querySelectorAll('.price-coverage').forEach(function(pc){
      var anyBlock=false;
      pc.querySelectorAll('.coverage-block').forEach(function(b){ if(b.style.display!=='none') anyBlock=true; });
      if(!anyBlock) pc.style.display='none';
    });
  }
  noCarStrip.forEach(function(dt){
    var card = document.querySelector('[data-tour="' + dt + '"]');
    if (card) stripCar(card);
  });

  // 3) הסתרת מעטפות-אזור / כותרות-משנה / מפרידים שנותרו ריקים
  function hasVisibleCard(scope){
    var cards = scope.querySelectorAll('.card, .combo-card');
    for (var i=0;i<cards.length;i++){ if (cards[i].style.display !== 'none') return true; }
    return false;
  }
  // מסתירים subsection / combos-block / city-frame שאין בהם אף כרטיס מוצג
  document.querySelectorAll('.combos-block').forEach(function(b){
    if (!hasVisibleCard(b)) {
      b.style.display = 'none';
      var prev = b.previousElementSibling;
      if (prev && prev.classList && prev.classList.contains('combos-divider')) prev.style.display='none';
    }
  });
  document.querySelectorAll('.subsection').forEach(function(s){
    if (!hasVisibleCard(s)) s.style.display = 'none';
  });
  document.querySelectorAll('.city-frame').forEach(function(c){
    if (!hasVisibleCard(c)) c.style.display = 'none';
  });

  // 4) הסתרת אלמנטים קבועים שאינם משקפים את ההצעה הספציפית:
  //    תוכן-עניינים קבוע ורשימות צ'יפים של כל הסיורים. (לעתיד: תוכן-עניינים דינמי.)
  document.querySelectorAll('.toc, .sub-legend').forEach(function(el){ el.style.display = 'none'; });

  // 5) תמונות דקורטיביות — מותנות בקטגוריה שלהן:
  //    ליסבון = עם הסיורים הרגליים בליסבון · סינטרה = אחרי טיולי יום בליסבון · פורטו = אחרי סיורי פורטו
  (function(){
    function visByTour(dt){ var c=document.querySelector('[data-tour="'+dt+'"]'); return !!c && c.style.display!=='none'; }
    function visByName(dn){ var f=false; document.querySelectorAll('[data-tour-name]').forEach(function(c){ if(c.getAttribute('data-tour-name')===dn && c.style.display!=='none') f=true; }); return f; }
    var lisbonWalk = visByTour('classic-lisbon')||visByTour('belem')||visByTour('culinary')||visByTour('combo-classic-belem')||visByName('שילוב: קולינרי + קלאסית');
    var lisbonDay = visByTour('sintra')||visByTour('arrabida')||visByTour('obidos');
    var porto = visByTour('porto-classic')||visByTour('tastings')||visByTour('douro')||visByTour('combo-porto-classic-tastings');
    document.querySelectorAll('.tour-photo').forEach(function(p){
      var img=p.querySelector('img'); var src=img?(img.getAttribute('src')||''):'';
      var keep=false;
      if(/hero-quote-lisbon/.test(src)) keep=lisbonWalk;
      else if(/moment-sintra/.test(src)) keep=lisbonDay;
      else if(/moment-porto/.test(src)) keep=porto;
      if(!keep) p.style.display='none';
    });
  })();
})();
</script>
`;

  html = html.replace('</body>', injectScript + '</body>');

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
