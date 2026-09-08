import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'gpt-oss';
const LITELLM_BASE_URL = process.env.LITELLM_BASE_URL || '';
const LITELLM_MODEL = process.env.LITELLM_MODEL || 'uithoorn-agent';
const LITELLM_API_KEY = process.env.LITELLM_API_KEY || '';
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
  responseSchema?: Record<string, unknown>;
};

type KimiChatResponse = {
  choices: Array<{ message: { role: string; content: string } }>;
  provider?: string;
  model?: string;
};

type Provider = 'ollama' | 'litellm' | 'groq' | 'openai' | 'bedrock';

function providerOrder(): Provider[] {
  const configured = (process.env.LLM_PROVIDER_ORDER || 'ollama,litellm,groq,bedrock,openai')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter((value): value is Provider => value === 'ollama' || value === 'litellm' || value === 'groq' || value === 'openai' || value === 'bedrock');
  return configured.length ? [...new Set(configured)] : ['ollama', 'litellm', 'groq', 'bedrock', 'openai'];
}

function hasCredentials(provider: Provider): boolean {
  if (provider === 'ollama') return Boolean(process.env.OLLAMA_BASE_URL);
  if (provider === 'litellm') return Boolean(LITELLM_BASE_URL);
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

function providerHeaders(provider: Provider): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (provider === 'litellm' && LITELLM_API_KEY) headers.Authorization = `Bearer ${LITELLM_API_KEY}`;
  if (provider === 'groq' && process.env.GROQ_API_KEY) headers.Authorization = `Bearer ${process.env.GROQ_API_KEY}`;
  if (provider === 'openai' && process.env.OPENAI_API_KEY) headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
  return headers;
}

async function callOpenAICompatible(provider: 'litellm' | 'groq' | 'openai', messages: ChatMessage[], options: Required<KimiChatOptions>): Promise<KimiChatResponse> {
  const baseUrl = provider === 'litellm' ? LITELLM_BASE_URL : provider === 'groq' ? GROQ_BASE_URL : OPENAI_BASE_URL;
  const model = provider === 'litellm' ? LITELLM_MODEL : provider === 'groq' ? GROQ_MODEL : OPENAI_MODEL;
  if (!baseUrl) throw new Error(`${provider.toUpperCase()}_NOT_CONFIGURED`);
  if ((provider === 'groq' || provider === 'openai') && !providerHeaders(provider).Authorization) throw new Error(`${provider.toUpperCase()}_NOT_CONFIGURED`);

  const requestBody: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature,
    max_completion_tokens: options.maxCompletionTokens,
  };
  if (provider === 'groq') {
    requestBody.reasoning_effort = options.reasoningEffort;
    requestBody.include_reasoning = false;
    requestBody.response_format = { type: 'json_object' };
  } else if (options.responseSchema) {
    requestBody.response_format = {
      type: 'json_schema',
      json_schema: { name: 'uithoorn_agent_decision', strict: true, schema: options.responseSchema },
    };
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: providerHeaders(provider),
    body: JSON.stringify(requestBody),
  });

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
      body: body.slice(0, 500),
    });
    const error = new Error(`${provider.toUpperCase()}_REQUEST_FAILED:${response.status}`);
    (error as Error & { status?: number; retryAfterMs?: number }).status = response.status;
    (error as Error & { status?: number; retryAfterMs?: number }).retryAfterMs = parseRetryAfter(new Response(null, { status: response.status, headers: response.headers }));
    throw error;
  }

  const payload = await response.json() as KimiChatResponse;
  return { ...payload, provider, model };
}

async function callOllama(messages: ChatMessage[], options: Required<KimiChatOptions>): Promise<KimiChatResponse> {
  const response = await fetch(`${OLLAMA_BASE_URL.replace(/\/$/, '')}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      think: options.reasoningEffort === 'low' ? false : options.reasoningEffort,
      format: options.responseSchema || 'json',
      options: { temperature: options.temperature, num_predict: options.maxCompletionTokens },
    }),
  });
  if (!response.ok) {
    const error = new Error(`OLLAMA_REQUEST_FAILED:${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  const payload = await response.json() as { message?: { role?: string; content?: string }; model?: string };
  const content = payload.message?.content?.trim() || '';
  if (!content) throw new Error('OLLAMA_EMPTY_RESPONSE');
  return { choices: [{ message: { role: payload.message?.role || 'assistant', content } }], provider: 'ollama', model: payload.model || OLLAMA_MODEL };
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
    maxCompletionTokens: inputOptions.maxCompletionTokens ?? 1000,
    temperature: inputOptions.temperature ?? 0.1,
    reasoningEffort: inputOptions.reasoningEffort ?? 'low',
    responseSchema: inputOptions.responseSchema ?? {},
  };

  const providers = providerOrder().filter(hasCredentials);
  if (!providers.length) throw new Error('LLM_NOT_CONFIGURED');

  let lastError: unknown = null;
  for (let index = 0; index < providers.length; index += 1) {
    const provider = providers[index];
    try {
      const result = provider === 'ollama'
        ? await callOllama(messages, options)
        : provider === 'bedrock'
          ? await callBedrock(messages, options)
          : await callOpenAICompatible(provider, messages, options);
      console.info('LLM_PROVIDER_SELECTED', { provider: result.provider, model: result.model });
      return result;
    } catch (error) {
      lastError = error;
      const status = error instanceof Error ? (error as Error & { status?: number }).status : undefined;
      const retryAfterMs = error instanceof Error ? (error as Error & { retryAfterMs?: number }).retryAfterMs || 0 : 0;
      console.error('LLM_PROVIDER_FALLBACK', { provider, error: error instanceof Error ? error.message : 'unknown_error', status });
      if (status === 429 && index < providers.length - 1) continue;
      if (status === 429 && retryAfterMs > 0) await new Promise((resolve) => setTimeout(resolve, retryAfterMs));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('LLM_ALL_PROVIDERS_FAILED');
}
