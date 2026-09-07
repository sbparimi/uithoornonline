import type { AgentAction, AgentSlot, AgentState, SemanticIntent } from './state';

const SERVICE_ACTIONS: AgentAction[] = [
  { label: 'Loodgieter', value: 'Loodgieter', kind: 'quick_reply' },
  { label: 'Elektricien', value: 'Elektricien', kind: 'quick_reply' },
  { label: 'Schoonmaak', value: 'Schoonmaak', kind: 'quick_reply' },
  { label: 'Tuinonderhoud', value: 'Tuinonderhoud', kind: 'quick_reply' },
  { label: 'Anders', value: 'Ik heb een andere dienst nodig', kind: 'quick_reply' },
];

const FOOD_ACTIONS: AgentAction[] = [
  { label: 'Eten & restaurants', value: 'Eten & restaurants', kind: 'quick_reply' },
  { label: 'Catering', value: 'Catering', kind: 'quick_reply' },
  { label: 'Indiaas eten', value: 'Indiaas eten', kind: 'quick_reply' },
  { label: 'Afhalen', value: 'Afhalen', kind: 'quick_reply' },
];

const CATEGORY_ACTIONS: AgentAction[] = [
  { label: 'Restaurant', value: 'Restaurant', kind: 'quick_reply' },
  { label: 'Winkel', value: 'Winkel', kind: 'quick_reply' },
  { label: 'Dienstverlener', value: 'Dienstverlener', kind: 'quick_reply' },
  { label: 'Anders', value: 'Ik zoek iets anders', kind: 'quick_reply' },
];

const FULFILMENT_ACTIONS: AgentAction[] = [
  { label: 'Afhalen', value: 'Afhalen', kind: 'quick_reply' },
  { label: 'Bezorgen', value: 'Bezorgen', kind: 'quick_reply' },
  { label: 'Ter plaatse', value: 'Ter plaatse', kind: 'quick_reply' },
];

const EVENT_ACTIONS: AgentAction[] = [
  { label: 'Vandaag', value: 'Vandaag', kind: 'quick_reply' },
  { label: 'Dit weekend', value: 'Dit weekend', kind: 'quick_reply' },
  { label: 'Deze week', value: 'Deze week', kind: 'quick_reply' },
];

function hasExplicitEmergencySignal(message: string): string | null {
  const text = message.toLowerCase().replace(/\s+/g, ' ').trim();
  const signals: Array<[RegExp, string]> = [
    [/\b112\b/, '112 was explicitly requested'],
    [/in\s+brand|woningbrand|huisbrand/, 'fire emergency'],
    [/gaslek|gaslucht/, 'gas emergency'],
    [/explos(?:ie|ion)/, 'explosion emergency'],
    [/bewusteloos|reanimat/, 'medical emergency'],
    [/levensgevaar|levensbedreig/, 'life-threatening situation'],
    [/ernstig\s+(?:gewond|bloed)|zwaar\s+gewond/, 'serious injury'],
    [/acute?\s+medische\s+nood|ambulance\s+nodig/, 'acute medical emergency'],
    [/overval\s+(?:nu|gaande)|gewapende?\s+(?:overval|persoon)/, 'active violent incident'],
    [/ik\s+word\s+bedreigd/, 'active threat'],
  ];
  return signals.find(([regex]) => regex.test(text))?.[1] || null;
}

export function emergencyFromMessage(message: string): { emergency: boolean; reason: string | null } {
  const reason = hasExplicitEmergencySignal(message);
  return { emergency: Boolean(reason), reason };
}

export function actionsForState(state: AgentState): AgentAction[] {
  if (state.safety.emergency) {
    return [{ label: 'Bel 112', value: 'Bel 112', kind: 'emergency' }];
  }

  const slot = state.planning.nextRequiredSlot;
  if (!slot) return [];

  switch (slot) {
    case 'service': return SERVICE_ACTIONS;
    case 'category':
      return state.intent.primary === 'find_food' || state.intent.primary === 'order_food' ? FOOD_ACTIONS : CATEGORY_ACTIONS;
    case 'fulfilment': return FULFILMENT_ACTIONS;
    case 'date': return EVENT_ACTIONS;
    default: return [];
  }
}

export function deterministicReply(state: AgentState, hasProviders: boolean): string | null {
  if (state.safety.emergency) {
    return 'Dit klinkt als een noodsituatie. Bel direct 112 voor politie, brandweer of ambulance.';
  }

  if (state.task.status !== 'collecting') return null;

  switch (state.planning.nextRequiredSlot as AgentSlot | null) {
    case 'service':
      return state.planning.repeatedIntentCount > 1
        ? 'Je zoekt een dienst. Kies hieronder welke dienst je nodig hebt, dan zoek ik gericht in Uithoorn en De Kwakel.'
        : 'Welke dienst heb je nodig? Kies hieronder een optie of typ de dienst in je eigen woorden.';
    case 'category':
      return state.intent.primary === 'find_food' || state.intent.primary === 'order_food'
        ? 'Wat voor eten of catering zoek je? Kies hieronder een optie of typ wat je zoekt.'
        : 'Wat voor soort bedrijf zoek je? Kies hieronder een optie of typ het in je eigen woorden.';
    case 'fulfilment':
      return 'Wil je dit afhalen, laten bezorgen of ter plaatse regelen?';
    case 'date':
      return 'Voor wanneer zoek je een activiteit of evenement?';
    default:
      return hasProviders ? null : 'Ik heb nog niet genoeg informatie om gericht te zoeken. Vertel kort wat je nodig hebt.';
  }
}

export function intentIsTaskChange(previous: AgentState, currentIntent: SemanticIntent): boolean {
  return previous.intent.primary !== currentIntent;
}
