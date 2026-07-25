import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Switch,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';

/** Pulse creator defaults — mirrors web Settings. */
export default function PulseCreatorSettingsScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [allowRemix, setAllowRemix] = useState(true);
  const [allowWeave, setAllowWeave] = useState(true);
  const [allowDownload, setAllowDownload] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const prefs = await api.getPreferences();
      setAllowRemix(prefs.default_allow_remix !== false);
      setAllowWeave(prefs.default_allow_weave !== false);
      setAllowDownload(Boolean(prefs.default_allow_download));
    } catch {
      /* keep defaults */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async (patch: {
    default_allow_remix?: boolean;
    default_allow_weave?: boolean;
    default_allow_download?: boolean;
  }) => {
    setSaving(true);
    try {
      await api.updatePreferences({
        default_allow_remix: patch.default_allow_remix ?? allowRemix,
        default_allow_weave: patch.default_allow_weave ?? allowWeave,
        default_allow_download: patch.default_allow_download ?? allowDownload,
      });
    } catch {
      Alert.alert('Error', 'Could not save Pulse creator defaults.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()}>
          <Text style={{ color: colors.text, fontWeight: '700' }}>Back</Text>
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Pulse creator</Text>
        <View style={{ width: 40 }} />
      </View>

      <Text style={[styles.hint, { color: colors.textSecondary }]}>
        Defaults applied to new signals you launch — Remix, Weave, and export.
      </Text>

      {loading ? (
        <ActivityIndicator color="#A78BFA" style={{ marginTop: 32 }} />
      ) : (
        <View style={{ padding: 16, gap: 4 }}>
          <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.text }]}>Allow Remix</Text>
            <Switch
              value={allowRemix}
              onValueChange={(v) => {
                setAllowRemix(v);
                void save({ default_allow_remix: v });
              }}
              disabled={saving}
              trackColor={{ true: '#7C3AED', false: colors.border }}
            />
          </View>
          <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.text }]}>Allow Weave</Text>
            <Switch
              value={allowWeave}
              onValueChange={(v) => {
                setAllowWeave(v);
                void save({ default_allow_weave: v });
              }}
              disabled={saving}
              trackColor={{ true: '#7C3AED', false: colors.border }}
            />
          </View>
          <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.label, { color: colors.text }]}>Allow export</Text>
            <Switch
              value={allowDownload}
              onValueChange={(v) => {
                setAllowDownload(v);
                void save({ default_allow_download: v });
              }}
              disabled={saving}
              trackColor={{ true: '#7C3AED', false: colors.border }}
            />
          </View>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 17, fontWeight: '800' },
  hint: {
    paddingHorizontal: 16,
    paddingTop: 12,
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  label: { fontSize: 15, fontWeight: '700' },
});
