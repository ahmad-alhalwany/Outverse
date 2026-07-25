import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { api } from '@/api/client';
import { useTheme } from '@/hooks/useTheme';

type Experience = {
  id: string | number;
  title: string;
  organization?: string;
  start_date?: string;
  end_date?: string | null;
  is_current?: boolean;
  description?: string;
};

const emptyForm = {
  title: '',
  organization: '',
  start_date: '',
  end_date: '',
  is_current: false,
  description: '',
};

export default function ExperienceScreen() {
  const { colors } = useTheme();
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async (isRefresh = false) => {
    try {
      const rows = await api.getMyExperience();
      setItems(Array.isArray(rows) ? rows : []);
    } catch {
      Alert.alert('Error', 'Could not load experience.');
    } finally {
      setLoading(false);
      if (isRefresh) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const edit = (item: Experience) => {
    setEditingId(item.id);
    setForm({
      title: item.title || '',
      organization: item.organization || '',
      start_date: item.start_date || '',
      end_date: item.end_date || '',
      is_current: !!item.is_current,
      description: item.description || '',
    });
  };

  const save = async () => {
    if (!form.title.trim()) {
      Alert.alert('Title required', 'Add a role or experience title.');
      return;
    }
    try {
      setSaving(true);
      const payload = {
        title: form.title.trim(),
        organization: form.organization.trim(),
        start_date: form.start_date.trim() || undefined,
        end_date: form.is_current ? null : form.end_date.trim() || null,
        is_current: form.is_current,
        description: form.description.trim(),
      };
      if (editingId) {
        await api.updateExperience(editingId, payload);
      } else {
        await api.createExperience(payload);
      }
      resetForm();
      void load(true);
    } catch {
      Alert.alert('Error', 'Could not save experience.');
    } finally {
      setSaving(false);
    }
  };

  const remove = (item: Experience) => {
    Alert.alert('Delete experience?', item.title, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              await api.deleteExperience(item.id);
              setItems((prev) => prev.filter((row) => String(row.id) !== String(item.id)));
            } catch {
              Alert.alert('Error', 'Could not delete experience.');
            }
          })();
        },
      },
    ]);
  };

  const renderItem = ({ item }: { item: Experience }) => (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>{item.title}</Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {item.organization || 'Independent'}
        </Text>
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {item.start_date || 'Start'} - {item.is_current ? 'Present' : item.end_date || 'End'}
        </Text>
        {item.description ? (
          <Text style={[styles.description, { color: colors.text }]}>{item.description}</Text>
        ) : null}
      </View>
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={() => edit(item)} style={[styles.smallBtn, { borderColor: colors.primary }]}>
          <Text style={[styles.smallText, { color: colors.primary }]}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => remove(item)} style={[styles.smallBtn, { borderColor: '#ef4444' }]}>
          <Text style={[styles.smallText, { color: '#ef4444' }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={{ fontSize: 22, color: colors.text }}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.titleText, { color: colors.text }]}>Experience</Text>
        <TouchableOpacity onPress={resetForm} style={styles.backBtn}>
          <Text style={{ color: colors.primary, fontWeight: '800' }}>New</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.formBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Text style={[styles.formTitle, { color: colors.text }]}>
          {editingId ? 'Edit experience' : 'Add experience'}
        </Text>
        <TextInput
          value={form.title}
          onChangeText={(title) => setForm((prev) => ({ ...prev, title }))}
          placeholder="Title"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        />
        <TextInput
          value={form.organization}
          onChangeText={(organization) => setForm((prev) => ({ ...prev, organization }))}
          placeholder="Organization"
          placeholderTextColor={colors.textSecondary}
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        />
        <View style={styles.dateRow}>
          <TextInput
            value={form.start_date}
            onChangeText={(start_date) => setForm((prev) => ({ ...prev, start_date }))}
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.textSecondary}
            style={[styles.input, styles.dateInput, { color: colors.text, borderColor: colors.border }]}
          />
          <TextInput
            value={form.end_date}
            onChangeText={(end_date) => setForm((prev) => ({ ...prev, end_date }))}
            placeholder="End date"
            placeholderTextColor={colors.textSecondary}
            editable={!form.is_current}
            style={[styles.input, styles.dateInput, { color: colors.text, borderColor: colors.border, opacity: form.is_current ? 0.5 : 1 }]}
          />
        </View>
        <TouchableOpacity
          onPress={() => setForm((prev) => ({ ...prev, is_current: !prev.is_current, end_date: !prev.is_current ? '' : prev.end_date }))}
          style={styles.currentRow}
        >
          <View style={[styles.checkbox, { borderColor: colors.primary, backgroundColor: form.is_current ? colors.primary : 'transparent' }]} />
          <Text style={{ color: colors.text, fontWeight: '700' }}>I am currently here</Text>
        </TouchableOpacity>
        <TextInput
          value={form.description}
          onChangeText={(description) => setForm((prev) => ({ ...prev, description }))}
          placeholder="Description"
          placeholderTextColor={colors.textSecondary}
          multiline
          style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border }]}
        />
        <TouchableOpacity onPress={save} disabled={saving} style={[styles.primaryBtn, { backgroundColor: colors.primary }]}>
          <Text style={styles.primaryText}>{saving ? 'Saving...' : editingId ? 'Save changes' : 'Add experience'}</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
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
          ListEmptyComponent={<Text style={[styles.empty, { color: colors.textSecondary }]}>No experience entries yet.</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  backBtn: { width: 54, alignItems: 'center' },
  titleText: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  formBox: { margin: 16, borderWidth: 1, borderRadius: 16, padding: 12, gap: 10 },
  formTitle: { fontSize: 15, fontWeight: '800' },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  textArea: { minHeight: 72, textAlignVertical: 'top' },
  dateRow: { flexDirection: 'row', gap: 8 },
  dateInput: { flex: 1 },
  currentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 18, height: 18, borderRadius: 5, borderWidth: 2 },
  primaryBtn: { borderRadius: 999, paddingVertical: 11, alignItems: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  list: { padding: 16, paddingTop: 0, paddingBottom: 32 },
  card: { borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 10, flexDirection: 'row', gap: 12 },
  cardTitle: { fontSize: 15, fontWeight: '800' },
  meta: { fontSize: 12, marginTop: 2 },
  description: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  cardActions: { gap: 8, justifyContent: 'center' },
  smallBtn: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, alignItems: 'center' },
  smallText: { fontSize: 12, fontWeight: '800' },
  empty: { padding: 30, textAlign: 'center' },
});
