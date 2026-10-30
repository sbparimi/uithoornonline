import 'server-only';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// Fetches a business's OWN public website for the AI profile builder, safely:
// - http(s) only, standard ports, no credentials in the URL, public IP addresses only (blocks
//   localhost / private / link-local / metadata ranges, checked again on every redirect),
// - respects robots.txt (User-agent * and our own agent), 8 s timeout per request, 1.5 MB cap,
// - at most the home page + 2 same-site pages that look like contact / about / hours / services.
// Returns plain text and the structured facts the page itself carries (JSON-LD, meta, tel:, mailto:).

export const BOT_UA = 'UithoornOnlineProfileBot/1.0 (+https://uithoorn.online/voor-bedrijven)';
const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8000;

export class SiteFetchError extends Error { constructor(public code: string) { super(code); } }

function privateV4(ip: string) {
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224 || (a === 198 && (b === 18 || b === 19));
}
function privateV6(ip: string) {
  const x = ip.toLowerCase();
  if (x === '::1' || x === '::') return true;
  if (x.startsWith('::ffff:')) return privateV4(x.slice(7));
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(x);
}

async function assertPublic(url: URL) {
  if (!/^https?:$/.test(url.protocol)) throw new SiteFetchError('bad_scheme');
  if (url.username || url.password) throw new SiteFetchError('bad_url');
  if (url.port && !['80', '443'].includes(url.port)) throw new SiteFetchError('bad_port');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (!host.includes('.') || /\.(local|internal|localhost)$/i.test(host)) throw new SiteFetchError('bad_host');
  const addrs = isIP(host) ? [{ address: host, family: isIP(host) }] : await lookup(host, { all: true }).catch(() => { throw new SiteFetchError('dns_failed'); });
  if (!addrs.length) throw new SiteFetchError('dns_failed');
  for (const a of addrs) if (a.family === 4 ? privateV4(a.address) : privateV6(a.address)) throw new SiteFetchError('private_address');
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return '';
  const chunks: Uint8Array[] = []; let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_BYTES) { await reader.cancel().catch(() => undefined); break; }
    chunks.push(value);
  }
  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return buf.toString('utf8');
}

/** GET with manual, re-checked redirects. Returns final URL + body text (HTML/plain only). */
async function safeGet(start: URL, accept = 'text/html,application/xhtml+xml'): Promise<{ url: URL; body: string; status: number }> {
  let url = start;
  for (let hop = 0; hop < 4; hop++) {
    await assertPublic(url);
    const res = await fetch(url, { redirect: 'manual', headers: { 'User-Agent': BOT_UA, Accept: accept, 'Accept-Language': 'nl,en;q=0.8' }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { url = new URL(res.headers.get('location')!, url); continue; }
    const type = res.headers.get('content-type') || '';
    if (!/text\/(html|plain)|application\/xhtml/i.test(type) && accept.includes('html')) return { url, body: '', status: res.status };
    return { url, body: res.ok ? await readCapped(res) : '', status: res.status };
  }
  throw new SiteFetchError('too_many_redirects');
}

/** Minimal robots.txt check for our agent / "*". Unreachable robots.txt = allowed. */
async function robotsAllows(url: URL): Promise<boolean> {
  try {
    const { body, status } = await safeGet(new URL('/robots.txt', url.origin), 'text/plain');
    if (status >= 400 || !body) return true;
    let applies = false; const rules: { allow: boolean; path: string }[] = [];
    for (const raw of body.split(/\r?\n/)) {
      const line = raw.replace(/#.*/, '').trim();
      const m = line.match(/^(user-agent|allow|disallow)\s*:\s*(.*)$/i);
      if (!m) continue;
      const k = m[1].toLowerCase(), v = m[2].trim();
      if (k === 'user-agent') applies = v === '*' || /uithoorn/i.test(v);
      else if (applies && v) rules.push({ allow: k === 'allow', path: v.replace(/\*.*$/, '') });
    }
    const path = url.pathname || '/';
    const hit = rules.filter((r) => path.startsWith(r.path)).sort((a, b) => b.path.length - a.path.length)[0];
    return !hit || hit.allow;
  } catch { return true; }
}

const decode = (s: string) => s.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&euro;/g, '€').replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

export function htmlToText(html: string): string {
  return decode(html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<noscript[\s\S]*?<\/noscript>|<svg[\s\S]*?<\/svg>|<!--[\s\S]*?-->/gi, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/header|\/footer)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\f\v]+/g, ' ').replace(/\s*\n\s*/g, '\n').replace(/\n{2,}/g, '\n').trim();
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'))?.slice(2).find((x) => x !== undefined) ?? null;

export type PageFacts = {
  url: string; title: string | null; siteName: string | null; metaDescription: string | null; text: string;
  jsonLd: Record<string, unknown>[]; tels: string[]; mails: string[]; images: { url: string; alt: string }[]; logo: string | null; links: { url: string; label: string }[];
};

function sameSite(a: URL, b: URL) {
  const strip = (h: string) => h.replace(/^www\./, '');
  return strip(a.hostname) === strip(b.hostname);
}

export function parsePage(html: string, base: URL): PageFacts {
  const title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '') || null;
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  const meta = (n: string) => { const t = metas.find((m) => new RegExp(`(name|property)\\s*=\\s*["']${n}["']`, 'i').test(m)); return t ? decode(attr(t, 'content') ?? '').trim() || null : null; };
  const jsonLd: Record<string, unknown>[] = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const v = JSON.parse(m[1].trim());
      const flat = (x: unknown): void => { if (Array.isArray(x)) x.forEach(flat); else if (x && typeof x === 'object') { const o = x as Record<string, unknown>; if (Array.isArray(o['@graph'])) flat(o['@graph']); else jsonLd.push(o); } };
      flat(v);
    } catch { /* ignore broken JSON-LD */ }
  }
  const anchors = [...html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)];
  const tels = [...new Set(anchors.map((a) => attr(a[1], 'href')).filter((h): h is string => !!h && /^tel:/i.test(h)).map((h) => decode(h.slice(4)).replace(/[^\d+]/g, '')).filter((t) => t.length >= 9))].slice(0, 5);
  const mails = [...new Set(anchors.map((a) => attr(a[1], 'href')).filter((h): h is string => !!h && /^mailto:/i.test(h)).map((h) => decode(h.slice(7)).split('?')[0].trim().toLowerCase()).filter((m) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(m)))].slice(0, 5);
  const links: { url: string; label: string }[] = [];
  for (const a of anchors) {
    const href = attr(a[1], 'href'); if (!href || /^(#|mailto:|tel:|javascript:)/i.test(href)) continue;
    try { const u = new URL(decode(href), base); u.hash = ''; if (sameSite(u, base) && /^https?:$/.test(u.protocol)) links.push({ url: u.toString(), label: htmlToText(a[2]).slice(0, 60) }); } catch { /* skip */ }
  }
  const images: { url: string; alt: string }[] = [];
  const og = meta('og:image');
  const pushImg = (src: string | null, alt: string) => {
    if (!src || /^data:/i.test(src)) return;
    try {
      const u = new URL(decode(src), base);
      if (!/^https:$/.test(u.protocol) || !sameSite(u, base)) return; // only images hosted on their own site, over https
      if (/\.(svg|gif|ico)(\?|$)/i.test(u.pathname) || /(icon|sprite|pixel|tracking|spacer|badge|flag|arrow|logo)/i.test(u.pathname)) return;
      if (!images.some((i) => i.url === u.toString())) images.push({ url: u.toString(), alt: alt.slice(0, 120) });
    } catch { /* skip */ }
  };
  if (og) pushImg(og, title ?? '');
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const w = Number(attr(m[0], 'width') || 0);
    if (w && w < 200) continue;
    pushImg(attr(m[0], 'src') || attr(m[0], 'data-src'), decode(attr(m[0], 'alt') ?? ''));
    if (images.length >= 12) break;
  }
  let logo: string | null = null;
  const logoImg = (html.match(/<img\b[^>]*>/gi) ?? []).find((t) => /logo/i.test(t));
  try { const src = logoImg ? attr(logoImg, 'src') : null; if (src) { const u = new URL(decode(src), base); if (u.protocol === 'https:' && sameSite(u, base)) logo = u.toString(); } } catch { /* none */ }
  return { url: base.toString(), title, siteName: meta('og:site_name'), metaDescription: meta('description') || meta('og:description'), text: htmlToText(html.replace(/<(nav|header)\b[\s\S]*?<\/\1>/gi, ' ')).slice(0, 12000), jsonLd, tels, mails, images, logo, links };
}

const INTERESTING = /(contact|over-ons|over|about|openingstijden|opening|tijden|hours|diensten|services|behandelingen|tarieven|prijzen|menu|wie-zijn-wij)/i;

export async function fetchBusinessSite(input: string): Promise<{ pages: PageFacts[]; finalUrl: string }> {
  let raw = input.trim();
  if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
  let start: URL;
  try { start = new URL(raw); } catch { throw new SiteFetchError('bad_url'); }
  if (!(await robotsAllows(start))) throw new SiteFetchError('robots_disallow');
  let home = await safeGet(start).catch((e) => { if (start.protocol === 'https:' && !(e instanceof SiteFetchError)) return null; throw e; });
  if (!home) home = await safeGet(new URL(start.toString().replace(/^https:/, 'http:')));
  if (!home.body) throw new SiteFetchError(home.status >= 400 ? `http_${home.status}` : 'empty');
  const first = parsePage(home.body, home.url);
  const pages = [first];
  const seen = new Set([home.url.toString()]);
  const extra = first.links.filter((l) => INTERESTING.test(l.url) || INTERESTING.test(l.label)).map((l) => l.url).filter((u) => !seen.has(u) && seen.add(u));
  for (const u of extra.slice(0, 2)) {
    try {
      const url = new URL(u);
      if (!(await robotsAllows(url))) continue;
      const res = await safeGet(url);
      if (res.body) pages.push(parsePage(res.body, res.url));
    } catch { /* a sub page failing is fine */ }
  }
  return { pages, finalUrl: home.url.toString() };
}
