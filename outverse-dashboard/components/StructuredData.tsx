'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

interface StructuredDataProps {
  type: 'WebSite' | 'WebPage' | 'SocialMediaPosting' | 'VideoObject' | 'Article' | 'ProfilePage';
  data: Record<string, unknown>;
}

export default function StructuredData({ type, data }: StructuredDataProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (typeof window === 'undefined') return;
  }, [pathname, searchParams]);

  const baseData = {
    '@context': 'https://schema.org',
    '@type': type,
    ...data,
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(baseData) }}
    />
  );
}

export function getWebsiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Cosmory',
    url: 'https://cosmory.app',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://cosmory.app/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };
}

export function getWebPageSchema(title: string, description: string, url: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: title,
    description: description,
    url: url,
  };
}

export function getSocialMediaPostingSchema(post: {
  id: number;
  text: string;
  author: { name: string; url: string };
  datePublished: string;
  image?: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'SocialMediaPosting',
    '@id': post.url,
    headline: post.text.slice(0, 100),
    text: post.text,
    author: {
      '@type': 'Person',
      name: post.author.name,
      url: post.author.url,
    },
    datePublished: post.datePublished,
    image: post.image,
    url: post.url,
    publisher: {
      '@type': 'Organization',
      name: 'Cosmory',
      url: 'https://cosmory.app',
    },
  };
}

export function getVideoObjectSchema(reel: {
  id: number;
  caption: string;
  videoUrl: string;
  thumbnailUrl: string;
  author: { name: string; url: string };
  datePublished: string;
  duration: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    '@id': reel.url,
    name: reel.caption.slice(0, 100),
    description: reel.caption,
    contentUrl: reel.videoUrl,
    thumbnailUrl: reel.thumbnailUrl,
    uploadDate: reel.datePublished,
    duration: reel.duration,
    author: {
      '@type': 'Person',
      name: reel.author.name,
      url: reel.author.url,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Cosmory',
      url: 'https://cosmory.app',
    },
  };
}

export function getArticleSchema(article: {
  id: number;
  headline: string;
  description: string;
  author: { name: string; url: string };
  datePublished: string;
  dateModified?: string;
  image?: string;
  url: string;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    '@id': article.url,
    headline: article.headline,
    description: article.description,
    author: {
      '@type': 'Person',
      name: article.author.name,
      url: article.author.url,
    },
    datePublished: article.datePublished,
    dateModified: article.dateModified || article.datePublished,
    image: article.image,
    url: article.url,
    publisher: {
      '@type': 'Organization',
      name: 'Cosmory',
      url: 'https://cosmory.app',
    },
  };
}

export function getProfilePageSchema(profile: {
  id: number;
  name: string;
  username: string;
  bio: string;
  avatar: string;
  url: string;
  followersCount: number;
  followingCount: number;
}) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': profile.url,
    mainEntity: {
      '@type': 'Person',
      '@id': profile.url,
      name: profile.name,
      alternateName: `@${profile.username}`,
      description: profile.bio,
      image: profile.avatar,
      url: profile.url,
      followerCount: profile.followersCount,
      followingCount: profile.followingCount,
    },
  };
}