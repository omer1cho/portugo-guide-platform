# -*- coding: utf-8 -*-
"""
מעתיק את תמונות הסיורים שהמדריכים העלו למערכת אל הדרייב של פורטוגו.

איך זה עובד:
  1. מושך רשימה של כל התמונות מהמערכת (/api/photo-manifest).
  2. מוריד כל תמונה (הכתובות ציבוריות, לא צריך התחברות).
  3. שומר אותה בתיקייה הנכונה בדרייב:
        מאגר תמונות פורטוגו / קבוצות / <סוג הסיור> / <שנה> / PHOTO-<תאריך>-<מזהה>.jpg
  4. גוגל דרייב (Drive for Desktop) מסנכרן לבד לענן.

הסקריפט בטוח להרצה חוזרת: תמונה שכבר קיימת בדרייב מדולגת.

הרצה:
    python sync_photos_to_drive.py --drive "H:/My Drive/מאגר תמונות פורטוגו"
    python sync_photos_to_drive.py --drive "..." --from 2026-09-01     # רק מספטמבר
    python sync_photos_to_drive.py --drive "..." --dry-run             # רק להראות מה יקרה
"""

import argparse
import json
import os
import sys
import urllib.request

MANIFEST_URL = "https://portugo-guide-platform.vercel.app/api/photo-manifest?k=gogo-photos-2026"

# סוג הסיור במערכת -> שם התיקייה בדרייב. השמות בדרייב שונים מהשמות במערכת,
# ולכן הטבלה הזו היא המקור. (מופה מול הדרייב ב-14.6.26)
FOLDER_BY_TOUR_TYPE = {
    "קלאסי_1": "ליסבון הקלאסית",
    "קלאסי_2": "ליסבון הקלאסית",
    "פורטו_1": "פורטו",
    "בלם_1": "בלם",
    "סינטרה": "סינטרה",
    "אראבידה": "אראבידה והסביבה",
    "אובידוש": "אובידוש והסביבה",
    "קולינרי": "קולינרי",
    "טעימות": "טעימות בפורטו",
    "יינות": "טעימות בפורטו",
    "דורו": "דורו ",          # שימי לב: בדרייב יש רווח בסוף השם
    "יהדות": "ליסבון הקלאסית",
}

# סיור פרטי: אין תיקייה "פרטי" בדרייב. ברירת המחדל היא "פרטיים חריגים",
# אלא אם ההערות מזהות סיור מוכר — ואז התמונה הולכת לתיקייה של אותו סיור.
PRIVATE_DEFAULT_FOLDER = "פרטיים חריגים"
PRIVATE_KEYWORDS = [
    ("סינטרה", "סינטרה"),
    ("אראבידה", "אראבידה והסביבה"),
    ("אובידוש", "אובידוש והסביבה"),
    ("קולינרי", "קולינרי"),
    ("טעימות", "טעימות בפורטו"),
    ("דורו", "דורו "),
    ("בלם", "בלם"),
    ("יהדות", "ליסבון הקלאסית"),
    ("קלאסי", "ליסבון הקלאסית"),
]


def target_folder(tour_type, category, notes):
    """מחזיר את שם תיקיית היעד בדרייב, או None אם לא ידוע."""
    if tour_type in ("פרטי_1", "פרטי_2") or category == "private":
        for keyword, folder in PRIVATE_KEYWORDS:
            if keyword in (notes or ""):
                return folder
        return PRIVATE_DEFAULT_FOLDER
    return FOLDER_BY_TOUR_TYPE.get(tour_type)


def fetch_manifest(from_date):
    url = MANIFEST_URL + ("&from=" + from_date if from_date else "")
    with urllib.request.urlopen(url, timeout=120) as r:
        data = json.loads(r.read().decode("utf-8"))
    if not data.get("ok"):
        raise SystemExit("המערכת לא החזירה רשימה: " + str(data))
    return data["photos"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--drive", required=True,
                    help='הנתיב לתיקיית "מאגר תמונות פורטוגו" בדרייב המחובר למחשב')
    ap.add_argument("--from", dest="from_date", default="",
                    help="להעתיק רק מתאריך זה והלאה (YYYY-MM-DD)")
    ap.add_argument("--dry-run", action="store_true", help="רק להראות מה יקרה, בלי להעתיק")
    args = ap.parse_args()

    root = args.drive
    if not os.path.isdir(root):
        raise SystemExit("לא נמצאה התיקייה בדרייב: " + root)

    groups_root = os.path.join(root, "קבוצות")
    if not os.path.isdir(groups_root):
        raise SystemExit('לא נמצאה תיקיית "קבוצות" בתוך: ' + root)

    photos = fetch_manifest(args.from_date)
    print("נמצאו %d תמונות במערכת" % len(photos))

    copied = skipped = failed = 0
    unknown = {}

    for p in photos:
        folder = target_folder(p.get("tour_type"), p.get("category"), p.get("notes"))
        if not folder:
            unknown[p.get("tour_type")] = unknown.get(p.get("tour_type"), 0) + 1
            continue

        year = (p["date"] or "")[:4]
        dest_dir = os.path.join(groups_root, folder, year)
        name = "PHOTO-%s-%s.jpg" % (p["date"], str(p["id"])[:8])
        dest = os.path.join(dest_dir, name)

        if os.path.exists(dest) and os.path.getsize(dest) > 0:
            skipped += 1
            continue

        if args.dry_run:
            print("[יועתק] %s -> %s\\%s" % (name, folder, year))
            copied += 1
            continue

        try:
            os.makedirs(dest_dir, exist_ok=True)
            with urllib.request.urlopen(p["url"], timeout=120) as r:
                blob = r.read()
            if not blob:
                raise ValueError("קובץ ריק")
            tmp = dest + ".part"
            with open(tmp, "wb") as f:
                f.write(blob)
            os.replace(tmp, dest)
            copied += 1
            if copied % 25 == 0:
                print("  הועתקו %d..." % copied)
        except Exception as e:
            failed += 1
            print("  נכשל: %s (%s)" % (name, e))

    print("\nסיכום: הועתקו %d, כבר היו בדרייב %d, נכשלו %d" % (copied, skipped, failed))
    if unknown:
        print("סוגי סיור בלי תיקייה מוגדרת: %s" % unknown)
    if not args.dry_run and copied:
        print('גוגל דרייב מסנכרן עכשיו ברקע. אפשר לעקוב בסמל הדרייב בשורת המשימות.')


if __name__ == "__main__":
    main()
