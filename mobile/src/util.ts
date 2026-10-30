export function formatDate(iso: string, lang: 'nl' | 'en') {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(lang === 'nl' ? 'nl-NL' : 'en-GB', { day: 'numeric', month: 'short', year: d.getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
  } catch { return iso; }
}
export function formatTime(iso: string, lang: 'nl' | 'en') {
  try { return new Date(iso).toLocaleTimeString(lang === 'nl' ? 'nl-NL' : 'en-GB', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; }
}
export function validPostcode(v: string) { return /^\d{4}\s?[A-Z]{2}$/i.test(v.trim()); }
export function formatPostcode(v: string) { return v.trim().toUpperCase().replace(/^(\d{4})\s*([A-Z]{2})$/, '$1 $2'); }
export function displayPhone(p: string) {
  const d = p.replace(/[^\d+]/g, '');
  if (d.startsWith('+316') && d.length === 12) return `06 ${d.slice(4, 6)} ${d.slice(6, 8)} ${d.slice(8, 10)} ${d.slice(10)}`;
  if (d.startsWith('+31') && d.length === 12) return `0${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8)}`;
  return p;
}
export function displayUrl(u: string) { return u.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, ''); }
