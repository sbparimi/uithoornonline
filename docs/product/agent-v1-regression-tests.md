# Uithoorn.online Agent V1 Regression Tests

These tests define the V1 contract for the six P0 capabilities: persistent state, default geography, deterministic intent/entity normalization, task state, specialist workflow routing, and regression protection.

## T01 — Indian food uses default Uithoorn

Given a fresh anonymous session.

When the user says:

`I need Indian food`

Then:

- language = `en`
- intent = `find_food`
- cuisine = `Indian`
- municipality = `Uithoorn`
- specialist = `food`
- provider search query = `Indian food`
- provider search location = `Uithoorn`
- SpiceIndia is an eligible verified provider
- the agent must not ask for location

## T02 — Context survives the next turn

When the user first says:

`I need Indian food`

and then:

`order it`

Then:

- intent remains `order_food`
- cuisine remains `Indian`
- municipality remains `Uithoorn`
- the agent must not ask for location again
- the agent should ask only for the next missing fulfilment/order detail

## T03 — Explicit Uithoorn location is retained

When the user says:

`I need Indian food in Uithoorn`

Then:

- municipality = `Uithoorn`
- intent = `find_food`
- cuisine = `Indian`

A later message such as `pickup` must retain all three values.

## T04 — Postcode resolves to Uithoorn

When the user says:

`1422RR`

Then:

- postcode = `1422RR`
- municipality = `Uithoorn`
- source = `postcode`

A provider does not need to have the exact postcode `1422` in its own postcode field if its verified service area is Uithoorn.

## T05 — De Kwakel postcode resolves separately

When the user says:

`1424RR`

Then:

- postcode = `1424RR`
- municipality = `De Kwakel`
- source = `postcode`

## T06 — No language mixing

English input must produce an English response.

Dutch input must produce a Dutch response.

The response must not contain accidental mixed phrases such as `Vertel gewoon wat je you need` or `te finding`.

## T07 — Provider facts are grounded

For SpiceIndia the agent may state only verified data supplied by the provider record, including South Indian food, dosa, idli, vada, Andhra-style biryani, pickup, catering, and no delivery.

The agent must not invent prices, delivery availability, opening changes, or menu items.

## T08 — Ordering is a task, not a generic search

When the user says:

`order Indian food`

the specialist is `food` and task type is `order_food`.

If fulfilment is missing, the agent asks for the next necessary fulfilment choice. If pickup is selected, the agent proceeds to order details instead of restarting the conversation.

## T09 — Existing context is never discarded

A later message such as `Uithoorn`, `pickup`, `dosa`, or `tomorrow` must enrich or modify the existing state rather than reset intent, cuisine, provider, or location.

## T10 — Provider retrieval failure is not fabricated

If no verified provider matches the structured task and location, the agent must say that no verified matching provider was found and ask only for information that can materially improve the search.

It must never invent a local provider.
