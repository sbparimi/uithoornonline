import 'server-only';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';

// Single Postgres pool for the whole server (Neon in production, local Postgres in development).
// Use Neon's POOLED connection string (host contains "-pooler") as DATABASE_URL on Vercel.

export class DbUnavailableError extends Error {
  constructor(message = 'database_unavailable') { super(message); this.name = 'DbUnavailableError'; }
}

declare global { var __uoPool: Pool | undefined; }

export function isDbConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

function getPool() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new DbUnavailableError('DATABASE_URL is not configured');
  if (!globalThis.__uoPool) {
    // sslmode=require in the Neon URL turns on TLS with certificate verification.
    const needsSsl = /neon\.tech/.test(url) && !/sslmode=/.test(url);
    globalThis.__uoPool = new Pool({
      connectionString: url,
      ssl: needsSsl ? true : undefined,
      max: Number(process.env.DATABASE_POOL_MAX || 5),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 8_000,
    });
    globalThis.__uoPool.on('error', (error) => console.error('[db] idle client error', error.message));
  }
  return globalThis.__uoPool;
}

function wrap(error: unknown): never {
  const code = (error as { code?: string })?.code;
  if (error instanceof DbUnavailableError) throw error;
  if (code === 'ECONNREFUSED' || code === 'ENOTFOUND' || code === 'ETIMEDOUT' || code === '57P01' || code === '53300' || /timeout|terminated|ECONNRESET/i.test(String((error as Error)?.message))) {
    throw new DbUnavailableError(String((error as Error)?.message || code));
  }
  throw error;
}

export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  try {
    const result = await getPool().query<T>(text, params);
    return result.rows;
  } catch (error) { wrap(error); }
}

export async function queryOne<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  let client: PoolClient;
  try { client = await getPool().connect(); } catch (error) { wrap(error); }
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => undefined);
    wrap(error);
  } finally {
    client.release();
  }
}
