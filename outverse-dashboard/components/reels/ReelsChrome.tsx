'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeftIcon,
  MagnifyingGlassIcon,
  PlusIcon,
} from '@heroicons/react/24/outline';
import ReelsIcon from '@/components/icons/ReelsIcon';
import { useLocale } from '../LocaleProvider';

interface ReelsChromeProps {
  feed: 'all' | 'following';
  onFeedChange: (f: 'all' | 'following') => void;
}

export default function ReelsChrome({ feed, onFeedChange }: ReelsChromeProps) {
  const { t } = useLocale();
  const router = useRouter();

  return (
    <>
      <header className="reels-chrome__top">
        <button
          type="button"
          className="reels-chrome__btn"
          onClick={() => router.push('/')}
          aria-label={t('reels.back')}
        >
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <div className="reels-chrome__brand">
          <span className="reels-chrome__brand-icon">
            <ReelsIcon size={26} active title={t('reels.title')} />
          </span>
          <span>{t('reels.title')}</span>
        </div>
        <div className="flex gap-1.5">
          <Link href="/reels/discover" className="reels-chrome__btn" title={t('reels.discoverTitle')}>
            <MagnifyingGlassIcon className="h-5 w-5" />
          </Link>
          <Link href="/reels/create" className="reels-chrome__btn reels-chrome__btn--accent">
            <PlusIcon className="h-6 w-6" />
          </Link>
        </div>
      </header>

      <div className="reels-chrome__tabs">
        <button
          type="button"
          className={`reels-chrome__tab${feed === 'all' ? ' reels-chrome__tab--on' : ''}`}
          onClick={() => onFeedChange('all')}
        >
          {t('reels.tabAll')}
        </button>
        <button
          type="button"
          className={`reels-chrome__tab${feed === 'following' ? ' reels-chrome__tab--on' : ''}`}
          onClick={() => onFeedChange('following')}
        >
          {t('reels.tabFollowing')}
        </button>
      </div>
    </>
  );
}
