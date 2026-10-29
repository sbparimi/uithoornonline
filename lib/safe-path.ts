/**
 * True for a same-site path such as "/account?tab=1". Rejects protocol-relative ("//evil.com"),
 * backslash variants that browsers treat as "//" ("/\\evil.com"), absolute URLs and control characters.
 */
export function isSafeLocalPath(value: unknown): value is string {
  if (typeof value !== 'string' || !value.startsWith('/') || value.length > 500) return false;
  if (value.startsWith('//') || value.includes('\\') || value.includes('://')) return false;
  return !/[\u0000-\u001f\u007f\s]/.test(value);
}
