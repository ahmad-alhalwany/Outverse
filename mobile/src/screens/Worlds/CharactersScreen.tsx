import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  WorldBackdrop,
  WorldHeader,
  WorldHero,
} from '@/components/world/WorldChrome';
import { asForgeStories, type ForgeCharacter, type ForgeStory } from '@/lib/forge';
import {
  asCharacters,
  canMergePair,
  characterApiError,
  CREATE_CUSTOM_COST,
  MYSTERY_SUMMON_COST,
  RARITY_COLOR,
  useCharactersPalette,
  type CharactersPalette,
  type MarketCharacter,
} from '@/lib/characters';

type TabKey = 'market' | 'mine';

export default function CharactersScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const { user } = useAuth();
  const C = useCharactersPalette(isDark);
  const { t, locale } = useLocale();

  const [tab, setTab] = useState<TabKey>('market');
  const [characters, setCharacters] = useState<MarketCharacter[]>([]);
  const [mine, setMine] = useState<MarketCharacter[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mergeMode, setMergeMode] = useState(false);
  const [selectedForMerge, setSelectedForMerge] = useState<number[]>([]);
  const [merging, setMerging] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [createPrompt, setCreatePrompt] = useState('');
  const [creating, setCreating] = useState(false);

  const [mysterySummoning, setMysterySummoning] = useState(false);
  const [reveal, setReveal] = useState<MarketCharacter | null>(null);

  const [forgePickerFor, setForgePickerFor] = useState<MarketCharacter | null>(null);
  const [forgeStories, setForgeStories] = useState<ForgeStory[] | null>(null);
  const [sendingToForge, setSendingToForge] = useState(false);

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(''), 3200);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, []);

  const failToast = useCallback(
    (err: unknown, fallbackKey: string) => {
      const raw = characterApiError(err);
      if (raw === 'Insufficient coins.') showToast(t('characters.insufficientCoins'));
      else showToast(raw || t(fallbackKey));
    },
    [showToast, t],
  );

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const [marketData, mineData, wallet] = await Promise.all([
        api.getCharacters(),
        user ? api.getMyCharacters() : Promise.resolve([]),
        user ? api.getShopWallet() : Promise.resolve(null),
      ]);
      setCharacters(asCharacters(marketData));
      setMine(asCharacters(mineData));
      if (wallet && typeof wallet.balance === 'number') setBalance(wallet.balance);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const list = tab === 'market' ? characters : mine;
  const mergeEligible = useMemo(() => {
    if (selectedForMerge.length !== 2) return false;
    const a = mine.find((c) => c.id === selectedForMerge[0]);
    const b = mine.find((c) => c.id === selectedForMerge[1]);
    return canMergePair(a, b);
  }, [mine, selectedForMerge]);

  const summon = async (character: MarketCharacter) => {
    if (!user || character.owned) return;
    setBusyId(character.id);
    try {
      const data = await api.summonCharacter(character.id);
      showToast(t('characters.summonSuccess', { name: character.name }));
      if (typeof data.balance === 'number') setBalance(data.balance);
      await load(true);
    } catch (err) {
      failToast(err, 'characters.summonFailed');
    } finally {
      setBusyId(null);
    }
  };

  const mysterySummon = async () => {
    if (!user || mysterySummoning) return;
    setMysterySummoning(true);
    try {
      const data = (await api.mysterySummonCharacter()) as MarketCharacter;
      setReveal(data);
      if (typeof data.balance === 'number') setBalance(data.balance);
      await load(true);
    } catch (err) {
      failToast(err, 'characters.summonFailed');
    } finally {
      setMysterySummoning(false);
    }
  };

  const toggleMergeSelect = (character: MarketCharacter) => {
    setSelectedForMerge((prev) => {
      if (prev.includes(character.id)) return prev.filter((id) => id !== character.id);
      if (prev.length >= 2) return prev;
      return [...prev, character.id];
    });
  };

  const confirmMerge = async () => {
    if (selectedForMerge.length !== 2) {
      showToast(t('characters.mergeNeedTwo'));
      return;
    }
    setMerging(true);
    try {
      const data = (await api.mergeCharacters(selectedForMerge)) as MarketCharacter;
      setReveal(data);
      showToast(t('characters.mergeSuccess', { name: data.name }));
      setSelectedForMerge([]);
      setMergeMode(false);
      await load(true);
    } catch (err) {
      failToast(err, 'characters.mergeFailed');
    } finally {
      setMerging(false);
    }
  };

  const createCustom = async () => {
    const prompt = createPrompt.trim();
    if (!prompt || creating) return;
    setCreating(true);
    try {
      const data = (await api.createCustomCharacter(prompt, locale)) as MarketCharacter;
      setReveal(data);
      setCreateOpen(false);
      setCreatePrompt('');
      if (typeof data.balance === 'number') setBalance(data.balance);
      await load(true);
    } catch (err) {
      failToast(err, 'characters.createFailed');
    } finally {
      setCreating(false);
    }
  };

  const openForgePicker = async (character: MarketCharacter) => {
    setForgePickerFor(character);
    if (!forgeStories && user) {
      try {
        const data = await api.getForgeStories({ owner: user.id });
        setForgeStories(asForgeStories(data));
      } catch {
        setForgeStories([]);
      }
    }
  };

  const sendToForge = async (story: ForgeStory) => {
    if (!forgePickerFor) return;
    setSendingToForge(true);
    const character = forgePickerFor;
    try {
      const full = await api.getForgeStory(story.id);
      const existing: ForgeCharacter[] = Array.isArray(full.characters) ? full.characters : [];
      const nextCharacters = [
        ...existing,
        {
          name: character.name,
          role: character.rarity_display,
          traits: [character.rarity_display],
          voice: '',
          notes: character.description,
          emoji: character.emoji,
          source_character_id: character.id,
        },
      ];
      await api.updateForgeStory(story.id, { characters: nextCharacters });
      showToast(t('characters.sendToForgeSuccess', { character: character.name, story: story.title }));
      setForgePickerFor(null);
    } catch {
      showToast(t('characters.sendToForgeFailed'));
    } finally {
      setSendingToForge(false);
    }
  };

  return (
    <WorldBackdrop tone="default">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={t('characters.title')}
          subtitle={t('nav.characters')}
          tone="default"
          onBack={() => navigation.goBack()}
        />
        {loading && characters.length === 0 && mine.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={C.brown} />
            <Text style={[styles.hint, { color: C.text2 }]}>{t('common.loading')}</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.content}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.brown} />
            }
          >
            <WorldHero tone="default" eyebrow="🧙" title={t('characters.title')} body={t('characters.subtitle')} />

            {balance != null ? (
              <View style={[styles.balance, { backgroundColor: C.card }]}>
                <Ionicons name="sparkles" size={16} color={C.brownDk} />
                <Text style={[styles.balanceText, { color: C.brownDk }]}>
                  {balance.toLocaleString()} {t('common.coins')}
                </Text>
              </View>
            ) : null}

            {user ? (
              <View style={styles.actions}>
                <Pressable
                  onPress={() => void mysterySummon()}
                  disabled={mysterySummoning}
                  style={[styles.actionPrimary, { backgroundColor: C.brownDk, opacity: mysterySummoning ? 0.6 : 1 }]}
                >
                  {mysterySummoning ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={16} color="#fff" />
                      <Text style={styles.actionPrimaryText}>
                        {t('characters.mysterySummon')} ({MYSTERY_SUMMON_COST} ✨)
                      </Text>
                    </>
                  )}
                </Pressable>
                <Pressable onPress={() => setCreateOpen(true)} style={[styles.actionSecondary, { backgroundColor: C.card2 }]}>
                  <Text style={[styles.actionSecondaryText, { color: C.brownDk }]}>✏️ {t('characters.createOwn')}</Text>
                </Pressable>
              </View>
            ) : null}

            <View style={styles.tabs}>
              {(['market', 'mine'] as const).map((key) => (
                <Pressable
                  key={key}
                  onPress={() => setTab(key)}
                  style={[
                    styles.tab,
                    {
                      backgroundColor: tab === key ? C.brown : C.white,
                      borderColor: tab === key ? C.brown : C.line,
                    },
                  ]}
                >
                  <Text style={{ color: tab === key ? '#fff' : C.text2, fontWeight: '700', fontSize: 13 }}>
                    {key === 'market' ? t('characters.tabMarket') : `${t('characters.tabMine')} (${mine.length})`}
                  </Text>
                </Pressable>
              ))}
            </View>

            {tab === 'mine' && user && mine.length > 0 ? (
              <View style={[styles.mergeBar, { backgroundColor: C.card2 }]}>
                <Pressable
                  onPress={() => {
                    setMergeMode((v) => !v);
                    setSelectedForMerge([]);
                  }}
                  style={[
                    styles.mergeChip,
                    { backgroundColor: mergeMode ? C.brownDk : C.white },
                  ]}
                >
                  <Text style={{ color: mergeMode ? '#fff' : C.brownDk, fontWeight: '800', fontSize: 12 }}>
                    🧪 {mergeMode ? t('characters.mergeModeOn') : t('characters.mergeMode')}
                  </Text>
                </Pressable>
                {mergeMode ? (
                  <>
                    <Text style={[styles.mergeHint, { color: C.text2 }]}>{t('characters.mergeHint')}</Text>
                    <Pressable
                      onPress={() => void confirmMerge()}
                      disabled={!mergeEligible || merging}
                      style={[
                        styles.mergeChip,
                        { backgroundColor: C.brown, opacity: !mergeEligible || merging ? 0.4 : 1 },
                      ]}
                    >
                      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 12 }}>
                        {merging
                          ? t('characters.mergeFusing')
                          : `${t('characters.mergeButton')} (${selectedForMerge.length}/2)`}
                      </Text>
                    </Pressable>
                  </>
                ) : null}
              </View>
            ) : null}

            {error && list.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: C.card2 }]}>
                <Text style={[styles.emptyText, { color: C.text2 }]}>{t('characters.loadError')}</Text>
                <Pressable onPress={() => void load()} style={[styles.retry, { backgroundColor: C.brownDk }]}>
                  <Text style={styles.retryText}>{t('characters.retry')}</Text>
                </Pressable>
              </View>
            ) : list.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: C.card2 }]}>
                <Text style={styles.emptyEmoji}>🧙</Text>
                <Text style={[styles.emptyText, { color: C.text2 }]}>
                  {tab === 'market' ? t('characters.empty') : t('characters.mineEmpty')}
                </Text>
              </View>
            ) : (
              <View style={styles.grid}>
                {list.map((character) => {
                  const selected = selectedForMerge.includes(character.id);
                  const selectable = mergeMode && tab === 'mine';
                  return (
                    <CharacterCard
                      key={character.id}
                      character={character}
                      C={C}
                      t={t}
                      tab={tab}
                      selected={selected}
                      selectable={selectable}
                      busy={busyId === character.id}
                      signedIn={!!user}
                      mergeMode={mergeMode}
                      onPress={() => (selectable ? toggleMergeSelect(character) : undefined)}
                      onSummon={() => void summon(character)}
                      onSendToForge={() => void openForgePicker(character)}
                    />
                  );
                })}
              </View>
            )}
          </ScrollView>
        )}
      </SafeAreaView>

      {toast ? (
        <View pointerEvents="none" style={[styles.toast, { backgroundColor: C.brownDk }]}>
          <Text style={styles.toastText}>{toast}</Text>
        </View>
      ) : null}

      <CreateModal
        visible={createOpen}
        C={C}
        t={t}
        prompt={createPrompt}
        creating={creating}
        onChangePrompt={setCreatePrompt}
        onClose={() => setCreateOpen(false)}
        onSubmit={() => void createCustom()}
      />

      <ForgePickerModal
        visible={!!forgePickerFor}
        C={C}
        t={t}
        stories={forgeStories}
        sending={sendingToForge}
        onClose={() => setForgePickerFor(null)}
        onPick={(story) => void sendToForge(story)}
      />

      <RevealModal visible={!!reveal} character={reveal} C={C} t={t} onClose={() => setReveal(null)} />
    </WorldBackdrop>
  );
}

function CharacterCard({
  character,
  C,
  t,
  tab,
  selected,
  selectable,
  busy,
  signedIn,
  mergeMode,
  onPress,
  onSummon,
  onSendToForge,
}: {
  character: MarketCharacter;
  C: CharactersPalette;
  t: (key: string, vars?: Record<string, string | number>) => string;
  tab: TabKey;
  selected: boolean;
  selectable: boolean;
  busy: boolean;
  signedIn: boolean;
  mergeMode: boolean;
  onPress?: () => void;
  onSummon: () => void;
  onSendToForge: () => void;
}) {
  const cover = mediaUrl(character.image_url);
  const rarityColor = RARITY_COLOR[character.rarity] || C.brown;
  return (
    <Pressable
      onPress={selectable ? onPress : undefined}
      style={[
        styles.card,
        {
          backgroundColor: C.white,
          borderColor: selected ? C.brownDk : C.line,
          shadowColor: selected ? C.brownDk : 'transparent',
        },
      ]}
    >
      <LinearGradient colors={[C.card, C.card2]} style={styles.art}>
        {cover ? (
          <Image source={{ uri: cover }} style={styles.artImage} />
        ) : (
          <Text style={styles.emoji}>{character.emoji || '✨'}</Text>
        )}
        {character.is_ai_generated ? (
          <View style={[styles.aiBadge, { backgroundColor: C.brownDk }]}>
            <Text style={styles.aiBadgeText}>✨ {t('characters.aiGenerated')}</Text>
          </View>
        ) : null}
      </LinearGradient>
      <View style={styles.cardBody}>
        <Text style={[styles.rarity, { backgroundColor: `${rarityColor}22`, color: rarityColor }]}>
          {character.rarity_display}
        </Text>
        <Text style={[styles.cardTitle, { color: C.text }]}>{character.name}</Text>
        {character.description ? (
          <Text style={[styles.cardDesc, { color: C.text2 }]} numberOfLines={2}>
            {character.description}
          </Text>
        ) : null}
        {tab === 'market' ? (
          <Pressable
            onPress={onSummon}
            disabled={character.owned || busy || !signedIn}
            style={[styles.cta, { backgroundColor: C.brownDk, opacity: character.owned || busy || !signedIn ? 0.55 : 1 }]}
          >
            {busy ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>
                {character.owned
                  ? t('characters.owned')
                  : `${t('characters.summonFor')} ${character.price} ✨`}
              </Text>
            )}
          </Pressable>
        ) : !mergeMode ? (
          <Pressable onPress={onSendToForge} style={[styles.cta, { backgroundColor: C.card2 }]}>
            <Text style={[styles.ctaText, { color: C.brownDk }]}>📖 {t('characters.sendToForge')}</Text>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

function CreateModal({
  visible,
  C,
  t,
  prompt,
  creating,
  onChangePrompt,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  C: CharactersPalette;
  t: (key: string, vars?: Record<string, string | number>) => string;
  prompt: string;
  creating: boolean;
  onChangePrompt: (v: string) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalRoot}>
        <Pressable style={[styles.overlay, { backgroundColor: C.overlay }]} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: C.cream, borderColor: C.line }]}>
          <Text style={[styles.modalTitle, { color: C.text }]}>{t('characters.createTitle')}</Text>
          <Text style={[styles.modalHint, { color: C.text2 }]}>{t('characters.createPrivateNote')}</Text>
          <TextInput
            value={prompt}
            onChangeText={onChangePrompt}
            placeholder={t('characters.createPromptPlaceholder')}
            placeholderTextColor={C.text2}
            multiline
            style={[styles.input, { backgroundColor: C.white, borderColor: C.line, color: C.text }]}
          />
          <Text style={[styles.cost, { color: C.brownDk }]}>{t('characters.createCost', { price: CREATE_CUSTOM_COST })}</Text>
          <View style={styles.modalActions}>
            <Pressable onPress={onClose} style={[styles.modalBtn, { backgroundColor: C.card2 }]}>
              <Text style={{ color: C.text, fontWeight: '700' }}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable
              onPress={onSubmit}
              disabled={creating || !prompt.trim()}
              style={[styles.modalBtn, { backgroundColor: C.brownDk, opacity: creating || !prompt.trim() ? 0.55 : 1 }]}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={{ color: '#fff', fontWeight: '800' }}>{t('characters.createSubmit')}</Text>
              )}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ForgePickerModal({
  visible,
  C,
  t,
  stories,
  sending,
  onClose,
  onPick,
}: {
  visible: boolean;
  C: CharactersPalette;
  t: (key: string) => string;
  stories: ForgeStory[] | null;
  sending: boolean;
  onClose: () => void;
  onPick: (story: ForgeStory) => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={[styles.overlay, { backgroundColor: C.overlay }]} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: C.cream, borderColor: C.line, maxHeight: '70%' }]}>
          <Text style={[styles.modalTitle, { color: C.text }]}>{t('characters.sendToForgeTitle')}</Text>
          {stories === null ? (
            <Text style={[styles.modalHint, { color: C.text2 }]}>{t('common.loading')}</Text>
          ) : stories.length === 0 ? (
            <Text style={[styles.modalHint, { color: C.text2 }]}>{t('characters.sendToForgeEmpty')}</Text>
          ) : (
            <ScrollView>
              {stories.map((story) => (
                <Pressable
                  key={story.id}
                  disabled={sending}
                  onPress={() => onPick(story)}
                  style={[styles.storyRow, { backgroundColor: C.white, borderColor: C.line, opacity: sending ? 0.6 : 1 }]}
                >
                  <Text style={{ color: C.text, fontWeight: '600' }}>{story.title}</Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          <Pressable onPress={onClose} style={[styles.modalBtn, { backgroundColor: C.card2, marginTop: 12 }]}>
            <Text style={{ color: C.text, fontWeight: '700', textAlign: 'center' }}>{t('characters.close')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function RevealModal({
  visible,
  character,
  C,
  t,
  onClose,
}: {
  visible: boolean;
  character: MarketCharacter | null;
  C: CharactersPalette;
  t: (key: string) => string;
  onClose: () => void;
}) {
  if (!character) return null;
  const rarityColor = RARITY_COLOR[character.rarity] || C.brown;
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={[styles.overlay, { backgroundColor: C.overlay }]} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: C.cream, borderColor: C.line, alignItems: 'center' }]}>
          <Text style={styles.revealEmoji}>{character.emoji || '✨'}</Text>
          <Text style={[styles.rarity, { backgroundColor: `${rarityColor}22`, color: rarityColor }]}>
            {character.rarity_display}
          </Text>
          <Text style={[styles.revealName, { color: C.text }]}>{character.name}</Text>
          {character.description ? (
            <Text style={[styles.cardDesc, { color: C.text2, textAlign: 'center' }]}>{character.description}</Text>
          ) : null}
          <Pressable onPress={onClose} style={[styles.modalBtn, { backgroundColor: C.brownDk, marginTop: 16, alignSelf: 'stretch' }]}>
            <Text style={{ color: '#fff', fontWeight: '800', textAlign: 'center' }}>{t('characters.close')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 48 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  hint: { fontSize: 13 },
  balance: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 12,
    marginBottom: 10,
  },
  balanceText: { fontSize: 13, fontWeight: '800' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  actionPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  actionSecondary: { borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10 },
  actionSecondaryText: { fontWeight: '800', fontSize: 13 },
  tabs: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 8 },
  mergeBar: { borderRadius: 18, padding: 12, gap: 10, marginBottom: 14 },
  mergeChip: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  mergeHint: { fontSize: 12, lineHeight: 18 },
  grid: { gap: 12 },
  card: { borderRadius: 18, borderWidth: 1, overflow: 'hidden', shadowOffset: { width: 0, height: 0 }, shadowRadius: 6, shadowOpacity: 0.9 },
  art: { height: 128, alignItems: 'center', justifyContent: 'center' },
  artImage: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  emoji: { fontSize: 48 },
  aiBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  aiBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  cardBody: { padding: 14 },
  rarity: {
    overflow: 'hidden',
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardDesc: { fontSize: 13, lineHeight: 19, marginTop: 4 },
  cta: { marginTop: 12, borderRadius: 14, paddingVertical: 11, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  empty: { borderRadius: 22, padding: 28, alignItems: 'center', gap: 10 },
  emptyEmoji: { fontSize: 36 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  retry: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8, marginTop: 4 },
  retryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  toast: {
    position: 'absolute',
    left: 24,
    right: 24,
    bottom: 28,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  toastText: { color: '#fff', fontWeight: '700', fontSize: 13, textAlign: 'center' },
  modalRoot: { flex: 1, justifyContent: 'center', padding: 16 },
  overlay: { ...StyleSheet.absoluteFillObject },
  sheet: { borderRadius: 22, borderWidth: 1, padding: 18 },
  modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 6 },
  modalHint: { fontSize: 12, lineHeight: 18, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 88,
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  cost: { fontSize: 12, fontWeight: '800', marginBottom: 14 },
  modalActions: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, borderRadius: 14, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  storyRow: { borderRadius: 14, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 12, marginBottom: 8 },
  revealEmoji: { fontSize: 56, marginBottom: 10 },
  revealName: { fontSize: 20, fontWeight: '800', marginTop: 8, marginBottom: 6, textAlign: 'center' },
});
