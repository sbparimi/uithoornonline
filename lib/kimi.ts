import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const GROQ_BASE_URL = process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1';
const GROQ_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';
const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';
const BEDROCK_REGION = process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION || 'eu-west-1';
const BEDROCK_MODEL = process.env.BEDROCK_MODEL_ID || 'global.anthropic.claude-haiku-4-5-20251001-v1:0';

type ChatMessage = { role: string; content: string };
export type KimiChatOptions = {
  maxCompletionTokens?: number;
  temperature?: number;
  reasoningEffort?: 'low' | 'medium' | 'high';
};

type KimiChatResponse = {
  choices: Array<{ message: { role: string; content: string } }>;
  provider?: string;
  model?: string;
};

type Provider = 'groq' | 'openai' | 'bedrock';

function providerOrder(): Provider[] {
  const configured = (process.env.LLM_PROVIDER_ORDER || 'groq,bedrock,openai')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is Provider => value === 'groq' || value === 'openai' || value === 'bedrock');
  return configured.length ? [...new Set(configured)] : ['groq', 'bedrock', 'openai'];
}

function hasCredentials(provider: Provider): boolean {
  if (provider === 'groq') return Boolean(process.env.GROQ_API_KEY);
  if (provider === 'openai') return Boolean(process.env.OPENAI_API_KEY);
  return Boolean(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE || process.env.AWS_ROLE_ARN || process.env.AWS_WEB_IDENTITY_TOKEN_FILE);
}

function parseRetryAfter(response: Response): number {
  const raw = response.headers.get('retry-after');
  if (!raw) return 0;
  const seconds = Number(raw);
  return Number.isFinite(seconds) ? Math.max(0, Math.min(seconds * 1000, 3000)) : 0;
}

async function callOpenAICompatible(provider: 'groq' | 'openai', messages: ChatMessage[], options: Required<KimiChatOptions>): Promise<KimiChatResponse> {
  const isGroq = provider === 'groq';
  const baseUrl = isGroq ? GROQ_BASE_URL : OPENAI_BASE_URL;
  const model = isGroq ? GROQ_MODEL : OPENAI_MODEL;
  const apiKey = isGroq ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error(`${provider.toUpperCase()}_NOT_CONFIGURED`);

  const requestBody = JSON.stringify({
    model,
    messages,
    temperature: options.temperature,
    max_completion_tokens: options.maxCompletionTokens,
    ...(isGroq ? { reasoning_effort: options.reasoningEffort, include_reasoning: false } : {}),
  });

  let response = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: requestBody,
  });

  if (response.status === 429) {
    const waitMs = parseRetryAfter(response);
    if (waitMs > 0) {
      console.warn('LLM_RATE_LIMIT_RETRY', { provider, model, waitMs });
      await new Promise((resolve) => setTimeout(resolve, waitMs));
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: requestBody,
      });
    }
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '');
    console.error('LLM_PROVIDER_ERROR', {
      provider,
      model,
      status: response.status,
      retryAfter: response.headers.get('retry-after'),
      remainingTokens: response.headers.get('x-ratelimit-remaining-tokens'),
      resetTokens: response.headers.get('x-ratelimit-reset-tokens'),
      remainingRequests: response.headers.get('x-ratelimit-remaining-requests'),
      resetRequests: response.headers.get('x-ratelimit-reset-requests'),
      body: body.slice(0, 500),
    });
    throw new Error(`${provider.toUpperCase()}_REQUEST_FAILED:${response.status}`);
  }

  const payload = await response.json() as KimiChatResponse;
  return { ...payload, provider, model };
}

async function callBedrock(messages: ChatMessage[], options: Required<KimiChatOptions>): Promise<KimiChatResponse> {
  const client = new BedrockRuntimeClient({ region: BEDROCK_REGION });
  const system = messages.filter((message) => message.role === 'system').map((message) => ({ text: message.content }));
  const conversation = messages
    .filter((message) => message.role !== 'system')
    .map((message) => ({ role: message.role === 'assistant' ? 'assistant' as const : 'user' as const, content: [{ text: message.content }] }));
  const command = new ConverseCommand({
    modelId: BEDROCK_MODEL,
    ...(system.length ? { system } : {}),
    messages: conversation,
    inferenceConfig: { maxTokens: options.maxCompletionTokens, temperature: options.temperature },
  });
  const response = await client.send(command);
  const content = response.output?.message?.content?.map((item) => item.text || '').join('').trim() || '';
  if (!content) throw new Error('BEDROCK_EMPTY_RESPONSE');
  return { choices: [{ message: { role: 'assistant', content } }], provider: 'bedrock', model: BEDROCK_MODEL };
}

export async function kimiChat(messages: ChatMessage[], inputOptions: KimiChatOptions = {}): Promise<KimiChatResponse> {
  const options: Required<KimiChatOptions> = {
    maxCompletionTokens: inputOptions.maxCompletionTokens ?? 900,
    temperature: inputOptions.temperature ?? 0.1,
    reasoningEffort: inputOptions.reasoningEffort ?? 'low',
  };

  const providers = providerOrder().filter(hasCredentials);
  if (!providers.length) throw new Error('LLM_NOT_CONFIGURED');

  let lastError: unknown = null;
  for (const provider of providers) {
    try {
      const result = provider === 'bedrock'
        ? await callBedrock(messages, options)
        : await callOpenAICompatible(provider, messages, options);
      console.info('LLM_PROVIDER_SELECTED', { provider: result.provider, model: result.model });
      return result;
    } catch (error) {
      lastError = error;
      console.error('LLM_PROVIDER_FALLBACK', { provider, error: error instanceof Error ? error.message : 'unknown_error' });
    }
  }

  throw lastError instanceof Error ? lastError : new Error('LLM_ALL_PROVIDERS_FAILED');
}
