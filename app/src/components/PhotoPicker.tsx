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
  /** האם לפתוח ישירות במצלמה האחורית (במובייל) או לאפשר גם בחירה מהגלריה */
  cameraOnly?: boolean;
};

/**
 * רכיב לבחירת תמונה אחת — אופטימלי למובייל.
 * - לחיצה ראשונה פותחת מצלמה / גלריה לפי בחירת המשתמש
 * - מציג thumbnail אחרי בחירה
 * - מאפשר החלפה / הסרה
 */
export default function PhotoPicker({
  label = 'צרף.י תמונה',
  emoji = '📷',
  onChange,
  value,
  className = '',
  cameraOnly = false,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
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
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className={className}>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture={cameraOnly ? 'environment' : undefined}
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
              onClick={() => inputRef.current?.click()}
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
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full border-2 border-dashed border-green-600 text-green-700 py-4 rounded-lg font-semibold hover:bg-green-50 active:scale-98 transition-all"
        >
          {emoji} {label}
        </button>
      )}
    </div>
  );
}
