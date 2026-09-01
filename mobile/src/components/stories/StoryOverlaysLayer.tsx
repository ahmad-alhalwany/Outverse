import React, { useEffect, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  formatCountdownLong,
  overlayFontSize,
  type StoryOverlay,
  type StoryStroke,
} from '@/lib/storyStudio';

export type PollResults = Record<
  string,
  { counts: Record<string, number>; total: number; my_vote: number | null }
>;

type Props = {
  overlays: StoryOverlay[];
  drawing: StoryStroke[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onMove?: (id: string, x: number, y: number) => void;
  draggable?: boolean;
  interactive?: boolean;
  isOwner?: boolean;
  pollResults?: PollResults;
  questionResponseCounts?: Record<string, number>;
  onVote?: (overlayId: string, optionIndex: number) => void;
  onSubmitAnswer?: (overlayId: string, text: string) => void;
  onOpenResponses?: (overlayId: string) => void;
  onMentionPress?: (username: string) => void;
  stageW: number;
  stageH: number;
};

function PollCard({
  question,
  options,
  overlayId,
  interactive,
  isOwner,
  results,
  onVote,
}: {
  question: string;
  options: [string, string];
  overlayId: string;
  interactive?: boolean;
  isOwner?: boolean;
  results?: PollResults[string];
  onVote?: (overlayId: string, optionIndex: number) => void;
}) {
  const { t } = useLocale();
  const total = results?.total ?? 0;
  const myVote = results?.my_vote ?? null;
  const showResults = interactive && (isOwner || myVote !== null);
  const votesLabel =
    total === 1 ? t('stories.pollVotes', { count: total }) : t('stories.pollVotesPlural', { count: total });

  return (
    <View style={styles.pollCard}>
      <Text style={styles.pollQ}>{question}</Text>
      {options.map((label, i) => {
        const count = results?.counts?.[String(i)] ?? 0;
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const isMine = myVote === i;
        if (showResults) {
          return (
            <View key={i} style={[styles.pollResult, isMine && styles.pollResultMine]}>
              <View style={[styles.pollFill, { width: `${pct}%` }]} />
              <Text style={styles.pollResultLabel}>{label}</Text>
              <Text style={styles.pollPct}>{pct}%</Text>
            </View>
          );
        }
        return (
          <Pressable
            key={i}
            disabled={!interactive}
            onPress={() => onVote?.(overlayId, i)}
            style={styles.pollOpt}
          >
            <Text style={styles.pollOptText}>{label}</Text>
          </Pressable>
        );
      })}
      {showResults ? <Text style={styles.pollTotal}>{votesLabel}</Text> : null}
    </View>
  );
}

function QuestionCard({
  prompt,
  overlayId,
  interactive,
  isOwner,
  responseCount,
  onSubmitAnswer,
  onOpenResponses,
}: {
  prompt: string;
  overlayId: string;
  interactive?: boolean;
  isOwner?: boolean;
  responseCount?: number;
  onSubmitAnswer?: (overlayId: string, text: string) => void;
  onOpenResponses?: (overlayId: string) => void;
}) {
  const { t } = useLocale();
  const [answer, setAnswer] = useState('');
  const [sent, setSent] = useState(false);
  const count = responseCount ?? 0;
  const answersLabel =
    count === 1 ? t('stories.questionAnswers', { count }) : t('stories.questionAnswersPlural', { count });

  return (
    <View style={styles.qCard}>
      <Text style={styles.qPrompt}>{prompt}</Text>
      {!interactive ? null : isOwner ? (
        <Pressable style={styles.qResponses} onPress={() => onOpenResponses?.(overlayId)}>
          <Ionicons name="chatbubble-ellipses" size={14} color="#E9D5FF" />
          <Text style={styles.qResponsesText}>{answersLabel}</Text>
        </Pressable>
      ) : sent ? (
        <Text style={styles.qSent}>{t('stories.answerSent')}</Text>
      ) : (
        <View style={styles.qRow}>
          <TextInput
            value={answer}
            onChangeText={setAnswer}
            placeholder={t('stories.answerPlaceholder')}
            placeholderTextColor="rgba(245,243,255,0.45)"
            style={styles.qInput}
            maxLength={200}
          />
          <Pressable
            disabled={!answer.trim()}
            onPress={() => {
              if (!answer.trim()) return;
              onSubmitAnswer?.(overlayId, answer.trim());
              setSent(true);
            }}
            style={styles.qSend}
          >
            <Ionicons name="send" size={14} color="#fff" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function CountdownBadge({ label, targetAt }: { label: string; targetAt: string }) {
  const { t } = useLocale();
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, (new Date(targetAt).getTime() - Date.now()) / 1000),
  );

  useEffect(() => {
    const id = setInterval(() => {
      setRemaining(Math.max(0, (new Date(targetAt).getTime() - Date.now()) / 1000));
    }, 1000);
    return () => clearInterval(id);
  }, [targetAt]);

  return (
    <View style={styles.countCard}>
      <Text style={styles.countLabel}>{label}</Text>
      <Text style={styles.countValue}>
        {remaining <= 0 ? t('stories.timesUp') : formatCountdownLong(remaining)}
      </Text>
    </View>
  );
}

function OverlayItem({
  el,
  selected,
  draggable,
  interactive,
  isOwner,
  pollResults,
  questionResponseCounts,
  onSelect,
  onMove,
  onVote,
  onSubmitAnswer,
  onOpenResponses,
  onMentionPress,
  stageW,
  stageH,
}: {
  el: StoryOverlay;
  selected: boolean;
  draggable?: boolean;
  interactive?: boolean;
  isOwner?: boolean;
  pollResults?: PollResults;
  questionResponseCounts?: Record<string, number>;
  onSelect?: (id: string) => void;
  onMove?: (id: string, x: number, y: number) => void;
  onVote?: (overlayId: string, optionIndex: number) => void;
  onSubmitAnswer?: (overlayId: string, text: string) => void;
  onOpenResponses?: (overlayId: string) => void;
  onMentionPress?: (username: string) => void;
  stageW: number;
  stageH: number;
}) {
  const [size, setSize] = useState({ w: 80, h: 40 });
  const origin = useRef({ x: el.x, y: el.y });
  origin.current = { x: el.x, y: el.y };

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !!draggable,
      onPanResponderGrant: () => {
        origin.current = { x: el.x, y: el.y };
        onSelect?.(el.id);
      },
      onPanResponderMove: (_, g) => {
        if (!onMove || !stageW || !stageH) return;
        const nx = Math.max(4, Math.min(96, origin.current.x + (g.dx / stageW) * 100));
        const ny = Math.max(4, Math.min(96, origin.current.y + (g.dy / stageH) * 100));
        onMove(el.id, nx, ny);
      },
    }),
  ).current;

  const interactiveCard = el.type === 'poll' || el.type === 'question' || el.type === 'mention';

  return (
    <View
      {...(draggable ? pan.panHandlers : {})}
      pointerEvents={interactive || draggable ? 'box-none' : 'none'}
      onLayout={(e) => setSize({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
      style={[
        styles.overlay,
        {
          left: `${el.x}%`,
          top: `${el.y}%`,
          transform: [{ translateX: -size.w / 2 }, { translateY: -size.h / 2 }],
          outlineColor: selected ? 'rgba(255,255,255,0.75)' : 'transparent',
          zIndex: interactiveCard ? 20 : 4,
        },
        selected && styles.overlaySelected,
      ]}
    >
      {el.type === 'text' ? (
        <Text
          style={{
            color: el.color,
            fontSize: overlayFontSize(el.fontSize),
            fontWeight: String(el.fontWeight) as any,
            textAlign: el.align || 'center',
            textShadowColor: 'rgba(0,0,0,0.45)',
            textShadowRadius: 8,
            maxWidth: stageW * 0.82,
          }}
        >
          {el.text}
        </Text>
      ) : el.type === 'sticker' ? (
        <Text style={{ fontSize: 40 * (el.scale || 1), lineHeight: 46 * (el.scale || 1) }}>{el.emoji}</Text>
      ) : el.type === 'poll' ? (
        <PollCard
          question={el.question}
          options={el.options}
          overlayId={el.id}
          interactive={interactive}
          isOwner={isOwner}
          results={pollResults?.[el.id]}
          onVote={onVote}
        />
      ) : el.type === 'question' ? (
        <QuestionCard
          prompt={el.prompt}
          overlayId={el.id}
          interactive={interactive}
          isOwner={isOwner}
          responseCount={questionResponseCounts?.[el.id]}
          onSubmitAnswer={onSubmitAnswer}
          onOpenResponses={onOpenResponses}
        />
      ) : el.type === 'location' ? (
        <View style={styles.locBadge}>
          <Ionicons name="location" size={13} color="#F5F3FF" />
          <Text style={styles.locText}>{el.label}</Text>
        </View>
      ) : el.type === 'mention' ? (
        <Pressable onPress={() => onMentionPress?.(el.username)} disabled={!interactive}>
          <Text style={styles.mention}>@{el.username}</Text>
        </Pressable>
      ) : (
        <CountdownBadge label={el.label} targetAt={el.targetAt} />
      )}
    </View>
  );
}

export default function StoryOverlaysLayer({
  overlays,
  drawing,
  selectedId,
  onSelect,
  onMove,
  draggable,
  interactive,
  isOwner,
  pollResults,
  questionResponseCounts,
  onVote,
  onSubmitAnswer,
  onOpenResponses,
  onMentionPress,
  stageW,
  stageH,
}: Props) {
  return (
    <View pointerEvents="box-none" style={[StyleSheet.absoluteFill, { zIndex: 10 }]}>
      {drawing.length > 0 ? (
        <Svg width={stageW} height={stageH} style={StyleSheet.absoluteFill} pointerEvents="none">
          {drawing.map((stroke, i) => (
            <Polyline
              key={i}
              points={stroke.points.map(([x, y]) => `${(x / 100) * stageW},${(y / 100) * stageH}`).join(' ')}
              fill="none"
              stroke={stroke.color}
              strokeWidth={stroke.width}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
      ) : null}
      {overlays.map((el) => (
        <OverlayItem
          key={el.id}
          el={el}
          selected={selectedId === el.id}
          draggable={draggable}
          interactive={interactive}
          isOwner={isOwner}
          pollResults={pollResults}
          questionResponseCounts={questionResponseCounts}
          onSelect={onSelect}
          onMove={onMove}
          onVote={onVote}
          onSubmitAnswer={onSubmitAnswer}
          onOpenResponses={onOpenResponses}
          onMentionPress={onMentionPress}
          stageW={stageW}
          stageH={stageH}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
  },
  overlaySelected: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.7)',
    borderStyle: 'dashed',
    borderRadius: 10,
    padding: 4,
  },
  pollCard: {
    width: 220,
    backgroundColor: 'rgba(20,16,42,0.88)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.4)',
  },
  pollQ: { color: '#fff', fontWeight: '800', marginBottom: 8, fontSize: 14 },
  pollOpt: {
    backgroundColor: 'rgba(124,58,237,0.4)',
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    marginTop: 6,
  },
  pollOptText: { color: '#F5F3FF', fontWeight: '700', fontSize: 13 },
  pollResult: {
    marginTop: 6,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  pollResultMine: { borderWidth: 1, borderColor: '#A78BFA' },
  pollFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: 'rgba(124,58,237,0.45)',
  },
  pollResultLabel: { color: '#fff', fontWeight: '700', flex: 1, fontSize: 13 },
  pollPct: { color: '#E9D5FF', fontWeight: '800', fontSize: 12 },
  pollTotal: { color: 'rgba(245,243,255,0.65)', fontSize: 11, marginTop: 6 },
  qCard: {
    width: 230,
    backgroundColor: 'rgba(20,16,42,0.88)',
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(34,211,238,0.35)',
  },
  qPrompt: { color: '#fff', fontWeight: '800', fontSize: 14, marginBottom: 8 },
  qResponses: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qResponsesText: { color: '#E9D5FF', fontWeight: '700', fontSize: 12 },
  qSent: { color: '#4ADE80', fontWeight: '700', fontSize: 12 },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    color: '#fff',
    fontSize: 13,
  },
  qSend: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  locBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15,10,31,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.35)',
  },
  locText: { color: '#F5F3FF', fontWeight: '700', fontSize: 12 },
  mention: {
    color: '#67E8F9',
    fontWeight: '800',
    fontSize: 16,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowRadius: 6,
  },
  countCard: {
    backgroundColor: 'rgba(20,16,42,0.88)',
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.4)',
    alignItems: 'center',
  },
  countLabel: { color: '#F5F3FF', fontWeight: '700', fontSize: 12 },
  countValue: { color: '#FBBF24', fontWeight: '800', fontSize: 16, marginTop: 2 },
});
