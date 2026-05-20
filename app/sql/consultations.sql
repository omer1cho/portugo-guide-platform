-- ============================================================================
-- consultations — שאלוני ייעוץ מסלול שלקוחות ממלאים באתר
-- ============================================================================
-- כל שורה = פניה אחת של לקוח, ממלאה השאלון ב-portugo.co.il/consultation.
-- שדות חובה: שם מלא, טלפון/וואטסאפ, אימייל. כל השאר אופציונליים.
-- ============================================================================

CREATE TABLE IF NOT EXISTS consultations (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      timestamptz NOT NULL DEFAULT now(),

  -- פרטים בסיסיים (חובה)
  full_name       text NOT NULL,
  phone           text NOT NULL,
  email           text NOT NULL,

  -- פרטים בסיסיים (רשות)
  party_size      text,
  ages            text,
  travel_date     text,
  trip_length     text,
  has_flights     text,
  airports        text,
  flight_times    text,

  -- הרכב המטיילים
  has_kids        text,
  has_babies      text,
  mobility_limit  text,
  special_needs   text,

  -- ניסיון קודם וציפיות
  first_time_portugal text,
  prior_europe        text,
  prior_loved         text,
  prior_avoid         text,

  -- סגנון הטיול (מערכי checkbox + שדות בחירה יחידה)
  style_types        text[],  -- array של בחירות
  pace               text,

  -- מבנה הטיול
  structure          text,
  prefer_less_hotels text,
  existing_bookings  text,

  -- התניידות ונהיגה
  transport         text[],
  comfortable_driving text,
  daily_drive_time  text,
  avoid_driving     text,

  -- אזורים ומקומות
  must_include_areas    text,
  recommended_places    text,
  uncertain_areas       text,

  -- תחומי עניין
  interests         text[],

  -- אוכל וכשרות
  food_preferences  text,
  allergies         text,
  kashrut           text,
  include_restaurants text,

  -- לינה ותקציב
  lodging_level     text[],
  lodging_type      text[],
  lodging_location  text,
  budget            text,

  -- מגבלות
  physical_limits   text,
  avoid_list        text[],
  avoid_other       text,

  -- אופי השירות הרצוי
  service_focus     text[],
  existing_itinerary text,

  -- שאלות עומק
  most_important   text,
  perfect_trip     text,
  bull_in_target   text,  -- מה יגרום להגיד "זה היה בול בשבילנו"
  special_event    text,

  -- סיום
  anything_else    text,
  questions_for_us text,

  -- מטא-דאטה למעקב פנימי
  status           text NOT NULL DEFAULT 'new',  -- new | in_progress | scheduled | done | cancelled
  admin_notes      text,
  user_agent       text,
  ip_hash          text  -- hash בלבד, לא IP אמיתי (פרטיות)
);

CREATE INDEX IF NOT EXISTS consultations_created_at_idx ON consultations (created_at DESC);
CREATE INDEX IF NOT EXISTS consultations_status_idx ON consultations (status);

-- RLS: הציבור יכול להוסיף (INSERT), קריאה רק לאדמינים.
ALTER TABLE consultations ENABLE ROW LEVEL SECURITY;

-- POLICY 1: anyone can INSERT (גם anon)
DROP POLICY IF EXISTS "anon can submit consultations" ON consultations;
CREATE POLICY "anon can submit consultations"
  ON consultations
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- POLICY 2: רק אדמינים יכולים לקרוא
DROP POLICY IF EXISTS "admins can read consultations" ON consultations;
CREATE POLICY "admins can read consultations"
  ON consultations
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guides g
      WHERE LOWER(g.email) = LOWER(auth.jwt() ->> 'email')
        AND g.is_admin = true
    )
  );

-- POLICY 3: רק אדמינים יכולים לעדכן סטטוס/הערות
DROP POLICY IF EXISTS "admins can update consultations" ON consultations;
CREATE POLICY "admins can update consultations"
  ON consultations
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guides g
      WHERE LOWER(g.email) = LOWER(auth.jwt() ->> 'email')
        AND g.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM guides g
      WHERE LOWER(g.email) = LOWER(auth.jwt() ->> 'email')
        AND g.is_admin = true
    )
  );

-- POLICY 4: רק אדמינים יכולים למחוק (לא נשתמש אבל לבטחון)
DROP POLICY IF EXISTS "admins can delete consultations" ON consultations;
CREATE POLICY "admins can delete consultations"
  ON consultations
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM guides g
      WHERE LOWER(g.email) = LOWER(auth.jwt() ->> 'email')
        AND g.is_admin = true
    )
  );
