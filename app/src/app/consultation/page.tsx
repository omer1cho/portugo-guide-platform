/**
 * /consultation — שאלון ייעוץ מסלול ציבורי.
 *
 * דף ציבורי — לקוחות פוטנציאליים מקבלים את הקישור הקבוע ומשאירים פניה.
 * בסיום: הדאטה נשמרת ב-Supabase ועומר מקבלת מייל התראה.
 */

import type { Metadata } from 'next';
import ConsultationForm from './ConsultationForm';

export const metadata: Metadata = {
  title: 'שאלון ייעוץ מסלול | פורטוגו',
  description: 'שאלון היכרות לקראת תכנון מסלול הטיול שלכם בפורטוגל',
  robots: { index: false, follow: false }, // לא רוצים שיופיע בגוגל — קישור פרטי
};

export default function ConsultationPage() {
  return <ConsultationForm />;
}
