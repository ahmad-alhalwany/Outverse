import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ColorScheme = 'light' | 'dark' | 'nebula' | 'stardust';

interface ThemeState {
  colorScheme: ColorScheme;
  setColorScheme: (scheme: ColorScheme) => void;
  toggleColorScheme: () => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      colorScheme: 'dark',
      setColorScheme: (scheme) => set({ colorScheme: scheme }),
      toggleColorScheme: () => {
        const current = get().colorScheme;
        const darkish = current === 'dark' || current === 'nebula';
        set({ colorScheme: darkish ? 'light' : 'dark' });
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);

const lightColors = {
  primary: '#7C3AED',
  primaryLight: '#A78BFA',
  primaryDark: '#5B21B6',
  background: '#F3F0FC',
  surface: '#FFFFFF',
  surfaceSecondary: '#EDE4FB',
  surfaceElevated: '#FFFFFF',
  text: '#211B3D',
  textSecondary: '#79709E',
  textMuted: '#9691B8',
  icon: '#5B21B6',
  iconHover: '#7C3AED',
  border: 'rgba(124,58,237,0.18)',
  borderLight: 'rgba(124,58,237,0.08)',
  error: '#D32F2F',
  errorLight: '#FEE2E2',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#7C3AED',
  infoLight: '#EDE4FB',
  overlay: 'rgba(33, 27, 61, 0.45)',
  shadow: 'rgba(124, 58, 237, 0.14)',
  divider: 'rgba(124,58,237,0.12)',
  online: '#10B981',
  offline: '#9691B8',
  inputBg: '#FFFFFF',
  disabled: '#D1D5DB',
  card: '#FFFFFF',
  lab: '#4CAF50',
  bazaar: '#2196F3',
  vault: '#9C27B0',
  story: '#FF9800',
  shop: '#E91E63',
};

const nebulaColors = {
  primary: '#E879F9',
  primaryLight: '#F5D0FE',
  primaryDark: '#A21CAF',
  background: '#1A0B24',
  surface: '#3B1848',
  surfaceSecondary: '#2A1036',
  surfaceElevated: '#451A54',
  text: '#FDF4FF',
  textSecondary: '#E9D5FF',
  textMuted: '#D8B4FE',
  icon: '#F0ABFC',
  iconHover: '#F5D0FE',
  border: 'rgba(232,121,249,0.28)',
  borderLight: 'rgba(232,121,249,0.14)',
  error: '#FF5B5B',
  errorLight: 'rgba(255,59,59,0.10)',
  success: '#34D399',
  successLight: '#064E3B',
  warning: '#FBBF24',
  warningLight: '#78350F',
  info: '#E879F9',
  infoLight: '#2A1036',
  overlay: 'rgba(20, 8, 28, 0.72)',
  shadow: 'rgba(20, 8, 28, 0.45)',
  divider: 'rgba(232,121,249,0.18)',
  online: '#34D399',
  offline: '#C084FC',
  inputBg: 'rgba(255,255,255,0.06)',
  disabled: '#484F58',
  card: '#2A1036',
  lab: '#4CAF50',
  bazaar: '#2196F3',
  vault: '#9C27B0',
  story: '#FF9800',
  shop: '#E91E63',
};

const stardustColors = {
  primary: '#B45309',
  primaryLight: '#F59E0B',
  primaryDark: '#92400E',
  background: '#F8F4EC',
  surface: '#FFFFFF',
  surfaceSecondary: '#F3E8D4',
  surfaceElevated: '#FFFFFF',
  text: '#2C2416',
  textSecondary: '#7A6A4F',
  textMuted: '#9A8B6E',
  icon: '#B45309',
  iconHover: '#92400E',
  border: 'rgba(180,83,9,0.18)',
  borderLight: 'rgba(180,83,9,0.08)',
  error: '#D32F2F',
  errorLight: '#FEE2E2',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#B45309',
  infoLight: '#F3E8D4',
  overlay: 'rgba(44, 36, 22, 0.45)',
  shadow: 'rgba(180, 83, 9, 0.12)',
  divider: 'rgba(180,83,9,0.12)',
  online: '#10B981',
  offline: '#9A8B6E',
  inputBg: '#FFFFFF',
  disabled: '#D1D5DB',
  card: '#FFFFFF',
  lab: '#4CAF50',
  bazaar: '#2196F3',
  vault: '#9C27B0',
  story: '#FF9800',
  shop: '#E91E63',
};

const darkColors = {
  primary: '#7C3AED',
  primaryLight: '#C4B5FD',
  primaryDark: '#5B21B6',
  background: '#14102A',
  surface: '#2A2154',
  surfaceSecondary: '#1E1740',
  surfaceElevated: '#251B4D',
  text: '#F5F3FF',
  textSecondary: '#B0A6D9',
  textMuted: '#A99FD4',
  icon: '#C4B5FD',
  iconHover: '#E9D5FF',
  border: 'rgba(196,181,253,0.22)',
  borderLight: 'rgba(196,181,253,0.12)',
  error: '#FF5B5B',
  errorLight: 'rgba(255,59,59,0.10)',
  success: '#34D399',
  successLight: '#064E3B',
  warning: '#FBBF24',
  warningLight: '#78350F',
  info: '#C4B5FD',
  infoLight: '#1E1740',
  overlay: 'rgba(11, 8, 29, 0.72)',
  shadow: 'rgba(11, 8, 29, 0.45)',
  divider: 'rgba(196,181,253,0.16)',
  online: '#34D399',
  offline: '#9587C4',
  inputBg: 'rgba(255,255,255,0.06)',
  disabled: '#484F58',
  card: '#1E1740',
  lab: '#4CAF50',
  bazaar: '#2196F3',
  vault: '#9C27B0',
  story: '#FF9800',
  shop: '#E91E63',
};

export function useTheme() {
  const systemColorScheme = useColorScheme();
  const { colorScheme, setColorScheme, toggleColorScheme } = useThemeStore();

  const effectiveColorScheme = colorScheme;
  const colors =
    effectiveColorScheme === 'light'
      ? lightColors
      : effectiveColorScheme === 'nebula'
        ? nebulaColors
        : effectiveColorScheme === 'stardust'
          ? stardustColors
          : darkColors;

  return {
    colors,
    colorScheme: effectiveColorScheme,
    setColorScheme,
    toggleColorScheme,
    isDark: effectiveColorScheme === 'dark' || effectiveColorScheme === 'nebula',
  };
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 9999,
};

export const FONT_FAMILY = 'Inter_400Regular';

export const typography = {
  h1: { fontFamily: FONT_FAMILY, fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
  h2: { fontFamily: FONT_FAMILY, fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  h3: { fontFamily: FONT_FAMILY, fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  h4: { fontFamily: FONT_FAMILY, fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontFamily: FONT_FAMILY, fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMedium: { fontFamily: FONT_FAMILY, fontSize: 16, fontWeight: '500' as const, lineHeight: 24 },
  caption: { fontFamily: FONT_FAMILY, fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  captionMedium: { fontFamily: FONT_FAMILY, fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  small: { fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  smallMedium: { fontFamily: FONT_FAMILY, fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
};

export const shadows = {
  sm: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 4,
  },
  lg: {
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 18,
    elevation: 8,
  },
  xl: {
    shadowColor: '#5B21B6',
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
};