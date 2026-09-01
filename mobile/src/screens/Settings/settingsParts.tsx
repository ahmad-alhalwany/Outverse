import React, { useState } from 'react';
import { Image, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ColorScheme } from '@/hooks/useTheme';
import type { SettingsPalette } from '@/lib/settings';

type TFn = (key: string) => string;

export function SectionTitle({
  icon,
  title,
  C,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  C: SettingsPalette;
}) {
  return (
    <View style={styles.sectionTitle}>
      <Ionicons name={icon} size={20} color={C.icon} />
      <Text style={[styles.sectionTitleText, { color: C.text }]}>{title}</Text>
    </View>
  );
}

export function ToggleRow({
  icon,
  label,
  hint,
  checked,
  onChange,
  C,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  C: SettingsPalette;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleLeft}>
        {icon ? <Ionicons name={icon} size={18} color={C.icon} /> : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.rowLabel, { color: C.text }]}>{label}</Text>
          {hint ? <Text style={[styles.hint, { color: C.textMuted }]}>{hint}</Text> : null}
        </View>
      </View>
      <Switch
        value={checked}
        onValueChange={onChange}
        trackColor={{ false: C.cardSoft, true: C.cardStrong }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

export function LinkRow({
  icon,
  label,
  hint,
  onPress,
  C,
  rtl,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  onPress: () => void;
  C: SettingsPalette;
  rtl?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.link, { backgroundColor: C.card }]}>
      <Ionicons name={icon} size={18} color={C.icon} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.rowLabel, { color: C.text }]}>{label}</Text>
        {hint ? <Text style={[styles.hint, { color: C.textMuted }]}>{hint}</Text> : null}
      </View>
      <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={16} color={C.icon} />
    </Pressable>
  );
}

export function ThemeGrid({
  colorScheme,
  onPick,
  C,
  t,
}: {
  colorScheme: ColorScheme;
  onPick: (theme: ColorScheme) => void;
  C: SettingsPalette;
  t: TFn;
}) {
  const options: Array<{ id: string; label: string; theme: ColorScheme }> = [
    { id: 'cosmic', label: t('settings.themeCosmicCalm'), theme: 'dark' },
    { id: 'nebula', label: t('settings.themeNebulaGlow'), theme: 'nebula' },
    { id: 'stardust', label: t('settings.themeStardustMist'), theme: 'stardust' },
    { id: 'aurora', label: t('settings.themeAuroraDrift'), theme: 'light' },
  ];
  return (
    <View style={styles.themeGrid}>
      {options.map((option) => {
        const active = colorScheme === option.theme;
        return (
          <Pressable
            key={option.id}
            onPress={() => onPick(option.theme)}
            style={[
              styles.themeCard,
              {
                backgroundColor: active ? C.cardStrong : C.card,
              },
            ]}
          >
            <Text style={[styles.themeLabel, { color: active ? '#FFFFFF' : C.icon }]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function ChipRow({
  value,
  options,
  onChange,
  C,
}: {
  value: string | number;
  options: Array<{ id: string | number; label: string }>;
  onChange: (id: string | number) => void;
  C: SettingsPalette;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => {
        const active = value === opt.id;
        return (
          <Pressable
            key={String(opt.id)}
            onPress={() => onChange(opt.id)}
            style={[styles.chip, { backgroundColor: active ? C.cardStrong : C.card }]}
          >
            <Text style={[styles.chipText, { color: active ? '#FFFFFF' : C.icon }]}>{opt.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function WeirdnessSlider({
  value,
  onChange,
  C,
  t,
}: {
  value: number;
  onChange: (next: number) => void;
  C: SettingsPalette;
  t: TFn;
}) {
  const [width, setWidth] = useState(1);
  const setFromX = (x: number) => {
    onChange(Math.round(Math.max(0, Math.min(1, x / width)) * 100));
  };
  return (
    <View>
      <Pressable
        onLayout={(e) => setWidth(e.nativeEvent.layout.width)}
        onPress={(e) => setFromX(e.nativeEvent.locationX)}
        style={[styles.sliderTrack, { backgroundColor: C.track }]}
      >
        <View style={[styles.sliderFill, { width: `${value}%`, backgroundColor: C.cardStrong }]} />
        <View style={[styles.sliderThumb, { left: `${Math.max(0, Math.min(100, value))}%` }]} />
      </Pressable>
      <View style={styles.sliderMeta}>
        <Text style={[styles.hint, { color: C.textMuted }]}>{t('settings.mild')}</Text>
        <Text style={[styles.rowLabel, { color: C.text }]}>{value}</Text>
        <Text style={[styles.hint, { color: C.textMuted }]}>{t('settings.wild')}</Text>
      </View>
    </View>
  );
}

export function AccountCard({
  name,
  email,
  avatar,
  empty,
  onPress,
  C,
}: {
  name: string;
  email: string;
  avatar: string;
  empty: string;
  onPress: () => void;
  C: SettingsPalette;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.account, { backgroundColor: C.white }]}>
      <View style={[styles.avatar, { backgroundColor: C.card }]}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatarImg} />
        ) : (
          <Ionicons name="person-circle-outline" size={42} color={C.icon} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        {name ? (
          <>
            <Text style={[styles.accountName, { color: C.text }]} numberOfLines={1}>
              {name}
            </Text>
            {email ? (
              <Text style={[styles.hint, { color: C.textMuted }]} numberOfLines={1}>
                {email}
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={[styles.hint, { color: C.textMuted }]}>{empty}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, paddingBottom: 12 },
  sectionTitleText: { fontSize: 17, fontWeight: '700' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 10 },
  toggleLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowLabel: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 13, marginTop: 3, lineHeight: 18 },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 10 },
  themeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  themeCard: { flexGrow: 1, flexBasis: 148, minWidth: 148, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 18 },
  themeLabel: { fontSize: 15, fontWeight: '700' },
  coming: { fontSize: 11, marginTop: 6 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexGrow: 1, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 10, alignItems: 'center' },
  chipText: { fontSize: 13, fontWeight: '700' },
  sliderTrack: { height: 8, borderRadius: 999, justifyContent: 'center' },
  sliderFill: { height: 8, borderRadius: 999 },
  sliderThumb: {
    position: 'absolute',
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    marginLeft: -9,
    top: -5,
  },
  sliderMeta: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  account: { flexDirection: 'row', alignItems: 'center', gap: 14, borderRadius: 22, padding: 14 },
  avatar: { width: 64, height: 64, borderRadius: 32, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%' },
  accountName: { fontSize: 20, fontWeight: '700' },
});
