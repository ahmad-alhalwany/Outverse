import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/hooks/useTheme';
import { useAuth } from '@/auth/AuthContext';
import { api } from '@/api/client';

type Overview = {
  health?: Record<string, unknown>;
  chat?: Record<string, unknown>;
  audit?: Array<Record<string, unknown>>;
};

export default function AdminScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<Overview>({});

  const load = useCallback(async (isRefresh = false) => {
    try {
      const [health, chat, audit] = await Promise.all([
        api.request<any>('get', '/health/system/').catch(() => null),
        api.request<any>('get', '/chat/admin/overview/').catch(() => null),
        api.request<any>('get', '/audit/logs/?limit=20').catch(() => null),
      ]);
      setData({
        health: health || undefined,
        chat: chat || undefined,
        audit: Array.isArray(audit) ? audit : audit?.results || [],
      });
    } catch (e) {
      Alert.alert('Admin', 'Could not load admin overview. Staff access may be required.');
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.back}>
          <Text style={{ fontSize: 22, color: colors.text }}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>Admin</Text>
        <View style={styles.back} />
      </View>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(true);
            }}
            colors={[colors.primary]}
          />
        }
      >
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          Signed in as @{user?.username || 'staff'} · mirrors web /admin overview
        </Text>

        <Text style={[styles.section, { color: colors.text }]}>System health</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {data.health ? JSON.stringify(data.health, null, 2).slice(0, 800) : 'Unavailable'}
          </Text>
        </View>

        <Text style={[styles.section, { color: colors.text }]}>Chat overview</Text>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
            {data.chat ? JSON.stringify(data.chat, null, 2).slice(0, 800) : 'Unavailable'}
          </Text>
        </View>

        <Text style={[styles.section, { color: colors.text }]}>Recent audit</Text>
        {(data.audit || []).length === 0 ? (
          <Text style={{ color: colors.textSecondary }}>No audit rows.</Text>
        ) : (
          (data.audit || []).slice(0, 15).map((row, idx) => (
            <View
              key={String(row.id || idx)}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>
                {String(row.action || row.verb || row.event || 'event')}
              </Text>
              <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 4 }}>
                {String(row.created_at || row.timestamp || '')}
              </Text>
            </View>
          ))
        )}

        <TouchableOpacity
          style={[styles.link, { backgroundColor: colors.primary }]}
          onPress={() => navigation.navigate('Ads')}
        >
          <Text style={styles.linkText}>Open Ads manager</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  back: { width: 44, alignItems: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  body: { padding: 16, paddingBottom: 40, gap: 8 },
  meta: { fontSize: 12, marginBottom: 8 },
  section: { fontSize: 16, fontWeight: '800', marginTop: 10 },
  card: { borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  link: { marginTop: 12, borderRadius: 999, paddingVertical: 12, alignItems: 'center' },
  linkText: { color: '#fff', fontWeight: '800' },
});
