import { json } from '@/lib/http';
import { BUSINESS_CATEGORIES, OTHER_CATEGORY, categoryLabel } from '@/lib/categories';
import { REQUEST_CATEGORIES, REQUEST_TIMING, REQUEST_URGENCY } from '@/lib/request-options';
import { getDictionary } from '@/lib/i18n/dictionaries';
import { CONTACT_EMAIL } from '@/lib/contact';
import { SITE_URL } from '@/lib/i18n/config';

// Static option lists and labels for the mobile app, so the app never drifts from the website.
export const dynamic = 'force-static';
export const revalidate = 3600;

export async function GET() {
  const nl = getDictionary('nl').requestForm;
  const en = getDictionary('en').requestForm;
  const labelled = (values: string[], key: 'categories' | 'timing' | 'urgency') =>
    values.map((value) => ({ value, nl: nl[key][value] ?? value, en: en[key][value] ?? value }));
  return json({
    apiVersion: 1,
    businessCategories: [
      ...BUSINESS_CATEGORIES.map((c) => ({ value: c.value, nl: c.nl, en: c.en })),
      { value: OTHER_CATEGORY, nl: categoryLabel(OTHER_CATEGORY, 'nl'), en: categoryLabel(OTHER_CATEGORY, 'en'), other: true },
    ],
    requestCategories: labelled(REQUEST_CATEGORIES, 'categories'),
    timing: labelled(REQUEST_TIMING, 'timing'),
    urgency: labelled(REQUEST_URGENCY, 'urgency'),
    contactEmail: CONTACT_EMAIL,
    links: {
      privacy: { nl: `${SITE_URL}/privacy`, en: `${SITE_URL}/en/privacy` },
      terms: { nl: `${SITE_URL}/voorwaarden`, en: `${SITE_URL}/en/voorwaarden` },
      forgotPassword: { nl: `${SITE_URL}/forgot-password`, en: `${SITE_URL}/en/forgot-password` },
    },
  }, 200, { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' });
}
