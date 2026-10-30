import { verifyToken } from '@/lib/urgent/tokens';
import { acceptJob } from '@/lib/urgent/alerts';

export const dynamic = 'force-dynamic';

const twiml = (say: string) => new Response(`<?xml version="1.0" encoding="UTF-8"?><Response><Say language="nl-NL">${say}</Say></Response>`, { headers: { 'content-type': 'text/xml' } });

// Keypress webhook for the automated spoed call (lib/urgent/channels.ts placeCall). "1" accepts the job
// for the business the signed token names; the reply is read out to the caller.
export async function POST(request: Request) {
  const ids = verifyToken('voice', new URL(request.url).searchParams.get('t'));
  if (!ids) return twiml('Deze oproep is verlopen. Tot ziens.');
  const form = await request.formData().catch(() => null);
  if (String(form?.get('Digits') ?? '') !== '1') return twiml('U heeft de klus niet aangenomen. Tot ziens.');
  const result = await acceptJob(ids[0], ids[1], 'voice');
  if (result.ok) return twiml('Dank u wel. De klus is van u. U ontvangt een e-mail met de gegevens van de klant. Neem zo snel mogelijk contact op. Tot ziens.');
  if (result.error === 'taken') return twiml('Helaas, een ander bedrijf was u net voor. Bedankt en tot ziens.');
  return twiml('Deze klus is niet meer beschikbaar. Tot ziens.');
}
