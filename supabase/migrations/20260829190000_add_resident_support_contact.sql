-- Resident support intake fields. These store contact preferences and meeting requests;
-- they do not constitute an official claim or application with any authority.
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS contact_method TEXT CHECK (contact_method IN ('phone','whatsapp'));
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS meeting_requested BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.claims ADD COLUMN IF NOT EXISTS meeting_availability TEXT;
