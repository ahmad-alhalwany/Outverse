import React, { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import {
  asMemories,
  asMemory,
  memoryFieldError,
  relativeMemoryTime,
  useMemoriesPalette,
  type FutureMemory,
} from '@/lib/memories';

export default function MemoriesScreen() {
  const navigation = useNavigation<any>();
  const { isDark } = useTheme();
  const C = useMemoriesPalette(isDark);
  const { t, locale } = useLocale();

  const [memories, setMemories] = useState<FutureMemory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [text, setText] = useState('');
  const [tag, setTag] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [depositing, setDepositing] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');
    try {
      setMemories(asMemories(await api.getFutureMemories()));
    } catch {
      setMemories([]);
      setError(t('memories.loadError'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const deposit = async () => {
    if (!text.trim() || depositing) return;
    setDepositing(true);
    setError('');
    try {
      const created = asMemory(
        await api.createFutureMemory({
          text: text.trim(),
          tag: tag.trim(),
          is_public: isPublic,
        }),
      );
      setText('');
      setTag('');
      if (created) {
        setMemories((prev) => [created, ...prev.filter((row) => row.id !== created.id)]);
      } else {
        await load(true);
      }
    } catch (err) {
      setError(memoryFieldError(err, t('memories.depositFailed')));
    } finally {
      setDepositing(false);
    }
  };

  return (
    <WorldBackdrop tone="vault">
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <WorldHeader
          title={`🏦 ${t('memories.title')}`}
          subtitle={t('memories.subtitle')}
          tone="vault"
          onBack={() => navigation.goBack()}
        />
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={C.brown} />
          }
        >
          <View style={[styles.form, { backgroundColor: C.white, borderColor: C.line }]}>
            <Text style={[styles.formTitle, { color: C.text }]}>{t('memories.depositTitle')}</Text>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder={t('memories.depositPlaceholder')}
              placeholderTextColor={C.text2}
              multiline
              style={[styles.input, styles.textarea, { backgroundColor: C.card2, color: C.text, borderColor: C.line }]}
            />
            <View style={styles.formRow}>
              <TextInput
                value={tag}
                onChangeText={setTag}
                placeholder={t('memories.tagPlaceholder')}
                placeholderTextColor={C.text2}
                autoCapitalize="none"
                style={[styles.input, styles.tagInput, { backgroundColor: C.card2, color: C.text, borderColor: C.line }]}
              />
              <Pressable onPress={() => setIsPublic((prev) => !prev)} style={styles.switchRow}>
                <Switch
                  value={isPublic}
                  onValueChange={setIsPublic}
                  trackColor={{ false: C.card, true: C.brown }}
                  thumbColor="#fff"
                />
                <Text style={[styles.switchLabel, { color: C.text2 }]}>{t('memories.makePublic')}</Text>
              </Pressable>
            </View>
            <Pressable
              onPress={() => void deposit()}
              disabled={depositing || !text.trim()}
              style={[
                styles.deposit,
                { backgroundColor: C.brownDk, opacity: depositing || !text.trim() ? 0.5 : 1 },
              ]}
            >
              <Ionicons name="cash-outline" size={16} color="#fff" />
              <Text style={styles.depositText}>
                {depositing ? t('memories.depositing') : t('memories.deposit')}
              </Text>
            </Pressable>
          </View>

          {error ? <Text style={[styles.error, { color: C.brownDk }]}>{error}</Text> : null}

          {loading && memories.length === 0 ? (
            <View style={styles.center}>
              <ActivityIndicator color={C.brown} />
              <Text style={[styles.hint, { color: C.text2 }]}>{t('common.loading')}</Text>
            </View>
          ) : memories.length === 0 ? (
            <View style={[styles.empty, { backgroundColor: C.card2 }]}>
              <Text style={[styles.hint, { color: C.text2 }]}>{error || t('memories.empty')}</Text>
              {error ? (
                <Pressable onPress={() => void load()} style={[styles.retry, { backgroundColor: C.brownDk }]}>
                  <Text style={styles.retryText}>{t('common.tryAgain')}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.list}>
              {memories.map((memory) => (
                <View
                  key={memory.id}
                  style={[styles.card, { backgroundColor: C.white, borderColor: C.line }]}
                >
                  <Text style={[styles.body, { color: C.text }]}>{memory.text}</Text>
                  <View style={styles.meta}>
                    <View style={styles.metaLeft}>
                      {memory.username ? (
                        <Text style={[styles.user, { color: C.text2 }]}>@{memory.username}</Text>
                      ) : null}
                      {memory.tag ? (
                        <View style={[styles.tag, { backgroundColor: C.card2 }]}>
                          <Text style={[styles.tagText, { color: C.text2 }]}>#{memory.tag}</Text>
                        </View>
                      ) : null}
                      {!memory.is_public ? (
                        <Ionicons name="lock-closed-outline" size={12} color={C.text2} />
                      ) : null}
                    </View>
                    <Text style={[styles.time, { color: C.text2 }]}>
                      {relativeMemoryTime(memory.created_at, locale)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  form: { borderRadius: 18, borderWidth: 1, padding: 16, marginBottom: 16 },
  formTitle: { fontSize: 14, fontWeight: '800', marginBottom: 10 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textarea: { minHeight: 88, textAlignVertical: 'top', marginBottom: 10 },
  formRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, marginBottom: 12 },
  tagInput: { flexGrow: 1, minWidth: 140 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchLabel: { fontSize: 13, fontWeight: '600' },
  deposit: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  depositText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  error: { fontSize: 13, marginBottom: 12 },
  center: { alignItems: 'center', paddingVertical: 40 },
  hint: { fontSize: 14, textAlign: 'center', marginTop: 10 },
  empty: { borderRadius: 18, padding: 28, alignItems: 'center' },
  retry: { marginTop: 14, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  list: { gap: 10 },
  card: { borderRadius: 18, borderWidth: 1, padding: 16 },
  body: { fontSize: 14, lineHeight: 22 },
  meta: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  metaLeft: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, flex: 1 },
  user: { fontSize: 12, fontWeight: '600' },
  tag: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  tagText: { fontSize: 11, fontWeight: '700' },
  time: { fontSize: 11 },
});
