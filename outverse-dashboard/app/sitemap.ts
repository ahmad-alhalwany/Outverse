import { MetadataRoute } from 'next';

const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://outverse-six.vercel.app';

// Only real, public, unauthenticated pages belong here — no placeholder
// [id]/[slug] paths (those 404 for crawlers) and nothing robots.ts disallows.
const staticPages = [
  '',
  '/bazaar',
  '/shop',
  '/forge',
  '/reels',
  '/reels/discover',
  '/museum',
  '/communities',
  '/characters',
  '/simulator',
  '/garden',
  '/about',
  '/faq',
  '/terms',
  '/privacy',
];

export default function sitemap(): MetadataRoute.Sitemap {
  return staticPages.map((page) => ({
    url: `${baseUrl}${page}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: page === '' ? 1 : 0.8,
  }));
}
