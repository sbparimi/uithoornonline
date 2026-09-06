const KIMI_BASE_URL = process.env.KIMI_BASE_URL || 'https://api.moonshot.ai/v1';
const KIMI_MODEL = process.env.KIMI_MODEL || 'kimi-k2.5';

export async function kimiChat(messages: Array<{ role: string; content: string }>) {
  const apiKey = process.env.KIMI_API_KEY;
  if (!apiKey) throw new Error('KIMI_NOT_CONFIGURED');

  const response = await fetch(`${KIMI_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: KIMI_MODEL, messages, temperature: 0.2 }),
  });

  if (!response.ok) throw new Error(`KIMI_REQUEST_FAILED:${response.status}`);
  return response.json();
}
