# Agent Architecture Map

## Runtime layers

```text
Customer message
      |
      v
Agent runtime
      |
      +--> context / knowledge selection
      |
      +--> reason + plan
      |      |
      |      +--> Ollama structured output (primary)
      |      |       -> LiteLLM gateway (fallback)
      |      |       -> Groq / Bedrock / OpenAI (existing fallbacks)
      |      |
      |      +--> Ajv decision contract (primary)
      |              -> narrow compatibility repair (fallback)
      |
      +--> permissioned tool gateway
      |
      +--> provider search
      |      |
      |      +--> Meilisearch (primary)
      |      |       -> Supabase verified-provider search (fallback)
      |      |
      |      +--> OpenStreetMap/Nominatim discovery (primary)
      |              -> optional Overpass enrichment
      |              -> Google Places discovery (existing fallback)
      |
      +--> structured observation
      |
      +--> verification
      |
      +--> Langfuse/OpenTelemetry observability (primary)
      |      -> console/Vercel logs (fallback)
      |
      +--> response
```

## Boundary rules
- The LLM proposes decisions and plans.
- Ollama is the preferred structured-output model endpoint when configured; LiteLLM and the existing Groq/Bedrock/OpenAI providers remain fallbacks.
- Ajv is the primary executable decision contract. Compatibility repair is narrow and happens before final contract validation.
- The application owns execution and authorization.
- Tools return structured observations.
- Meilisearch is the preferred provider-search index when configured; Supabase remains the verified-record fallback and is also used to seed the search index.
- OpenStreetMap is the preferred external discovery source; Google Places remains the fallback for broader discovery.
- Verification determines whether observations are sufficient evidence.
- Customer responses must be based on verified state and observations.
- Langfuse/OpenTelemetry is preferred for LLM/provider telemetry; normal application logs remain available when observability is not configured.

## Context rule
Context is progressively disclosed. The runtime should provide the model only the knowledge required for the current task instead of concatenating the entire repository knowledge base.

## Recovery rule
Recovery is bounded. Repeating an identical failed action without changing the relevant input, capability or context is not considered recovery.

## Operational rule
GitHub Actions runs TypeScript and production-build gates before code is promoted. Vercel remains the deployment/runtime fallback rather than the only validation mechanism.
