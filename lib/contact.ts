// Public contact email shown on the site and used as Reply-To on outgoing mail.
// Owner decision 2026-10-30: sam@uithoorn.online is the public contact address. Mail to it is received
// by Resend (inbound on uithoorn.online) and forwarded by app/api/email/inbound to the admin inbox and the
// operations mailbox, so replies to site emails (Reply-To) land there too.
export const CONTACT_EMAIL = 'sam@uithoorn.online';
