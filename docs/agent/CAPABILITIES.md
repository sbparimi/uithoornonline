# Agent Capability Map

## Local discovery
The agent may request local provider/business discovery through the permissioned tool gateway.

### Preconditions
- The task is a local discovery task.
- The requested category or service is sufficiently understood.
- Search parameters are derived from the current task and durable context.

### Evidence
Provider results are observations, not model knowledge. Provider identity and usable contact/location evidence must be checked before presenting a provider as a successful result.

### Prohibited behavior
- No invented providers.
- No invented contact information.
- No claims that an external action occurred unless a tool observation confirms it.
- No unrestricted tool execution from model output.

## Future capabilities
New capabilities must be added to this map with explicit authorization, input contract, output observation shape and verification rule before the model is allowed to use them.
