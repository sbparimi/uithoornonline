-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- =========================
-- knowledge_sources
-- =========================
CREATE TABLE public.knowledge_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url text NOT NULL UNIQUE,
  label text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('official','news','legal','search')),
  active boolean NOT NULL DEFAULT true,
  last_scraped_at timestamptz,
  last_status text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.knowledge_sources TO anon, authenticated;
GRANT ALL ON public.knowledge_sources TO service_role;

ALTER TABLE public.knowledge_sources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_sources public read"
  ON public.knowledge_sources FOR SELECT
  USING (true);

-- Seed sources (Dutch authoritative + news search queries)
INSERT INTO public.knowledge_sources (url, label, source_type) VALUES
  ('https://www.bezoekbas.nl/',                                         'BAS – Bewoners Aanspreekpunt Schiphol',     'official'),
  ('https://www.bezoekbas.nl/veelgestelde-vragen/',                     'BAS – Veelgestelde vragen',                  'official'),
  ('https://www.schiphol.nl/nl/schiphol-als-buur/',                     'Schiphol – Schiphol als buur',               'official'),
  ('https://www.schiphol.nl/nl/schiphol-als-buur/pagina/geluid/',       'Schiphol – Geluid',                          'official'),
  ('https://www.ilent.nl/onderwerpen/geluid-luchtvaart',                'ILT – Geluid luchtvaart',                    'official'),
  ('https://www.uithoorn.nl/',                                          'Gemeente Uithoorn',                          'official'),
  ('schiphol geluidsoverlast Uithoorn',                                 'Nieuws – Schiphol Uithoorn',                 'search'),
  ('Schiphol compensatie omwonenden',                                   'Nieuws – Compensatie omwonenden Schiphol',   'search');

-- =========================
-- knowledge_chunks (RAG)
-- =========================
CREATE TABLE public.knowledge_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id uuid REFERENCES public.knowledge_sources(id) ON DELETE CASCADE,
  source_url text NOT NULL,
  source_title text,
  source_type text NOT NULL,
  language text NOT NULL DEFAULT 'nl',
  content text NOT NULL,
  content_hash text NOT NULL,
  embedding vector(3072) NOT NULL,
  model_version text NOT NULL DEFAULT 'google/gemini-embedding-001',
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_url, content_hash)
);

CREATE INDEX knowledge_chunks_source_id_idx ON public.knowledge_chunks (source_id);
CREATE INDEX knowledge_chunks_fetched_at_idx ON public.knowledge_chunks (fetched_at DESC);

GRANT SELECT ON public.knowledge_chunks TO anon, authenticated;
GRANT ALL ON public.knowledge_chunks TO service_role;

ALTER TABLE public.knowledge_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "knowledge_chunks public read"
  ON public.knowledge_chunks FOR SELECT
  USING (true);

-- Similarity search
CREATE OR REPLACE FUNCTION public.match_knowledge(
  query_embedding vector(3072),
  match_count int DEFAULT 5,
  min_similarity float DEFAULT 0.55
)
RETURNS TABLE (
  id uuid,
  source_url text,
  source_title text,
  source_type text,
  content text,
  similarity float,
  fetched_at timestamptz
)
LANGUAGE sql STABLE
SET search_path = public
AS $$
  SELECT
    k.id,
    k.source_url,
    k.source_title,
    k.source_type,
    k.content,
    1 - (k.embedding <=> query_embedding) AS similarity,
    k.fetched_at
  FROM public.knowledge_chunks k
  WHERE 1 - (k.embedding <=> query_embedding) >= min_similarity
  ORDER BY k.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_knowledge(vector, int, float) TO anon, authenticated, service_role;

-- =========================
-- chat_eval_runs (factuality regression tests)
-- =========================
CREATE TABLE public.chat_eval_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  question text NOT NULL,
  expected_keywords text[] NOT NULL DEFAULT '{}',
  must_cite boolean NOT NULL DEFAULT true,
  actual_answer text,
  citation_count int NOT NULL DEFAULT 0,
  passed boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.chat_eval_runs TO authenticated;
GRANT ALL ON public.chat_eval_runs TO service_role;

ALTER TABLE public.chat_eval_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_eval_runs authenticated read"
  ON public.chat_eval_runs FOR SELECT
  TO authenticated
  USING (true);