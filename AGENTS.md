# Agent Repository Map

This file is a map, not an encyclopedia. Read only the knowledge relevant to the task.

## Start here
- `docs/agent/KNOWLEDGE_MAP.md` — context entry point and progressive-disclosure rules.
- `docs/agent/PRODUCT.md` — customer goals and completion semantics.
- `docs/agent/BEHAVIOR.md` — agent behavior contract.
- `docs/agent/ARCHITECTURE.md` — runtime boundaries and recovery model.
- `docs/agent/CAPABILITIES.md` — permissioned capabilities and evidence rules.

## Runtime code
- `lib/agent/agent-runtime.ts` — reasoning, planning and structured agent decision.
- `lib/agent/harness/` — harness state, tool authorization and verification.
- `app/api/agent/route.ts` — application execution boundary.

## Core rule
Do not infer external facts from model output. Use tool observations and verification for external facts.

## Change rule
When behavior changes, update the smallest relevant source-of-truth document. Prefer executable checks over prose when a rule can be mechanically enforced.
