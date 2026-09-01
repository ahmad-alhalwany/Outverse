import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';

type Appeal = {
  id: number;
  content_type?: string;
  object_id?: number;
  reason?: string;
  status?: string;
  created_at?: string;
  staff_note?: string;
};

export default function AppealsScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { t } = useLocale();
  const TYPES: Array<{ id: string; label: string }> = [
    { id: 'post', label: t('security.appealTypePost') },
    { id: 'comment', label: t('security.appealTypeComment') },
    { id: 'reel', label: t('security.appealTypeReel') },
    { id: 'reel_comment', label: t('security.appealTypeReelComment') },
    { id: 'story', label: t('security.appealTypeStory') },
  ];
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [appeals, setAppeals] = useState<Appeal[]>([]);
  const [contentType, setContentType] = useState('post');
  const [objectId, setObjectId] = useState('');
  const [reason, setReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await api.getMyAppeals();
      setAppeals(Array.isArray(rows) ? rows : []);
    } catch {
      setAppeals([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    const id = Number(objectId);
    if (!id || reason.trim().length < 10) {
      Alert.alert(t('security.appealsTitle'), t('mobile.appealNeedId'));
      return;
    }
    setSubmitting(true);
    try {
      await api.submitAppeal({ content_type: contentType, object_id: id, reason: reason.trim() });
      setObjectId('');
      setReason('');
      Alert.alert(t('security.appealsTitle'), t('security.appealSubmitted'));
      void load();
    } catch {
      Alert.alert(t('security.appealsTitle'), t('security.appealError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <WorldBackdrop>
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title={t('security.appealsTitle')}
          subtitle={t('security.appealsHint')}
          onBack={() => navigation.goBack()}
        />
        <ScrollView contentContainerStyle={styles.content}>
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.text }]}>{t('mobile.appealNew')}</Text>
            <View style={styles.chips}>
              {TYPES.map((type) => {
                const on = contentType === type.id;
                return (
                  <Pressable
                    key={type.id}
                    onPress={() => setContentType(type.id)}
                    style={[styles.chip, { backgroundColor: on ? colors.primary : colors.surfaceSecondary }]}
                  >
                    <Text style={[styles.chipText, { color: on ? '#fff' : colors.text }]}>{type.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              value={objectId}
              onChangeText={setObjectId}
              placeholder={t('security.appealObjectId')}
              placeholderTextColor={colors.textSecondary}
              keyboardType="number-pad"
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
            />
            <TextInput
              value={reason}
              onChangeText={setReason}
              placeholder={t('security.appealReason')}
              placeholderTextColor={colors.textSecondary}
              multiline
              style={[styles.area, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surfaceSecondary }]}
            />
            <Pressable
              onPress={() => void submit()}
              disabled={submitting}
              style={[styles.btn, { backgroundColor: colors.primary, opacity: submitting ? 0.6 : 1 }]}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{t('security.appealSubmit')}</Text>}
            </Pressable>
          </View>

          {loading ? (
            <ActivityIndicator color={colors.primary} />
          ) : appeals.length === 0 ? (
            <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>{t('security.appealsEmpty')}</Text>
          ) : (
            appeals.map((item) => (
              <View key={String(item.id)} style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.label, { color: colors.text }]}>
                  {item.content_type || 'content'} #{item.object_id} · {item.status || 'pending'}
                </Text>
                {item.reason ? (
                  <Text style={[styles.hint, { color: colors.textSecondary }]}>{item.reason}</Text>
                ) : null}
                {item.staff_note ? (
                  <Text style={[styles.hint, { color: colors.primary }]}>{item.staff_note}</Text>
                ) : null}
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 12, paddingBottom: 40 },
  card: { borderWidth: 1, borderRadius: 18, padding: 14 },
  label: { fontSize: 15, fontWeight: '800' },
  hint: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontSize: 12, fontWeight: '800' },
  input: { marginTop: 12, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  area: { marginTop: 10, minHeight: 90, textAlignVertical: 'top', borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  btn: { marginTop: 12, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '800' },
});
