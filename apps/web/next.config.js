const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    typedRoutes: true,
    instrumentationHook: true,
    // Code review PR #4: webpack nie potrafi zbundlować natywnych `.node`
    // binarek z puppeteer-core / @sparticuz/chromium. Bez tej flagi deploy
    // na Vercel/Lambda nie uruchamia się — moduły są bundlowane i wybuchają
    // na runtime przy import'cie native addons.
    serverComponentsExternalPackages: ['puppeteer-core', '@sparticuz/chromium'],
  },
  // Source-of-truth dla typów: packages/database/types.ts
  transpilePackages: ['@k2/database'],
};

module.exports = withSentryConfig(nextConfig, {
  // Build-time options — bez source maps upload (wymaga auth tokena)
  silent: true,
  org: 'k2biznes',
  project: 'javascript-nextjs',
  // Source maps: wylaczone (mozna dolaczyc po setupie SENTRY_AUTH_TOKEN w Vercel)
  sourcemaps: { disable: true },
  // Tunneling przez /monitoring zeby ad-blockery nie blokowaly Sentry requestow
  tunnelRoute: '/monitoring',
  disableLogger: true,
  automaticVercelMonitors: false,
});
