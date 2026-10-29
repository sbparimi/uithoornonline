import 'server-only';
import type { PoolClient } from 'pg';
import { query } from '../db';
import type { SessionUser } from '../auth/session';

// Shared helpers for the admin console (lib/admin/*). Every exported function in lib/admin
// must be called with a user returned by requireRole('admin'); assertAdmin re-checks it.

export function assertAdmin(user: SessionUser | null | undefined): asserts user is SessionUser {
  if (!user || user.role !== 'admin') throw new Error('admin_required');
}

export const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);

/** True when the error means a table/column from a not-yet-applied migration is missing. */
export function isMissingSchema(error: unknown) {
  const code = (error as { code?: string })?.code;
  return code === '42P01' || code === '42703';
}

/** Runs a query that depends on migration 0002; returns `fallback` when that migration has not run yet. */
export async function optional<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try { return await fn(); } catch (error) { if (isMissingSchema(error)) return fallback; throw error; }
}

export class MigrationPendingError extends Error {
  constructor() { super('migration_pending'); this.name = 'MigrationPendingError'; }
}
/** Like optional(), but for writes: turns a missing-schema error into MigrationPendingError. */
export async function needsSchema<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch (error) { if (isMissingSchema(error)) throw new MigrationPendingError(); throw error; }
}

function trimSnapshot(value: unknown): unknown {
  if (!value || typeof value !== 'object') return value ?? null;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (k === 'password_hash') { out[k] = v ? '(set)' : null; continue; }
    out[k] = typeof v === 'string' && v.length > 500 ? `${v.slice(0, 500)}…` : v;
  }
  return out;
}

/** Audit log: who (actor), what (action + target), when (created_at), before/after snapshots. */
export async function audit(actor: SessionUser, action: string, targetType: string, targetId: string | null, before: unknown = null, after: unknown = null, extra: Record<string, unknown> = {}, client?: PoolClient) {
  const details = JSON.stringify({ actor_email: actor.email, before: trimSnapshot(before), after: trimSnapshot(after), ...extra });
  const sql = 'insert into audit_log(actor_id, action, target_type, target_id, details) values ($1,$2,$3,$4,$5)';
  const params = [actor.id, action, targetType, targetId, details];
  if (client) await client.query(sql, params); else await query(sql, params);
}

export type Page = { page: number; size: number; offset: number };
export function paging(raw: unknown, size = 25): Page {
  const page = Math.max(1, Math.min(10_000, Number.parseInt(String(raw ?? '1'), 10) || 1));
  return { page, size, offset: (page - 1) * size };
}

export type Paged<T> = { rows: T[]; total: number; page: number; size: number; pages: number };
export function paged<T>(rows: (T & { _total?: number | string })[], p: Page): Paged<T> {
  const total = rows.length ? Number(rows[0]._total ?? rows.length) : 0;
  return { rows: rows.map(({ _total, ...r }) => r as T), total, page: p.page, size: p.size, pages: Math.max(1, Math.ceil(total / p.size)) };
}

/** Escapes a search term for ILIKE. */
export function like(q: string) { return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`; }

export function csv(rows: Record<string, unknown>[], columns?: string[]) {
  const cols = columns ?? (rows[0] ? Object.keys(rows[0]) : []);
  const cell = (v: unknown) => {
    if (v === null || v === undefined) return '';
    let s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // no spreadsheet formula injection
    return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return '\ufeff' + [cols.join(','), ...rows.map((r) => cols.map((c) => cell(r[c])).join(','))].join('\r\n');
}

export const money = (cents: number | null | undefined) => `€${((cents ?? 0) / 100).toFixed(2).replace('.', ',')}`;
