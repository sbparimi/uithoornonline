// In-app notification texts, stored in the recipient's language (the dashboards render them as-is).
type Lang = 'nl' | 'en';
const TEXT = {
  new_request: {
    nl: ['Nieuwe lokale aanvraag', 'Er is een nieuwe aanvraag die past bij jouw bedrijf.'],
    en: ['New local request', 'There is a new request that matches your business.'],
  },
  new_request_locked: {
    nl: ['Nieuwe aanvraag (limiet bereikt)', 'Er is een nieuwe aanvraag voor jouw bedrijf. Upgrade je pakket om hem te bekijken.'],
    en: ['New request (limit reached)', 'There is a new request for your business. Upgrade your plan to view it.'],
  },
  new_message: {
    nl: ['Nieuw bericht op Uithoorn.online', ''],
    en: ['New message on Uithoorn.online', ''],
  },
  completed: {
    nl: ['Opdracht afgerond', 'Je gesprek is gemarkeerd als afgerond. Laat een beoordeling achter voor de aanbieder.'],
    en: ['Job completed', 'Your conversation has been marked as completed. Leave a review for the provider.'],
  },
  accepted: {
    nl: ['Een aanbieder heeft gereageerd', 'Een lokale aanbieder heeft jouw aanvraag geaccepteerd. Je kunt nu berichten sturen.'],
    en: ['A provider has responded', 'A local provider has accepted your request. You can now send messages.'],
  },
} as const;

export type NotificationKey = keyof typeof TEXT;

export function notificationText(key: NotificationKey, lang: string | null | undefined): { title: string; body: string } {
  const [title, body] = TEXT[key][lang === 'en' ? 'en' : 'nl'];
  return { title, body };
}

export function isLang(v: unknown): v is Lang { return v === 'nl' || v === 'en'; }
