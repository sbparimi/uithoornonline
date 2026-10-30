// Production API. Override with EXPO_PUBLIC_API_URL (e.g. a Vercel preview) at build time.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://uithoorn.online').replace(/\/$/, '');
export const SITE_URL = 'https://uithoorn.online';
export const SUPPORT_EMAIL = 'sam@uithoorn.online';
