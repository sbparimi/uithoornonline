CREATE TABLE public.ai_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  question text,
  paid boolean NOT NULL DEFAULT false,
  mollie_payment_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.ai_sessions TO authenticated;
GRANT ALL ON public.ai_sessions TO service_role;
ALTER TABLE public.ai_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ai_sessions select" ON public.ai_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own ai_sessions insert" ON public.ai_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.dossier_exports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  claim_id uuid REFERENCES public.claims(id) ON DELETE SET NULL,
  paid boolean NOT NULL DEFAULT false,
  mollie_payment_id text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.dossier_exports TO authenticated;
GRANT ALL ON public.dossier_exports TO service_role;
ALTER TABLE public.dossier_exports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own dossier_exports select" ON public.dossier_exports FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "own dossier_exports insert" ON public.dossier_exports FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_ai_sessions_payment ON public.ai_sessions(mollie_payment_id);
CREATE INDEX idx_dossier_exports_payment ON public.dossier_exports(mollie_payment_id);