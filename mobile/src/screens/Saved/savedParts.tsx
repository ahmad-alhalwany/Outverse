import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { mediaUrl } from '@/api/config';
import { bazaarCategoryLabel, bazaarOwnerName, type BazaarIdea } from '@/lib/bazaar';
import { ownerLabel, type SavedFolder, type SavedItem, type SavedPalette } from '@/lib/saved';
import type { AppLocale } from '@/i18n';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function SavedIdeaCard({
  idea,
  C,
  t,
  locale,
  onOpen,
  onUnsave,
}: {
  idea: BazaarIdea;
  C: SavedPalette;
  t: TFn;
  locale: AppLocale;
  onOpen: () => void;
  onUnsave: () => void;
}) {
  const avatar = idea.owner?.avatar ? mediaUrl(idea.owner.avatar) : '';
  return (
    <View style={[styles.ideaCard, { backgroundColor: C.card, borderColor: C.border }]}>
      <View style={styles.ideaTop}>
        <Pressable onPress={onOpen} style={{ flex: 1 }}>
          <View style={styles.ideaMeta}>
            {idea.category ? (
              <View style={[styles.cat, { backgroundColor: `${C.accent}22` }]}>
                <Text style={[styles.catText, { color: C.accent }]}>
                  {bazaarCategoryLabel(idea.category, locale)}
                </Text>
              </View>
            ) : null}
            {idea.is_voted ? (
              <Text style={[styles.supported, { color: C.bazaar }]}>♥ {t('bazaar.supported')}</Text>
            ) : null}
          </View>
          <Text style={[styles.ideaTitle, { color: C.text }]} numberOfLines={2}>
            {idea.title}
          </Text>
          {idea.description ? (
            <Text style={[styles.ideaDesc, { color: C.muted }]} numberOfLines={2}>
              {idea.description}
            </Text>
          ) : null}
          <View style={styles.ownerRow}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, { backgroundColor: C.chipBg }]} />
            )}
            <Text style={[styles.owner, { color: C.muted }]} numberOfLines={1}>
              {bazaarOwnerName(idea)} · {idea.supporters || 0}
            </Text>
          </View>
          {idea.tags && idea.tags.length > 0 ? (
            <View style={styles.tags}>
              {idea.tags.slice(0, 4).map((tag) => (
                <Text key={tag} style={[styles.tag, { color: C.muted, backgroundColor: C.chipBg }]}>
                  #{tag}
                </Text>
              ))}
            </View>
          ) : null}
        </Pressable>
        <Pressable onPress={onUnsave} hitSlop={8} accessibilityLabel={t('bazaar.unsaveIdea')}>
          <Ionicons name="bookmark" size={20} color={C.accent} />
        </Pressable>
      </View>
      <Pressable onPress={onUnsave} style={styles.remove}>
        <Text style={[styles.removeText, { color: C.muted }]}>{t('bazaar.removeFromSaved')}</Text>
      </Pressable>
    </View>
  );
}

export function SavedSimpleCard({
  item,
  C,
  t,
  onOpen,
  onUnsave,
}: {
  item: SavedItem;
  C: SavedPalette;
  t: TFn;
  onOpen: () => void;
  onUnsave: () => void;
}) {
  const isReel = item.saved_type === 'reel';
  const title = isReel
    ? String(item.caption || t('saved.tabReels'))
    : String(item.text || item.title || t('saved.tabStories'));
  const user = (item.user || item.owner) as { username?: string; avatar?: string } | undefined;
  const subtitle = ownerLabel(user) || (user?.username ? `@${user.username}` : '');
  const thumb = mediaUrl(
    String(item.thumbnail_url || item.thumbnail || item.image || item.cover_url || ''),
  );
  const typeKey = isReel ? 'saved.tabReels' : 'saved.tabStories';

  return (
    <Pressable
      onPress={onOpen}
      style={[styles.simple, { backgroundColor: C.card, borderColor: C.border }]}
    >
      {thumb ? (
        <Image source={{ uri: thumb }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, { backgroundColor: C.chipBg, alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons name={isReel ? 'play' : 'sparkles-outline'} size={18} color={C.accent} />
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={[styles.typeBadge, { color: C.accent }]}>{t(typeKey)}</Text>
        <Text style={[styles.simpleTitle, { color: C.text }]} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.owner, { color: C.muted }]} numberOfLines={1}>
            {subtitle.startsWith('@') ? subtitle : `@${subtitle}`}
          </Text>
        ) : null}
      </View>
      <Pressable onPress={onUnsave} hitSlop={10} accessibilityLabel={t('saved.unsave')}>
        <Ionicons name="close" size={18} color={C.muted} />
      </Pressable>
    </Pressable>
  );
}

export function FolderChip({
  folder,
  active,
  C,
  t,
  updating,
  onSelect,
  onTogglePublic,
  onOpenBoard,
}: {
  folder: SavedFolder;
  active: boolean;
  C: SavedPalette;
  t: TFn;
  updating: boolean;
  onSelect: () => void;
  onTogglePublic: () => void;
  onOpenBoard: () => void;
}) {
  return (
    <View style={styles.folderWrap}>
      <Pressable
        onPress={onSelect}
        style={[
          styles.folderChip,
          { backgroundColor: active ? C.bazaar : C.chipBg },
        ]}
      >
        <Text style={[styles.folderText, { color: active ? '#fff' : C.muted }]}>
          {folder.name} {folder.item_count}
        </Text>
      </Pressable>
      {folder.is_public ? (
        <Pressable onPress={onOpenBoard} style={[styles.miniChip, { backgroundColor: C.chipBg }]}>
          <Text style={[styles.miniText, { color: C.accent }]}>{t('saved.publicBoard')}</Text>
        </Pressable>
      ) : null}
      <Pressable
        onPress={onTogglePublic}
        disabled={updating}
        style={[styles.miniChip, { backgroundColor: C.chipBg, opacity: updating ? 0.5 : 1 }]}
      >
        <Text style={[styles.miniText, { color: C.muted }]}>
          {folder.is_public ? t('saved.makePrivate') : t('saved.makePublic')}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  ideaCard: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 12 },
  ideaTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  ideaMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8, marginBottom: 8 },
  cat: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  catText: { fontSize: 11, fontWeight: '700' },
  supported: { fontSize: 11, fontWeight: '700' },
  ideaTitle: { fontSize: 16, fontWeight: '700' },
  ideaDesc: { fontSize: 13, lineHeight: 19, marginTop: 6 },
  ownerRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  avatar: { width: 24, height: 24, borderRadius: 12 },
  owner: { fontSize: 12, flex: 1 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  tag: { fontSize: 11, borderRadius: 6, overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3 },
  remove: { marginTop: 12 },
  removeText: { fontSize: 12, fontWeight: '600' },
  simple: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 16,
    borderWidth: 1,
    padding: 12,
    marginBottom: 10,
  },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  typeBadge: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4, marginBottom: 3 },
  simpleTitle: { fontSize: 15, fontWeight: '700' },
  folderWrap: { flexDirection: 'row', alignItems: 'center', gap: 6, marginRight: 6 },
  folderChip: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  folderText: { fontSize: 12, fontWeight: '700' },
  miniChip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5 },
  miniText: { fontSize: 10, fontWeight: '700' },
});
