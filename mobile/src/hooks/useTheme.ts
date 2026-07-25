import { useColorScheme } from 'react-native';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ColorScheme = 'light' | 'dark';

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
      toggleColorScheme: () => set({ colorScheme: get().colorScheme === 'light' ? 'dark' : 'light' }),
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
  surfaceSecondary: '#E9E1FA',
  surfaceElevated: '#F8F5FF',
  text: '#211B3D',
  textSecondary: '#79709E',
  textMuted: '#9691B8',
  border: 'rgba(124,58,237,0.16)',
  borderLight: 'rgba(124,58,237,0.08)',
  error: '#EF4444',
  errorLight: '#FEE2E2',
  success: '#10B981',
  successLight: '#D1FAE5',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#6366F1',
  infoLight: '#E0E7FF',
  overlay: 'rgba(33, 27, 61, 0.45)',
  shadow: 'rgba(124, 58, 237, 0.14)',
  divider: 'rgba(124,58,237,0.12)',
  online: '#10B981',
  offline: '#9691B8',
  inputBg: '#FFFFFF',
  disabled: '#D1D5DB',
  card: '#FFFFFF',
};

const darkColors = {
  primary: '#C4B5FD',
  primaryLight: '#DDD6FE',
  primaryDark: '#A78BFA',
  background: '#0F0B1F',
  surface: '#17122A',
  surfaceSecondary: '#1E1740',
  surfaceElevated: '#221A45',
  text: '#F5F3FF',
  textSecondary: '#B0A6D9',
  textMuted: '#79709E',
  border: 'rgba(167,139,250,0.20)',
  borderLight: 'rgba(167,139,250,0.10)',
  error: '#F87171',
  errorLight: '#7F1D1D',
  success: '#34D399',
  successLight: '#064E3B',
  warning: '#FBBF24',
  warningLight: '#78350F',
  info: '#A5B4FC',
  infoLight: '#1E1B4B',
  overlay: 'rgba(8, 6, 20, 0.72)',
  shadow: 'rgba(0, 0, 0, 0.45)',
  divider: 'rgba(167,139,250,0.16)',
  online: '#34D399',
  offline: '#79709E',
  inputBg: '#14102A',
  disabled: '#484F58',
  card: '#1A1532',
};

export function useTheme() {
  const systemColorScheme = useColorScheme();
  const { colorScheme, setColorScheme, toggleColorScheme } = useThemeStore();

  const effectiveColorScheme = colorScheme;
  const colors = effectiveColorScheme === 'light' ? lightColors : darkColors;

  return {
    colors,
    colorScheme: effectiveColorScheme,
    setColorScheme,
    toggleColorScheme,
    isDark: effectiveColorScheme === 'dark',
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

export const typography = {
  h1: { fontSize: 32, fontWeight: '700' as const, lineHeight: 40 },
  h2: { fontSize: 24, fontWeight: '700' as const, lineHeight: 32 },
  h3: { fontSize: 20, fontWeight: '600' as const, lineHeight: 28 },
  h4: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 24 },
  bodyMedium: { fontSize: 16, fontWeight: '500' as const, lineHeight: 24 },
  caption: { fontSize: 14, fontWeight: '400' as const, lineHeight: 20 },
  captionMedium: { fontSize: 14, fontWeight: '500' as const, lineHeight: 20 },
  small: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16 },
  smallMedium: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
};

export const shadows = {
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 24,
    elevation: 12,
  },
};