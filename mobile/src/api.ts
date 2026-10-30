import { API_URL } from './config';

export class ApiError extends Error {
  constructor(public code: string, public status: number, public data?: any) { super(code); }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
export function setAuthToken(token: string | null) { authToken = token; }
export function setUnauthorizedHandler(fn: (() => void) | null) { onUnauthorized = fn; }

export async function api<T = any>(path: string, options: { method?: string; body?: unknown; auth?: boolean } = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json', 'X-UO-Client': 'mobile' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (authToken && options.auth !== false) headers.Authorization = `Bearer ${authToken}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { method: options.method || 'GET', headers, body: options.body !== undefined ? JSON.stringify(options.body) : undefined, credentials: 'omit' });
  } catch {
    throw new ApiError('network', 0);
  }
  let data: any = null;
  try { data = await res.json(); } catch { data = null; }
  if (!res.ok) {
    if (res.status === 401 && authToken && onUnauthorized) onUnauthorized();
    throw new ApiError((data && data.error) || `http_${res.status}`, res.status, data);
  }
  return data as T;
}

export type Business = { id: string; name: string; category: string; description: string; postcode: string | null; website: string | null; phone: string | null; verified: boolean; featured: boolean };
export type Review = { id: string; rating: number; body: string; created_at: string; author: string };
export type Option = { value: string; nl: string; en: string; other?: boolean };
export type Meta = { businessCategories: Option[]; requestCategories: Option[]; timing: Option[]; urgency: Option[]; contactEmail: string; links: Record<string, { nl: string; en: string }> };
export type User = { id: string; name: string; email: string; phone: string | null; role: 'customer' | 'provider' | 'admin'; emailVerified: boolean };
export type OwnBusiness = Business & { address: string | null; moderation_status: 'pending' | 'approved' | 'rejected'; active: boolean };
export type MyRequest = { id: string; category: string; description: string; postcode: string; status: string; created_at: string; matched: number; conversations: number };
export type ConversationRow = { id: string; status: string; updated_at: string; business_name: string; category: string; side: 'customer' | 'business' };
export type Me = { user: User; business: OwnBusiness | null; requests: MyRequest[]; conversations: ConversationRow[] };
export type Lead = { id: string; status: string; created_at: string; request_id: string; category: string; description: string | null; postcode: string | null; preferred_timing: string | null; urgency: string | null; budget_min: string | null; budget_max: string | null; conversation_id: string | null };
export type Message = { id: string; sender_id: string | null; body: string; created_at: string; mine: boolean };
export type Conversation = { id: string; status: string; side: string; business_name: string; business_category: string; category: string; description: string; postcode: string; preferred_timing: string; customer_name: string; messages: Message[] };
