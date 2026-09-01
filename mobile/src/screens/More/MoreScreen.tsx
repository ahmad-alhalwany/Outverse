import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/auth/AuthContext';
import { useLocale } from '@/i18n/LocaleProvider';

type MoreItem = {
  labelKey: string;
  icon: keyof typeof Ionicons.glyphMap;
  screen: string;
};

type MoreSection = { titleKey: string; items: MoreItem[]; accent: string };

const SECTIONS: MoreSection[] = [
  {
    titleKey: 'nav.sectionCreate',
    accent: '#7C3AED',
    items: [
      { labelKey: 'nav.lab', icon: 'flask-outline', screen: 'Lab' },
      { labelKey: 'nav.bazaar', icon: 'bag-handle-outline', screen: 'Bazaar' },
      { labelKey: 'nav.story', icon: 'book-outline', screen: 'Forge' },
      { labelKey: 'nav.studio', icon: 'color-palette-outline', screen: 'DrawStudio' },
      { labelKey: 'nav.simulator', icon: 'planet-outline', screen: 'Simulator' },
    ],
  },
  {
    titleKey: 'nav.sectionExplore',
    accent: '#2563EB',
    items: [
      { labelKey: 'nav.discover', icon: 'compass-outline', screen: 'Explore' },
      { labelKey: 'nav.storyMap', icon: 'map-outline', screen: 'StoryMap' },
      { labelKey: 'nav.videos', icon: 'film-outline', screen: 'Videos' },
      { labelKey: 'nav.garden', icon: 'leaf-outline', screen: 'Garden' },
      { labelKey: 'nav.museum', icon: 'library-outline', screen: 'Museum' },
      { labelKey: 'nav.characters', icon: 'sparkles-outline', screen: 'Characters' },
    ],
  },
  {
    titleKey: 'nav.sectionSocial',
    accent: '#0D9488',
    items: [
      { labelKey: 'nav.chat', icon: 'chatbubbles-outline', screen: 'Chat' },
      { labelKey: 'nav.rooms', icon: 'albums-outline', screen: 'PromptRooms' },
      { labelKey: 'nav.communities', icon: 'people-circle-outline', screen: 'Communities' },
      { labelKey: 'nav.collab', icon: 'git-network-outline', screen: 'Collab' },
    ],
  },
  {
    titleKey: 'nav.sectionCommerce',
    accent: '#DB2777',
    items: [
      { labelKey: 'nav.shop', icon: 'cart-outline', screen: 'Shop' },
      { labelKey: 'nav.wallet', icon: 'wallet-outline', screen: 'Wallet' },
      { labelKey: 'nav.premium', icon: 'heart-outline', screen: 'Premium' },
    ],
  },
  {
    titleKey: 'nav.sectionLibrary',
    accent: '#7C3AED',
    items: [
      { labelKey: 'nav.vault', icon: 'archive-outline', screen: 'Vault' },
      { labelKey: 'nav.saved', icon: 'bookmark-outline', screen: 'Saved' },
      { labelKey: 'nav.playlists', icon: 'list-outline', screen: 'Playlists' },
      { labelKey: 'nav.capsules', icon: 'hourglass-outline', screen: 'Capsules' },
      { labelKey: 'nav.library', icon: 'library-outline', screen: 'Library' },
      { labelKey: 'nav.memories', icon: 'images-outline', screen: 'Memories' },
      { labelKey: 'nav.orbitLists', icon: 'albums-outline', screen: 'OrbitLists' },
      { labelKey: 'nav.boards', icon: 'grid-outline', screen: 'PublicBoard' },
    ],
  },
  {
    titleKey: 'nav.sectionStats',
    accent: '#EA580C',
    items: [
      { labelKey: 'nav.year', icon: 'trophy-outline', screen: 'Year' },
      { labelKey: 'nav.achievements', icon: 'ribbon-outline', screen: 'Achievements' },
      { labelKey: 'nav.analytics', icon: 'stats-chart-outline', screen: 'Analytics' },
    ],
  },
];

export default function MoreScreen() {
  const navigation = useNavigation<any>();
  const { colors, isDark } = useTheme();
  const { t, isRTL } = useLocale();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const isCompact = width < 360;
  const gutter = isCompact ? 12 : width >= 768 ? 28 : 16;
  const moreColumns = isCompact ? 2 : width < 420 ? 3 : width >= 768 ? 4 : 3;
  const cellWidth = `${100 / moreColumns}%` as const;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]} edges={['top']}>
      <View style={[styles.titleRow, { paddingHorizontal: gutter }]}>
        <Text style={[styles.title, { color: colors.text, textAlign: isRTL ? 'right' : 'left', fontSize: isCompact ? 22 : 26 }]}>
          {t('nav.more')}
        </Text>
      </View>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingHorizontal: gutter - 4, paddingBottom: 48 }]}>
        {SECTIONS.map((section) => (
          <View key={section.titleKey} style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary, textAlign: isRTL ? 'right' : 'left' }]}>
              {t(section.titleKey)}
            </Text>
            <View style={styles.grid}>
              {section.items.map((item) => (
                <Pressable
                  key={item.labelKey}
                  onPress={() => navigation.navigate(item.screen)}
                  accessibilityRole="button"
                  accessibilityLabel={t(item.labelKey)}
                  style={({ pressed }) => [
                    styles.cell,
                    {
                      width: cellWidth,
                      backgroundColor: pressed
                        ? 'rgba(124,58,237,0.12)'
                        : isDark
                          ? 'rgba(255,255,255,0.04)'
                          : 'rgba(255,255,255,0.72)',
                      borderColor: isDark ? 'rgba(196,181,253,0.12)' : 'rgba(124,58,237,0.10)',
                    },
                  ]}
                >
                  <View style={[styles.iconWrap, { backgroundColor: `${section.accent}22` }]}>
                    <Ionicons name={item.icon} size={22} color={section.accent} />
                  </View>
                  <Text style={[styles.cellLabel, { color: colors.text, fontSize: isCompact ? 11 : 12 }]} numberOfLines={2}>
                    {t(item.labelKey)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))}
        <View style={[styles.settingsWrap, { borderTopColor: colors.border }]}>
          {user?.is_staff ? (
            <Pressable
              onPress={() => navigation.navigate('Admin')}
              style={({ pressed }) => [
                styles.settings,
                {
                  backgroundColor: pressed ? 'rgba(124,58,237,0.12)' : isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="shield-checkmark-outline" size={20} color={colors.icon} />
              <Text style={[styles.settingsLabel, { color: colors.text }]}>{t('mobile.adminEntry')}</Text>
              <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textMuted} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => navigation.navigate('Settings')}
            style={({ pressed }) => [
              styles.settings,
              {
                backgroundColor: pressed ? 'rgba(124,58,237,0.12)' : isDark ? 'rgba(255,255,255,0.04)' : '#FFFFFF',
                borderColor: colors.border,
              },
            ]}
          >
            <Ionicons name="settings-outline" size={20} color={colors.icon} />
            <Text style={[styles.settingsLabel, { color: colors.text }]}>{t('nav.settings')}</Text>
            <Ionicons name={isRTL ? 'chevron-back' : 'chevron-forward'} size={18} color={colors.textMuted} />
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  titleRow: { paddingTop: 8, paddingBottom: 4 },
  title: { fontWeight: '800', letterSpacing: -0.3 },
  scroll: { paddingBottom: 40 },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 8,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    minHeight: 96,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cellLabel: { fontWeight: '600', textAlign: 'center', lineHeight: 15 },
  settingsWrap: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  settings: {
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    borderWidth: 1,
  },
  settingsLabel: { fontSize: 15, fontWeight: '600', flex: 1 },
});
