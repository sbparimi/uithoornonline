import Ajv, { type JSONSchemaType, type ValidateFunction } from 'ajv';
import type { UnifiedAgentResult } from './agent-runtime';

const schema: JSONSchemaType<UnifiedAgentResult> = {
  type: 'object',
  properties: {
    decision: {
      type: 'object',
      properties: {
        language: { type: 'string', enum: ['nl', 'en'] },
        location: {
          type: 'object',
          properties: {
            municipality: { type: 'string', enum: ['Uithoorn', 'De Kwakel'] },
            postcode: { type: ['string', 'null'] },
            source: { type: 'string', enum: ['default', 'user', 'postcode'] },
          },
          required: ['municipality', 'postcode', 'source'],
          additionalProperties: true,
        },
        intent: {
          type: 'object',
          properties: {
            primary: { type: 'string', enum: ['find_food', 'order_food', 'find_service', 'find_business', 'find_event', 'general_local'] },
            confidence: { type: 'number' },
          },
          required: ['primary', 'confidence'],
          additionalProperties: true,
        },
        entities: { type: 'object', nullable: true, additionalProperties: true },
        specialist: { type: 'string', enum: ['food', 'local_discovery', 'local_service', 'events', 'general'] },
        task: { type: 'object', properties: { type: { type: 'string' } }, required: ['type'], additionalProperties: true },
        plan: {
          type: 'object',
          properties: {
            goal: { type: 'string' },
            steps: { type: 'array', items: { type: 'string' } },
            nextAction: { type: 'string' },
            searchQuery: { type: ['string', 'null'] },
          },
          required: ['goal', 'steps', 'nextAction', 'searchQuery'],
          additionalProperties: true,
        },
      },
      required: ['language', 'location', 'intent', 'entities', 'specialist', 'task', 'plan'],
      additionalProperties: true,
    },
    action: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['tool', 'respond', 'clarify', 'complete'] },
        capability: { type: ['string', 'null'], enum: ['business.search', 'business.discover', null] },
        arguments: { type: 'object', additionalProperties: true },
        rationale: { type: 'string' },
      },
      required: ['kind', 'capability', 'arguments', 'rationale'],
      additionalProperties: true,
    },
    specialist: {
      type: 'object',
      properties: {
        reply: { type: 'string' },
        captured: { type: 'object', additionalProperties: true },
        nextRequiredSlot: { type: ['string', 'null'] },
        missingSlots: { type: 'array', items: { type: 'string' } },
        status: { type: 'string', enum: ['collecting', 'ready'] },
        shouldSearch: { type: 'boolean' },
        plan: {
          type: 'object',
          properties: {
            goal: { type: 'string' },
            steps: { type: 'array', items: { type: 'string' } },
            nextAction: { type: 'string' },
            searchQuery: { type: ['string', 'null'] },
          },
          required: ['goal', 'steps', 'nextAction', 'searchQuery'],
          additionalProperties: true,
        },
      },
      required: ['reply', 'captured', 'nextRequiredSlot', 'missingSlots', 'status', 'shouldSearch', 'plan'],
      additionalProperties: true,
    },
  },
  required: ['decision', 'action', 'specialist'],
  additionalProperties: true,
};

const ajv = new Ajv({ allErrors: true, strict: false });
const validator: ValidateFunction<UnifiedAgentResult> = ajv.compile(schema);

export function validateAgentDecision(value: unknown): value is UnifiedAgentResult {
  try {
    return validator(value) as boolean;
  } catch (error) {
    console.error('AGENT_AJV_VALIDATION_ERROR', error instanceof Error ? error.message : 'unknown_error');
    return false;
  }
}

export function getAgentDecisionSchema(): JSONSchemaType<UnifiedAgentResult> {
  return schema;
}
