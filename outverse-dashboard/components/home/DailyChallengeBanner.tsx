'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { FireIcon, ArrowRightIcon } from '@heroicons/react/24/outline';
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

  useEffect(() => {
    fetch(apiUrl('challenges/daily/'))
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.id) setChallenge(data);
      })
      .catch(() => {});
  }, []);

  if (!challenge) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="daily-challenge-banner mb-6 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center gap-4 relative overflow-hidden"
    >
      <div className="relative z-10 flex-1">
        <p className="text-xs font-bold uppercase tracking-wider text-amber-200/90 flex items-center gap-1 mb-1">
          <FireIcon className="h-4 w-4" />
          Daily Challenge
        </p>
        <h2 className="text-lg font-bold text-white">{challenge.title}</h2>
        <p className="text-sm text-white/75 mt-1 line-clamp-2">{challenge.description}</p>
        {challenge.type_display && (
          <span className="inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full bg-white/15 text-white/90">
            {challenge.type_display} · {challenge.difficulty || 'open'}
          </span>
        )}
      </div>
      <Link
        href={`/lab?challenge=${challenge.id}`}
        className="relative z-10 shrink-0 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm bg-white text-vault shadow-lg hover:scale-[1.02] transition-transform"
      >
        Join challenge
        <ArrowRightIcon className="h-4 w-4" />
      </Link>
    </motion.div>
  );
}
