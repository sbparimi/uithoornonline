# Uithoorn.online — Phase 1 Provider Discovery Specification

## Product objective
Move Uithoorn.online from a visually complete directory into a trustworthy local discovery product where a resident can discover a real, verified provider and take a clear next action.

## Scope
This phase covers provider discovery and provider profile presentation. It does not introduce reviews, payments, advertising, AI chat, or a mobile app.

## Product rules
1. Only verified and active database businesses are public marketplace listings.
2. Curated/static fallback content must never be presented as verified marketplace inventory.
3. Provider profile pages must show only information actually stored for that provider.
4. Contact actions must be explicit: website, phone, or request-local-help.
5. No placeholder businesses, fake reviews, invented ratings, or invented opening hours.
6. Dutch and English must use the same product semantics; language changes text, not data meaning.
7. The provider directory must remain useful when the database is empty; the UI must explain the state rather than manufacture inventory.

## Acceptance criteria
- [ ] `/businesses` reads verified, active businesses from Supabase.
- [ ] Directory cards link to `/businesses/[id]` for database businesses.
- [ ] `/businesses/[id]` renders a provider profile using public verified fields only.
- [ ] Provider profile exposes a clear primary action and safe fallback when contact details are absent.
- [ ] Empty database state is explicit and branded.
- [ ] Existing request flow remains unchanged.
- [ ] Existing Dutch/English switcher remains unchanged and covers the new profile UI.
- [ ] No existing homepage visual system is redesigned in this phase.
- [ ] TypeScript/build passes before deployment.
- [ ] Production smoke review checks home, directory, profile, signup and request routes.

## Specialist review gates
### Product
Validate that every screen answers: what is this, why should the resident care, and what action can they take?

### UX/content
Validate hierarchy, truthful claims, CTA clarity, empty states, and Dutch/English semantic parity.

### Engineering
Validate server/client boundaries, Supabase RLS assumptions, error handling, and no accidental exposure of owner-only data.

### QA/release
Validate build, route rendering, language switching, responsive layout, broken links, and regression of existing flows.

## Definition of done
The phase is done only when all acceptance criteria pass and no P0/P1 product, brand, translation, accessibility, or functional defects remain.
