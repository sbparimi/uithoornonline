import type { MetadataRoute } from 'next';
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/account', '/admin', '/provider', '/messages/', '/en/account', '/en/admin', '/en/provider', '/en/messages/'] }, sitemap: 'https://uithoorn.online/sitemap.xml' };
}
