import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { useTheme } from '@/hooks/useTheme';
import { useLocale } from '@/i18n/LocaleProvider';
import { mediaUrl } from '@/api/config';

type PickedImage = {
  uri: string;
  name?: string;
  type?: string;
};

const PALETTES = {
  light: {
    cream: '#F3F0FC',
    card: '#E9E1FA',
    white: '#FFFFFF',
    brown: '#7C3AED',
    brownDk: '#5B21B6',
    text: '#211B3D',
    text2: '#79709E',
    line: 'rgba(124,58,237,0.16)',
  },
  dark: {
    cream: '#14102A',
    card: '#1E1740',
    white: '#2A2154',
    brown: '#C4B5FD',
    brownDk: '#A78BFA',
    text: '#F5F3FF',
    text2: '#B0A6D9',
    line: 'rgba(167,139,250,0.20)',
  },
};

function asUpload(image: PickedImage, fallbackName: string) {
  let name = image.name || fallbackName;
  const hinted = (image.type || '').toLowerCase();
  const extFromType = hinted.includes('png')
    ? 'png'
    : hinted.includes('webp')
      ? 'webp'
      : hinted.includes('gif')
        ? 'gif'
        : 'jpg';
  if (!/\.[a-z0-9]+$/i.test(name)) name = `${name}.${extFromType}`;
  const ext = name.split('.').pop()?.toLowerCase();
  const type =
    image.type ||
    (ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg');
  return { uri: image.uri, name, type } as unknown as Blob;
}

export default function EditProfileScreen({ navigation }: any) {
  const { isDark } = useTheme();
  const { t } = useLocale();
  const { user, updateUser, checkAuth } = useAuth();
  const C = isDark ? PALETTES.dark : PALETTES.light;
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [bio, setBio] = useState('');
  const [location, setLocation] = useState('');
  const [avatar, setAvatar] = useState('');
  const [cover, setCover] = useState('');
  const [pickedAvatar, setPickedAvatar] = useState<PickedImage | null>(null);
  const [pickedCover, setPickedCover] = useState<PickedImage | null>(null);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        const [me, publicProfile] = await Promise.all([
          api.getMe(),
          user?.id ? api.getProfileById(user.id).catch(() => null) : Promise.resolve(null),
        ]);
        if (!mounted) return;
        setFirstName(me.first_name || user?.first_name || '');
        setLastName(me.last_name || user?.last_name || '');
        setBio(me.bio || user?.bio || '');
        setLocation(me.location || user?.location || '');
        setAvatar(me.avatar || publicProfile?.avatar || user?.avatar || '');
        setCover(
          publicProfile?.cover_photo || user?.cover_photo || user?.cover_image || '',
        );
      } catch {
        if (!mounted || !user) return;
        setFirstName(user.first_name || '');
        setLastName(user.last_name || '');
        setBio(user.bio || '');
        setLocation(user.location || '');
        setAvatar(user.avatar || '');
        setCover(user.cover_photo || user.cover_image || '');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [user]);

  const pickImage = async (kind: 'avatar' | 'cover') => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('profile.editProfile'), t('profile.photoLibraryPermission'));
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: kind === 'avatar' ? [1, 1] : [16, 9],
      quality: 0.85,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    const picked: PickedImage = {
      uri: asset.uri,
      name: asset.fileName || `${kind}-${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
    };
    if (kind === 'avatar') setPickedAvatar(picked);
    else setPickedCover(picked);
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
      if (pickedAvatar) form.append('avatar', asUpload(pickedAvatar, 'avatar.jpg'));
      if (pickedCover) form.append('cover_photo', asUpload(pickedCover, 'cover.jpg'));

      const updated = await api.updateProfile(user.id, form);
      updateUser({
        ...updated,
        display_name:
          `${updated.first_name || firstName} ${updated.last_name || lastName}`.trim() || user.username,
        avatar: updated.avatar || pickedAvatar?.uri || avatar || user.avatar,
        cover_photo: updated.cover_photo || pickedCover?.uri || cover,
        cover_image: updated.cover_photo || pickedCover?.uri || cover,
        bio: updated.bio ?? bio.trim(),
        first_name: updated.first_name ?? firstName.trim(),
        last_name: updated.last_name ?? lastName.trim(),
        location: updated.location ?? location.trim(),
      });
      await checkAuth().catch(() => undefined);
      navigation.goBack();
    } catch {
      Alert.alert(t('profile.editProfile'), t('profile.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: C.cream }]}>
        <ActivityIndicator color={C.brown} />
      </SafeAreaView>
    );
  }

  const avatarUri = pickedAvatar?.uri || mediaUrl(avatar) || avatar;
  const coverUri = pickedCover?.uri || mediaUrl(cover) || cover;

  return (
    <View style={{ flex: 1, backgroundColor: C.cream }}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <View style={styles.header}>
            <Pressable onPress={() => navigation.goBack()} hitSlop={8} style={[styles.headerBtn, { backgroundColor: C.white, borderColor: C.line }]}>
              <Text style={{ color: C.brownDk, fontWeight: '700' }}>{t('common.back')}</Text>
            </Pressable>
            <Text style={[styles.title, { color: C.text }]}>{t('profile.editProfile')}</Text>
            <Pressable onPress={() => void save()} disabled={saving} style={[styles.headerBtn, { backgroundColor: C.brownDk, opacity: saving ? 0.65 : 1 }]}>
              <Text style={{ color: '#fff', fontWeight: '800' }}>{saving ? t('profile.saving') : t('common.save')}</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <Pressable onPress={() => void pickImage('cover')} style={[styles.coverWrap, { backgroundColor: C.card, borderColor: C.line }]}>
              {coverUri ? (
                <Image source={{ uri: coverUri }} style={styles.cover} />
              ) : (
                <LinearGradient colors={isDark ? ['#251B4D', '#1E1740'] : ['#C4B5FD', '#A78BFA']} style={styles.cover} />
              )}
              <View style={styles.coverLabel}>
                <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{t('profile.changeCoverPhoto')}</Text>
              </View>
            </Pressable>

            <Pressable onPress={() => void pickImage('avatar')} style={styles.avatarWrap}>
              {avatarUri ? (
                <Image source={{ uri: avatarUri }} style={[styles.avatar, { borderColor: C.cream }]} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: C.brown, borderColor: C.cream }]}>
                  <Text style={styles.avatarInitial}>{user?.username?.[0]?.toUpperCase() || '?'}</Text>
                </View>
              )}
              <Text style={{ color: C.brown, fontWeight: '800', marginTop: 10 }}>{t('profile.changePhoto')}</Text>
            </Pressable>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: C.text2 }]}>{t('profile.firstName')}</Text>
                <TextInput
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder={t('profile.firstName')}
                  placeholderTextColor={C.text2}
                  style={[styles.input, { color: C.text, borderColor: C.line, backgroundColor: C.white }]}
                  maxLength={80}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: C.text2 }]}>{t('profile.lastName')}</Text>
                <TextInput
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder={t('profile.lastName')}
                  placeholderTextColor={C.text2}
                  style={[styles.input, { color: C.text, borderColor: C.line, backgroundColor: C.white }]}
                  maxLength={80}
                />
              </View>
            </View>

            <Text style={[styles.label, { color: C.text2 }]}>{t('profile.location')}</Text>
            <TextInput
              value={location}
              onChangeText={setLocation}
              placeholder={t('profile.locationPlaceholder')}
              placeholderTextColor={C.text2}
              style={[styles.input, { color: C.text, borderColor: C.line, backgroundColor: C.white }]}
              maxLength={120}
            />

            <Text style={[styles.label, { color: C.text2 }]}>{t('profile.bio')}</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder={t('profile.bio')}
              placeholderTextColor={C.text2}
              style={[styles.input, styles.textArea, { color: C.text, borderColor: C.line, backgroundColor: C.white }]}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={[styles.count, { color: C.text2 }]}>{bio.length}/500</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 10,
  },
  headerBtn: { borderRadius: 999, borderWidth: 1, borderColor: 'transparent', paddingHorizontal: 14, paddingVertical: 8, minHeight: 40, justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800' },
  content: { padding: 16, paddingBottom: 40 },
  coverWrap: { height: 148, borderRadius: 20, overflow: 'hidden', borderWidth: 1, marginBottom: 8 },
  cover: { width: '100%', height: '100%' },
  coverLabel: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  avatarWrap: { alignItems: 'center', marginTop: -36, marginBottom: 22 },
  avatar: { width: 104, height: 104, borderRadius: 52, borderWidth: 4 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 36, fontWeight: '800' },
  row: { flexDirection: 'row', gap: 10 },
  label: { fontSize: 12, fontWeight: '700', marginBottom: 6, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16 },
  textArea: { minHeight: 104 },
  count: { alignSelf: 'flex-end', fontSize: 12, marginTop: 4 },
});
