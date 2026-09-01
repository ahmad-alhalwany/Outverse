import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import {
  WorldBackdrop,
  WorldCard,
  WorldHeader,
  WorldHero,
} from '@/components/world/WorldChrome';

const WORLDS = [
  ['Year', 'nav.year', 'mobile.worldYearBody'],
  ['Library', 'nav.library', 'mobile.worldLibraryBody'],
  ['Museum', 'nav.museum', 'mobile.worldMuseumBody'],
  ['Garden', 'nav.garden', 'mobile.worldGardenBody'],
  ['Memories', 'nav.memories', 'mobile.worldMemoriesBody'],
  ['Characters', 'nav.characters', 'mobile.worldCharactersBody'],
  ['Simulator', 'nav.simulator', 'mobile.worldSimulatorBody'],
  ['Premium', 'nav.premium', 'mobile.worldPremiumBody'],
  ['Achievements', 'nav.achievements', 'mobile.worldAchievementsBody'],
  ['Analytics', 'nav.analytics', 'mobile.worldAnalyticsBody'],
  ['Collab', 'nav.collab', 'mobile.worldCollabBody'],
  ['DrawStudio', 'nav.studio', 'mobile.worldStudioBody'],
  ['Forge', 'forge.title', 'mobile.worldForgeBody'],
  ['Ads', 'ads.title', 'mobile.worldAdsBody'],
  ['Following', 'nav.following', 'mobile.worldFollowingBody'],
  ['Followers', 'mobile.worldFollowers', 'mobile.worldFollowersBody'],
  ['Sound', 'mobile.originalSignal', 'mobile.worldSoundBody'],
  ['PromptRooms', 'mobile.worldPromptRooms', 'mobile.worldRoomsBody'],
  ['ShopSeller', 'mobile.worldSeller', 'mobile.worldSellerBody'],
  ['TwoFactorSetup', 'mobile.twoFactor', 'mobile.worldTwoFactorBody'],
  ['Admin', 'admin.panelTitle', 'mobile.worldAdminBody'],
] as const;

export default function WorldsHubScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { t } = useLocale();

  return (
    <WorldBackdrop tone="default">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title={t('mobile.worldsTitle')}
          subtitle={t('mobile.worldsMap')}
          tone="default"
          onBack={() => navigation.goBack()}
        />
        <ScrollView contentContainerStyle={styles.content}>
          <WorldHero
            tone="default"
            eyebrow={t('mobile.worldsHeroEyebrow')}
            title={t('mobile.worldsHeroTitle')}
            body={t('mobile.worldsHeroBody')}
          />
          <View style={styles.grid}>
            {WORLDS.map(([route, labelKey, bodyKey]) => (
              <WorldCard
                key={route}
                style={styles.card}
                onPress={() => navigation.navigate(route)}
              >
                <Text style={[styles.cardTitle, { color: colors.text }]}>{t(labelKey)}</Text>
                <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{t(bodyKey)}</Text>
              </WorldCard>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 48 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '48%', minHeight: 112, marginBottom: 0 },
  cardTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  cardBody: { fontSize: 13, lineHeight: 18 },
});
