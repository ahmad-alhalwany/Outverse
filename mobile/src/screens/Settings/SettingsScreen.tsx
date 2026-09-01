import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { displayName } from '@/lib/names';
import { registerForPushNotifications } from '@/lib/push';
import {
  DEFAULT_SETTINGS,
  asSettingsPrefs,
  settingsPayload,
  useSettingsPalette,
  type SettingsPrefs,
} from '@/lib/settings';
import {
  AccountCard,
  ChipRow,
  LinkRow,
  SectionTitle,
  ThemeGrid,
  ToggleRow,
  WeirdnessSlider,
} from './settingsParts';

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const { user, logout, isAuthenticated } = useAuth();
  const { colorScheme, setColorScheme, isDark } = useTheme();
  const C = useSettingsPalette(isDark);
  const { t, locale, setLocale, isRTL } = useLocale();

  const [prefs, setPrefs] = useState<SettingsPrefs>(DEFAULT_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [pushBusy, setPushBusy] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async () => {
    try {
      setPrefs(asSettingsPrefs(await api.getPreferences(), DEFAULT_SETTINGS));
    } catch {
      /* optional on older backends */
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const persist = async (next: SettingsPrefs, theme: 'light' | 'dark' = colorScheme === 'stardust' ? 'light' : colorScheme === 'light' ? 'light' : 'dark') => {
    setSaving(true);
    setStatus(t('settings.saving'));
    try {
      await api.updatePreferences(settingsPayload(next, theme));
      setStatus(t('settings.prefsSaved'));
    } catch {
      setStatus(t('settings.prefsSaveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const updatePrefs = (patch: Partial<SettingsPrefs>, delay = 0) => {
    const next = { ...prefs, ...patch };
    setPrefs(next);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    if (delay) {
      saveTimer.current = setTimeout(() => void persist(next), delay);
      return;
    }
    void persist(next);
  };

  const enablePush = async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      const result = await registerForPushNotifications();
      setStatus(result.ok ? t('settings.pushDeviceEnabled') : result.reason || t('settings.pushUnavailable'));
    } catch {
      setStatus(t('settings.pushUnavailable'));
    } finally {
      setPushBusy(false);
    }
  };

  const confirmLogout = () => {
    Alert.alert(t('settings.logOut'), t('settings.logOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('settings.logOut'), style: 'destructive', onPress: () => void logout() },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: C.page }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.backBtn}>
            <Ionicons name={isRTL ? 'arrow-forward' : 'arrow-back'} size={22} color={C.text} />
          </Pressable>
          <Text style={[styles.title, { color: C.text }]}>{t('settings.title')}</Text>
        </View>

        <View style={[styles.band, { backgroundColor: C.section }]}>
          <SectionTitle icon="globe-outline" title={t('settings.account')} C={C} />
          <AccountCard
            name={user ? displayName(user, '') : ''}
            email={user?.email || (user?.username ? `@${user.username}` : '')}
            avatar={user?.avatar ? mediaUrl(user.avatar) : ''}
            empty={t('settings.notSignedIn')}
            onPress={() => navigation.navigate(isAuthenticated ? 'EditProfile' : 'Login')}
            C={C}
          />
          {isAuthenticated ? (
            <View style={{ marginTop: 10 }}>
              <LinkRow
                icon="person-outline"
                label={t('mobile.editProfile')}
                hint={t('mobile.editProfileSub')}
                onPress={() => navigation.navigate('EditProfile')}
                C={C}
                rtl={isRTL}
              />
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <SectionTitle icon="color-palette-outline" title={t('settings.personalization')} C={C} />
          <Text style={[styles.blockLabel, { color: C.text }]}>{t('settings.moodTheme')}</Text>
          <ThemeGrid
            colorScheme={colorScheme}
            C={C}
            t={t}
            onPick={(theme) => {
              setColorScheme(theme);
              void persist(prefs, theme === 'stardust' ? 'light' : theme === 'nebula' ? 'dark' : theme);
            }}
          />

          <View style={styles.blockHead}>
            <Text style={[styles.blockLabel, { color: C.text, marginBottom: 0 }]}>{t('settings.weirdnessLevel')}</Text>
            <Pressable
              onPress={() => {
                const next = locale === 'en' ? 'ar' : 'en';
                setPrefs((prev) => ({ ...prev, locale: next }));
                void setLocale(next);
                void persist({ ...prefs, locale: next });
              }}
              style={[styles.langChip, { backgroundColor: C.card }]}
            >
              <Text style={[styles.langText, { color: C.icon }]}>{locale === 'en' ? 'EN' : 'AR'}</Text>
            </Pressable>
          </View>
          <WeirdnessSlider
            value={prefs.weirdness_level}
            onChange={(value) => updatePrefs({ weirdness_level: value }, 400)}
            C={C}
            t={t}
          />

          <LinkRow
            icon="sparkles-outline"
            label={t('mobile.tasteTitle')}
            hint={t('mobile.tasteSub')}
            onPress={() => navigation.navigate('InspirationTaste')}
            C={C}
            rtl={isRTL}
          />

          <Text style={[styles.blockLabel, { color: C.text }]}>{t('settings.bottleFrequency')}</Text>
          <ChipRow
            value={prefs.message_frequency}
            options={[
              { id: 'hourly', label: t('settings.freqFrequent') },
              { id: 'daily', label: t('settings.freqBalanced') },
              { id: 'weekly', label: t('settings.freqRare') },
            ]}
            onChange={(id) => updatePrefs({ message_frequency: id as SettingsPrefs['message_frequency'] })}
            C={C}
          />
        </View>

        <View style={[styles.band, { backgroundColor: C.section }]}>
          <SectionTitle icon="notifications-outline" title={t('settings.notificationsTitle')} C={C} />
          {(
            [
              ['likes', t('settings.notifLikes'), 'heart-outline'],
              ['comments', t('settings.notifComments'), 'chatbubble-outline'],
              ['follows', t('settings.notifFollows'), 'person-add-outline'],
              ['shop', t('settings.notifShop'), 'storefront-outline'],
              ['reels', t('mobile.notifReels'), 'radio-outline'],
              ['ideas', t('mobile.notifIdeas'), 'bulb-outline'],
              ['stories', t('mobile.notifStories'), 'book-outline'],
              ['bottles', t('mobile.notifBottles'), 'wine-outline'],
            ] as const
          ).map(([key, label, icon]) => (
            <ToggleRow
              key={key}
              icon={icon}
              label={label}
              checked={prefs.notification_prefs[key]}
              onChange={(value) =>
                updatePrefs({ notification_prefs: { ...prefs.notification_prefs, [key]: value } })
              }
              C={C}
            />
          ))}
          <ToggleRow
            icon="moon-outline"
            label={t('mobile.quietHours')}
            hint={t('mobile.quietHoursSub')}
            checked={prefs.quiet_hours_enabled}
            onChange={(value) => updatePrefs({ quiet_hours_enabled: value })}
            C={C}
          />
          {prefs.quiet_hours_enabled ? (
            <View style={styles.timeRow}>
              <TextInput
                value={prefs.quiet_hours_start}
                onChangeText={(text) => setPrefs((prev) => ({ ...prev, quiet_hours_start: text }))}
                onBlur={() => setPrefs((prev) => {
                  void persist(prev);
                  return prev;
                })}
                placeholder="22:00"
                placeholderTextColor={C.textSoft}
                style={[styles.timeInput, { color: C.text, borderColor: C.border, backgroundColor: C.white }]}
              />
              <Text style={{ color: C.textMuted }}>{t('social.quietHoursTo')}</Text>
              <TextInput
                value={prefs.quiet_hours_end}
                onChangeText={(text) => setPrefs((prev) => ({ ...prev, quiet_hours_end: text }))}
                onBlur={() => setPrefs((prev) => {
                  void persist(prev);
                  return prev;
                })}
                placeholder="08:00"
                placeholderTextColor={C.textSoft}
                style={[styles.timeInput, { color: C.text, borderColor: C.border, backgroundColor: C.white }]}
              />
            </View>
          ) : null}
          <Pressable
            onPress={() => void enablePush()}
            disabled={pushBusy}
            style={[styles.pushBtn, { backgroundColor: C.cardStrong, opacity: pushBusy ? 0.6 : 1 }]}
          >
            {pushBusy ? <ActivityIndicator color="#fff" /> : (
              <Text style={styles.pushText}>{t('settings.enableBrowserPush')}</Text>
            )}
          </Pressable>
          <Text style={[styles.status, { color: C.textMuted }]}>
            {saving ? t('settings.saving') : status || t('settings.prefsSyncHint')}
          </Text>
        </View>

        <View style={styles.section}>
          <SectionTitle icon="planet-outline" title={t('settings.innerOrbit')} C={C} />
          <LinkRow
            icon="people-outline"
            label={t('settings.innerOrbit')}
            hint={t('mobile.innerOrbitSub')}
            onPress={() => navigation.navigate('OrbitFriends')}
            C={C}
            rtl={isRTL}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle icon="radio-outline" title={t('signal.publishTitle')} C={C} />
          <Text style={[styles.hint, { color: C.textMuted }]}>{t('signal.publishHint')}</Text>
          <Text style={[styles.blockLabel, { color: C.text }]}>{t('compose.replyControl')}</Text>
          <ChipRow
            value={prefs.default_reply_control}
            options={[
              { id: 'everyone', label: t('compose.replyEveryone') },
              { id: 'followers', label: t('compose.replyFollowers') },
              { id: 'nobody', label: t('compose.replyNobody') },
            ]}
            onChange={(id) =>
              updatePrefs({ default_reply_control: id as SettingsPrefs['default_reply_control'] })
            }
            C={C}
          />
          <Pressable onPress={() => navigation.navigate('OrbitLists')}>
            <Text style={[styles.inlineLink, { color: C.icon }]}>{t('nav.orbitLists')} →</Text>
          </Pressable>
        </View>

        <View style={styles.section}>
          <SectionTitle icon="pulse-outline" title={t('reels.pulseCreator')} C={C} />
          <Text style={[styles.hint, { color: C.textMuted, marginBottom: 8 }]}>{t('reels.pulseCreatorHint')}</Text>
          <ToggleRow
            icon="git-branch-outline"
            label={t('reels.allowRemix')}
            checked={prefs.default_allow_remix}
            onChange={(value) => updatePrefs({ default_allow_remix: value })}
            C={C}
          />
          <ToggleRow
            icon="layers-outline"
            label={t('reels.allowWeave')}
            checked={prefs.default_allow_weave}
            onChange={(value) => updatePrefs({ default_allow_weave: value })}
            C={C}
          />
          <ToggleRow
            icon="download-outline"
            label={t('reels.allowExport')}
            checked={prefs.default_allow_download}
            onChange={(value) => updatePrefs({ default_allow_download: value })}
            C={C}
          />
          <Pressable onPress={() => navigation.navigate('ReelsDiscover')}>
            <Text style={[styles.inlineLink, { color: C.icon }]}>{t('reels.creatorStats')} →</Text>
          </Pressable>
        </View>

        <View style={[styles.band, { backgroundColor: C.section }]}>
          <SectionTitle icon="chatbubbles-outline" title={t('settings.messaging')} C={C} />
          <ToggleRow
            icon="checkmark-done-outline"
            label={t('settings.readReceipts')}
            hint={t('settings.readReceiptsHint')}
            checked={prefs.read_receipts_enabled}
            onChange={(value) => updatePrefs({ read_receipts_enabled: value })}
            C={C}
          />
          <ToggleRow
            icon="ellipse-outline"
            label={t('mobile.onlineStatus')}
            hint={t('mobile.onlineStatusSub')}
            checked={prefs.online_status_visible}
            onChange={(value) => updatePrefs({ online_status_visible: value })}
            C={C}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle icon="shield-checkmark-outline" title={t('security.title')} C={C} />
          <LinkRow
            icon="lock-closed-outline"
            label={t('mobile.twoFactor')}
            hint={t('mobile.twoFactorSub')}
            onPress={() => navigation.navigate('TwoFactorSetup')}
            C={C}
            rtl={isRTL}
          />
          <LinkRow
            icon="document-text-outline"
            label={t('mobile.appeals')}
            hint={t('mobile.appealsSub')}
            onPress={() => navigation.navigate('Appeals')}
            C={C}
            rtl={isRTL}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle icon="eye-off-outline" title={t('social.privacyTitle')} C={C} />
          <LinkRow
            icon="lock-closed-outline"
            label={t('settings.privacy')}
            hint={t('mobile.privacySub')}
            onPress={() => navigation.navigate('Privacy')}
            C={C}
            rtl={isRTL}
          />
          <LinkRow
            icon="ban-outline"
            label={t('social.blockedAccountsTitle')}
            hint={t('mobile.blockedSub')}
            onPress={() => navigation.navigate('BlockedAccounts')}
            C={C}
            rtl={isRTL}
          />
        </View>

        <View style={styles.section}>
          <SectionTitle icon="information-circle-outline" title={t('settings.legal')} C={C} />
          <LinkRow
            icon="lock-closed-outline"
            label={t('legal.privacyTitle')}
            hint={t('mobile.privacyPolicySub')}
            onPress={() => navigation.navigate('Legal', { page: 'privacy' })}
            C={C}
            rtl={isRTL}
          />
          <LinkRow
            icon="document-text-outline"
            label={t('legal.termsTitle')}
            hint={t('mobile.termsSub')}
            onPress={() => navigation.navigate('Legal', { page: 'terms' })}
            C={C}
            rtl={isRTL}
          />
          <LinkRow
            icon="planet-outline"
            label={t('mobile.about')}
            hint={t('mobile.aboutSub')}
            onPress={() => navigation.navigate('Legal', { page: 'about' })}
            C={C}
            rtl={isRTL}
          />
          <LinkRow
            icon="help-circle-outline"
            label={t('mobile.faq')}
            hint={t('mobile.faqSub')}
            onPress={() => navigation.navigate('Legal', { page: 'faq' })}
            C={C}
            rtl={isRTL}
          />
          <LinkRow
            icon="chatbubbles-outline"
            label={t('settings.messageSettings')}
            onPress={() => navigation.navigate('Chat')}
            C={C}
            rtl={isRTL}
          />
          {user?.is_staff ? (
            <LinkRow
              icon="shield-outline"
              label={t('mobile.adminEntry')}
              hint={t('mobile.adminSub')}
              onPress={() => navigation.navigate('Admin')}
              C={C}
              rtl={isRTL}
            />
          ) : null}
        </View>

        {isAuthenticated ? (
          <Pressable onPress={confirmLogout} style={[styles.logout, { backgroundColor: C.cardStrong }]}>
            <Ionicons name="log-out-outline" size={20} color="#FFFFFF" />
            <Text style={styles.logoutText}>{t('settings.logOut')}</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => navigation.navigate('Login')} style={[styles.logout, { backgroundColor: C.cardStrong }]}>
            <Text style={styles.logoutText}>{t('settings.signIn')}</Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingBottom: 18, paddingTop: 8 },
  backBtn: { padding: 4 },
  title: { fontSize: 30, fontWeight: '700', letterSpacing: -0.6 },
  band: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 18, marginBottom: 8 },
  section: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 18 },
  blockLabel: { fontSize: 16, fontWeight: '700', marginTop: 14, marginBottom: 10 },
  blockHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 10 },
  langChip: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 },
  langText: { fontSize: 12, fontWeight: '800' },
  hint: { fontSize: 13, lineHeight: 19, marginBottom: 10 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  timeInput: { flex: 1, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  pushBtn: { borderRadius: 14, paddingVertical: 13, alignItems: 'center', marginTop: 10 },
  pushText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  status: { fontSize: 13, marginTop: 10 },
  inlineLink: { fontSize: 13, fontWeight: '700', marginTop: 12 },
  logout: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  logoutText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
