import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { mediaUrl } from '@/api/config';

type PickedImage = {
  uri: string;
  name?: string;
  type?: string;
};

export default function EditProfileScreen({ navigation }: any) {
  const { colors } = useTheme();
  const { user, updateUser, checkAuth } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [avatar, setAvatar] = useState('');
  const [pickedAvatar, setPickedAvatar] = useState<PickedImage | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const me = await api.getMe();
        if (!mounted) return;
        setFirstName(me.first_name || user?.first_name || '');
        setLastName(me.last_name || user?.last_name || '');
        setBio(me.bio || user?.bio || '');
        setLocation(me.location || (user as any)?.location || '');
        setAvatar(me.avatar || user?.avatar || '');
      } catch {
        if (!mounted || !user) return;
        setFirstName(user.first_name || '');
        setLastName(user.last_name || '');
        setBio(user.bio || '');
        setLocation((user as any).location || '');
        setAvatar(user.avatar || '');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  const pickAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to choose an avatar.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    setPickedAvatar({
      uri: asset.uri,
      name: asset.fileName || `avatar-${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    });
  };

  const save = async () => {
    if (!user?.id || saving) return;
    setSaving(true);
    try {
      const form = new FormData();
      form.append('first_name', firstName.trim());
      form.append('last_name', lastName.trim());
      form.append('bio', bio.trim());
      form.append('location', location.trim());
      if (pickedAvatar) {
        form.append('avatar', {
          uri: pickedAvatar.uri,
          name: pickedAvatar.name || 'avatar.jpg',
          type: pickedAvatar.type || 'image/jpeg',
        } as any);
      }

      const updated = await api.updateProfile(user.id, form);
      updateUser({
        ...updated,
        display_name:
          `${updated.first_name || firstName} ${updated.last_name || lastName}`.trim() ||
          user.username,
        avatar: updated.avatar || pickedAvatar?.uri || avatar || user.avatar,
        bio: updated.bio ?? bio.trim(),
        first_name: updated.first_name ?? firstName.trim(),
        last_name: updated.last_name ?? lastName.trim(),
        ...(updated.location != null ? { location: updated.location } : { location: location.trim() }),
      } as any);
      await checkAuth().catch(() => undefined);
      Alert.alert('Profile saved', 'Your profile was updated.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Profile update failed:', error);
      Alert.alert('Error', 'Could not update your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} />
      </SafeAreaView>
    );
  }

  const avatarUri = pickedAvatar?.uri || mediaUrl(avatar) || avatar;

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: colors.background }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerSide}>
            <Text style={[styles.headerButton, { color: colors.text }]}>Cancel</Text>
          </TouchableOpacity>
          <Text style={[styles.title, { color: colors.text }]}>Edit Profile</Text>
          <TouchableOpacity onPress={() => void save()} disabled={saving} style={styles.headerSide}>
            <Text style={[styles.headerButton, { color: saving ? colors.disabled : colors.primary }]}>
              {saving ? 'Saving' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TouchableOpacity style={styles.avatarWrap} onPress={() => void pickAvatar()} activeOpacity={0.85}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.primary }]}>
                <Text style={styles.avatarInitial}>{user?.username?.[0]?.toUpperCase() || '?'}</Text>
              </View>
            )}
            <Text style={[styles.changePhoto, { color: colors.primary }]}>Change avatar</Text>
            <Text style={[styles.coverNote, { color: colors.textSecondary }]}>
              Cover editing is unavailable on the current profile update API.
            </Text>
          </TouchableOpacity>

          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>First name</Text>
            <TextInput
              value={firstName}
              onChangeText={setFirstName}
              placeholder="First name"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              maxLength={80}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Last name</Text>
            <TextInput
              value={lastName}
              onChangeText={setLastName}
              placeholder="Last name"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              maxLength={80}
            />
          </View>
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Tell people what you are building"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, styles.textArea, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              multiline
              maxLength={240}
              textAlignVertical="top"
            />
            <Text style={[styles.count, { color: colors.textSecondary }]}>{bio.length}/240</Text>
          </View>
          <View style={styles.fieldGroup}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Location</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder="City, country, orbit"
              placeholderTextColor={colors.textSecondary}
              style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
              maxLength={120}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerSide: { width: 82, paddingVertical: 4 },
  headerButton: { fontSize: 15, fontWeight: '700' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  content: { padding: 18, paddingBottom: 40 },
  avatarWrap: { alignItems: 'center', marginBottom: 22 },
  avatar: { width: 112, height: 112, borderRadius: 56 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 36, fontWeight: '800' },
  changePhoto: { marginTop: 10, fontWeight: '800' },
  coverNote: { marginTop: 5, fontSize: 12, textAlign: 'center' },
  fieldGroup: { marginBottom: 14 },
  label: { fontSize: 12, fontWeight: '800', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16 },
  textArea: { minHeight: 104 },
  count: { alignSelf: 'flex-end', fontSize: 12, marginTop: 4 },
});
