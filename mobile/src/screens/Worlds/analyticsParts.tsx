import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatCount } from '@/lib/profileEmotions';
import {
  CATEGORY_KEYS,
  CHANNEL_KEYS,
  REACTION_COLORS,
  creatorHasContent,
  sortedEntries,
  type AnalyticsPalette,
  type CreatorAnalytics,
} from '@/lib/analytics';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function CreatorDashboard({
  data,
  C,
  t,
  loading,
  onOpenBazaar,
  onOpenInspiration,
  onOpenItem,
}: {
  data: CreatorAnalytics | null;
  C: AnalyticsPalette;
  t: TFn;
  loading: boolean;
  onOpenBazaar: () => void;
  onOpenInspiration: () => void;
  onOpenItem: (type: 'post' | 'reel' | 'idea', id: number) => void;
}) {
  if (loading && !data) {
    return <View style={[styles.skeleton, { backgroundColor: C.card2 }]} />;
  }

  if (!data || !creatorHasContent(data)) {
    return (
      <View style={[styles.empty, { backgroundColor: C.card2, borderColor: C.line }]}>
        <Ionicons name="stats-chart-outline" size={28} color={C.text2} />
        <Text style={[styles.emptyTitle, { color: C.text }]}>{t('analytics.creatorEmpty')}</Text>
        <Text style={[styles.emptyHint, { color: C.text2 }]}>{t('analytics.creatorEmptyHint')}</Text>
      </View>
    );
  }

  const { summary } = data;
  const shareRows = sortedEntries(data.shares_by_channel, 8);
  const reactionRows = sortedEntries(data.reactions_by_type);
  const maxShare = Math.max(1, ...shareRows.map(([, count]) => count));
  const maxReaction = Math.max(1, ...reactionRows.map(([, count]) => count));
  const trend = data.engagement_trend;
  const maxTrend = Math.max(1, ...trend.map((day) => day.shares + day.reactions));

  return (
    <View style={styles.block}>
      <View style={styles.sectionHead}>
        <Ionicons name="stats-chart-outline" size={18} color={C.brownDk} />
        <Text style={[styles.sectionTitle, { color: C.text }]}>{t('analytics.creatorTitle')}</Text>
      </View>

      <View style={styles.grid4}>
        {[
          { label: t('analytics.creatorContent'), value: summary.total_content },
          { label: t('profile.views'), value: summary.total_views },
          { label: t('analytics.creatorReactions'), value: summary.total_reactions },
          { label: t('profile.shares'), value: summary.total_shares },
        ].map((stat) => (
          <View key={stat.label} style={[styles.stat, { backgroundColor: C.white, borderColor: C.line }]}>
            <Text style={[styles.statValue, { color: C.brown }]}>{formatCount(stat.value)}</Text>
            <Text style={[styles.statLabel, { color: C.text2 }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      <View style={styles.grid5}>
        {[
          { label: t('profile.posts'), value: summary.total_posts },
          { label: t('analytics.creatorSignals'), value: summary.total_signals },
          { label: t('profile.likes'), value: summary.total_likes },
          { label: t('profile.comments'), value: summary.total_comments },
          { label: t('analytics.creatorReposts'), value: summary.total_reposts },
        ].map((stat) => (
          <View key={stat.label} style={[styles.mini, { backgroundColor: C.card2 }]}>
            <Text style={[styles.miniValue, { color: C.text }]}>{formatCount(stat.value)}</Text>
            <Text style={[styles.miniLabel, { color: C.text2 }]}>{stat.label}</Text>
          </View>
        ))}
      </View>

      {trend.length > 0 ? (
        <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line }]}>
          <View style={styles.sectionHead}>
            <Ionicons name="trending-up-outline" size={16} color={C.brownDk} />
            <Text style={[styles.panelTitle, { color: C.text }]}>{t('analytics.creatorEngagementTrend')}</Text>
          </View>
          <View style={styles.bars}>
            {trend.map((day, index) => (
              <View key={day.date || index} style={styles.barCol}>
                <View style={styles.pair}>
                  <View
                    style={[
                      styles.thinBar,
                      { height: Math.max(4, (day.shares / maxTrend) * 72), backgroundColor: C.brown },
                    ]}
                  />
                  <View
                    style={[
                      styles.thinBar,
                      { height: Math.max(4, (day.reactions / maxTrend) * 72), backgroundColor: C.brownDk },
                    ]}
                  />
                </View>
                <Text style={[styles.barLabel, { color: C.text2 }]}>{day.day}</Text>
              </View>
            ))}
          </View>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: C.brown }]} />
              <Text style={[styles.legendText, { color: C.text2 }]}>{t('profile.shares')}</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: C.brownDk }]} />
              <Text style={[styles.legendText, { color: C.text2 }]}>{t('analytics.creatorReactions')}</Text>
            </View>
          </View>
        </View>
      ) : null}

      {shareRows.length > 0 ? (
        <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line }]}>
          <View style={styles.sectionHead}>
            <Ionicons name="share-outline" size={16} color={C.brownDk} />
            <Text style={[styles.panelTitle, { color: C.text }]}>{t('analytics.creatorSharesByChannel')}</Text>
          </View>
          {shareRows.map(([channel, count]) => (
            <HBar
              key={channel}
              label={CHANNEL_KEYS[channel] ? t(CHANNEL_KEYS[channel]) : channel}
              value={count}
              max={maxShare}
              color={C.brownDk}
              track={C.barBg}
              text={C.text}
              muted={C.text2}
            />
          ))}
        </View>
      ) : null}

      {reactionRows.length > 0 ? (
        <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line }]}>
          <View style={styles.sectionHead}>
            <Ionicons name="sparkles-outline" size={16} color={C.brownDk} />
            <Text style={[styles.panelTitle, { color: C.text }]}>{t('analytics.creatorReactionsByType')}</Text>
          </View>
          <View style={styles.bars}>
            {reactionRows.map(([type, count]) => (
              <View key={type} style={styles.barCol}>
                <View
                  style={[
                    styles.vBar,
                    {
                      height: Math.max(8, (count / maxReaction) * 96),
                      backgroundColor: REACTION_COLORS[type] || C.brownDk,
                    },
                  ]}
                />
                <Text style={[styles.barLabel, { color: C.text2 }]} numberOfLines={1}>
                  {t(`reactions.${type}`)}
                </Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {data.ideas && data.ideas.total_ideas > 0 ? (
        <View style={[styles.panel, { backgroundColor: C.card, borderColor: C.line }]}>
          <Text style={[styles.panelTitle, { color: C.text }]}>{t('analytics.creatorIdeas')}</Text>
          <View style={styles.grid4}>
            {[
              { label: t('analytics.creatorIdeasCount'), value: data.ideas.total_ideas },
              { label: t('analytics.creatorIdeaSupporters'), value: data.ideas.total_supporters },
              { label: t('analytics.creatorIdeaFunding'), value: data.ideas.total_funding_raised },
              { label: t('analytics.creatorIdeaPledges'), value: data.ideas.total_pledges },
            ].map((stat) => (
              <View key={stat.label} style={[styles.mini, { backgroundColor: C.white }]}>
                <Text style={[styles.miniValue, { color: C.brown }]}>{formatCount(stat.value)}</Text>
                <Text style={[styles.miniLabel, { color: C.text2 }]}>{stat.label}</Text>
              </View>
            ))}
          </View>
          <View style={styles.chips}>
            {sortedEntries(data.ideas.by_category, 5).map(([cat, count]) => (
              <Text key={cat} style={[styles.chip, { backgroundColor: C.white, color: C.brownDk }]}>
                {cat} · {count}
              </Text>
            ))}
          </View>
          <Pressable onPress={onOpenBazaar}>
            <Text style={[styles.link, { color: C.brownDk }]}>{t('bazaar.title')} →</Text>
          </Pressable>
        </View>
      ) : null}

      {data.inspiration.published > 0 ? (
        <View style={[styles.panel, { backgroundColor: C.card, borderColor: C.line }]}>
          <Text style={[styles.panelTitle, { color: C.text }]}>{t('analytics.creatorInspiration')}</Text>
          <Text style={[styles.big, { color: C.brown }]}>{formatCount(data.inspiration.published)}</Text>
          <View style={styles.chips}>
            {sortedEntries(data.inspiration.by_category, 5).map(([cat, count]) => (
              <Text key={cat} style={[styles.chip, { backgroundColor: C.white, color: C.brownDk }]}>
                {CATEGORY_KEYS[cat] ? t(CATEGORY_KEYS[cat]) : cat} · {count}
              </Text>
            ))}
          </View>
          {data.inspiration.preferred_categories.length > 0 ? (
            <Text style={[styles.preferred, { color: C.text2 }]}>
              {t('analytics.creatorPreferred')}:{' '}
              {data.inspiration.preferred_categories
                .map((cat) => (CATEGORY_KEYS[cat] ? t(CATEGORY_KEYS[cat]) : cat))
                .join(', ')}
            </Text>
          ) : null}
          <Pressable onPress={onOpenInspiration}>
            <Text style={[styles.link, { color: C.brownDk }]}>{t('inspiration.statsViewHistory')} →</Text>
          </Pressable>
        </View>
      ) : null}

      {data.top_content.length > 0 ? (
        <View style={[styles.panel, { backgroundColor: C.white, borderColor: C.line }]}>
          <Text style={[styles.panelTitle, { color: C.text }]}>{t('analytics.creatorTopContent')}</Text>
          {data.top_content.map((item) => {
            const typeLabel =
              item.type === 'post'
                ? t('profile.posts')
                : item.type === 'idea'
                  ? t('analytics.creatorIdeasCount')
                  : t('analytics.creatorSignals');
            return (
              <Pressable
                key={`${item.type}-${item.id}`}
                onPress={() => onOpenItem(item.type, item.id)}
                style={[styles.topRow, { backgroundColor: C.card2 }]}
              >
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.topTitle, { color: C.text }]} numberOfLines={1}>
                    {item.title}
                  </Text>
                  <Text style={[styles.topMeta, { color: C.text2 }]}>{typeLabel}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {item.type === 'idea' ? (
                    <Text style={[styles.topMeta, { color: C.text2 }]}>
                      {formatCount(item.likes)} {t('bazaar.supporters')}
                    </Text>
                  ) : (
                    <>
                      <Text style={[styles.topMeta, { color: C.text2 }]}>
                        {formatCount(item.views)} {t('profile.views').toLowerCase()}
                      </Text>
                      <Text style={[styles.topMeta, { color: C.text2 }]}>
                        {formatCount(item.likes)} · {formatCount(item.shares)}
                        {item.reposts > 0 ? ` · ${formatCount(item.reposts)} ↻` : ''}
                      </Text>
                    </>
                  )}
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function HBar({
  label,
  value,
  max,
  color,
  track,
  text,
  muted,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  track: string;
  text: string;
  muted: string;
}) {
  return (
    <View style={styles.hRow}>
      <Text style={[styles.hLabel, { color: text }]} numberOfLines={1}>
        {label}
      </Text>
      <View style={[styles.hTrack, { backgroundColor: track }]}>
        <View style={[styles.hFill, { width: `${Math.max(8, (value / max) * 100)}%`, backgroundColor: color }]} />
      </View>
      <Text style={[styles.hValue, { color: muted }]}>{formatCount(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  block: { gap: 12, marginBottom: 18 },
  skeleton: { height: 180, borderRadius: 18, marginBottom: 18 },
  empty: { borderRadius: 18, borderWidth: 1, padding: 24, alignItems: 'center', marginBottom: 18 },
  emptyTitle: { fontSize: 14, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  emptyHint: { fontSize: 12, marginTop: 4, textAlign: 'center' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '800' },
  panel: { borderRadius: 18, borderWidth: 1, padding: 16 },
  panelTitle: { fontSize: 14, fontWeight: '700', marginBottom: 10 },
  grid4: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  grid5: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  stat: { flexGrow: 1, flexBasis: 148, minWidth: 148, borderRadius: 16, borderWidth: 1, padding: 12, alignItems: 'center' },
  statValue: { fontSize: 20, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase', marginTop: 4, textAlign: 'center' },
  mini: { width: '30%', flexGrow: 1, borderRadius: 12, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center' },
  miniValue: { fontSize: 13, fontWeight: '800' },
  miniLabel: { fontSize: 10, marginTop: 2, textAlign: 'center' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', height: 120, gap: 6 },
  barCol: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 4 },
  pair: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 80 },
  thinBar: { width: 8, borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  vBar: { width: '70%', borderTopLeftRadius: 6, borderTopRightRadius: 6 },
  barLabel: { fontSize: 10, textAlign: 'center' },
  legend: { flexDirection: 'row', gap: 14, marginTop: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  swatch: { width: 8, height: 8, borderRadius: 2 },
  legendText: { fontSize: 10 },
  hRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  hLabel: { width: 88, fontSize: 11, fontWeight: '600' },
  hTrack: { flex: 1, height: 8, borderRadius: 999, overflow: 'hidden' },
  hFill: { height: '100%', borderRadius: 999 },
  hValue: { width: 28, fontSize: 11, textAlign: 'right' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, fontSize: 12, fontWeight: '700', overflow: 'hidden' },
  link: { fontSize: 12, fontWeight: '700', marginTop: 12 },
  preferred: { fontSize: 12, marginTop: 8, lineHeight: 18 },
  big: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  topRow: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, flexDirection: 'row', gap: 10, marginBottom: 8 },
  topTitle: { fontSize: 13, fontWeight: '700' },
  topMeta: { fontSize: 10, marginTop: 2 },
});
