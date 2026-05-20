/**
 * consultation.ts — טיפוסים + מטא-דאטה של שאלון ייעוץ מסלול.
 *
 * שותף בין הדף הציבורי (/consultation), ה-API route (/api/consultations)
 * ודף האדמין (/admin/consultations). כדי שלא יהיו שמות שדות שלא תואמים.
 */

export type ConsultationSubmission = {
  // פרטים בסיסיים (חובה)
  full_name: string;
  phone: string;
  email: string;

  // פרטים בסיסיים (רשות)
  party_size?: string;
  ages?: string;
  travel_date?: string;
  trip_length?: string;
  has_flights?: string;
  airports?: string;
  flight_times?: string;

  // הרכב המטיילים
  has_kids?: string;
  has_babies?: string;
  mobility_limit?: string;
  special_needs?: string;

  // ניסיון קודם וציפיות
  first_time_portugal?: string;
  prior_europe?: string;
  prior_loved?: string;
  prior_avoid?: string;

  // סגנון
  style_types?: string[];
  pace?: string;

  // מבנה הטיול
  structure?: string;
  prefer_less_hotels?: string;
  existing_bookings?: string;

  // התניידות
  transport?: string[];
  comfortable_driving?: string;
  daily_drive_time?: string;
  avoid_driving?: string;

  // אזורים ומקומות
  must_include_areas?: string;
  recommended_places?: string;
  uncertain_areas?: string;

  // תחומי עניין
  interests?: string[];

  // אוכל וכשרות
  food_preferences?: string;
  allergies?: string;
  kashrut?: string;
  include_restaurants?: string;

  // לינה ותקציב
  lodging_level?: string[];
  lodging_type?: string[];
  lodging_location?: string;
  budget?: string;

  // מגבלות
  physical_limits?: string;
  avoid_list?: string[];
  avoid_other?: string;

  // אופי השירות
  service_focus?: string[];
  existing_itinerary?: string;

  // שאלות עומק
  most_important?: string;
  perfect_trip?: string;
  bull_in_target?: string;
  special_event?: string;

  // סיום
  anything_else?: string;
  questions_for_us?: string;
};

export type ConsultationRow = ConsultationSubmission & {
  id: string;
  created_at: string;
  status: 'new' | 'in_progress' | 'scheduled' | 'done' | 'cancelled';
  admin_notes?: string | null;
  user_agent?: string | null;
  ip_hash?: string | null;
};

// ============================================================================
// אופציות לצ'קבוקסים — מקור אמת אחד, גם לדף הציבורי וגם להצגה באדמין
// ============================================================================

export const STYLE_TYPES = [
  'טבע ונופים',
  'ערים ואווירה',
  'כפרים ועיירות',
  'קולינריה ויין',
  'חופים',
  'היסטוריה ותרבות',
  'אטרקציות לילדים',
  'שופינג',
  'טיול רומנטי / זוגי',
  'טיול משפחתי',
  'טיול יוקרתי ומפנק',
  'שילוב מגוון',
];

export const PACE_OPTIONS = [
  'רגוע — לא יותר מדי נסיעות ואטרקציות ביום',
  'בינוני — שילוב בין הספק למנוחה',
  'עמוס — רוצים לראות כמה שיותר',
  'לא בטוחים, נשמח להכוונה',
];

export const STRUCTURE_OPTIONS = [
  'טיול כוכב: לינה במקום אחד או שניים ויציאות יומיות',
  'מעבר בין כמה אזורים ולינות',
  'שילוב בין השניים',
  'עדיין לא בטוחים — נשמח להמלצה',
];

export const TRANSPORT_OPTIONS = [
  'רכב שכור',
  'תחבורה ציבורית',
  'מוניות / העברות פרטיות',
  'שילוב',
  'עדיין לא החלטנו',
];

export const DRIVING_OPTIONS = [
  'כן',
  'לא',
  'תלוי באזור / במרחקים',
];

export const DAILY_DRIVE_OPTIONS = [
  'עד שעה ביום',
  'שעה–שעתיים',
  'עד שלוש שעות',
  'אין בעיה עם נסיעות ארוכות אם זה שווה את זה',
];

export const INTEREST_OPTIONS = [
  'תצפיות ונופים',
  'טיולים רגליים קלים',
  'מסלולי טבע רציניים יותר',
  'יקבים ויין',
  'מסעדות מומלצות',
  'שווקים ואוכל מקומי',
  'מוזיאונים',
  'ארמונות וטירות',
  'חופים ובטן־גב',
  'אטרקציות לילדים',
  'פארקים / גני חיות / אקווריומים',
  'קניות',
  'חיי לילה',
  'צילום ולוקיישנים יפים',
  'מקומות פחות מתוירים',
];

export const LODGING_LEVEL_OPTIONS = [
  'פשוט ונקי',
  'נוח ומרכזי',
  'בוטיק / מיוחד',
  'מפנק',
  'יוקרתי',
];

export const LODGING_TYPE_OPTIONS = [
  'מלונות',
  'דירות',
  'וילות',
  'מלונות כפריים / יקבים / חוות',
  'אין העדפה',
];

export const AVOID_OPTIONS = [
  'נסיעות ארוכות',
  'הרבה הליכה',
  'מדרגות ועליות',
  'מקומות עמוסים מדי',
  'החלפת מלונות מרובה',
  'נהיגה בערים',
  'אטרקציות תיירותיות מדי',
  'מסעדות יקרות',
  'ימים עמוסים מדי',
];

export const SERVICE_FOCUS_OPTIONS = [
  'בניית שלד מסלול כללי',
  'חלוקה נכונה של ימים ואזורים',
  'בחירת יעדים שמתאימים להרכב שלכם',
  'אטרקציות לילדים',
  'תכנון נסיעות ומעברים',
  'דיוק מסלול שכבר בניתם לבד',
  'התלבטות בין אזורים שונים בפורטוגל',
];

// ============================================================================
// כותרות בעברית לכל שדה — לשימוש במייל ההתראה ובדף האדמין
// ============================================================================

export const FIELD_LABELS: Record<keyof ConsultationSubmission, string> = {
  full_name: 'שם מלא',
  phone: 'טלפון / וואטסאפ',
  email: 'אימייל',
  party_size: 'כמה אנשים מטיילים',
  ages: 'גילאי המשתתפים',
  travel_date: 'מועד טיול משוער',
  trip_length: 'משך טיול משוער',
  has_flights: 'כבר יש טיסות?',
  airports: 'איפה נוחתים ומאיפה חוזרים',
  flight_times: 'שעות נחיתה והמראה',
  has_kids: 'האם יש ילדים? (גילאים)',
  has_babies: 'האם יש תינוקות / עגלות',
  mobility_limit: 'קושי בהליכה / מגבלה פיזית / קצב איטי',
  special_needs: 'צרכים מיוחדים',
  first_time_portugal: 'פעם ראשונה בפורטוגל?',
  prior_europe: 'טיולים קודמים באירופה',
  prior_loved: 'איזה טיול קודם אהבתם במיוחד',
  prior_avoid: 'מה פחות עבד בטיולים קודמים',
  style_types: 'סגנון הטיול',
  pace: 'קצב הטיול',
  structure: 'מבנה הטיול',
  prefer_less_hotels: 'להחליף כמה שפחות מקומות לינה?',
  existing_bookings: 'לינות שכבר סגורות',
  transport: 'התניידות',
  comfortable_driving: 'נוח לכם לנהוג בפורטוגל?',
  daily_drive_time: 'משך נסיעה יומי נוח',
  avoid_driving: 'דברים שחשוב להימנע מהם בנהיגה',
  must_include_areas: 'מקומות שחשוב לכלול',
  recommended_places: 'מקומות / מלונות / מסעדות שראיתם',
  uncertain_areas: 'אזורים שלא בטוחים לגביהם',
  interests: 'תחומי עניין',
  food_preferences: 'העדפות קולינריות',
  allergies: 'רגישויות / אלרגיות / צמחונות',
  kashrut: 'כשרות',
  include_restaurants: 'לשלב מסעדות מומלצות?',
  lodging_level: 'רמת לינה',
  lodging_type: 'סוג לינה',
  lodging_location: 'מיקום לינה',
  budget: 'תקציב משוער (לא כולל טיסות)',
  physical_limits: 'מגבלות פיזיות',
  avoid_list: 'דברים שמעדיפים להימנע מהם',
  avoid_other: 'אחר — דברים להימנע מהם',
  service_focus: 'במה להתמקד בפגישה',
  existing_itinerary: 'מסלול ראשוני שכבר יש',
  most_important: 'מה הכי חשוב בטיול הזה',
  perfect_trip: 'איך נראה בעיניכם טיול מושלם',
  bull_in_target: 'מה יגרום להגיד: "זה היה בול בשבילנו"',
  special_event: 'אירוע מיוחד סביב הטיול',
  anything_else: 'משהו נוסף שחשוב שנדע',
  questions_for_us: 'שאלות שתרצו שנגיע איתן מוכנים',
};

/** סדר הצגה במייל ובאדמין */
export const FIELD_ORDER: Array<keyof ConsultationSubmission> = [
  'full_name', 'phone', 'email',
  'party_size', 'ages', 'travel_date', 'trip_length',
  'has_flights', 'airports', 'flight_times',
  'has_kids', 'has_babies', 'mobility_limit', 'special_needs',
  'first_time_portugal', 'prior_europe', 'prior_loved', 'prior_avoid',
  'style_types', 'pace',
  'structure', 'prefer_less_hotels', 'existing_bookings',
  'transport', 'comfortable_driving', 'daily_drive_time', 'avoid_driving',
  'must_include_areas', 'recommended_places', 'uncertain_areas',
  'interests',
  'food_preferences', 'allergies', 'kashrut', 'include_restaurants',
  'lodging_level', 'lodging_type', 'lodging_location', 'budget',
  'physical_limits', 'avoid_list', 'avoid_other',
  'service_focus', 'existing_itinerary',
  'most_important', 'perfect_trip', 'bull_in_target', 'special_event',
  'anything_else', 'questions_for_us',
];

/** קבוצות לתצוגה — לאדמין */
export const SECTION_GROUPS: { title: string; fields: Array<keyof ConsultationSubmission> }[] = [
  {
    title: 'פרטים בסיסיים',
    fields: ['full_name', 'phone', 'email', 'party_size', 'ages', 'travel_date', 'trip_length', 'has_flights', 'airports', 'flight_times'],
  },
  {
    title: 'הרכב המטיילים',
    fields: ['has_kids', 'has_babies', 'mobility_limit', 'special_needs'],
  },
  {
    title: 'ניסיון קודם וציפיות',
    fields: ['first_time_portugal', 'prior_europe', 'prior_loved', 'prior_avoid'],
  },
  {
    title: 'סגנון וקצב',
    fields: ['style_types', 'pace'],
  },
  {
    title: 'מבנה הטיול',
    fields: ['structure', 'prefer_less_hotels', 'existing_bookings'],
  },
  {
    title: 'התניידות ונהיגה',
    fields: ['transport', 'comfortable_driving', 'daily_drive_time', 'avoid_driving'],
  },
  {
    title: 'אזורים ומקומות',
    fields: ['must_include_areas', 'recommended_places', 'uncertain_areas'],
  },
  {
    title: 'תחומי עניין',
    fields: ['interests'],
  },
  {
    title: 'אוכל וכשרות',
    fields: ['food_preferences', 'allergies', 'kashrut', 'include_restaurants'],
  },
  {
    title: 'לינה ותקציב',
    fields: ['lodging_level', 'lodging_type', 'lodging_location', 'budget'],
  },
  {
    title: 'מגבלות',
    fields: ['physical_limits', 'avoid_list', 'avoid_other'],
  },
  {
    title: 'אופי השירות',
    fields: ['service_focus', 'existing_itinerary'],
  },
  {
    title: 'שאלות עומק',
    fields: ['most_important', 'perfect_trip', 'bull_in_target', 'special_event'],
  },
  {
    title: 'סיום',
    fields: ['anything_else', 'questions_for_us'],
  },
];

/** עיצוב תווית סטטוס בעברית */
export function statusLabel(status: ConsultationRow['status']): string {
  switch (status) {
    case 'new': return 'חדשה';
    case 'in_progress': return 'בטיפול';
    case 'scheduled': return 'נקבעה פגישה';
    case 'done': return 'הושלם';
    case 'cancelled': return 'בוטל';
  }
}

export function statusColor(status: ConsultationRow['status']): string {
  switch (status) {
    case 'new':         return '#d4351c';  // אדום — דורש תשומת לב
    case 'in_progress': return '#f5c518';  // צהוב
    case 'scheduled':   return '#1a7a3d';  // ירוק
    case 'done':        return '#6b7280';  // אפור — סגור
    case 'cancelled':   return '#9ca3af';  // אפור בהיר
  }
}
