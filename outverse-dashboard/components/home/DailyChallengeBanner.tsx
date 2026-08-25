'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import {
  FireIcon,
  ArrowRightIcon,
  LightBulbIcon,
} from '@heroicons/react/24/outline';
import { apiUrl } from '@/lib/api';

type Challenge = {
  id: number;
  title: string;
  description: string;
  type_display?: string;
  difficulty?: string;
};

export default function DailyChallengeBanner() {
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(apiUrl('challenges/daily/'))
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data && data.id) setChallenge(data);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Mirrors the real banner's layout classes AND its worst-case content
  // height, not just a plausible-looking guess — the first attempt at this
  // (matching layout classes but reserving one line for the title) still
  // measurably drifted, because AI-generated challenge titles can run long
  // enough to wrap to 2 lines (title had no line-clamp, so its real height
  // was open-ended). Bounded the real title to line-clamp-2 below and sized
  // this skeleton's title placeholder to the same 2-line worst case, so
  // "loading" and "loaded" can never differ in height regardless of title
  // length.
  if (loading) {
    return (
      <div className="daily-challenge-banner-skeleton mb-5 rounded-[28px] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex-1">
          <div className="h-2.5 w-28 rounded skeleton-pulse mb-3" />
          <div className="h-6 w-full rounded skeleton-pulse mb-1" />
          <div className="h-6 w-2/3 rounded skeleton-pulse mb-2" />
          <div className="h-4 w-full rounded skeleton-pulse mb-1" />
          <div className="h-4 w-2/3 rounded skeleton-pulse mb-3" />
          {/* Reserves space for the type_display chip even though it's
              conditional in the real markup — it's present on nearly every
              challenge (confirmed via the live API), and over-reserving on
              the rare day it's absent is a far smaller shift than under-
              reserving on the common day it's there. */}
          <div className="h-6 w-24 rounded-full skeleton-pulse" />
        </div>
        <div className="h-11 sm:min-w-[11rem] rounded-2xl skeleton-pulse" />
      </div>
    );
  }
  if (!challenge) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="daily-challenge-banner mb-5 rounded-[28px] p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 relative overflow-hidden"
    >
      <div className="relative z-10 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-amber-100/90 flex items-center gap-1 mb-2">
          <FireIcon className="h-4 w-4" />
          Daily Challenge
        </p>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[1.55rem] leading-tight font-bold text-white line-clamp-2">{challenge.title}</h2>
            <p className="text-sm sm:text-base text-white/78 mt-2 line-clamp-2">
              {challenge.description}
            </p>
            {challenge.type_display && (
              <span className="inline-flex items-center gap-1.5 mt-3 text-[11px] px-3 py-1 rounded-full bg-white/12 text-white/90">
                <LightBulbIcon className="h-3.5 w-3.5" />
                {challenge.type_display} · {challenge.difficulty || 'open'}
              </span>
            )}
          </div>
          <div className="hidden sm:flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
            <LightBulbIcon className="h-6 w-6 text-white" />
          </div>
        </div>
      </div>
      <Link
        href={`/lab?challenge=${challenge.id}`}
        className="relative z-10 shrink-0 inline-flex items-center justify-center gap-2 px-5 py-3 rounded-2xl font-semibold text-sm bg-white text-vault shadow-lg hover:scale-[1.02] transition-transform min-w-[11rem]"
      >
        Join challenge
        <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </motion.div>
  );
}