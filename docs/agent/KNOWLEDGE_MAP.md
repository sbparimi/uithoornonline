# Agent Knowledge Map

This is the entry point for agent context. Do not treat this file as an encyclopedia. Use it to locate the smallest authoritative source needed for the current task.

## Product
- Product behavior and customer goals: `docs/agent/PRODUCT.md`
- Agent behavior and conversation policy: `docs/agent/BEHAVIOR.md`

## Architecture
- Runtime boundaries and execution model: `docs/agent/ARCHITECTURE.md`
- Tool permissions and evidence rules: `docs/agent/CAPABILITIES.md`

## Operational state
- Current agent state is runtime state, not documentation.
- Harness execution state must remain bounded and explicit.
- Provider facts must come from tool observations, never model invention.

## Progressive disclosure
1. Start here.
2. Read only the document(s) relevant to the current task.
3. Read source code only when behavior cannot be established from the knowledge map or tool observation.
4. Never load every document by default.

## Source-of-truth rule
If documentation conflicts with executable behavior, executable behavior wins temporarily and the documentation becomes a maintenance defect. Do not silently invent a reconciliation.
