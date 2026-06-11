
ALTER TABLE public.knowledge_sources ADD COLUMN IF NOT EXISTS source_tier int NOT NULL DEFAULT 5;
ALTER TABLE public.knowledge_chunks ADD COLUMN IF NOT EXISTS source_tier int NOT NULL DEFAULT 5;

-- Backfill tiers based on domain
UPDATE public.knowledge_sources SET source_tier = 1 WHERE url ~* 'wetten\.overheid\.nl|eur-lex\.europa\.eu';
UPDATE public.knowledge_sources SET source_tier = 2 WHERE url ~* 'rijksoverheid\.nl|tweedekamer\.nl|government\.nl';
UPDATE public.knowledge_sources SET source_tier = 3 WHERE url ~* 'ilent\.nl|ilt\.nl|bezoekbas\.nl|schiphol\.nl|rivm\.nl|knmi\.nl';
UPDATE public.knowledge_sources SET source_tier = 4 WHERE url ~* 'uithoorn\.nl|gemeente';
UPDATE public.knowledge_chunks c SET source_tier = s.source_tier
  FROM public.knowledge_sources s WHERE c.source_id = s.id AND c.source_tier = 5;

CREATE TABLE IF NOT EXISTS public.chat_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  request_id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  lang text NOT NULL DEFAULT 'nl',
  model text NOT NULL DEFAULT 'google/gemini-2.5-flash',
  question text NOT NULL,
  status text NOT NULL,
  message text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb,
  sources jsonb NOT NULL DEFAULT '[]'::jsonb,
  flags jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.chat_audit_log TO authenticated;
GRANT ALL ON public.chat_audit_log TO service_role;
ALTER TABLE public.chat_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit read" ON public.chat_audit_log FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP FUNCTION IF EXISTS public.match_knowledge(vector, integer, double precision);
CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding vector,
  match_count integer DEFAULT 5,
  min_similarity double precision DEFAULT 0.55
)
RETURNS TABLE (
  id uuid,
  source_url text,
  source_title text,
  source_type text,
  source_tier int,
  content text,
  similarity double precision,
  fetched_at timestamptz
)
LANGUAGE sql STABLE SET search_path TO 'public' AS $$
  SELECT
    k.id, k.source_url, k.source_title, k.source_type, k.source_tier,
    k.content,
    1 - (k.embedding <=> query_embedding) AS similarity,
    k.fetched_at
  FROM public.knowledge_chunks k
  WHERE 1 - (k.embedding <=> query_embedding) >= min_similarity
  ORDER BY k.source_tier ASC, k.embedding <=> query_embedding
  LIMIT match_count;
$$;
