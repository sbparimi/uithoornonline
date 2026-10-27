#!/usr/bin/env node
// Seeds ONLY the two real businesses that were already listed on uithoorn.online
// (the fallback list in the old app/businesses/page.tsx). Same ids, so existing links keep working.
// Nothing else is invented. Safe to re-run.
import pg from 'pg';

const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1); }
const ssl = /neon\.tech/.test(url) && !/sslmode=/.test(url) ? true : undefined;
const client = new pg.Client({ connectionString: url, ssl });

const businesses = [
  {
    id: '15953249-c000-4521-839d-41bf341b6aa8',
    name: 'SpiceIndia',
    category: 'Indian food & catering',
    description: 'South Indian home kitchen in Uithoorn offering freshly prepared takeaway and catering. Specialities include Andhra-style biryani, dosa, idli and vada. Pickup only; no delivery. Catering available in Uithoorn and Amstelveen.',
    postcode: '1421',
    website: 'https://www.spiceindia.nl/',
    phone: '+31 6 45480446',
  },
  {
    id: '68efa8f0-6e5f-4ea9-ba5b-94fbff1fba35',
    name: 'Ruslen',
    category: 'Garden renovation, paving, tiling & fencing',
    description: 'Local contractor for garden renovation and outdoor works, including paving, tiles and fencing. Contact Ruslen for project details, scope and quotation.',
    postcode: '1421',
    website: null,
    phone: '+31616270233',
  },
];

await client.connect();
try {
  for (const b of businesses) {
    await client.query(
      `insert into businesses (id, owner_id, name, category, description, postcode, website, phone, moderation_status, verified, active)
       values ($1, null, $2, $3, $4, $5, $6, $7, 'approved', true, true)
       on conflict (id) do nothing`,
      [b.id, b.name, b.category, b.description, b.postcode, b.website, b.phone],
    );
  }
  const { rows } = await client.query('select count(*)::int as n from businesses');
  console.log(`Seed done. businesses in database: ${rows[0].n}`);
} finally {
  await client.end();
}
