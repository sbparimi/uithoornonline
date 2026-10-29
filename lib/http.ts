import 'server-only';
import { NextResponse } from 'next/server';
import { DbUnavailableError } from './db';
import { AuthError } from './auth/session';

export function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

export function errorJson(error: string, status: number, extra?: Record<string, unknown>, headers?: Record<string, string>) {
  return json({ error, ...extra }, status, headers);
}

/** Thrown for a client error that `handle()` turns into a JSON error response. */
export class HttpError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}

/** Largest request body any form or JSON call needs (the longest field is a 5,000-character message). */
export const MAX_BODY_BYTES = 64 * 1024;

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  const type = request.headers.get('content-type') || '';
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_BODY_BYTES) throw new HttpError('payload_too_large', 413);
  if (!type.includes('application/json') && !type.includes('form')) return {};
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) throw new HttpError('payload_too_large', 413);
  if (type.includes('application/json')) {
    let body: unknown = null;
    try { body = JSON.parse(raw); } catch { body = null; }
    return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {};
  }
  if (type.includes('multipart/form-data')) {
    // Rebuild the request so the platform parser handles boundaries; size is already capped above.
    const form = await new Request(request.url, { method: 'POST', headers: { 'content-type': type }, body: raw }).formData();
    return Object.fromEntries([...form.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : '']));
  }
  return Object.fromEntries(new URLSearchParams(raw).entries());
}

export function str(value: unknown, max = 2000) {
  return String(value ?? '').trim().slice(0, max);
}

/** Rejects cross-site state-changing requests (defence in depth on top of SameSite=Lax cookies). */
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return true; // same-origin fetches from older browsers / server-to-server
  try {
    const host = request.headers.get('x-forwarded-host') || request.headers.get('host');
    return new URL(origin).host === host;
  } catch { return false; }
}

/** Uniform error handling for route handlers. */
export async function handle(fn: () => Promise<Response>, label: string): Promise<Response> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AuthError) return errorJson(error.code, error.status);
    if (error instanceof HttpError) return errorJson(error.code, error.status);
    if (error instanceof DbUnavailableError) {
      console.error(`[${label}] database unavailable`, error.message);
      return errorJson('service_unavailable', 503, undefined, { 'Retry-After': '60' });
    }
    console.error(`[${label}] failed`, error instanceof Error ? error.message : error);
    return errorJson('internal_error', 500);
  }
}
