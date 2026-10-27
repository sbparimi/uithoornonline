import type { MetadataRoute } from 'next';
import { SITE_URL, lp } from '../lib/i18n/config';

const routes = ['/', '/businesses', '/request', '/voor-bedrijven', '/deals', '/jobs', '/food', '/signup', '/privacy', '/cookies', '/diensten/loodgieter-uithoorn', '/diensten/elektricien-uithoorn', '/diensten/tuinman-uithoorn', '/diensten/schoonmaker-uithoorn', '/diensten/handyman-uithoorn', '/diensten/verhuizer-uithoorn'];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return routes.flatMap((route) => {
    const nl = `${SITE_URL}${route === '/' ? '' : route}`;
    const en = `${SITE_URL}${lp('en', route)}`;
    const alternates = { languages: { 'nl-NL': nl, en } };
    return [
      { url: nl, lastModified: now, alternates, priority: route === '/' ? 1 : 0.7 },
      { url: en, lastModified: now, alternates, priority: route === '/' ? 0.8 : 0.5 },
    ];
  });
}
