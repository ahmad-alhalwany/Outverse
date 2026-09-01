import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';
import { useLocale } from '@/i18n/LocaleProvider';

export default function CommunityWikiScreen() {
  const { colors } = useTheme();
  const { t } = useLocale();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const slug = String(route.params?.slug || '');
  const initialPageSlug = String(route.params?.pageSlug || '');
  const isModerator = !!route.params?.isModerator;

  const [page, setPage] = useState<{
    title: string;
    body: string;
    slug: string;
    edited_at?: string | null;
    edited_by?: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(!!initialPageSlug);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(!initialPageSlug && isModerator);
  const [titleDraft, setTitleDraft] = useState('');
  const [bodyDraft, setBodyDraft] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    if (!slug || !initialPageSlug) return;
    setLoading(true);
    setNotFound(false);
    try {
      const data = await api.getCommunityWikiPage(slug, initialPageSlug);
      setPage(data);
      setTitleDraft(data?.title || '');
      setBodyDraft(data?.body || '');
    } catch {
      setNotFound(true);
      setPage(null);
    } finally {
      setLoading(false);
    }
  }, [initialPageSlug, slug]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!titleDraft.trim() || saving) return;
    setSaving(true);
    try {
      const saved = await api.saveCommunityWikiPage(slug, {
        title: titleDraft.trim(),
        body: bodyDraft,
        slug: page?.slug || initialPageSlug || undefined,
      });
      setPage(saved);
      setEditing(false);
    } catch {
      Alert.alert(t('communities.wikiSave'), t('communities.wikiSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <WorldBackdrop>
      <SafeAreaView style={styles.safe}>
        <WorldHeader
          title={page?.title || t('communities.wikiSectionTitle')}
          subtitle={slug ? `c/${slug}` : undefined}
          onBack={() => navigation.goBack()}
          right={
            isModerator && page && !editing ? (
              <TouchableOpacity onPress={() => setEditing(true)}>
                <Text style={{ color: colors.primary, fontWeight: '700' }}>{t('communities.editWikiPage')}</Text>
              </TouchableOpacity>
            ) : null
          }
        />
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
            <Text style={{ color: colors.textSecondary, marginTop: 8 }}>{t('communities.wikiLoading')}</Text>
          </View>
        ) : notFound && !editing ? (
          <View style={styles.center}>
            <Text style={{ color: colors.textSecondary }}>{t('communities.wikiNotFound')}</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.body}>
            {editing ? (
              <View style={{ gap: 10 }}>
                <TextInput
                  value={titleDraft}
                  onChangeText={setTitleDraft}
                  placeholder={t('communities.wikiTitleLabel')}
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                />
                <TextInput
                  value={bodyDraft}
                  onChangeText={setBodyDraft}
                  placeholder={t('communities.wikiBodyLabel')}
                  placeholderTextColor={colors.textSecondary}
                  multiline
                  style={[
                    styles.input,
                    styles.bodyInput,
                    { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface },
                  ]}
                />
                <View style={styles.row}>
                  <TouchableOpacity
                    onPress={() => {
                      if (!page) navigation.goBack();
                      else setEditing(false);
                    }}
                    style={[styles.btn, { backgroundColor: colors.surfaceSecondary }]}
                  >
                    <Text style={{ color: colors.text, fontWeight: '700' }}>{t('common.cancel')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => void save()}
                    disabled={saving || !titleDraft.trim()}
                    style={[styles.btn, { backgroundColor: colors.primary, opacity: saving || !titleDraft.trim() ? 0.6 : 1 }]}
                  >
                    <Text style={{ color: '#fff', fontWeight: '800' }}>
                      {saving ? t('communities.wikiSaving') : t('communities.wikiSave')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {(page?.edited_at || page?.edited_by) && (
                  <Text style={{ color: colors.textSecondary, fontSize: 12, marginBottom: 12 }}>
                    {page.edited_by
                      ? t('communities.wikiEditedBy', { user: page.edited_by })
                      : t('communities.wikiEdited')}
                    {page.edited_at ? ` · ${page.edited_at}` : ''}
                  </Text>
                )}
                <Text style={[styles.article, { color: colors.text }]}>
                  {page?.body || t('communities.wikiNoContent')}
                </Text>
              </>
            )}
          </ScrollView>
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  body: { padding: 16, paddingBottom: 40 },
  input: { borderWidth: 1, borderRadius: 12, padding: 12, fontSize: 15 },
  bodyInput: { minHeight: 220, textAlignVertical: 'top' },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 8 },
  btn: { borderRadius: 999, paddingHorizontal: 16, paddingVertical: 10 },
  article: { fontSize: 15, lineHeight: 24 },
});
