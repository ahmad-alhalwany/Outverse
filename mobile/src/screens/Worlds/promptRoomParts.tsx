import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { api } from '@/api/client';
import {
  ROOM_CATEGORIES,
  ROOM_CATEGORY_LABEL,
  type PromptQuestion,
  type RoomsPalette,
} from '@/lib/rooms';

type TFn = (key: string, vars?: Record<string, string | number>) => string;

export function PromptQuestionPicker({
  open,
  C,
  t,
  lang,
  joining,
  onClose,
  onUse,
}: {
  open: boolean;
  C: RoomsPalette;
  t: TFn;
  lang: string;
  joining?: boolean;
  onClose: () => void;
  onUse: (question: PromptQuestion) => void;
}) {
  const [question, setQuestion] = useState<PromptQuestion | null>(null);
  const [category, setCategory] = useState('all');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(
    async (cat?: string, skipCurrent = false) => {
      if (skipCurrent && question?.id) void api.skipQuestion(question.id);
      setLoading(true);
      setError('');
      try {
        const next = await api.getNextQuestion({
          lang,
          category: cat ?? category,
          personalize: !cat || cat === 'all',
        });
        if (!next?.id) {
          setQuestion(null);
          setError(t('inspiration.empty'));
        } else {
          setQuestion(next);
        }
      } catch {
        setQuestion(null);
        setError(t('inspiration.error'));
      } finally {
        setLoading(false);
      }
    },
    [category, lang, question?.id, t],
  );

  useEffect(() => {
    if (open) void load(category);
    // load once when opened; category changes call load directly
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const spark = async () => {
    setLoading(true);
    setError('');
    try {
      const generated = await api.generateQuestion({ lang, category });
      if (!generated?.id) {
        setError(t('inspiration.error'));
      } else {
        setQuestion(generated);
      }
    } catch {
      setError(t('inspiration.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable style={[styles.overlay, { backgroundColor: C.overlay }]} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: C.cream, borderColor: C.line }]}>
          <Text style={[styles.title, { color: C.text }]}>{t('rooms.pickQuestion')}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cats}>
            {ROOM_CATEGORIES.map((key) => {
              const active = category === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    setCategory(key);
                    void load(key);
                  }}
                  style={[styles.cat, { backgroundColor: active ? C.brownDk : C.card, borderColor: C.line }]}
                >
                  <Text style={{ color: active ? '#fff' : C.text, fontWeight: '700', fontSize: 12 }}>
                    {t(ROOM_CATEGORY_LABEL[key])}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={[styles.promptCard, { backgroundColor: C.white, borderColor: C.line }]}>
            {loading ? (
              <ActivityIndicator color={C.brownDk} />
            ) : error ? (
              <Text style={{ color: C.text2, textAlign: 'center' }}>{error}</Text>
            ) : (
              <>
                {question?.category ? (
                  <Text style={[styles.catChip, { color: C.brownDk }]}>
                    {t(ROOM_CATEGORY_LABEL[question.category] || 'inspiration.categoryAll')}
                  </Text>
                ) : null}
                <Text style={[styles.promptText, { color: C.text }]}>{question?.text}</Text>
              </>
            )}
          </View>
          <View style={styles.actions}>
            <Pressable
              onPress={() => void load(category, true)}
              disabled={loading || joining}
              style={[styles.btn, { backgroundColor: C.card }]}
            >
              <Text style={{ color: C.text, fontWeight: '700' }}>{t('inspiration.another')}</Text>
            </Pressable>
            <Pressable
              onPress={() => void spark()}
              disabled={loading || joining}
              style={[styles.btn, { backgroundColor: C.card }]}
            >
              <Text style={{ color: C.text, fontWeight: '700' }}>{t('inspiration.generate')}</Text>
            </Pressable>
          </View>
          <Pressable
            onPress={() => question && onUse(question)}
            disabled={!question || loading || joining}
            style={[styles.primary, { backgroundColor: C.brownDk, opacity: !question || loading || joining ? 0.55 : 1 }]}
          >
            {joining ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryText}>{t('rooms.join')}</Text>
            )}
          </Pressable>
          <Pressable onPress={onClose} style={styles.close}>
            <Text style={{ color: C.text2, fontWeight: '700' }}>{t('common.close')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  overlay: { ...StyleSheet.absoluteFillObject },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  title: { fontSize: 18, fontWeight: '800' },
  cats: { gap: 8, paddingVertical: 4 },
  cat: { borderRadius: 999, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 7 },
  promptCard: { borderRadius: 16, borderWidth: 1, padding: 16, minHeight: 110, justifyContent: 'center' },
  catChip: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', marginBottom: 8 },
  promptText: { fontSize: 17, fontWeight: '700', lineHeight: 24 },
  actions: { flexDirection: 'row', gap: 8 },
  btn: { flex: 1, borderRadius: 14, paddingVertical: 12, alignItems: 'center' },
  primary: { borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  close: { alignItems: 'center', paddingVertical: 6 },
});
