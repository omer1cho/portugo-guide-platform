-- Add optional start_time column to tours table
ALTER TABLE tours ADD COLUMN IF NOT EXISTS start_time TIME;
