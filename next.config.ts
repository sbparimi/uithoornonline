import type { NextConfig } from 'next';

// Security headers for every response. The CSP keeps 'unsafe-inline' for scripts because Next.js
// inlines its bootstrap scripts on statically rendered pages (nonces would force every page dynamic).
// vercel.live is only used by the Vercel toolbar on preview deployments.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://vercel.live https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://vitals.vercel-insights.com https://vercel.live wss://ws-us3.pusher.com",
  "frame-src https://vercel.live",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Never index the admin console, account pages or API responses, whatever robots.txt says.
      { source: '/(admin|account|provider|messages)/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/en/(admin|account|provider|messages)/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/(admin|account|provider)', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/en/(admin|account|provider)', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
      { source: '/api/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
  async redirects() {
    return [
      { source: '/for-businesses', destination: '/voor-bedrijven', permanent: true },
      { source: '/en/for-businesses', destination: '/en/voor-bedrijven', permanent: true },
      { source: '/services', destination: '/businesses', permanent: true },
      { source: '/en/services', destination: '/en/businesses', permanent: true },
    ];
  },
};

export default nextConfig;
