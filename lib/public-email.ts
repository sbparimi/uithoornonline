// Optional public contact email on a business listing (businesses.public_email, migration 0004).
// Separate from the owner's login email, which is never shown. Trimmed and lower-cased; empty means none.
export const PUBLIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "  Info@Example.NL " -> "info@example.nl"; empty stays empty. A "mailto:" prefix is dropped. */
export function normalizePublicEmail(raw: unknown): string {
  return String(raw ?? '').trim().replace(/^mailto:/i, '').toLowerCase();
}

export function isValidPublicEmail(value: string): boolean {
  return value.length <= 254 && PUBLIC_EMAIL_PATTERN.test(value);
}
