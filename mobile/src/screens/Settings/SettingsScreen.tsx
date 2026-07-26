import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';
import { registerForPushNotifications } from '@/lib/push';

type PreferenceState = {
  quiet_hours_enabled: boolean;
  quiet_hours_start: string;
  quiet_hours_end: string;
  read_receipts_enabled: boolean;
};

const LINKS = [
  { title: 'Saved', subtitle: 'Posts, reels, ideas, and stories you bookmarked', route: 'Saved' },
  { title: 'Search', subtitle: 'Find people, posts, ideas, and signals', route: 'Search' },
  { title: 'Orbit Friends', subtitle: 'Manage close friends for private stories', route: 'OrbitFriends' },
  { title: 'Signal Publish', subtitle: 'Default signal publishing controls', route: 'SignalPublish' },
  { title: 'Pulse Creator', subtitle: 'Reel remix, weave, and download defaults', route: 'PulseCreator' },
  { title: 'Orbit Lists', subtitle: 'Curate custom people lists and feeds', route: 'OrbitLists' },
  { title: 'Creator Studio', subtitle: 'Tiers, analytics, videos, and playlists', route: 'CreatorStudio' },
  { title: 'Two-Factor Auth', subtitle: 'Enable or manage 2FA', route: 'TwoFactorSetup' },
  { title: 'Worlds Hub', subtitle: 'Forge, Museum, Garden, and more', route: 'WorldsHub' },
  { title: 'Admin', subtitle: 'Health, chat overview, audit', route: 'Admin' },
];

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [prefs, setPrefs] = useState<PreferenceState>({
    quiet_hours_enabled: false,
    quiet_hours_start: '22:00',
    quiet_hours_end: '08:00',
    read_receipts_enabled: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getPreferences();
      setPrefs((prev) => ({
        ...prev,
        quiet_hours_enabled: Boolean(data.quiet_hours_enabled),
        quiet_hours_start: data.quiet_hours_start || prev.quiet_hours_start,
        quiet_hours_end: data.quiet_hours_end || prev.quiet_hours_end,
        read_receipts_enabled: data.read_receipts_enabled !== false,
      }));
    } catch {
      /* preferences are optional on older backends */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const savePrefs = async (patch: Partial<PreferenceState>) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    setSaving(true);
    try {
      const updated = await api.updatePreferences(next);
      setPrefs((prev) => ({
        ...prev,
        ...updated,
        quiet_hours_enabled: Boolean(updated.quiet_hours_enabled ?? next.quiet_hours_enabled),
        read_receipts_enabled: updated.read_receipts_enabled !== false,
      }));
    } catch {
      setPrefs(prefs);
      Alert.alert('Error', 'Could not update preferences.');
    } finally {
      setSaving(false);
    }
  };

  const enablePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const result = await registerForPushNotifications();
      if (result.ok) {
        Alert.alert('Push enabled', 'This device is now subscribed to Cosmory notifications.');
      } else {
        Alert.alert('Push unavailable', result.reason || 'Could not enable push notifications.');
      }
    } catch {
      Alert.alert('Push unavailable', 'Could not subscribe this device for notifications.');
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ fontSize: 22, color: colors.text }}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Settings</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Hub</Text>
          {LINKS.map((link) => (
            <TouchableOpacity
              key={link.route}
              onPress={() => navigation.navigate(link.route)}
              style={[styles.linkRow, { borderTopColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={[styles.linkTitle, { color: colors.text }]}>{link.title}</Text>
                <Text style={[styles.linkSub, { color: colors.textSecondary }]}>{link.subtitle}</Text>
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 18 }}>›</Text>
            </TouchableOpacity>
          ))}
          <View style={[styles.disabledRow, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.linkTitle, { color: colors.textSecondary }]}>Onboarding</Text>
              <Text style={[styles.linkSub, { color: colors.textSecondary }]}>Skip not available after setup</Text>
            </View>
            <Text style={{ color: colors.textSecondary }}>N/A</Text>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Privacy & Availability</Text>
            {loading || saving ? <ActivityIndicator color={colors.primary} size="small" /> : null}
          </View>
          <View style={[styles.prefRow, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.linkTitle, { color: colors.text }]}>Quiet hours</Text>
              <Text style={[styles.linkSub, { color: colors.textSecondary }]}>Mute non-critical notifications overnight</Text>
            </View>
            <Switch
              value={prefs.quiet_hours_enabled}
              onValueChange={(value) => void savePrefs({ quiet_hours_enabled: value })}
              disabled={loading || saving}
            />
          </View>
          {prefs.quiet_hours_enabled ? (
            <View style={styles.timeRow}>
              <TextInput
                value={prefs.quiet_hours_start}
                onChangeText={(text) => setPrefs((prev) => ({ ...prev, quiet_hours_start: text }))}
                onBlur={() => void savePrefs({ quiet_hours_start: prefs.quiet_hours_start })}
                placeholder="22:00"
                placeholderTextColor={colors.textSecondary}
                style={[styles.timeInput, { color: colors.text, borderColor: colors.border }]}
              />
              <Text style={{ color: colors.textSecondary }}>to</Text>
              <TextInput
                value={prefs.quiet_hours_end}
                onChangeText={(text) => setPrefs((prev) => ({ ...prev, quiet_hours_end: text }))}
                onBlur={() => void savePrefs({ quiet_hours_end: prefs.quiet_hours_end })}
                placeholder="08:00"
                placeholderTextColor={colors.textSecondary}
                style={[styles.timeInput, { color: colors.text, borderColor: colors.border }]}
              />
            </View>
          ) : null}
          <View style={[styles.prefRow, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.linkTitle, { color: colors.text }]}>Read receipts</Text>
              <Text style={[styles.linkSub, { color: colors.textSecondary }]}>Show when your messages are read</Text>
            </View>
            <Switch
              value={prefs.read_receipts_enabled}
              onValueChange={(value) => void savePrefs({ read_receipts_enabled: value })}
              disabled={loading || saving}
            />
          </View>
          <View style={[styles.prefRow, { borderTopColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.linkTitle, { color: colors.text }]}>Push notifications</Text>
              <Text style={[styles.linkSub, { color: colors.textSecondary }]}>Subscribe this device for alerts and messages</Text>
            </View>
            <TouchableOpacity
              disabled={pushBusy}
              onPress={() => void enablePush()}
              style={[styles.pushButton, { backgroundColor: colors.primary, opacity: pushBusy ? 0.6 : 1 }]}
            >
              {pushBusy ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.pushButtonText}>Enable push</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 44, alignItems: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  content: { padding: 16, gap: 14, paddingBottom: 40 },
  section: { borderWidth: 1, borderRadius: 18, padding: 14 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  disabledRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth, opacity: 0.7 },
  linkTitle: { fontSize: 15, fontWeight: '800' },
  linkSub: { fontSize: 12, marginTop: 3, lineHeight: 16 },
  prefRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 12 },
  timeInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  pushButton: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, minWidth: 106, alignItems: 'center' },
  pushButtonText: { color: '#fff', fontSize: 12, fontWeight: '800' },
});
