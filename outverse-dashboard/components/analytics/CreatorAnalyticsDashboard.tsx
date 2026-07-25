'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowTrendingUpIcon,
  ChartBarIcon,
  ShareIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { useLocale } from '@/components/LocaleProvider';
import { formatCount } from '@/lib/profileEmotions';
import { reelPagePath } from '@/lib/fetchReel';
import {
  fetchCreatorAnalytics,
  type CreatorAnalytics,
} from '@/lib/creatorAnalyticsApi';

type Palette = {
  card: string;
  card2: string;
  white: string;
  brown: string;
  brownDk: string;
  text: string;
  text2: string;
  line: string;
  barBg: string;
};

const CHANNEL_LABELS: Record<string, string> = {
  copy: 'Copy link',
  native: 'Native',
  twitter: 'X / Twitter',
  whatsapp: 'WhatsApp',
  facebook: 'Facebook',
  telegram: 'Telegram',
  linkedin: 'LinkedIn',
  reddit: 'Reddit',
  bluesky: 'Bluesky',
  email: 'Email',
  dm: 'Direct message',
  story: 'Story',
  embed: 'Embed',
  card: 'Share card',
  unknown: 'Other',
};

const REACTION_COLORS: Record<string, string> = {
  inspired: '#F59E0B',
  cosmic: '#8B5CF6',
  mindbending: '#06B6D4',
  growing: '#10B981',
  spark: '#EC4899',
};

const CATEGORY_KEYS: Record<string, string> = {
  historical: 'inspiration.categoryHistorical',
  fantasy: 'inspiration.categoryFantasy',
  scifi: 'inspiration.categoryScifi',
  philosophical: 'inspiration.categoryPhilosophical',
  mystery: 'inspiration.categoryMystery',
  surreal: 'inspiration.categorySurreal',
  everyday: 'inspiration.categoryEveryday',
  emotional: 'inspiration.categoryEmotional',
};

type Props = {
  colors: Palette;
};

export default function CreatorAnalyticsDashboard({ colors: C }: Props) {
  const { t } = useLocale();
  const [data, setData] = useState<CreatorAnalytics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fetchCreatorAnalytics());
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const shareChartData = useMemo(
    () =>
      Object.entries(data?.shares_by_channel ?? {})
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8)
        .map(([channel, count]) => ({
          channel,
          label: CHANNEL_LABELS[channel] ?? channel,
          count,
        })),
    [data?.shares_by_channel],
  );

  const reactionChartData = useMemo(
    () =>
      Object.entries(data?.reactions_by_type ?? {})
        .sort((a, b) => b[1] - a[1])
        .map(([type, count]) => ({
          type,
          label: t(`reactions.${type}` as 'reactions.spark'),
          count,
        })),
    [data?.reactions_by_type, t],
  );

  const trendData = useMemo(
    () =>
      (data?.engagement_trend ?? []).map((row) => ({
        ...row,
        total: row.shares + row.reactions,
      })),
    [data?.engagement_trend],
  );

  const maxTrend = Math.max(1, ...trendData.map((d) => d.total));

  if (loading) {
    return (
      <div className="rounded-2xl p-8 mb-6 animate-pulse" style={{ background: C.card2, height: 180 }} />
    );
  }

  if (!data || (data.summary.total_content === 0 && !(data.ideas?.total_ideas))) {
    return (
      <section
        className="rounded-2xl p-6 mb-6 text-center"
        style={{ background: C.card2, border: `1px solid ${C.line}`, color: C.text2 }}
      >
        <ChartBarIcon className="h-8 w-8 mx-auto mb-2 opacity-60" />
        <p className="text-sm font-semibold">{t('analytics.creatorEmpty')}</p>
        <p className="text-xs mt-1">{t('analytics.creatorEmptyHint')}</p>
      </section>
    );
  }

  const { summary } = data;

  return (
    <section className="mb-6 space-y-4">
      <div className="flex items-center gap-2">
        <ChartBarIcon className="h-5 w-5" style={{ color: C.brownDk }} />
        <h2 className="text-base font-bold" style={{ color: C.text }}>
          {t('analytics.creatorTitle')}
        </h2>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t('analytics.creatorContent'), value: summary.total_content },
          { label: t('profile.views'), value: summary.total_views },
          { label: t('analytics.creatorReactions'), value: summary.total_reactions },
          { label: t('profile.shares'), value: summary.total_shares },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl p-3 text-center"
            style={{ background: C.white, border: `1px solid ${C.line}` }}
          >
            <div className="text-xl font-bold" style={{ color: C.brown }}>
              {formatCount(stat.value)}
            </div>
            <div className="text-[10px] uppercase tracking-wide mt-1" style={{ color: C.text2 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: t('profile.posts'), value: summary.total_posts },
          { label: t('analytics.creatorSignals'), value: summary.total_signals },
          { label: t('profile.likes'), value: summary.total_likes },
          { label: t('profile.comments'), value: summary.total_comments },
          { label: t('analytics.creatorReposts'), value: summary.total_reposts },
        ].map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl px-3 py-2 text-center"
            style={{ background: C.card2 }}
          >
            <div className="text-sm font-bold" style={{ color: C.text }}>
              {formatCount(stat.value)}
            </div>
            <div className="text-[10px]" style={{ color: C.text2 }}>
              {stat.label}
            </div>
          </div>
        ))}
      </div>

      {trendData.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: C.white, border: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-2 mb-3">
            <ArrowTrendingUpIcon className="h-5 w-5" style={{ color: C.brownDk }} />
            <p className="text-sm font-semibold" style={{ color: C.text }}>
              {t('analytics.creatorEngagementTrend')}
            </p>
          </div>
          <div className="flex items-end justify-between gap-2 h-28">
            {trendData.map((day) => (
              <div key={day.date} className="flex flex-1 flex-col items-center gap-1">
                <div className="flex w-full items-end justify-center gap-0.5" style={{ height: 80 }}>
                  <div
                    className="w-2 rounded-t-sm"
                    title={`${t('profile.shares')}: ${day.shares}`}
                    style={{
                      height: `${Math.max(4, (day.shares / maxTrend) * 72)}px`,
                      background: C.brown,
                    }}
                  />
                  <div
                    className="w-2 rounded-t-sm"
                    title={`${t('analytics.creatorReactions')}: ${day.reactions}`}
                    style={{
                      height: `${Math.max(4, (day.reactions / maxTrend) * 72)}px`,
                      background: C.brownDk,
                    }}
                  />
                </div>
                <span className="text-[10px]" style={{ color: C.text2 }}>
                  {day.day}
                </span>
              </div>
            ))}
          </div>
          <div className="flex gap-4 mt-3 text-[10px]" style={{ color: C.text2 }}>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: C.brown }} />
              {t('profile.shares')}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-sm" style={{ background: C.brownDk }} />
              {t('analytics.creatorReactions')}
            </span>
          </div>
        </div>
      )}

      {shareChartData.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: C.white, border: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-2 mb-3">
            <ShareIcon className="h-5 w-5" style={{ color: C.brownDk }} />
            <p className="text-sm font-semibold" style={{ color: C.text }}>
              {t('analytics.creatorSharesByChannel')}
            </p>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={shareChartData} layout="vertical" margin={{ left: 4, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} horizontal={false} />
                <XAxis type="number" tick={{ fill: C.text2, fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="label"
                  width={88}
                  tick={{ fill: C.text2, fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    background: C.card,
                    border: `1px solid ${C.line}`,
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" fill={C.brownDk} radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {reactionChartData.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: C.white, border: `1px solid ${C.line}` }}>
          <div className="flex items-center gap-2 mb-3">
            <SparklesIcon className="h-5 w-5" style={{ color: C.brownDk }} />
            <p className="text-sm font-semibold" style={{ color: C.text }}>
              {t('analytics.creatorReactionsByType')}
            </p>
          </div>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={reactionChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.line} vertical={false} />
                <XAxis dataKey="label" tick={{ fill: C.text2, fontSize: 10 }} />
                <YAxis tick={{ fill: C.text2, fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    background: C.card,
                    border: `1px solid ${C.line}`,
                    borderRadius: 12,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                  {reactionChartData.map((entry) => (
                    <Cell key={entry.type} fill={REACTION_COLORS[entry.type] ?? C.brownDk} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {data.ideas && data.ideas.total_ideas > 0 && (
        <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <p className="text-sm font-semibold mb-2" style={{ color: C.text }}>
            {t('analytics.creatorIdeas')}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
            {[
              { label: t('analytics.creatorIdeasCount'), value: data.ideas.total_ideas },
              { label: t('analytics.creatorIdeaSupporters'), value: data.ideas.total_supporters },
              { label: t('analytics.creatorIdeaFunding'), value: data.ideas.total_funding_raised },
              { label: t('analytics.creatorIdeaPledges'), value: data.ideas.total_pledges },
            ].map((stat) => (
              <div key={stat.label} className="rounded-xl px-3 py-2 text-center" style={{ background: C.white }}>
                <div className="text-sm font-bold" style={{ color: C.brown }}>{formatCount(stat.value)}</div>
                <div className="text-[10px]" style={{ color: C.text2 }}>{stat.label}</div>
              </div>
            ))}
          </div>
          {Object.keys(data.ideas.by_category).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(data.ideas.by_category)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([cat, count]) => (
                  <span
                    key={cat}
                    className="text-xs rounded-full px-3 py-1"
                    style={{ background: C.white, color: C.brownDk }}
                  >
                    {cat} · {count}
                  </span>
                ))}
            </div>
          )}
          <Link href="/bazaar" className="inline-block mt-3 text-xs font-semibold" style={{ color: C.brownDk }}>
            {t('bazaar.title')} →
          </Link>
        </div>
      )}

      {data.inspiration.published > 0 && (
        <div className="rounded-2xl p-5" style={{ background: C.card, border: `1px solid ${C.line}` }}>
          <p className="text-sm font-semibold mb-2" style={{ color: C.text }}>
            {t('analytics.creatorInspiration')}
          </p>
          <p className="text-2xl font-bold mb-3" style={{ color: C.brown }}>
            {formatCount(data.inspiration.published)}
          </p>
          {Object.keys(data.inspiration.by_category).length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {Object.entries(data.inspiration.by_category)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([cat, count]) => {
                  const key = CATEGORY_KEYS[cat];
                  return (
                    <span
                      key={cat}
                      className="text-xs rounded-full px-3 py-1"
                      style={{ background: C.white, color: C.brownDk }}
                    >
                      {key ? t(key) : cat} · {count}
                    </span>
                  );
                })}
            </div>
          )}
          {data.inspiration.preferred_categories.length > 0 && (
            <p className="text-xs" style={{ color: C.text2 }}>
              {t('analytics.creatorPreferred')}:{' '}
              {data.inspiration.preferred_categories
                .map((cat) => {
                  const key = CATEGORY_KEYS[cat];
                  return key ? t(key) : cat;
                })
                .join(', ')}
            </p>
          )}
          <Link href="/inspiration" className="inline-block mt-3 text-xs font-semibold" style={{ color: C.brownDk }}>
            {t('inspiration.statsViewHistory')} →
          </Link>
        </div>
      )}

      {data.top_content.length > 0 && (
        <div className="rounded-2xl p-5" style={{ background: C.white, border: `1px solid ${C.line}` }}>
          <p className="text-sm font-semibold mb-3" style={{ color: C.text }}>
            {t('analytics.creatorTopContent')}
          </p>
          <div className="space-y-2">
            {data.top_content.map((item) => {
              const href =
                item.type === 'post'
                  ? `/post/${item.id}`
                  : item.type === 'idea'
                    ? `/bazaar/${item.id}`
                    : reelPagePath(item.id);
              const typeLabel =
                item.type === 'post'
                  ? t('profile.posts')
                  : item.type === 'idea'
                    ? t('analytics.creatorIdeasCount')
                    : t('analytics.creatorSignals');
              return (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={href}
                  className="flex items-center justify-between gap-3 rounded-xl px-3 py-2 transition hover:opacity-90"
                  style={{ background: C.card2 }}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: C.text }}>
                      {item.title}
                    </p>
                    <p className="text-[10px]" style={{ color: C.text2 }}>
                      {typeLabel}
                    </p>
                  </div>
                  <div className="shrink-0 text-right text-[10px]" style={{ color: C.text2 }}>
                    {item.type === 'idea' ? (
                      <div>
                        {formatCount(item.likes)} {t('bazaar.supporters').toLowerCase()}
                      </div>
                    ) : (
                      <>
                        <div>{formatCount(item.views)} {t('profile.views').toLowerCase()}</div>
                        <div>
                          {formatCount(item.likes)} · {formatCount(item.shares)}
                          {item.reposts > 0 ? ` · ${formatCount(item.reposts)} ↻` : ''}
                        </div>
                      </>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
