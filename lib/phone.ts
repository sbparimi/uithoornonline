// Phone numbers as businesses and residents type them, cleaned to one stored form.
// "06 1234 5678", "0031 6 12345678", "+31 (0)6-12345678" and a doubled country code
// ("+31 31 6 12345678", which autofill plus a typed +31 produces) all become "+31612345678".
// Anything that is not recognisably a phone number is kept as typed (trimmed), never rejected.
export function normalizePhone(raw: string | null | undefined): string {
  const typed = String(raw ?? '').trim();
  if (!typed) return '';
  const hasPlus = typed.startsWith('+');
  // Drop a "(0)" trunk prefix written after the country code, then everything but digits.
  let d = typed.replace(/\(0\)/g, '').replace(/\D/g, '');
  if (!d) return typed;
  if (!hasPlus) {
    if (d.startsWith('00')) d = d.slice(2);
    else if (d.startsWith('0')) d = `31${d.slice(1)}`;
    else if (d.startsWith('31') && (d.length === 11 || d.length === 13)) { /* 31… without the plus */ }
    else if (d.length === 9 && d.startsWith('6')) d = `31${d}`; // "6 12345678"
    else return typed;
  }
  if (d.startsWith('3131') && d.length === 13) d = d.slice(2); // +31 31 6…: doubled country code
  if (d.startsWith('310') && d.length === 12) d = `31${d.slice(3)}`; // +31 06…: trunk zero kept
  if (d.length < 8 || d.length > 15) return typed;
  return `+${d}`;
}

/** "www.example.nl" -> "https://www.example.nl"; empty stays empty. */
export function normalizeWebsite(raw: string | null | undefined): string {
  const typed = String(raw ?? '').trim();
  if (!typed) return '';
  if (/^https?:\/\//i.test(typed)) return typed;
  if (/^[^\s/@]+\.[a-z]{2,}([/?#].*)?$/i.test(typed)) return `https://${typed}`;
  return typed;
}
