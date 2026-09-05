import type { MetadataRoute } from 'next';
export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://uithoorn.online';
  const routes = ['', '/businesses', '/services', '/jobs', '/events', '/deals', '/request', '/for-businesses'];
  return routes.map((route) => ({ url: `${base}${route}`, lastModified: new Date() }));
}
