import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/api/',
        '/_next/',
        '/static/',
        '/admin/',
        '/settings/',
        '/login',
        '/register',
        '/onboarding',
        '/chat',
        '/wallet',
        '/notifications',
        '/search',
        '/api/',
        '/_next/',
        '/*.json$',
        '/*.xml$',
      ],
    },
    sitemap: 'https://cosmory.app/sitemap.xml',
    host: 'https://cosmory.app',
  };
}