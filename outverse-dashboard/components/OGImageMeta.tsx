'use client';

import Image from 'next/image';
import { usePathname } from 'next/navigation';

interface OGImageProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'video';
}

export default function OGImageMeta({ 
  title = 'Cosmory — Your Creative Social Space',
  description = 'Your creative social space where ideas come to life.',
  image = '/og-image.png',
  url = 'https://cosmory.app',
  type = 'website',
}: OGImageProps) {
  const pathname = usePathname();

  return (
    <>
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="Cosmory" />
      <meta property="og:locale" content="en_US" />
      
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      <meta name="twitter:site" content="@cosmory" />
      <meta name="twitter:creator" content="@cosmory" />
    </>
  );
}

export function getPageOGProps(pathname: string, searchParams: URLSearchParams) {
  const baseUrl = 'https://cosmory.app';
  const fullUrl = `${baseUrl}${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;
  
  const pageConfig: Record<string, { title: string; description: string; type: 'website' | 'article' | 'video'; image: string }> = {
    '/': {
      title: 'Cosmory — Your Creative Social Space',
      description: 'Your creative social space where ideas come to life. Share posts, create reels, join communities, and connect with creators worldwide.',
      type: 'website',
      image: '/og-image.png',
    },
    '/reels': {
      title: 'Discover Signals — Cosmory Reels',
      description: 'Discover short-form video signals from creators across the cosmos. Trending reels, moods, and sounds.',
      type: 'website',
      image: '/og-reels.png',
    },
    '/reels/create': {
      title: 'Launch a Signal — Create Reel',
      description: 'Create and launch your own short-form video signal with cosmic filters, music, and moods.',
      type: 'website',
      image: '/og-create-reel.png',
    },
    '/lab': {
      title: 'Lab — Cosmory',
      description: 'Experimental features and cosmic playground for creators.',
      type: 'website',
      image: '/og-lab.png',
    },
    '/bazaar': {
      title: 'Ideas Bazaar — Cosmory',
      description: 'Where creativity meets collaboration. Discover and support creative ideas.',
      type: 'website',
      image: '/og-bazaar.png',
    },
    '/shop': {
      title: 'Madness Shop — Cosmory',
      description: 'Creative products, digital and physical. Art, templates, stories, and more.',
      type: 'website',
      image: '/og-shop.png',
    },
    '/shop/dashboard': {
      title: 'Your Shop Dashboard',
      description: 'Manage your products, orders, and earnings.',
      type: 'website',
      image: '/og-shop-dashboard.png',
    },
    '/forge': {
      title: 'Story Forge — Cosmory',
      description: 'AI-powered creative writing. Generate stories, prompts, and inspiration.',
      type: 'website',
      image: '/og-forge.png',
    },
    '/vault': {
      title: 'Vault — Your Creative Archive',
      description: 'Your personal creative vault. Save, organize, and revisit your ideas.',
      type: 'website',
      image: '/og-vault.png',
    },
    '/bottles': {
      title: 'Messages in Bottles — Cosmory',
      description: 'Throw messages into the cosmic ocean. Find bottles from across the verse.',
      type: 'website',
      image: '/og-bottles.png',
    },
    '/settings': {
      title: 'Settings — Cosmory',
      description: 'Manage your account, privacy, notifications, and preferences.',
      type: 'website',
      image: '/og-settings.png',
    },
    '/login': {
      title: 'Sign In — Cosmory',
      description: 'Sign in to your creative social space.',
      type: 'website',
      image: '/og-login.png',
    },
    '/register': {
      title: 'Join Cosmory — Create Your Account',
      description: 'Join the creative social space where ideas come to life.',
      type: 'website',
      image: '/og-register.png',
    },
    '/onboarding': {
      title: 'Welcome to Cosmory — Set Up Your Profile',
      description: 'Customize your cosmic identity and start creating.',
      type: 'website',
      image: '/og-onboarding.png',
    },
    '/chat': {
      title: 'Cosmic Chat — Cosmory',
      description: 'Private messaging and cosmic conversations with creators.',
      type: 'website',
      image: '/og-chat.png',
    },
    '/wallet': {
      title: 'Your Wallet — Cosmory',
      description: 'Manage your cosmic coins, tips, and purchases.',
      type: 'website',
      image: '/og-wallet.png',
    },
    '/year': {
      title: 'Your Year in Review — Cosmory',
      description: 'A cosmic archive of what you created, felt, and returned to.',
      type: 'website',
      image: '/og-year.png',
    },
    '/studio': {
      title: 'Creation Studio — Cosmory',
      description: 'Your professional creative workspace. Advanced tools for serious creators.',
      type: 'website',
      image: '/og-studio.png',
    },
    '/simulator': {
      title: 'Universe Simulator — Cosmory',
      description: 'Simulate cosmic scenarios and creative experiments.',
      type: 'website',
      image: '/og-simulator.png',
    },
    '/museum': {
      title: 'Museum of Failures — Cosmory',
      description: 'Celebrate creative failures. Every failure is a step toward success.',
      type: 'website',
      image: '/og-museum.png',
    },
    '/garden': {
      title: 'Idea Garden — Cosmory',
      description: 'Plant creative seeds and watch them grow into full ideas.',
      type: 'website',
      image: '/og-garden.png',
    },
    '/memories': {
      title: 'Memories Bank — Cosmory',
      description: 'Your personal archive of cosmic moments and memories.',
      type: 'website',
      image: '/og-memories.png',
    },
    '/characters': {
      title: 'Characters Market — Cosmory',
      description: 'Buy, sell, and trade unique character designs.',
      type: 'website',
      image: '/og-characters.png',
    },
    '/premium': {
      title: 'Cosmic Pass — Cosmory Premium',
      description: 'Unlock premium features: advanced analytics, exclusive filters, and more.',
      type: 'website',
      image: '/og-premium.png',
    },
    '/collab': {
      title: 'Collab Hub — Cosmory',
      description: 'Collaborate with creators. Build projects together in real-time.',
      type: 'website',
      image: '/og-collab.png',
    },
    '/saved': {
      title: 'Your Saved Signals — Cosmory',
      description: 'Your personal collection of saved posts and reels.',
      type: 'website',
      image: '/og-saved.png',
    },
    '/notifications': {
      title: 'Notifications — Cosmory',
      description: 'Stay updated with your cosmic activity.',
      type: 'website',
      image: '/og-notifications.png',
    },
    '/search': {
      title: 'Search — Cosmory',
      description: 'Find creators, posts, reels, and communities across the verse.',
      type: 'website',
      image: '/og-search.png',
    },
    '/profile': {
      title: 'Profile — Cosmory',
      description: 'Your cosmic identity and creative portfolio.',
      type: 'website',
      image: '/og-profile.png',
    },
  } as const;

  const config = pageConfig[pathname] || {
    title: 'Cosmory — Your Creative Social Space',
    description: 'Your creative social space where ideas come to life.',
    type: 'website',
    image: '/og-image.png',
  };

  return {
    title: config.title,
    description: config.description,
    image: config.image,
    url: fullUrl,
    type: config.type,
  };
}