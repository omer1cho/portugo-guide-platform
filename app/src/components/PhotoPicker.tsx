'use client';

import { useRef, useState, useEffect } from 'react';

type Props = {
  /** טקסט הכפתור הראשי לפני שנבחר קובץ */
  label?: string;
  /** איקון לפני הטקסט */
  emoji?: string;
  /** כשנבחר קובץ */
  onChange: (file: File | null) => void;
  /** קובץ נוכחי שכבר נבחר (לתצוגה מקדימה) */
  value?: File | null;
  /** מחלקות tailwind לעטיפה החיצונית */
  className?: string;
  /** מצב ישן — אם true, מציג רק כפתור מצלמה (לא בשימוש כרגע, נשאר ל-tabbed compat) */
  cameraOnly?: boolean;
};

/**
 * רכיב לבחירת תמונה אחת — אופטימלי למובייל.
 *
 * מציג שני כפתורים נפרדים — מצלמה וגלריה — במקום כפתור אחד שתלוי בהתנהגות
 * הדפדפן. ההפרדה הזו פותרת בעיה ב-Android Chrome שלפעמים פתח רק גלריה
 * כשהמשתמש לחץ על כפתור משולב. עכשיו זה ברור ואחיד בכל המכשירים.
 */
export default function PhotoPicker({
  label = 'צרף.י תמונה',
  emoji = '📷',
  onChange,
  value,
  className = '',
}: Props) {
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const handleSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    onChange(file);
  };

  const handleClear = () => {
    onChange(null);
    if (cameraRef.current) cameraRef.current.value = '';
    if (galleryRef.current) galleryRef.current.value = '';
  };

  // אם יש תמונה — ננסה לפתוח שוב את אותו מקור (מצלמה אם משם הגיעה).
  // לפשטות, אחרי החלפה תמיד פותחים גלריה (יותר נפוץ ל"החלף").
  const handleReplace = () => galleryRef.current?.click();

  return (
    <div className={className}>
      {/* שני input-ים מוסתרים: אחד למצלמה, אחד לגלריה */}
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleSelect}
        className="hidden"
      />
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        onChange={handleSelect}
        className="hidden"
      />

      {previewUrl ? (
        <div className="relative inline-block w-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="תצוגה מקדימה"
            className="w-full max-h-64 object-cover rounded-lg border border-gray-200"
          />
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={handleReplace}
              className="flex-1 bg-gray-100 hover:bg-gray-200 active:scale-98 transition-all text-gray-700 rounded-lg py-2 text-sm font-medium"
            >
              ↻ החלף.י
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="px-4 bg-red-50 hover:bg-red-100 active:scale-98 transition-all text-red-700 rounded-lg py-2 text-sm font-medium"
            >
              הסר.י
            </button>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          {/* תווית קטנה (אופציונלית) — מוצגת רק אם יש מה להציג */}
          {(emoji || label) && (
            <div className="text-xs text-gray-500 mb-1">
              {emoji} {label}
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              className="flex flex-col items-center justify-center bg-green-50 hover:bg-green-100 active:scale-98 transition-all border-2 border-green-600 text-green-700 py-3 rounded-lg font-semibold"
            >
              <span className="text-2xl">📷</span>
              <span className="text-sm mt-1">מצלמה</span>
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              className="flex flex-col items-center justify-center bg-blue-50 hover:bg-blue-100 active:scale-98 transition-all border-2 border-blue-600 text-blue-700 py-3 rounded-lg font-semibold"
            >
              <span className="text-2xl">🖼️</span>
              <span className="text-sm mt-1">גלריה</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
