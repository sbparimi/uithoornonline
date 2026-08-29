-- Resident-reported evidence only. These fields do not establish aircraft causation or official measurement.
ALTER TABLE public.noise_logs
  ADD COLUMN IF NOT EXISTS observed_at timestamptz,
  ADD COLUMN IF NOT EXISTS duration_seconds integer,
  ADD COLUMN IF NOT EXISTS observation_text text,
  ADD COLUMN IF NOT EXISTS location_source text;

ALTER TABLE public.noise_logs
  DROP CONSTRAINT IF EXISTS noise_logs_duration_seconds_check;

ALTER TABLE public.noise_logs
  ADD CONSTRAINT noise_logs_duration_seconds_check
  CHECK (duration_seconds IS NULL OR (duration_seconds >= 0 AND duration_seconds <= 86400));

ALTER TABLE public.noise_logs
  DROP CONSTRAINT IF EXISTS noise_logs_location_source_check;

ALTER TABLE public.noise_logs
  ADD CONSTRAINT noise_logs_location_source_check
  CHECK (location_source IS NULL OR location_source IN ('browser','resident','none'));
