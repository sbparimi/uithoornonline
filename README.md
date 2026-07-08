# Uithoorn Noise Zone & Compensation Assessment

Evidence-based public information assistant that helps determine whether a Dutch
residential address falls within officially defined aircraft noise zones around
Schiphol, and whether the property may qualify for publicly documented
compensation or isolation schemes.

## What it does

- **Address check** — validates addresses against the official PDOK BAG
  register and intersects them with the Luchthavenindelingbesluit (LIB)
  Schiphol zones (PDOK WFS).
- **Community noise map** — real user-submitted noise reports (`noise_logs`),
  never fabricated.
- **Governed AI assistant** — answers cite live authoritative sources
  (Rijksoverheid, PDOK, BAS, Schiphol, gemeente Uithoorn) with tiered
  evidence chips, retrieval timestamps, and staleness warnings. Deflection
  ("check the official website") is forbidden — the agent calls the tools
  itself.

Every factual claim in the UI flows through the `<Evidence>` primitive
(`src/components/Evidence.tsx`) and carries `source_tier`, `source_url`, and
`retrieved_at`.

## Tech stack

- TanStack Start v1 (React 19, Vite 7) on Cloudflare Workers
- Tailwind CSS v4
- Lovable Cloud (Supabase) for auth, database, and RAG storage
- Lovable AI Gateway for LLM calls

## Local development

```sh
bun install
bun run dev
```

The app runs at `http://localhost:8080`.

Backend (database, auth, secrets) is managed through Lovable Cloud — there is
no local Supabase to start. `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` in
`.env` are publishable and safe to commit; service-role secrets are injected
server-side at deploy time and never appear in the repo.

## Deployment

Production deploys are handled by Lovable. The `main` branch is the source of
truth: pushes from GitHub sync into Lovable and vice versa.

## Project structure

```
src/
├── routes/            # File-based routes (TanStack Router)
│   ├── __root.tsx     # Root layout + head metadata
│   ├── index.tsx      # Home
│   ├── check.tsx      # Live BAG + LIB address check
│   ├── map.tsx        # Community noise map
│   ├── log.tsx        # Submit a noise report
│   └── api/public/    # Webhooks / ingest endpoints
├── lib/
│   ├── chat.functions.ts        # Governed AI agent (server fn)
│   ├── live-data.functions.ts   # Real-time BAG / LIB / noise feed
│   ├── official-sources.server.ts # PDOK BAG + LIB WFS clients
│   └── knowledge.server.ts      # RAG ingest / retrieval
├── components/
│   └── Evidence.tsx   # Source-tier citation chips (trust contract)
└── integrations/supabase/       # Auto-generated Lovable Cloud clients
```

## License

Public interest project. See individual data-source licenses (BAG, PDOK, BAS,
Schiphol Open Data) for reuse conditions of upstream data.
