import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  Image,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Pressable,
  Modal,
  TextInput,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { displayName as personName } from '@/lib/names';
import { openProfile } from '@/lib/nav';
import { formatCount } from '@/lib/profileEmotions';
import type { Reel } from '@/types';

export type LabPalette = {
  cream: string;
  card: string;
  card2: string;
  white: string;
  brown: string;
  brownDk: string;
  text: string;
  text2: string;
  line: string;
};

export type TFn = (key: string, vars?: Record<string, string | number>) => string;

export type SocialStatus = {
  is_blocked?: boolean;
  blocked_by_them?: boolean;
  is_muted?: boolean;
  is_restricted?: boolean;
};

export type IdeaRow = {
  id: string | number;
  title?: string;
  category?: string;
  cover_url?: string;
  supporters?: number;
  funding_goal?: number | null;
  funding_raised?: number;
};

export type CreatorTier = {
  id: string | number;
  name: string;
  description?: string;
  price_usd?: number;
  price_usd_cents?: number;
};

export type FollowUser = {
  id: number;
  username: string;
  first_name?: string;
  last_name?: string;
  avatar?: string | null;
};

const BAZAAR_CATEGORIES: Record<string, { en: string; ar: string }> = {
  technology: { en: 'Technology', ar: 'تقنية' },
  design: { en: 'Design', ar: 'تصميم' },
  writing: { en: 'Writing', ar: 'كتابة' },
  art: { en: 'Art', ar: 'فن' },
  education: { en: 'Education', ar: 'تعليم' },
  environment: { en: 'Environment', ar: 'بيئة' },
  health: { en: 'Health', ar: 'صحة' },
  social: { en: 'Social Impact', ar: 'أثر اجتماعي' },
};

const REPORT_REASONS = [
  { value: 'spam', labelKey: 'social.reportReasonSpam' },
  { value: 'harassment', labelKey: 'social.reportReasonHarassment' },
  { value: 'impersonation', labelKey: 'social.reportReasonImpersonation' },
  { value: 'hate', labelKey: 'social.reportReasonHate' },
  { value: 'other', labelKey: 'social.reportReasonOther' },
] as const;

export function EmptyTab({ emoji, text, color }: { emoji: string; text: string; color: string }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 40 }}>
      <Text style={{ fontSize: 28, marginBottom: 8 }}>{emoji}</Text>
      <Text style={{ color, fontSize: 13, textAlign: 'center' }}>{text}</Text>
    </View>
  );
}

export function ReelsGrid({
  C,
  t,
  reels,
  empty,
  onOpen,
  onCreate,
}: {
  C: LabPalette;
  t: TFn;
  reels: Reel[];
  empty: string;
  onOpen: (id: string | number) => void;
  onCreate?: () => void;
}) {
  if (reels.length === 0) {
    return (
      <View style={{ alignItems: 'center', paddingVertical: 36 }}>
        <Ionicons name="play-circle-outline" size={40} color={C.brown} />
        <Text style={{ color: C.text2, marginTop: 10, fontSize: 13 }}>{empty}</Text>
        {onCreate ? (
          <Pressable onPress={onCreate} style={{ marginTop: 10 }}>
            <Text style={{ color: C.brown, fontWeight: '700' }}>{t('reels.launchSignalLink')}</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }
  return (
    <View style={styles.grid2}>
      {reels.map((reel) => (
        <Pressable
          key={String(reel.id)}
          onPress={() => onOpen(reel.id)}
          style={[styles.card, { backgroundColor: C.white, borderColor: C.line }]}
        >
          <View style={[styles.thumb, { backgroundColor: '#0f0a1f' }]}>
            {reel.video_url || reel.video ? (
              <Image source={{ uri: mediaUrl(reel.video_url || reel.video) }} style={StyleSheet.absoluteFill} />
            ) : null}
            <View style={styles.playBadge}>
              <Ionicons name="play" size={14} color="#fff" />
            </View>
            <Text style={styles.viewsBadge}>▶ {formatCount(reel.views || 0)}</Text>
          </View>
          <Text style={{ color: C.text, fontSize: 12, fontWeight: '700', padding: 8 }} numberOfLines={1}>
            {(reel.caption || t('reels.singleTitle')).slice(0, 42)}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export function IdeasGrid({
  C,
  t,
  locale,
  ideas,
  isOwn,
  scope,
  onScope,
  onOpen,
  onCreate,
}: {
  C: LabPalette;
  t: TFn;
  locale: string;
  ideas: IdeaRow[];
  isOwn: boolean;
  scope: 'owned' | 'collaborating' | 'supporting';
  onScope: (s: 'owned' | 'collaborating' | 'supporting') => void;
  onOpen: (id: string | number) => void;
  onCreate: () => void;
}) {
  return (
    <View>
      {isOwn ? (
        <View style={[styles.scopeRow, { backgroundColor: C.card2, borderColor: C.line }]}>
          {(['owned', 'collaborating', 'supporting'] as const).map((key) => (
            <Pressable
              key={key}
              onPress={() => onScope(key)}
              style={[styles.scopeBtn, { backgroundColor: scope === key ? C.white : 'transparent' }]}
            >
              <Text style={{ color: scope === key ? C.brown : C.text2, fontWeight: '700', fontSize: 11 }}>
                {t(
                  key === 'owned'
                    ? 'bazaar.profileScopeOwned'
                    : key === 'collaborating'
                      ? 'bazaar.profileScopeCollaborating'
                      : 'bazaar.profileScopeSupporting',
                )}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      {ideas.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 36 }}>
          <Ionicons name="bulb-outline" size={36} color={C.brown} />
          <Text style={{ color: C.text2, marginTop: 10, fontSize: 13 }}>
            {isOwn && scope !== 'owned' ? t('bazaar.profileEmptyScoped') : t('bazaar.profileEmptyBazaar')}
          </Text>
          {isOwn && scope === 'owned' ? (
            <Pressable onPress={onCreate} style={[styles.cta, { backgroundColor: C.brownDk, marginTop: 12 }]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{t('bazaar.createIdea')}</Text>
            </Pressable>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {ideas.map((idea) => {
            const cat = BAZAAR_CATEGORIES[idea.category || '']?.[locale === 'ar' ? 'ar' : 'en'] || idea.category;
            return (
              <Pressable
                key={String(idea.id)}
                onPress={() => onOpen(idea.id)}
                style={[styles.listCard, { backgroundColor: C.white, borderColor: C.line, padding: 0, overflow: 'hidden' }]}
              >
                {idea.cover_url ? (
                  <Image source={{ uri: mediaUrl(idea.cover_url) }} style={{ height: 96, width: '100%' }} />
                ) : (
                  <LinearGradient colors={[C.card, C.card2]} style={{ height: 96 }} />
                )}
                <View style={{ padding: 12 }}>
                  {cat ? (
                    <View style={[styles.pill, { backgroundColor: C.card2, alignSelf: 'flex-start', marginBottom: 8 }]}>
                      <Text style={{ color: C.brown, fontSize: 10, fontWeight: '600' }}>{cat}</Text>
                    </View>
                  ) : null}
                  <Text style={{ color: C.text, fontWeight: '700' }}>{idea.title}</Text>
                  <Text style={{ color: C.text2, fontSize: 12, marginTop: 6 }}>
                    ♥ {formatCount(idea.supporters || 0)}
                    {idea.funding_goal
                      ? ` · ${formatCount(idea.funding_raised || 0)} / ${formatCount(idea.funding_goal)} ${t('bazaar.coins')}`
                      : ''}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );
}

export function FollowListModal({
  C,
  t,
  userId,
  mode,
  title,
  myUsername,
  navigation,
  onClose,
}: {
  C: LabPalette;
  t: TFn;
  userId: string | number;
  mode: 'followers' | 'following';
  title: string;
  myUsername?: string;
  navigation: any;
  onClose: () => void;
}) {
  const [list, setList] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const rows = mode === 'followers' ? await api.getFollowers(userId) : await api.getFollowing(userId);
      setList(Array.isArray(rows) ? (rows as FollowUser[]) : []);
    } catch {
      setList([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [mode, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={() => {}} style={[styles.sheet, { backgroundColor: C.cream, borderColor: C.line }]}>
          <View style={[styles.sheetHead, { borderBottomColor: C.line }]}>
            <Text style={{ color: C.text, fontWeight: '800', fontSize: 16 }}>{title}</Text>
            <Pressable onPress={onClose}>
              <Text style={{ color: C.text, fontSize: 20 }}>×</Text>
            </Pressable>
          </View>
          {loading ? (
            <ActivityIndicator color={C.brown} style={{ marginTop: 24 }} />
          ) : error ? (
            <View style={{ padding: 24, alignItems: 'center' }}>
              <Text style={{ color: C.text2 }}>{t('profile.followListLoadError')}</Text>
              <Pressable onPress={() => void load()} style={{ marginTop: 8 }}>
                <Text style={{ color: C.brownDk, fontWeight: '700' }}>{t('profile.followListRetry')}</Text>
              </Pressable>
            </View>
          ) : list.length === 0 ? (
            <Text style={{ color: C.text2, textAlign: 'center', marginTop: 32 }}>{t('profile.followListEmpty')}</Text>
          ) : (
            <ScrollView>
              {list.map((u) => (
                <Pressable
                  key={String(u.id)}
                  onPress={() => {
                    onClose();
                    openProfile(navigation, u.username, myUsername);
                  }}
                  style={styles.followRow}
                >
                  {u.avatar ? (
                    <Image source={{ uri: mediaUrl(u.avatar) }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, { backgroundColor: C.card, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={{ color: C.text, fontWeight: '800' }}>{(u.username || '?')[0].toUpperCase()}</Text>
                    </View>
                  )}
                  <View>
                    <Text style={{ color: C.text, fontWeight: '700' }}>{personName({ ...u, avatar: u.avatar ?? undefined }, u.username)}</Text>
                    <Text style={{ color: C.text2, fontSize: 12 }}>@{u.username}</Text>
                  </View>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function TipSheet({
  C,
  t,
  recipientId,
  onClose,
}: {
  C: LabPalette;
  t: TFn;
  recipientId: string | number;
  onClose: () => void;
}) {
  const [amount, setAmount] = useState(50);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const send = async () => {
    if (busy || amount <= 0) return;
    setBusy(true);
    setStatus('');
    try {
      const res = await api.sendTip(recipientId, amount);
      if (res?.error) setStatus(res.error);
      else {
        setStatus(t('tip.sent', { amount: String(amount) }));
        setTimeout(onClose, 1200);
      }
    } catch {
      setStatus(t('tip.error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={() => {}} style={[styles.smallSheet, { backgroundColor: C.cream, borderColor: C.line }]}>
          <Text style={{ color: C.text, fontWeight: '800', marginBottom: 10 }}>{t('tip.pickAmount')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[10, 50, 100, 500].map((amt) => (
              <Pressable
                key={amt}
                onPress={() => setAmount(amt)}
                style={[styles.pill, { backgroundColor: amount === amt ? C.brownDk : C.card2 }]}
              >
                <Text style={{ color: amount === amt ? '#fff' : C.text2, fontWeight: '700', fontSize: 12 }}>{amt} ✨</Text>
              </Pressable>
            ))}
          </View>
          <TextInput
            keyboardType="number-pad"
            value={String(amount)}
            onChangeText={(v) => setAmount(Math.max(1, parseInt(v, 10) || 0))}
            style={[styles.field, { backgroundColor: C.white, borderColor: C.line, color: C.text, marginTop: 12 }]}
          />
          {status ? <Text style={{ color: C.text2, marginTop: 8, fontSize: 12 }}>{status}</Text> : null}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
            <Pressable onPress={onClose}>
              <Text style={{ color: C.text2, fontWeight: '700' }}>{t('common.close')}</Text>
            </Pressable>
            <Pressable onPress={() => void send()} disabled={busy} style={[styles.cta, { backgroundColor: C.brownDk }]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{busy ? '…' : t('tip.send')}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function SubscribeSheet({
  C,
  t,
  tiers,
  onClose,
}: {
  C: LabPalette;
  t: TFn;
  tiers: CreatorTier[];
  onClose: () => void;
}) {
  const [busyId, setBusyId] = useState<string | number | null>(null);
  const [status, setStatus] = useState('');

  const subscribe = async (tierId: string | number) => {
    if (busyId) return;
    setBusyId(tierId);
    setStatus('');
    try {
      const res = await api.startCreatorCheckout(tierId);
      if (res.checkout_url) await Linking.openURL(res.checkout_url);
      else setStatus(t('profile.checkoutError'));
    } catch {
      setStatus(t('profile.checkoutError'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={() => {}} style={[styles.smallSheet, { backgroundColor: C.cream, borderColor: C.line }]}>
          <Text style={{ color: C.text, fontWeight: '800', marginBottom: 10 }}>{t('profile.supportThisCreator')}</Text>
          {tiers.map((tier) => (
            <View key={String(tier.id)} style={[styles.tierRow, { borderColor: C.line, backgroundColor: C.card2 }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: C.text, fontWeight: '700' }}>{tier.name}</Text>
                {tier.description ? <Text style={{ color: C.text2, fontSize: 12 }}>{tier.description}</Text> : null}
                <Text style={{ color: C.text2, fontSize: 12 }}>
                  ${Number(tier.price_usd ?? (tier.price_usd_cents || 0) / 100).toFixed(2)}
                  {t('creatorHub.perMonthShort')}
                </Text>
              </View>
              <Pressable onPress={() => void subscribe(tier.id)} style={[styles.cta, { backgroundColor: '#9C27B0' }]}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 12 }}>
                  {busyId === tier.id ? '…' : t('profile.subscribe')}
                </Text>
              </Pressable>
            </View>
          ))}
          {status ? <Text style={{ color: C.text2, marginTop: 8, fontSize: 12 }}>{status}</Text> : null}
          <Pressable onPress={onClose} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
            <Text style={{ color: C.text2, fontWeight: '700' }}>{t('common.close')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function SocialSheet({
  C,
  t,
  userId,
  username,
  social,
  onClose,
  onUpdate,
  onBlocked,
}: {
  C: LabPalette;
  t: TFn;
  userId: string | number;
  username: string;
  social?: SocialStatus;
  onClose: () => void;
  onUpdate: (social: SocialStatus) => void;
  onBlocked: () => void;
}) {
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<(typeof REPORT_REASONS)[number]['value']>('spam');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const status = social || {};

  const run = async (action: 'block' | 'mute' | 'restrict', undo: boolean) => {
    setBusy(true);
    try {
      const res = await api.setSocialAction(userId, action, undo);
      if (res?.social) {
        onUpdate(res.social);
        if (action === 'block' && !undo) onBlocked();
      }
    } finally {
      setBusy(false);
      onClose();
    }
  };

  return (
    <Modal transparent animationType="fade" visible onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable onPress={() => {}} style={[styles.smallSheet, { backgroundColor: C.cream, borderColor: C.line }]}>
          {reporting ? (
            <>
              <Text style={{ color: C.text, fontWeight: '800', marginBottom: 10 }}>
                {t('social.reportWhy', { username })}
              </Text>
              {REPORT_REASONS.map((r) => (
                <Pressable key={r.value} onPress={() => setReason(r.value)} style={styles.reportRow}>
                  <Ionicons name={reason === r.value ? 'radio-button-on' : 'radio-button-off'} size={16} color={C.brown} />
                  <Text style={{ color: C.text }}>{t(r.labelKey)}</Text>
                </Pressable>
              ))}
              <TextInput
                value={details}
                onChangeText={setDetails}
                placeholder={t('social.reportDetailsPlaceholder')}
                placeholderTextColor={C.text2}
                style={[styles.field, { backgroundColor: C.white, borderColor: C.line, color: C.text, marginTop: 8 }]}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 }}>
                <Pressable onPress={() => setReporting(false)}>
                  <Text style={{ color: C.text2, fontWeight: '700' }}>{t('social.reportCancel')}</Text>
                </Pressable>
                <Pressable
                  disabled={busy}
                  onPress={async () => {
                    setBusy(true);
                    try {
                      await api.reportUser(userId, reason, details.trim());
                    } finally {
                      setBusy(false);
                      onClose();
                    }
                  }}
                >
                  <Text style={{ color: '#EF4444', fontWeight: '800' }}>{t('social.reportSubmit')}</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Pressable onPress={() => void run('block', !!status.is_blocked)} style={styles.menuRow}>
                <Ionicons name="ban-outline" size={18} color={C.text} />
                <Text style={{ color: C.text }}>{status.is_blocked ? t('social.unblock') : t('social.block')}</Text>
              </Pressable>
              <Pressable onPress={() => void run('mute', !!status.is_muted)} style={styles.menuRow}>
                <Ionicons name="volume-mute-outline" size={18} color={C.text} />
                <Text style={{ color: C.text }}>{status.is_muted ? t('social.unmute') : t('social.mute')}</Text>
              </Pressable>
              <Pressable onPress={() => void run('restrict', !!status.is_restricted)} style={styles.menuRow}>
                <Ionicons name="eye-off-outline" size={18} color={C.text} />
                <Text style={{ color: C.text }}>{status.is_restricted ? t('social.unrestrict') : t('social.restrict')}</Text>
              </Pressable>
              <Pressable onPress={() => setReporting(true)} style={styles.menuRow}>
                <Ionicons name="flag-outline" size={18} color={C.text2} />
                <Text style={{ color: C.text2 }}>{t('social.report')}</Text>
              </Pressable>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  grid2: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', flexGrow: 1, maxWidth: '48%', borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  thumb: { width: '100%', aspectRatio: 1 },
  playBadge: {
    position: 'absolute',
    top: '40%',
    left: '42%',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewsBadge: { position: 'absolute', left: 8, bottom: 8, color: '#fff', fontSize: 11, fontWeight: '700' },
  listCard: { borderRadius: 12, borderWidth: 1, padding: 14 },
  scopeRow: { flexDirection: 'row', borderRadius: 12, borderWidth: 1, padding: 4, marginBottom: 12, gap: 4 },
  scopeBtn: { flex: 1, borderRadius: 8, paddingVertical: 8, alignItems: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', padding: 16 },
  sheet: { maxHeight: '70%', borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  sheetHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  followRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  smallSheet: { borderRadius: 16, borderWidth: 1, padding: 16 },
  field: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  pill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  cta: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10, minHeight: 40, justifyContent: 'center' },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10, marginBottom: 8 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  reportRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
});
