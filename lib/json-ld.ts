/**
 * Serialises structured data for a <script type="application/ld+json"> tag. JSON.stringify alone
 * leaves "</script>" intact, so user-controlled text (a business name) could close the tag and inject
 * HTML. Escaping <, >, & and the JS line separators makes the output inert inside a script element.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
