#!/usr/bin/env node
// Applies db/migrations/*.sql in order, once each, inside a transaction per file.
// Usage: DATABASE_URL=postgres://... npm run db:migrate
import { readdir, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1); }
const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'db', 'migrations');
const ssl = /neon\.tech/.test(url) && !/sslmode=/.test(url) ? true : undefined;
const client = new pg.Client({ connectionString: url, ssl });

await client.connect();
try {
  await client.query(`create table if not exists schema_migrations (name text primary key, checksum text not null, applied_at timestamptz not null default now())`);
  const files = (await readdir(dir)).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  const { rows } = await client.query('select name, checksum from schema_migrations');
  const applied = new Map(rows.map((r) => [r.name, r.checksum]));
  let count = 0;
  for (const file of files) {
    const sql = await readFile(path.join(dir, file), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    if (applied.has(file)) {
      if (applied.get(file) !== checksum) console.warn(`! ${file} changed after it was applied (checksum differs). Write a new migration instead of editing an applied one.`);
      continue;
    }
    process.stdout.write(`applying ${file} ... `);
    await client.query('begin');
    try {
      await client.query(sql);
      await client.query('insert into schema_migrations(name, checksum) values ($1, $2)', [file, checksum]);
      await client.query('commit');
      console.log('ok');
      count += 1;
    } catch (error) {
      await client.query('rollback');
      console.log('FAILED');
      throw error;
    }
  }
  console.log(count ? `${count} migration(s) applied.` : 'Database is up to date.');
} finally {
  await client.end();
}
