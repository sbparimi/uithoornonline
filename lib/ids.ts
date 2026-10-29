/** Strict UUID check (a loose [0-9a-f-]{36} lets '----…' through and Postgres then throws a 500). */
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function isUuid(value: unknown): value is string { return typeof value === 'string' && UUID_RE.test(value); }
