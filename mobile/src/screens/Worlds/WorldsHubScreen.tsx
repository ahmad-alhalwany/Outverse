import React from 'react';
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import {
  WorldBackdrop,
  WorldCard,
  WorldHeader,
  WorldHero,
} from '@/components/world/WorldChrome';

const WORLDS = [
  ['Year', 'Year in Cosmory', 'Annual stats'],
  ['Library', 'Library', 'Resources and downloads'],
  ['Museum', 'Museum', 'Failed ideas archive'],
  ['Garden', 'Garden', 'Fresh ideas'],
  ['Memories', 'Memories', 'Future memories'],
  ['Characters', 'Characters', 'Summoned personas'],
  ['Simulator', 'Simulator', 'Personal analytics'],
  ['Premium', 'Premium', 'Plans and checkout'],
  ['Achievements', 'Achievements', 'Profile milestones'],
  ['Analytics', 'Analytics', 'Creator signals'],
  ['Collab', 'Collab', 'Projects and tasks'],
  ['DrawStudio', 'Draw Studio', 'Drawing sessions'],
  ['Forge', 'Forge', 'Stories and segments'],
  ['Ads', 'Ads', 'Campaigns'],
  ['Following', 'Following', 'People you follow'],
  ['Followers', 'Followers', 'Your audience'],
  ['Sound', 'Sound', 'Reels by track'],
  ['PromptRooms', 'Prompt Rooms', 'Prompted chats'],
  ['ShopSeller', 'Seller Shop', 'Sales and transactions'],
  ['TwoFactorSetup', 'Two-Factor', 'Account security'],
  ['Admin', 'Admin', 'Health, chat, audit'],
] as const;

export default function WorldsHubScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();

  return (
    <WorldBackdrop tone="default">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title="Worlds"
          subtitle="Cosmory map"
          tone="default"
          onBack={() => navigation.goBack()}
        />
        <ScrollView contentContainerStyle={styles.content}>
          <WorldHero
            tone="default"
            eyebrow="Mobile parity"
            title="Every web world in your pocket"
            body="Jump into the same Cosmory worlds from mobile."
          />
          <View style={styles.grid}>
            {WORLDS.map(([route, label, body]) => (
              <WorldCard
                key={route}
                style={styles.card}
                onPress={() => navigation.navigate(route)}
              >
                <Text style={[styles.cardTitle, { color: colors.text }]}>{label}</Text>
                <Text style={[styles.cardBody, { color: colors.textSecondary }]}>{body}</Text>
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
