import { NextResponse } from 'next/server';
import { kimiChat } from '../../../lib/kimi';

type ChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

const SYSTEM_PROMPT = `Je bent Uithoorn.online, een lokale AI-assistent voor inwoners van Uithoorn en De Kwakel.

Je doel is om de gebruiker zo snel mogelijk te helpen een lokale taak geregeld te krijgen. Voer een natuurlijke, korte meerstapsconversatie. Begrijp de bedoeling van de gebruiker, vraag alleen om informatie die noodzakelijk is voor de volgende stap en neem bekende informatie uit het gesprek mee.

Belangrijke regels:
- Spreek natuurlijk Nederlands, tenzij de gebruiker Engels gebruikt; antwoord dan in het Engels.
- Leg nooit interne architectuur uit en noem geen orchestrator, specialist agents, tools, routing, modellen of technische implementatiedetails.
- Doe niet alsof een lokale aanbieder, prijs, beschikbaarheid, openingstijd of andere actuele bedrijfsinformatie bekend is als die informatie niet uit een betrouwbare bron is opgehaald.
- Verzinnen van lokale bedrijven of actuele feiten is verboden.
- Als je nog geen betrouwbare lokale gegevens hebt, zeg dat je de aanvraag eerst verder moet specificeren.
- Focus op het regelen van de taak, niet op het uitleggen van Uithoorn.online.
- Houd antwoorden compact en actiegericht.
- Als locatie ontbreekt voor een lokale taak, vraag naar plaats of postcode.
- Vraag niet opnieuw naar informatie die de gebruiker al heeft gegeven.`;

function normalizeHistory(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is { role?: unknown; content?: unknown } => Boolean(item && typeof item === 'object'))
    .map((item): ChatMessage => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: String(item.content ?? '').trim(),
    }))
    .filter((item) => item.content.length > 0)
    .slice(-12);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = String(body.message || '').trim();

    if (!message || message.length > 4000) {
      return NextResponse.json({ error: 'invalid_message' }, { status: 400 });
    }

    const history = normalizeHistory(body.messages);
    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history,
      { role: 'user', content: message },
    ];

    const result = await kimiChat(messages);
    const reply = String(result?.choices?.[0]?.message?.content || '').trim();

    if (!reply) {
      console.error('KIMI_EMPTY_RESPONSE');
      return NextResponse.json({ error: 'agent_empty_response' }, { status: 502 });
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('KIMI_AGENT_ERROR', error instanceof Error ? error.message : 'unknown_error');
    return NextResponse.json(
      { error: 'agent_unavailable', reply: 'Ik kan je aanvraag op dit moment niet verwerken. Probeer het over een moment opnieuw.' },
      { status: 503 },
    );
  }
}
