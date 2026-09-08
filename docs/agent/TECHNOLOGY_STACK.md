# Primary / Fallback Technology Stack

| Layer | Primary | Existing fallback | Failure boundary |
|---|---|---|---|
| Structured LLM output | llama.cpp server with schema-constrained OpenAI-compatible API | LiteLLM, Groq, Bedrock, OpenAI | Provider timeout/error -> next provider |
| LLM gateway | LiteLLM when configured | Direct existing provider calls | Gateway failure -> direct providers |
| Decision contract | Ajv JSON Schema | Narrow compatibility repair + existing semantic checks | Invalid decision -> bounded harness retry |
| Provider search | Typesense | Supabase verified-provider RPC | Search failure/empty -> Supabase |
| Geographic normalization | OpenStreetMap/Nominatim | Supplied postcode | OSM failure -> supplied postcode |
| External discovery | OpenStreetMap/Nominatim + optional Overpass | Google Places | Discovery failure -> next source |
| Observability | Langfuse OSS/self-hosted via OpenTelemetry | console/Vercel logs | Missing/unavailable Langfuse -> logs |
| CI validation | GitHub Actions TypeScript + production build | Vercel build | CI is the pre-promotion gate; Vercel remains runtime/deploy fallback |

## Design rule

The application does not replace the existing stack in one cutover. Each new open-source component is introduced as the preferred adapter, while the existing implementation remains behind the same capability boundary.

This keeps the customer-facing agent operational while the primary services are being populated or configured.

## Production deployment rule

AWS infrastructure is not part of the primary deployment architecture. The llama.cpp server, Typesense, LiteLLM, and Langfuse OSS components are intended to run on independent infrastructure outside Vercel, while Vercel continues to host the web application.
