import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { mediaUrl } from '@/api/config';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { WorldBackdrop, WorldHeader } from '@/components/world/WorldChrome';

type ListType = 'blocked' | 'muted' | 'restricted';
type SocialUser = { id: number; username: string; first_name?: string; last_name?: string; avatar?: string | null };

export default function BlockedAccountsScreen() {
  const navigation = useNavigation<any>();
  const { colors } = useTheme();
  const { t } = useLocale();
  const [active, setActive] = useState<ListType>('blocked');
  const [users, setUsers] = useState<SocialUser[]>([]);
  const [loading, setLoading] = useState(true);

  const tabs: Array<{ type: ListType; action: 'block' | 'mute' | 'restrict'; label: string; undo: string }> = [
    { type: 'blocked', action: 'block', label: t('social.tabBlocked'), undo: t('social.unblock') },
    { type: 'muted', action: 'mute', label: t('social.tabMuted'), undo: t('social.unmute') },
    { type: 'restricted', action: 'restrict', label: t('social.tabRestricted'), undo: t('social.unrestrict') },
  ];

  const load = useCallback(async (type: ListType) => {
    setLoading(true);
    try {
      const rows = await api.getSocialList(type);
      setUsers(Array.isArray(rows) ? rows : []);
    } catch {
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(active);
  }, [active, load]);

  const tab = tabs.find((item) => item.type === active)!;

  const undo = async (userId: number) => {
    setUsers((prev) => prev.filter((user) => user.id !== userId));
    try {
      await api.setSocialAction(userId, tab.action, true);
    } catch {
      Alert.alert(t('mobile.blockedTitle'), t('mobile.couldNotUndoAccount'));
      void load(active);
    }
  };

  return (
    <WorldBackdrop>
      <SafeAreaView style={{ flex: 1 }}>
        <WorldHeader
          title={t('social.blockedAccountsTitle')}
          subtitle={t('mobile.blockedSub')}
          onBack={() => navigation.goBack()}
        />
        <View style={styles.tabs}>
          {tabs.map((item) => {
            const on = item.type === active;
            return (
              <Pressable
                key={item.type}
                onPress={() => setActive(item.type)}
                style={[styles.tab, { backgroundColor: on ? colors.primary : colors.surfaceSecondary }]}
              >
                <Text style={[styles.tabText, { color: on ? '#fff' : colors.text }]}>{item.label}</Text>
              </Pressable>
            );
          })}
        </View>
        {loading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 32 }} />
        ) : (
          <FlatList
            data={users}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.list}
            ListEmptyComponent={
              <Text style={{ color: colors.textSecondary, textAlign: 'center', marginTop: 40 }}>
                {t('social.emptyList')}
              </Text>
            }
            renderItem={({ item }) => (
              <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                {item.avatar ? (
                  <Image source={{ uri: mediaUrl(item.avatar) || item.avatar }} style={styles.avatar} />
                ) : (
                  <View style={[styles.avatar, { backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }]}>
                    <Text style={{ color: '#fff', fontWeight: '800' }}>
                      {(item.username || '?').slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                  @{item.username}
                </Text>
                <Pressable onPress={() => void undo(item.id)}>
                  <Text style={{ color: colors.primary, fontWeight: '800' }}>{tab.undo}</Text>
                </Pressable>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </WorldBackdrop>
  );
}

const styles = StyleSheet.create({
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingBottom: 8 },
  tab: { borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8 },
  tabText: { fontSize: 12, fontWeight: '800' },
  list: { padding: 16, gap: 10, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  avatar: { width: 36, height: 36, borderRadius: 18 },
  name: { flex: 1, fontSize: 15, fontWeight: '700' },
});
