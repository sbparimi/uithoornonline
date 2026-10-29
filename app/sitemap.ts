import type { MetadataRoute } from 'next';
import { SITE_URL, lp } from '../lib/i18n/config';
import { listPublicBusinesses } from '../lib/data/businesses';

// Rebuilt at most hourly so new approved businesses appear without a deploy.
export const revalidate = 3600;

const routes = ['/', '/businesses', '/request', '/voor-bedrijven', '/deals', '/jobs', '/food', '/signup', '/privacy', '/cookies', '/voorwaarden', '/contact', '/diensten/loodgieter-uithoorn', '/diensten/elektricien-uithoorn', '/diensten/tuinman-uithoorn', '/diensten/schoonmaker-uithoorn', '/diensten/handyman-uithoorn', '/diensten/verhuizer-uithoorn'];

function entries(route: string, lastModified: Date, nlPriority: number, enPriority: number): MetadataRoute.Sitemap {
  const nl = `${SITE_URL}${route === '/' ? '' : route}`;
  const en = `${SITE_URL}${lp('en', route)}`;
  const alternates = { languages: { 'nl-NL': nl, en, 'x-default': nl } };
  return [
    { url: nl, lastModified, alternates, priority: nlPriority },
    { url: en, lastModified, alternates, priority: enPriority },
  ];
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const pages = routes.flatMap((route) => entries(route, now, route === '/' ? 1 : 0.7, route === '/' ? 0.8 : 0.5));
  // Every approved, active business profile (the same list the directory shows).
  let businesses: MetadataRoute.Sitemap = [];
  try {
    const { businesses: list } = await listPublicBusinesses();
    businesses = list.flatMap((b) => entries(`/businesses/${b.id}`, now, 0.6, 0.4));
  } catch (error) {
    console.error('[sitemap] businesses unavailable', error instanceof Error ? error.message : error);
  }
  return [...pages, ...businesses];
}
