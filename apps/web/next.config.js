/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
  },
  // Source-of-truth dla typów: packages/database/types.ts
  transpilePackages: ['@k2/database'],
};

module.exports = nextConfig;
