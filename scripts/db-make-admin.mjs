#!/usr/bin/env node
// Promotes an existing account to admin. Run by the site owner (or Tab) with database access:
//   DATABASE_URL=... npm run db:make-admin -- someone@example.com
// There is deliberately no web path that lets a user change their own role.
import pg from 'pg';

const email = (process.argv[2] || '').trim().toLowerCase();
const role = (process.argv[3] || 'admin').trim();
if (!email || !['admin', 'customer', 'provider'].includes(role)) { console.error('usage: db:make-admin -- <email> [admin|customer|provider]'); process.exit(1); }
const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1); }
const ssl = /neon\.tech/.test(url) && !/sslmode=/.test(url) ? true : undefined;
const client = new pg.Client({ connectionString: url, ssl });
await client.connect();
try {
  const { rowCount } = await client.query('update users set role = $2 where email = $1', [email, role]);
  if (!rowCount) { console.error(`No account with email ${email}. Sign up first.`); process.exitCode = 1; }
  else {
    await client.query(`insert into audit_log(actor_id, action, target_type, target_id, details) values (null, 'role_set_cli', 'user', $1, $2)`, [email, JSON.stringify({ role })]);
    console.log(`${email} is now ${role}.`);
  }
} finally {
  await client.end();
}
