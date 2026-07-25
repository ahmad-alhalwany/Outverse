import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  Alert,
  RefreshControl,
  TextInput,
  TouchableOpacity,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { api } from '@/api/client';
import {
  WorldBackdrop,
  WorldCard,
  WorldHeader,
  WorldHero,
  WorldPrimaryButton,
  WorldStat,
} from '@/components/world/WorldChrome';

type YearStats = {
  year?: number;
  posts_count?: number;
  words_written?: number;
  capsules_opened?: number;
  ritual_streak?: number;
};

type Collection = {
  id: number;
  name: string;
  item_count: number;
  is_public?: boolean;
};

export default function VaultScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [yearStats, setYearStats] = useState<YearStats | null>(null);
  const [capsuleStats, setCapsuleStats] = useState<{ sealed?: number; ready?: number; opened?: number } | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionName, setCollectionName] = useState('');
  const [collectionBusy, setCollectionBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (isRefresh = false) => {
    try {
      const [year, caps, savedCollections] = await Promise.all([
        api.getYearStats().catch(() => null),
        api.getCapsuleStats().catch(() => null),
        api.getCollections().catch(() => []),
      ]);
      setYearStats(year as YearStats | null);
      setCapsuleStats(caps);
      setCollections(Array.isArray(savedCollections) ? savedCollections : []);
    } catch (error) {
      console.error('Failed to load vault:', error);
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleCollectionPublic = async (collection: Collection) => {
    setCollectionBusy(true);
    try {
      const updated = await api.updateCollection(collection.id, {
        is_public: !collection.is_public,
      });
      setCollections((prev) => prev.map((item) => (item.id === collection.id ? updated : item)));
    } catch {
      Alert.alert('Error', 'Could not update collection visibility.');
    } finally {
      setCollectionBusy(false);
    }
  };

  const createCollection = async (isPublic: boolean) => {
    if (!collectionName.trim()) {
      Alert.alert('Name required', 'Add a collection name.');
      return;
    }
    setCollectionBusy(true);
    try {
      const created = await api.createCollection(collectionName.trim(), isPublic);
      setCollections((prev) => [created, ...prev]);
      setCollectionName('');
    } catch {
      Alert.alert('Error', 'Could not create collection.');
    } finally {
      setCollectionBusy(false);
    }
  };

  return (
    <WorldBackdrop tone="vault">
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title="The Vault"
          subtitle="Emotional archive"
          tone="vault"
          onBack={() => navigation.goBack()}
        />
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(true);
              }}
              colors={[colors.primary]}
            />
          }
        >
          <WorldHero
            tone="vault"
            eyebrow="One world"
            title="Bottles, capsules, and the moods that shaped you"
            body="Open a chamber of the archive — or revisit the year that made you."
          />

          <WorldCard onPress={() => navigation.navigate('Bottles')}>
            <Text style={[styles.kicker, { color: colors.primary }]}>Bottles</Text>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Drift & catch</Text>
            <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
              Throw anonymous feelings into the current and catch what washes ashore.
            </Text>
          </WorldCard>

          <WorldCard onPress={() => navigation.navigate('Capsules')}>
            <Text style={[styles.kicker, { color: colors.primary }]}>Capsules</Text>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Messages to future-you</Text>
            <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
              {capsuleStats
                ? `${capsuleStats.sealed ?? 0} sealed · ${capsuleStats.ready ?? 0} ready · ${capsuleStats.opened ?? 0} opened`
                : 'Seal a note that opens on the date you choose.'}
            </Text>
          </WorldCard>

          <WorldCard>
            <Text style={[styles.kicker, { color: colors.primary }]}>Public boards</Text>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Saved collections</Text>
            <Text style={[styles.cardBody, { color: colors.textSecondary }]}>
              Publish a collection to turn it into a shareable public board.
            </Text>
            <View style={styles.collectionForm}>
              <TextInput
                value={collectionName}
                onChangeText={setCollectionName}
                placeholder="Collection name"
                placeholderTextColor={colors.textSecondary}
                style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              />
              <View style={styles.collectionActions}>
                <TouchableOpacity
                  disabled={collectionBusy || !collectionName.trim()}
                  onPress={() => void createCollection(false)}
                  style={[styles.secondaryBtn, { borderColor: colors.border, opacity: collectionBusy || !collectionName.trim() ? 0.5 : 1 }]}
                >
                  <Text style={[styles.secondaryText, { color: colors.text }]}>Create</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  disabled={collectionBusy || !collectionName.trim()}
                  onPress={() => void createCollection(true)}
                  style={[styles.primaryBtn, { backgroundColor: colors.primary, opacity: collectionBusy || !collectionName.trim() ? 0.5 : 1 }]}
                >
                  <Text style={styles.primaryText}>Create public</Text>
                </TouchableOpacity>
              </View>
            </View>
            {collections.length === 0 ? (
              <Text style={[styles.empty, { color: colors.textSecondary }]}>No saved collections yet.</Text>
            ) : (
              collections.map((collection) => (
                <TouchableOpacity
                  key={collection.id}
                  onPress={() => {
                    if (collection.is_public) {
                      navigation.navigate('PublicBoard', { collectionId: collection.id });
                    } else {
                      Alert.alert('Private collection', 'Make this collection public to open its board.');
                    }
                  }}
                  style={[styles.collectionRow, { borderColor: colors.border }]}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.collectionTitle, { color: colors.text }]} numberOfLines={1}>
                      {collection.name}
                    </Text>
                    <Text style={[styles.collectionMeta, { color: colors.textSecondary }]}>
                      {collection.item_count ?? 0} items - {collection.is_public ? 'public' : 'private'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    disabled={collectionBusy}
                    onPress={() => void toggleCollectionPublic(collection)}
                    style={[styles.visibilityBtn, { borderColor: collection.is_public ? colors.primary : colors.border }]}
                  >
                    <Text style={{ color: collection.is_public ? colors.primary : colors.text, fontWeight: '800', fontSize: 12 }}>
                      {collection.is_public ? 'Public' : 'Make public'}
                    </Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))
            )}
          </WorldCard>

          {loading && !yearStats ? (
            <ActivityIndicator color={colors.primary} style={{ marginTop: 12 }} />
          ) : yearStats ? (
            <WorldCard>
              <Text style={[styles.kicker, { color: colors.primary }]}>
                {yearStats.year || new Date().getFullYear()} in feelings
              </Text>
              <View style={styles.statsRow}>
                <WorldStat label="Posts" value={yearStats.posts_count ?? 0} />
                <WorldStat label="Words" value={yearStats.words_written ?? 0} />
                <WorldStat label="Streak" value={yearStats.ritual_streak ?? 0} />
              </View>
              <View style={{ marginTop: 12 }}>
                <WorldPrimaryButton label="Open Passports" onPress={() => navigation.navigate('Passport')} />
              </View>
            </WorldCard>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  kicker: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  cardTitle: { fontSize: 20, fontWeight: '800', marginBottom: 6 },
  cardBody: { fontSize: 14, lineHeight: 21 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  collectionForm: { gap: 8, marginTop: 12 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, fontSize: 14 },
  collectionActions: { flexDirection: 'row', gap: 8 },
  primaryBtn: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 12 },
  secondaryBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  secondaryText: { fontWeight: '800', fontSize: 12 },
  collectionRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 11,
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  collectionTitle: { fontSize: 14, fontWeight: '800' },
  collectionMeta: { fontSize: 12, marginTop: 2 },
  visibilityBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6 },
  empty: { marginTop: 12, fontSize: 13 },
});
