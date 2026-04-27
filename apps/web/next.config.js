/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
    // Code review PR #4: webpack nie potrafi zbundlować natywnych `.node`
    // binarek z puppeteer-core / @sparticuz/chromium. Bez tej flagi deploy
    // na Vercel/Lambda nie uruchamia się — moduły są bundlowane i wybuchają
    // na runtime przy import'cie native addons.
    serverComponentsExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
  },
  // Source-of-truth dla typów: packages/database/types.ts
  transpilePackages: ['@k2/database'],
};

module.exports = nextConfig;
