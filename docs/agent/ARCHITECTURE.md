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
      |
      +--> permissioned tool gateway
      |
      +--> external capability
      |
      +--> structured observation
      |
      +--> verification
      |
      +--> response
```

## Boundary rules
- The LLM proposes decisions and plans.
- The application owns execution and authorization.
- Tools return structured observations.
- Verification determines whether observations are sufficient evidence.
- Customer responses must be based on verified state and observations.

## Context rule
Context is progressively disclosed. The runtime should provide the model only the knowledge required for the current task instead of concatenating the entire repository knowledge base.

## Recovery rule
Recovery is bounded. Repeating an identical failed action without changing the relevant input, capability or context is not considered recovery.
