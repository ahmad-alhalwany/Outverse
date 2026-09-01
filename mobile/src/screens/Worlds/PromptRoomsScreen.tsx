import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  WorldBackdrop,
  WorldHeader,
  WorldHero,
  WorldPrimaryButton,
} from '@/components/world/WorldChrome';
import { previewText, type ChatRoomRow } from '@/lib/chat';
import {
  asPromptRooms,
  formatRoomExpires,
  ROOM_CATEGORY_LABEL,
  useRoomsPalette,
  type PromptQuestion,
} from '@/lib/rooms';
import { PromptQuestionPicker } from './promptRoomParts';

export default function PromptRoomsScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const C = useRoomsPalette(isDark);
  const { t, locale } = useLocale();

  const [rooms, setRooms] = useState<ChatRoomRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [joining, setJoining] = useState(false);
  const [nowTick, setNowTick] = useState(0);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError(false);
    try {
      const data = await api.getPromptRooms();
      setRooms(asPromptRooms(data));
    } catch {
      setRooms([]);
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setNowTick((n) => n + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const openRoom = (room: ChatRoomRow) => {
    navigation.navigate('Room', {
      roomId: room.id,
      roomName: room.question_text || room.name,
      isExpired: room.is_expired,
      questionText: room.question_text,
      questionCategory: room.question_category,
    });
  };

  const startFromQuestion = async (question: PromptQuestion) => {
    if (joining) return;
    setJoining(true);
    try {
      const room = (await api.joinPromptRoom(question.id)) as ChatRoomRow;
      setPickerOpen(false);
      await load(true);
      openRoom({
        ...room,
        question_text: room.question_text || question.text,
        question_category: room.question_category || question.category,
      });
    } catch {
      Alert.alert(t('rooms.title'), t('chat.openPromptRoomFailed'));
    } finally {
      setJoining(false);
    }
  };

  const liveRooms = useMemo(
    () => rooms.filter((room) => !room.is_expired),
    [rooms, nowTick],
  );

  return (
    <WorldBackdrop tone="live">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={t('rooms.title')}
          subtitle={t('nav.rooms')}
          tone="live"
          onBack={() => navigation.goBack()}
          right={
            <Pressable onPress={() => void load(true)} hitSlop={8}>
              <Ionicons name="refresh" size={20} color={C.brown} />
            </Pressable>
          }
        />
        {loading && rooms.length === 0 ? (
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
            <WorldHero
              tone="live"
              eyebrow={t('rooms.orbitEyebrow')}
              title={t('rooms.title')}
              body={t('rooms.subtitle')}
              action={
                <WorldPrimaryButton
                  label={t('rooms.startFromQuestion')}
                  tone="live"
                  onPress={() => setPickerOpen(true)}
                />
              }
            />

            <Text style={[styles.count, { color: C.text2 }]}>
              {t('rooms.liveCount', { count: liveRooms.length })}
            </Text>

            {error ? (
              <Pressable onPress={() => void load()} style={[styles.empty, { backgroundColor: C.card }]}>
                <Text style={{ color: C.text, fontWeight: '700' }}>{t('common.tryAgain')}</Text>
              </Pressable>
            ) : liveRooms.length === 0 ? (
              <View style={[styles.empty, { backgroundColor: C.card, borderColor: C.line }]}>
                <Text style={{ fontSize: 28, marginBottom: 8 }}>✨</Text>
                <Text style={[styles.emptyTitle, { color: C.text }]}>{t('rooms.empty')}</Text>
                <WorldPrimaryButton
                  label={t('rooms.startFromQuestion')}
                  tone="live"
                  onPress={() => setPickerOpen(true)}
                />
              </View>
            ) : (
              liveRooms.map((room) => {
                const last = previewText(room.last_message);
                return (
                  <Pressable
                    key={room.id}
                    onPress={() => openRoom(room)}
                    style={[styles.card, { backgroundColor: C.white, borderColor: C.line }]}
                  >
                    <View style={styles.cardTop}>
                      <View style={[styles.emoji, { backgroundColor: C.card }]}>
                        <Text style={{ fontSize: 20 }}>✨</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        {room.question_category ? (
                          <Text style={[styles.category, { color: C.brownDk }]}>
                            {t(ROOM_CATEGORY_LABEL[room.question_category] || 'inspiration.categoryAll')}
                          </Text>
                        ) : null}
                        <Text style={[styles.question, { color: C.text }]} numberOfLines={3}>
                          {room.question_text || room.name}
                        </Text>
                      </View>
                    </View>
                    <Text style={[styles.meta, { color: C.text2 }]}>
                      {t('chat.explorersCount', { count: room.member_count })}
                      {' · '}
                      {formatRoomExpires(room.expires_at, t)}
                    </Text>
                    <Text style={[styles.last, { color: C.text2 }]} numberOfLines={2}>
                      {last ? `${t('rooms.lastMessage')} ${last}` : t('rooms.noMessages')}
                    </Text>
                    <View style={[styles.openBtn, { backgroundColor: C.brownDk }]}>
                      <Text style={styles.openText}>{room.is_expired ? t('rooms.recapBadge') : t('rooms.open')}</Text>
                    </View>
                  </Pressable>
                );
              })
            )}
          </ScrollView>
        )}
      </SafeAreaView>
      <PromptQuestionPicker
        open={pickerOpen}
        C={C}
        t={t}
        lang={locale}
        joining={joining}
        onClose={() => setPickerOpen(false)}
        onUse={(q) => void startFromQuestion(q)}
      />
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  hint: { fontSize: 13 },
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  count: { fontSize: 12, fontWeight: '800', letterSpacing: 0.4, textTransform: 'uppercase' },
  empty: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 22,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: { fontSize: 15, fontWeight: '700', textAlign: 'center', lineHeight: 22 },
  card: { borderRadius: 18, borderWidth: 1, padding: 14, gap: 8 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  emoji: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  category: { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', marginBottom: 4 },
  question: { fontSize: 16, fontWeight: '800', lineHeight: 22 },
  meta: { fontSize: 12, fontWeight: '600' },
  last: { fontSize: 13, lineHeight: 18 },
  openBtn: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  openText: { color: '#fff', fontWeight: '800', fontSize: 12 },
});
