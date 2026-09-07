# Uithoorn.online

Uithoorn.online is a modern local marketplace and community platform for Uithoorn and De Kwakel.

## Product areas
- Local businesses and services
- Local requests and lead generation
- Jobs and opportunities
- Events and local agenda
- Deals and promotions
- Community discovery

## Stack
Next.js, React, TypeScript, responsive CSS, Vercel and GitHub.

## Agent architecture
The local agent uses an LLM orchestrator to understand intent and route to a specialist, followed by specialist flow-graph execution, slot filling, grounded tool/search execution and response rendering.

Before non-emergency agent processing, the chat collects the user's name, email, phone number and address including house number. The API enforces this requirement server-side; genuine emergencies bypass contact collection so safety guidance is never delayed.

The application is intentionally database-ready; transactional data and authentication can be connected as the product model matures.
