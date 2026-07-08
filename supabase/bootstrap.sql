-- ─────────────────────────────────────────────────────────────────────────────
-- Uithoorn Noise — bootstrap schema
--
-- Idempotent script that provisions the core user-facing tables on a fresh
-- Supabase / Lovable Cloud project:
--
--   • profiles     — 1:1 with auth.users, auto-created on signup
--   • noise_logs   — community noise reports tied to auth.users
--   • claims       — compensation claim intake tied to auth.users
--
-- Safe to run multiple times. All statements use IF NOT EXISTS / OR REPLACE.
-- Every table gets: GRANTs → RLS enabled → owner-only policies.
--
-- Run with:  psql "$SUPABASE_DB_URL" -f supabase/bootstrap.sql
-- ─────────────────────────────────────────────────────────────────────────────

-- ── profiles ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text,
  postcode    text,
  address     text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own profile select" ON public.profiles;
CREATE POLICY "own profile select" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "own profile insert" ON public.profiles;
CREATE POLICY "own profile insert" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "own profile update" ON public.profiles;
CREATE POLICY "own profile update" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── noise_logs ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.noise_logs (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  timestamp      timestamptz NOT NULL DEFAULT now(),
  flight_number  text,
  altitude       integer,
  db_level       integer,
  lat            double precision,
  lng            double precision,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS noise_logs_user_id_idx    ON public.noise_logs (user_id);
CREATE INDEX IF NOT EXISTS noise_logs_timestamp_idx  ON public.noise_logs (timestamp DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.noise_logs TO authenticated;
GRANT ALL ON public.noise_logs TO service_role;

ALTER TABLE public.noise_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own logs select" ON public.noise_logs;
CREATE POLICY "own logs select" ON public.noise_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own logs insert" ON public.noise_logs;
CREATE POLICY "own logs insert" ON public.noise_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own logs delete" ON public.noise_logs;
CREATE POLICY "own logs delete" ON public.noise_logs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Note: the community map reads anonymized aggregates via the service_role
-- client (see src/lib/live-data.functions.ts). We deliberately do NOT expose
-- a public SELECT policy here — raw user_id must never leak to the browser.

-- ── claims ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.claims (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name            text NOT NULL,
  address         text NOT NULL,
  postcode        text NOT NULL,
  years_selected  text[] NOT NULL DEFAULT '{}',
  package         text NOT NULL,
  paid            boolean NOT NULL DEFAULT false,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS claims_user_id_idx ON public.claims (user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.claims TO authenticated;
GRANT ALL ON public.claims TO service_role;

ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own claims select" ON public.claims;
CREATE POLICY "own claims select" ON public.claims
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "own claims insert" ON public.claims;
CREATE POLICY "own claims insert" ON public.claims
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "own claims update" ON public.claims;
CREATE POLICY "own claims update" ON public.claims
  FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
