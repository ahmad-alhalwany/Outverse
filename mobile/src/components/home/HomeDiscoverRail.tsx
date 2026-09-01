import React, { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { openProfile } from '@/lib/nav';

type Creator = {
  id: number;
  username: string;
  avatar?: string | null;
  is_following?: boolean;
};

export default function HomeDiscoverRail() {
  const { colors, isDark } = useTheme();
  const { t } = useLocale();
  const { user } = useAuth();
  const navigation = useNavigation<any>();
  const [creators, setCreators] = useState<Creator[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const rows = (await api.getSuggestions(user?.id)) as Creator[];
        setCreators(Array.isArray(rows) ? rows.slice(0, 8) : []);
      } catch {
        setCreators([]);
      }
    })();
  }, [user?.id]);

  const toggleFollow = async (creator: Creator) => {
    try {
      const res = await api.toggleFollow(creator.id);
      setCreators((prev) =>
        prev.map((c) =>
          c.id === creator.id
            ? { ...c, is_following: res.is_following ?? res.following ?? !c.is_following }
            : c,
        ),
      );
    } catch {
      /* follow toggle is best-effort — keep the rail usable even if it fails */
    }
  };

  if (creators.length === 0) return null;

  return (
    <View style={[styles.card, { backgroundColor: isDark ? 'rgba(42,33,84,0.6)' : colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>{t('mobile.creatorsLike')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {creators.map((c) => {
          const uri = mediaUrl(c.avatar || '') || c.avatar;
          return (
            <View key={c.id} style={styles.item}>
              <Pressable onPress={() => openProfile(navigation, c.username, user?.username)}>
                {uri ? (
                  <Image source={{ uri }} style={styles.avatar} />
                ) : (
                  <LinearGradient colors={['#7C3AED', '#2196F3']} style={styles.avatarFallback}>
                    <Text style={styles.avatarText}>{c.username.slice(0, 2).toUpperCase()}</Text>
                  </LinearGradient>
                )}
              </Pressable>
              <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                {c.username}
              </Text>
              <Pressable
                onPress={() => void toggleFollow(c)}
                style={[
                  styles.follow,
                  { backgroundColor: c.is_following ? 'rgba(156,39,176,0.2)' : 'rgba(33,150,243,0.15)' },
                ]}
              >
                <Text style={[styles.followText, { color: c.is_following ? colors.vault : colors.bazaar }]}>
                  {c.is_following ? t('feed.following') : t('feed.follow')}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 16, borderWidth: 1, padding: 14, marginBottom: 16 },
  title: { fontSize: 14, fontWeight: '800', marginBottom: 12 },
  row: { gap: 12, paddingRight: 8 },
  item: { width: 72, alignItems: 'center', gap: 6 },
  avatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: 'rgba(124,58,237,0.35)' },
  avatarFallback: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  name: { fontSize: 10, fontWeight: '600', width: '100%', textAlign: 'center' },
  follow: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, minHeight: 24, justifyContent: 'center' },
  followText: { fontSize: 10, fontWeight: '800' },
});
