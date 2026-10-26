import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
