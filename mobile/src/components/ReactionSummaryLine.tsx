import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocale } from '@/i18n/LocaleProvider';
import { useTheme } from '@/hooks/useTheme';
import { COSMIC_REACTIONS, EMOJI_BY_REACTION_TYPE, type ReactionType } from '@/lib/reactions';

export type TopReactor = {
  id: number | string;
  name: string;
  username?: string;
  type?: string;
};

type Props = {
  total: number;
  myReaction?: string | null;
  reactionCounts?: Record<string, number>;
  topReactors?: TopReactor[];
  onOpen?: () => void;
};

function reactorLabel(r: TopReactor) {
  return (r.name || r.username || '').trim();
}

export default function ReactionSummaryLine({
  total,
  myReaction,
  reactionCounts = {},
  topReactors = [],
  onOpen,
}: Props) {
  const { t } = useLocale();
  const { colors } = useTheme();

  const emojiStack = useMemo(() => {
    const entries = Object.entries(reactionCounts)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    if (entries.length === 0 && myReaction) return [myReaction];
    return entries.map(([key]) => {
      if (COSMIC_REACTIONS.some((r) => r.emoji === key)) return key;
      return EMOJI_BY_REACTION_TYPE[key as ReactionType] || key;
    });
  }, [reactionCounts, myReaction]);

  const text = useMemo(() => {
    if (total <= 0) return '';
    const others = topReactors
      .map(reactorLabel)
      .filter(Boolean)
      .filter((name, i, arr) => arr.indexOf(name) === i)
      .slice(0, 2);

    if (myReaction) {
      if (total === 1) return t('feed.reactedYou');
      if (others.length >= 1) {
        const remaining = Math.max(0, total - 1 - others.length);
        if (remaining > 0) {
          return t('feed.reactedYouNameOthers', {
            name: others[0],
            count: String(remaining + Math.max(0, others.length - 1)),
          });
        }
        if (others.length === 1) return t('feed.reactedYouAndName', { name: others[0] });
        return t('feed.reactedYouAndTwo', { name1: others[0], name2: others[1] });
      }
      return t('feed.reactedYouAndOthers', { count: String(total - 1) });
    }

    if (others.length === 1 && total === 1) return t('feed.reactedName', { name: others[0] });
    if (others.length >= 2) {
      const remaining = Math.max(0, total - 2);
      if (remaining > 0) {
        return t('feed.reactedTwoOthers', {
          name1: others[0],
          name2: others[1],
          count: String(remaining),
        });
      }
      return t('feed.reactedTwo', { name1: others[0], name2: others[1] });
    }
    if (others.length === 1) {
      return t('feed.reactedNameOthers', {
        name: others[0],
        count: String(Math.max(0, total - 1)),
      });
    }
    return t('feed.reactedCount', { count: String(total) });
  }, [total, myReaction, topReactors, t]);

  if (total <= 0 || !text) return null;

  return (
    <Pressable
      onPress={onOpen}
      disabled={!onOpen}
      accessibilityRole={onOpen ? 'button' : undefined}
      style={styles.row}
    >
      <View style={styles.stack}>
        {emojiStack.map((emoji, i) => (
          <View
            key={`${emoji}-${i}`}
            style={[
              styles.emojiWrap,
              { zIndex: 3 - i, marginStart: i === 0 ? 0 : -6, borderColor: 'rgba(167,139,250,0.28)' },
            ]}
          >
            <Text style={styles.emoji}>{emoji}</Text>
          </View>
        ))}
      </View>
      <Text style={[styles.text, { color: colors.textSecondary }]} numberOfLines={2}>
        {text}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    width: '100%',
    marginBottom: 8,
    paddingVertical: 2,
  },
  stack: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  emojiWrap: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(20, 16, 42, 0.9)',
    borderWidth: 1.5,
  },
  emoji: {
    fontSize: 11,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 17,
  },
});
