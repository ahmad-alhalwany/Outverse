/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  swcMinify: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,
  experimental: {
    optimizePackageImports: [
      '@heroicons/react/24/outline',
      '@heroicons/react/24/solid',
      'framer-motion',
      'recharts',
      'leaflet',
      'react-leaflet',
      '@emoji-mart/data',
      '@emoji-mart/react',
    ],
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    // Local dev needs the Django backend + its WebSocket endpoint, which
    // production's CSP deliberately excludes (only cosmory.app is trusted
    // there). Never widen this for production builds.
    const devConnectSrc = isDev
      ? ' http://localhost:8000 http://127.0.0.1:8000 ws://localhost:8000 ws://127.0.0.1:8000'
      : '';
    const connectSrc = `connect-src 'self' https://api.cosmory.app https://cosmory.app https://fonts.googleapis.com https://fonts.gstatic.com https://www.google-analytics.com wss://*.cosmory.app${devConnectSrc}`;
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
                      key: 'Content-Security-Policy',
                      value: [
                        "default-src 'self'",
                        "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://www.googletagmanager.com",
                        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                        "img-src 'self' data: https: blob:",
                        "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com data:",
                        connectSrc,
                        "frame-src 'self'",
                        "object-src 'none'",
                        "base-uri 'self'",
                        "form-action 'self'",
                      ].join('; '),
                    },
                    {
                      key: 'Content-Security-Policy-Report-Only',
                      value: [
                        "default-src 'self'",
                        "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://fonts.googleapis.com https://fonts.gstatic.com https://www.googletagmanager.com",
                        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
                        "img-src 'self' data: https: blob:",
                        "font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com data:",
                        connectSrc,
                        "frame-src 'self'",
                        "object-src 'none'",
                        "base-uri 'self'",
                        "form-action 'self'",
                        "report-uri /api/csp-report",
                      ].join('; '),
                    },
        ],
      },
    ];
  },
  async redirects() {
    return [
      { source: '/favicon.ico', destination: '/vercel.svg', permanent: false },
    ];
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      { protocol: 'http', hostname: '127.0.0.1', port: '8000', pathname: '/media/**' },
      { protocol: 'http', hostname: 'localhost', port: '8000', pathname: '/media/**' },
      { protocol: 'https', hostname: 'randomuser.me', pathname: '/api/portraits/**' },
    ],
  },
};

const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  runtimeCaching: [
    { urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i, handler: 'CacheFirst', options: { cacheName: 'google-fonts', expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 } } },
    { urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i, handler: 'CacheFirst', options: { cacheName: 'google-fonts-static', expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 } } },
    { urlPattern: /\.(?:png|jpg|jpeg|svg|webp|avif|gif)$/i, handler: 'CacheFirst', options: { cacheName: 'images', expiration: { maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60 } } },
    { urlPattern: /\.(?:js|css)$/i, handler: 'StaleWhileRevalidate', options: { cacheName: 'static-resources', expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 } } },
    { urlPattern: ({ url }) => url.pathname.startsWith('/api/'), handler: 'NetworkFirst', options: { cacheName: 'api-cache', expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 }, networkTimeoutSeconds: 10 } },
  ],
});

module.exports = withBundleAnalyzer(withPWA(nextConfig));