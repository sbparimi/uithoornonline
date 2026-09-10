import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://uithoorn.online';
  const routes = ['', '/businesses', '/services', '/jobs', '/deals', '/request', '/for-businesses', '/diensten/loodgieter-uithoorn', '/diensten/elektricien-uithoorn', '/diensten/tuinman-uithoorn', '/diensten/schoonmaker-uithoorn', '/diensten/handyman-uithoorn', '/diensten/verhuizer-uithoorn'];
  return routes.map((route) => ({ url: `${base}${route}`, lastModified: new Date() }));
}
