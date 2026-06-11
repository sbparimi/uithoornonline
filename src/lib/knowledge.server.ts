// Server-only helpers for RAG: embedding + chunking + ingestion.
// NEVER import from client code.
import { createHash } from "crypto";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const EMBED_MODEL = "google/gemini-embedding-001";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";

export async function embedText(text: string): Promise<number[]> {
  const apiKey = process.env.LOVABLE_API_KEY;
  if (!apiKey) throw new Error("LOVABLE_API_KEY missing");
  const res = await fetch(`${GATEWAY_URL}/embeddings`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: EMBED_MODEL, input: text }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`embed failed ${res.status}: ${t}`);
  }
  const json = (await res.json()) as { data?: { embedding?: number[] }[] };
  const vec = json.data?.[0]?.embedding;
  if (!Array.isArray(vec)) throw new Error("embed: missing vector");
  return vec;
}

/** Greedy paragraph-based chunking with ~1200 char targets. */
export function chunkMarkdown(md: string, target = 1200, maxLen = 1800): string[] {
  const cleaned = md.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (!cleaned) return [];
  const paras = cleaned.split(/\n\n+/);
  const chunks: string[] = [];
  let buf = "";
  for (const p of paras) {
    const piece = p.trim();
    if (!piece) continue;
    if (buf.length + piece.length + 2 <= maxLen && buf.length < target) {
      buf = buf ? `${buf}\n\n${piece}` : piece;
    } else {
      if (buf) chunks.push(buf);
      if (piece.length <= maxLen) {
        buf = piece;
      } else {
        // hard split a giant paragraph
        for (let i = 0; i < piece.length; i += maxLen) chunks.push(piece.slice(i, i + maxLen));
        buf = "";
      }
    }
  }
  if (buf) chunks.push(buf);
  return chunks.filter((c) => c.length >= 80);
}

export function hashChunk(s: string): string {
  return createHash("sha256").update(s).digest("hex").slice(0, 32);
}

type FirecrawlDoc = { markdown?: string; metadata?: { title?: string; sourceURL?: string } };

async function firecrawlScrape(url: string): Promise<FirecrawlDoc | null> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY missing");
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  if (!res.ok) {
    console.error("firecrawl scrape failed", res.status, await res.text().catch(() => ""));
    return null;
  }
  const json = (await res.json()) as { data?: FirecrawlDoc; markdown?: string };
  return json.data ?? (json as FirecrawlDoc);
}

async function firecrawlSearch(query: string, limit = 5): Promise<FirecrawlDoc[]> {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error("FIRECRAWL_API_KEY missing");
  const res = await fetch("https://api.firecrawl.dev/v2/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      query,
      limit,
      tbs: "qdr:m", // past month
      scrapeOptions: { formats: ["markdown"], onlyMainContent: true },
    }),
  });
  if (!res.ok) {
    console.error("firecrawl search failed", res.status, await res.text().catch(() => ""));
    return [];
  }
  const json = (await res.json()) as {
    data?: { web?: FirecrawlDoc[] } | FirecrawlDoc[];
    web?: FirecrawlDoc[];
  };
  const arr = Array.isArray(json.data)
    ? json.data
    : (json.data?.web ?? json.web ?? []);
  return arr.filter((d) => d && d.markdown);
}

type Source = {
  id: string;
  url: string;
  label: string;
  source_type: "official" | "news" | "legal" | "search";
  source_tier?: number;
};

// Domain allow-list with tier (1 = law, 5 = other). Anything not matching is
// rejected at ingest so the RAG cannot be polluted with low-trust sources.
const TIER_RULES: { re: RegExp; tier: number }[] = [
  { re: /(^|\.)wetten\.overheid\.nl$|(^|\.)eur-lex\.europa\.eu$/i, tier: 1 },
  { re: /(^|\.)rijksoverheid\.nl$|(^|\.)tweedekamer\.nl$|(^|\.)government\.nl$/i, tier: 2 },
  {
    re: /(^|\.)ilent\.nl$|(^|\.)ilt\.nl$|(^|\.)bezoekbas\.nl$|(^|\.)schiphol\.nl$|(^|\.)rivm\.nl$|(^|\.)knmi\.nl$/i,
    tier: 3,
  },
  { re: /(^|\.)uithoorn\.nl$|gemeente/i, tier: 4 },
];

export function tierForUrl(url: string): number | null {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    return null;
  }
  for (const r of TIER_RULES) if (r.re.test(host)) return r.tier;
  return null;
}

async function ingestDoc(source: Source, doc: FirecrawlDoc, overrideUrl?: string) {
  const url = overrideUrl ?? doc.metadata?.sourceURL ?? source.url;
  const title = doc.metadata?.title ?? source.label;
  const md = doc.markdown ?? "";

  // Allow-list enforcement: only ingest from trusted domains.
  const tier = tierForUrl(url) ?? source.source_tier ?? null;
  if (tier === null) {
    console.warn("ingest: rejecting non-allowlisted URL", url);
    return 0;
  }

  const chunks = chunkMarkdown(md);
  let inserted = 0;
  for (const content of chunks) {
    const content_hash = hashChunk(content);
    const { data: existing } = await supabaseAdmin
      .from("knowledge_chunks")
      .select("id")
      .eq("source_url", url)
      .eq("content_hash", content_hash)
      .maybeSingle();
    if (existing) continue;
    let embedding: number[];
    try {
      embedding = await embedText(content);
    } catch (e) {
      console.error("embed failed for chunk", e);
      continue;
    }
    const { error } = await supabaseAdmin.from("knowledge_chunks").insert({
      source_id: source.id,
      source_url: url,
      source_title: title,
      source_type: source.source_type === "search" ? "news" : source.source_type,
      source_tier: tier,
      content,
      content_hash,
      embedding: embedding as unknown as string,
      model_version: EMBED_MODEL,
    });
    if (error) {
      if (!error.message.includes("duplicate")) console.error("insert chunk", error);
    } else {
      inserted++;
    }
  }
  return inserted;
}

export async function ingestAllSources(): Promise<{
  sources: number;
  chunks_inserted: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let chunks = 0;
  const { data: sources, error } = await supabaseAdmin
    .from("knowledge_sources")
    .select("id, url, label, source_type, active")
    .eq("active", true);
  if (error) throw new Error(error.message);
  for (const s of sources ?? []) {
    try {
      if (s.source_type === "search") {
        const docs = await firecrawlSearch(s.url, 4);
        for (const d of docs) chunks += await ingestDoc(s as Source, d);
      } else {
        const doc = await firecrawlScrape(s.url);
        if (doc) chunks += await ingestDoc(s as Source, doc);
      }
      await supabaseAdmin
        .from("knowledge_sources")
        .update({ last_scraped_at: new Date().toISOString(), last_status: "ok" })
        .eq("id", s.id);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${s.url}: ${msg}`);
      await supabaseAdmin
        .from("knowledge_sources")
        .update({ last_status: `error: ${msg.slice(0, 200)}` })
        .eq("id", s.id);
    }
  }
  return { sources: sources?.length ?? 0, chunks_inserted: chunks, errors };
}

export type KnowledgeHit = {
  source_url: string;
  source_title: string | null;
  source_type: string;
  content: string;
  similarity: number;
};

export async function searchKnowledge(query: string, k = 4): Promise<KnowledgeHit[]> {
  let embedding: number[];
  try {
    embedding = await embedText(query);
  } catch (e) {
    console.error("searchKnowledge embed failed", e);
    return [];
  }
  const { data, error } = await supabaseAdmin.rpc("match_knowledge", {
    query_embedding: embedding as unknown as string,
    match_count: k,
    min_similarity: 0.55,
  });
  if (error) {
    console.error("match_knowledge rpc", error);
    return [];
  }
  return (data ?? []) as KnowledgeHit[];
}
