'use client';

import { useMemo } from 'react';
import { useLocale } from './LocaleProvider';
import {
  COSMIC_REACTIONS,
  EMOJI_BY_REACTION_TYPE,
  type ReactionType,
} from '@/lib/reactions';

export type TopReactor = {
  id: number;
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
  className?: string;
};

function reactorLabel(r: TopReactor) {
  return (r.name || r.username || '').trim();
}

/** Facebook-style social proof: "You, Sara and 12 others" */
export default function ReactionSummaryLine({
  total,
  myReaction,
  reactionCounts = {},
  topReactors = [],
  onOpen,
  className = '',
}: Props) {
  const { t } = useLocale();

  const emojiStack = useMemo(() => {
    const entries = Object.entries(reactionCounts)
      .filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    if (entries.length === 0 && myReaction) {
      return [myReaction];
    }
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
    <button
      type="button"
      className={`reaction-summary-line ${className}`.trim()}
      onClick={onOpen}
      disabled={!onOpen}
    >
      <span className="reaction-summary-line__stack" aria-hidden>
        {emojiStack.map((emoji, i) => (
          <span key={`${emoji}-${i}`} className="reaction-summary-line__emoji" style={{ zIndex: 3 - i }}>
            {emoji}
          </span>
        ))}
      </span>
      <span className="reaction-summary-line__text">{text}</span>
    </button>
  );
}
