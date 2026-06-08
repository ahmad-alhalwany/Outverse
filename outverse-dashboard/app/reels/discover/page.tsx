'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowLeftIcon,
  FireIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import ReelsIcon from '@/components/icons/ReelsIcon';
import { apiFetch, mediaUrl } from '@/lib/api';
import {
  REEL_MOOD_META,
  type ReelDiscoverPayload,
  type ReelItem,
  type ReelMood,
} from '@/lib/reelTypes';
import { useLocale } from '@/components/LocaleProvider';

function ReelThumb({ reel, onClick }: { reel: ReelItem; onClick: () => void }) {
  return (
    <button type="button" className="reels-discover__card" onClick={onClick}>
      <div className="reels-discover__thumb-wrap">
        <video
          src={mediaUrl(reel.video) || reel.video}
          className="reels-discover__thumb"
          muted
          playsInline
          loop
          onMouseEnter={(e) => e.currentTarget.play().catch(() => {})}
          onMouseLeave={(e) => {
            e.currentTarget.pause();
            e.currentTarget.currentTime = 0;
          }}
        />
        <span className="reels-discover__thumb-glow" />
      </div>
      <p className="reels-discover__card-caption">{reel.caption?.slice(0, 48) || '…'}</p>
      <span className="reels-discover__card-stat">▶ {reel.views}</span>
    </button>
  );
}

function Lane({
  title,
  icon,
  reels,
  onOpen,
}: {
  title: string;
  icon: React.ReactNode;
  reels: ReelItem[];
  onOpen: (id: number) => void;
}) {
  if (!reels.length) return null;
  return (
    <section className="reels-discover__lane">
      <h2 className="reels-discover__lane-title">
        {icon}
        {title}
      </h2>
      <div className="reels-discover__scroll">
        {reels.map((r) => (
          <ReelThumb key={r.id} reel={r} onClick={() => onOpen(r.id)} />
        ))}
      </div>
    </section>
  );
}

export default function ReelsDiscoverPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [data, setData] = useState<ReelDiscoverPayload | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch('reels/discover/')
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => setData(json))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  const openReel = (id: number) => router.push(`/reels/${id}`);

  return (
    <div className="reels-discover">
      <header className="reels-discover__head">
        <Link href="/reels" className="reels-chrome__btn">
          <ArrowLeftIcon className="h-5 w-5" />
        </Link>
        <h1 className="reels-discover__title-row">
          <ReelsIcon size={28} active />
          {t('reels.discoverTitle')}
        </h1>
        <p>{t('reels.discoverSub')}</p>
      </header>

      {loading && (
        <div className="reels-discover__loading">
          <span className="reels-feed__orb" />
        </div>
      )}

      {!loading && data && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="reels-discover__body"
        >
          <Lane
            title={t('reels.trending')}
            icon={<FireIcon className="h-5 w-5 text-orange-400" />}
            reels={data.trending}
            onOpen={openReel}
          />
          <Lane
            title={t('reels.featured')}
            icon={<SparklesIcon className="h-5 w-5 text-cyan-300" />}
            reels={data.featured}
            onOpen={openReel}
          />
          <Lane
            title={t('reels.fresh')}
            icon={<ReelsIcon size={20} active />}
            reels={data.fresh}
            onOpen={openReel}
          />

          {(Object.keys(REEL_MOOD_META) as ReelMood[]).map((m) => {
            const list = data.by_mood[m] || [];
            if (!list.length) return null;
            const meta = REEL_MOOD_META[m];
            return (
              <Lane
                key={m}
                title={`${meta.emoji} ${meta.label}`}
                icon={null}
                reels={list}
                onOpen={openReel}
              />
            );
          })}

          {data.top_tags.length > 0 && (
            <section className="reels-discover__tags">
              <h2>{t('reels.tags')}</h2>
              <div className="reels-discover__tag-cloud">
                {data.top_tags.map((tag) => (
                  <Link
                    key={tag}
                    href={`/reels?tag=${encodeURIComponent(tag)}`}
                    className="reels-discover__tag"
                  >
                    #{tag}
                  </Link>
                ))}
              </div>
            </section>
          )}
        </motion.div>
      )}
    </div>
  );
}
