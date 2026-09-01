import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Video from 'react-native-video';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import Avatar from './Avatar';
import PostReactions from './PostReactions';
import StoryOverlaysLayer from './stories/StoryOverlaysLayer';
import { mediaUrl } from '../api/config';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useLocale } from '@/i18n/LocaleProvider';
import { openProfile } from '@/lib/nav';
import {
  backgroundColors,
  filterTint,
  formatCountdown,
  moodAuraColor,
  normalizeStrokes,
  type StoryOverlay,
} from '@/lib/storyStudio';
import type { ReactionType } from '@/lib/reactions';
import type { Story } from '../types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface StoryViewerProps {
  visible: boolean;
  stories: Story[];
  startIndex: number;
  onClose: () => void;
  onViewStory?: (storyId: string | number) => void;
}

function asOverlays(raw?: unknown[]): StoryOverlay[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((o): o is StoryOverlay => !!o && typeof o === 'object' && 'type' in (o as object));
}

export default function StoryViewer({
  visible,
  stories,
  startIndex,
  onClose,
  onViewStory,
}: StoryViewerProps) {
  const { t } = useLocale();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replySent, setReplySent] = useState(false);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [viewers, setViewers] = useState<Array<{ viewer?: { id: number; username: string; avatar?: string | null } }>>([]);
  const [answersOpen, setAnswersOpen] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Array<{ id: number; text: string; responder?: { username?: string } }>>([]);
  const [myReaction, setMyReaction] = useState<string | null>(null);
  const [reactionCounts, setReactionCounts] = useState<Record<string, number>>({});
  const [pollResults, setPollResults] = useState<Story['poll_results']>({});
  const [qCounts, setQCounts] = useState<Record<string, number>>({});
  const [lockLeft, setLockLeft] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoRef = useRef<any>(null);

  const currentStory = stories[currentIndex];
  const ownerId = currentStory?.user?.id ?? currentStory?.author?.id ?? currentStory?.user_id;
  const isOwner = !!user && String(user.id) === String(ownerId);
  const overlays = asOverlays(currentStory?.overlays);
  const drawing = normalizeStrokes(currentStory?.drawing);
  const hasDesign = overlays.length > 0 || drawing.length > 0;
  const mediaUri = mediaUrl(currentStory?.media || currentStory?.image || currentStory?.video || '');
  const isVideo = Boolean(currentStory?.video) || currentStory?.media_type === 'video';
  const isLocked = !!currentStory?.is_locked;
  const displayName = currentStory?.user?.username || currentStory?.author?.username || 'User';
  const durationMs = isVideo ? 30000 : 15000;

  useEffect(() => {
    if (visible) {
      setCurrentIndex(startIndex);
      setProgress(0);
      setPaused(false);
    }
  }, [visible, startIndex]);

  useEffect(() => {
    if (!visible || !currentStory) return;
    onViewStory?.(currentStory.id);
    setProgress(0);
    setPaused(false);
    setReplyText('');
    setReplySent(false);
    setViewersOpen(false);
    setAnswersOpen(null);
    setMyReaction(currentStory.my_reaction ?? null);
    setReactionCounts(currentStory.reaction_counts || {});
    setPollResults(currentStory.poll_results || {});
    setQCounts(currentStory.question_response_counts || {});
    setLockLeft(currentStory.unlocks_in ?? 0);
  }, [visible, currentIndex, currentStory?.id]);

  useEffect(() => {
    if (!visible || !currentStory || isLocked || isVideo || paused) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      setProgress((p) => {
        const next = p + 100 / (durationMs / 50);
        if (next >= 100) {
          if (currentIndex < stories.length - 1) setCurrentIndex((i) => i + 1);
          else onClose();
          return 0;
        }
        return next;
      });
    }, 50);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [visible, currentIndex, currentStory, stories.length, onClose, paused, isLocked, isVideo, durationMs]);

  useEffect(() => {
    if (!isLocked) return;
    const id = setInterval(() => setLockLeft((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [isLocked, currentStory?.id]);

  const goPrev = () => {
    if (currentIndex > 0) setCurrentIndex((i) => i - 1);
  };
  const goNext = () => {
    if (currentIndex < stories.length - 1) setCurrentIndex((i) => i + 1);
    else onClose();
  };

  const handleReact = useCallback(
    async (type: ReactionType) => {
      if (!currentStory) return;
      const next = myReaction === type ? null : type;
      setMyReaction(next);
      try {
        const res = await api.reactStory(currentStory.id, next);
        setReactionCounts(res.reaction_counts || {});
        setMyReaction(res.my_reaction);
      } catch {
        /* keep optimistic */
      }
    },
    [currentStory, myReaction],
  );

  const handleReply = async () => {
    if (!currentStory || !replyText.trim()) return;
    try {
      await api.replyToStory(currentStory.id, replyText.trim());
      setReplyText('');
      setReplySent(true);
    } catch {
      /* ignore */
    }
  };

  const openViewers = async () => {
    if (!currentStory || !isOwner) return;
    setViewersOpen((v) => !v);
    if (!viewersOpen) {
      try {
        setViewers(await api.getStoryViewers(currentStory.id));
      } catch {
        setViewers([]);
      }
    }
  };

  if (!currentStory) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <StatusBar barStyle="light-content" />

        <View style={styles.progressBars}>
          {stories.map((_, i) => (
            <View key={i} style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${i < currentIndex ? 100 : i === currentIndex ? progress : 0}%` },
                ]}
              />
            </View>
          ))}
        </View>

        <View style={styles.header}>
          <Avatar user={currentStory.user || currentStory.author} size="sm" />
          <Text style={styles.username}>{displayName}</Text>
          <Text style={styles.time}>{formatTime(currentStory.created_at)}</Text>
          {isOwner ? (
            <Pressable onPress={() => void openViewers()} style={styles.viewersBtn}>
              <Ionicons name="eye-outline" size={14} color="#E9D5FF" />
              <Text style={styles.viewersText}>{currentStory.viewer_count ?? currentStory.views ?? 0}</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeText}>✕</Text>
          </Pressable>
        </View>

        {viewersOpen && isOwner ? (
          <View style={styles.viewersPanel}>
            <Text style={styles.panelTitle}>{t('stories.viewers')}</Text>
            {viewers.length === 0 ? (
              <Text style={styles.muted}>{t('stories.noViews')}</Text>
            ) : (
              <ScrollView style={{ maxHeight: 140 }}>
                {viewers.map((row, i) => (
                  <Text key={row.viewer?.id ?? i} style={styles.viewerName}>
                    @{row.viewer?.username}
                  </Text>
                ))}
              </ScrollView>
            )}
          </View>
        ) : null}

        <View style={styles.body}>
          {!isLocked && currentStory.mood ? (
            <View pointerEvents="none" style={[styles.moodAura, { backgroundColor: moodAuraColor(currentStory.mood) }]} />
          ) : null}

          {isLocked ? (
            <View style={styles.locked}>
              <Ionicons name="lock-closed" size={36} color="#A78BFA" />
              <Text style={styles.lockedTitle}>{t('stories.capsuleTitle')}</Text>
              <Text style={styles.lockedSub}>
                {isOwner ? t('stories.capsuleOwner') : t('stories.capsuleOther', { name: displayName })}
              </Text>
              <Text style={styles.lockedCount}>{t('stories.opensIn', { time: formatCountdown(lockLeft) })}</Text>
            </View>
          ) : mediaUri && !isVideo ? (
            <>
              <Image source={{ uri: mediaUri }} style={styles.media} resizeMode="cover" />
              {currentStory.filter_style && currentStory.filter_style !== 'none' ? (
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: filterTint(currentStory.filter_style) }]} />
              ) : null}
            </>
          ) : mediaUri && isVideo ? (
            <Video
              ref={videoRef}
              source={{ uri: mediaUri }}
              style={styles.media}
              resizeMode="cover"
              repeat={false}
              paused={paused}
              controls={false}
              onEnd={goNext}
              onProgress={(e: { currentTime: number; playableDuration?: number; seekableDuration?: number }) => {
                const dur = e.seekableDuration || 30;
                setProgress(Math.min(100, (e.currentTime / Math.min(dur, 30)) * 100));
              }}
            />
          ) : (
            <LinearGradient colors={backgroundColors(currentStory.background_style)} style={styles.media}>
              {!hasDesign && currentStory.text ? <Text style={styles.placeholderText}>{currentStory.text}</Text> : null}
            </LinearGradient>
          )}

          {!isLocked && hasDesign ? (
            <StoryOverlaysLayer
              overlays={overlays}
              drawing={drawing}
              interactive
              isOwner={isOwner}
              pollResults={pollResults}
              questionResponseCounts={qCounts}
              onVote={async (overlayId, optionIndex) => {
                try {
                  const res = await api.voteStoryPoll(currentStory.id, overlayId, optionIndex);
                  setPollResults((prev) => ({ ...prev, [overlayId]: res }));
                } catch {
                  /* ignore */
                }
              }}
              onSubmitAnswer={async (overlayId, text) => {
                try {
                  await api.answerStoryQuestion(currentStory.id, overlayId, text);
                  setQCounts((prev) => ({ ...prev, [overlayId]: (prev[overlayId] || 0) + 1 }));
                } catch {
                  /* ignore */
                }
              }}
              onOpenResponses={async (overlayId) => {
                setAnswersOpen(overlayId);
                try {
                  setAnswers(await api.getStoryQuestionResponses(currentStory.id, overlayId));
                } catch {
                  setAnswers([]);
                }
              }}
              onMentionPress={(username) => {
                onClose();
                openProfile(navigation, username, user?.username);
              }}
              stageW={SCREEN_WIDTH}
              stageH={SCREEN_HEIGHT - 180}
            />
          ) : null}

          {currentStory.text && mediaUri && !hasDesign && !isLocked ? (
            <View style={styles.caption}>
              <Text style={styles.captionText}>{currentStory.text}</Text>
            </View>
          ) : null}

          {answersOpen ? (
            <View style={styles.answersPanel}>
              <View style={styles.answersHead}>
                <Text style={styles.panelTitle}>{t('stories.answersTitle')}</Text>
                <Pressable onPress={() => setAnswersOpen(null)}>
                  <Ionicons name="close" size={18} color="#E9D5FF" />
                </Pressable>
              </View>
              {answers.length === 0 ? (
                <Text style={styles.muted}>{t('stories.answersEmpty')}</Text>
              ) : (
                answers.map((a) => (
                  <View key={a.id} style={{ marginBottom: 8 }}>
                    <Text style={styles.viewerName}>@{a.responder?.username}</Text>
                    <Text style={styles.answerText}>{a.text}</Text>
                  </View>
                ))
              )}
            </View>
          ) : null}

          <View style={styles.tapZones} pointerEvents="box-none">
            <Pressable style={styles.tapLeft} onPress={goPrev} />
            <Pressable style={styles.tapCenter} onPress={() => setPaused((p) => !p)} />
            <Pressable style={styles.tapRight} onPress={goNext} />
          </View>

          {paused ? (
            <View style={styles.pauseBadge} pointerEvents="none">
              <Ionicons name="pause" size={36} color="#fff" />
              <Text style={styles.pauseText}>{t('stories.paused')}</Text>
            </View>
          ) : null}
        </View>

        {!isOwner && !isLocked ? (
          <View style={styles.footer}>
            <PostReactions
              compact
              selectedReaction={myReaction}
              reactionCounts={reactionCounts}
              onReact={handleReact}
            />
            <View style={styles.replyRow}>
              <TextInput
                value={replyText}
                onChangeText={setReplyText}
                onFocus={() => setPaused(true)}
                placeholder={t('stories.replyTo', { name: displayName })}
                placeholderTextColor="rgba(245,243,255,0.45)"
                style={styles.replyInput}
                onSubmitEditing={() => void handleReply()}
              />
              <Pressable disabled={!replyText.trim()} onPress={() => void handleReply()} style={styles.replySend}>
                <Ionicons name="send" size={16} color="#fff" />
              </Pressable>
            </View>
            {replySent ? <Text style={styles.sent}>{t('stories.replySent')}</Text> : null}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  return `${Math.floor(mins / 60)}h`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0c0818' },
  progressBars: {
    flexDirection: 'row',
    paddingTop: 50,
    paddingHorizontal: 8,
    gap: 4,
  },
  progressTrack: {
    flex: 1,
    height: 3,
    backgroundColor: 'rgba(167,139,250,0.25)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#A78BFA' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 10,
    zIndex: 8,
  },
  username: { color: '#F5F3FF', fontSize: 14, fontWeight: '700', marginLeft: 10 },
  time: { color: 'rgba(245,243,255,0.65)', fontSize: 12, marginLeft: 8 },
  viewersBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 10 },
  viewersText: { color: '#E9D5FF', fontSize: 12, fontWeight: '700' },
  closeBtn: {
    marginLeft: 'auto',
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(124,58,237,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  viewersPanel: {
    marginHorizontal: 12,
    marginTop: 8,
    backgroundColor: 'rgba(20,16,42,0.92)',
    borderRadius: 12,
    padding: 10,
    zIndex: 12,
  },
  panelTitle: { color: '#F5F3FF', fontWeight: '800', marginBottom: 6 },
  muted: { color: 'rgba(245,243,255,0.55)', fontSize: 12 },
  viewerName: { color: '#E9D5FF', fontSize: 13, paddingVertical: 3 },
  body: { flex: 1, position: 'relative' },
  media: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  moodAura: { position: 'absolute', top: 0, left: 0, right: 0, height: 180, zIndex: 1 },
  placeholderText: { color: '#fff', fontSize: 22, fontWeight: '800', textAlign: 'center', padding: 28, marginTop: 120 },
  caption: {
    position: 'absolute',
    bottom: 90,
    left: 16,
    right: 16,
    backgroundColor: 'rgba(12,8,24,0.45)',
    borderRadius: 12,
    padding: 10,
  },
  captionText: { color: '#fff', fontWeight: '700' },
  answersPanel: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 20,
    backgroundColor: 'rgba(20,16,42,0.95)',
    borderRadius: 14,
    padding: 12,
    zIndex: 30,
  },
  answersHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  answerText: { color: '#F5F3FF', fontSize: 13 },
  tapZones: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    zIndex: 6,
  },
  tapLeft: { width: '30%', height: '100%' },
  tapCenter: { width: '40%', height: '100%' },
  tapRight: { flex: 1, height: '100%' },
  pauseBadge: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 7,
  },
  pauseText: { color: '#fff', fontWeight: '800', marginTop: 6 },
  locked: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },
  lockedTitle: { color: '#F5F3FF', fontSize: 22, fontWeight: '800' },
  lockedSub: { color: '#B0A6D9', textAlign: 'center' },
  lockedCount: { color: '#A78BFA', fontWeight: '800', marginTop: 8 },
  footer: {
    paddingHorizontal: 12,
    paddingBottom: 18,
    paddingTop: 8,
    gap: 8,
    zIndex: 20,
    backgroundColor: 'rgba(12,8,24,0.65)',
  },
  replyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  replyInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: '#fff',
  },
  replySend: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#7C3AED',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sent: { color: '#4ADE80', fontSize: 12, fontWeight: '700' },
});
