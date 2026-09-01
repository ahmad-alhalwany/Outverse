import { useWindowDimensions } from 'react-native';

export const BREAKPOINTS = {
  compact: 360,
  phone: 400,
  largePhone: 430,
  tablet: 768,
};

export function layoutFromWidth(width: number) {
  const isCompact = width < BREAKPOINTS.compact;
  const isPhone = width < BREAKPOINTS.tablet;
  const isTablet = width >= BREAKPOINTS.tablet;
  const gutter = isCompact ? 12 : isTablet ? 28 : 16;
  const moreColumns = isCompact ? 2 : width < 420 ? 3 : isTablet ? 4 : 3;
  const contentMax = isTablet ? 720 : width;
  const formMax = Math.min(width - gutter * 2, 440);
  const heroTitle = isCompact ? 24 : isTablet ? 34 : 28;

  return {
    width,
    isCompact,
    isPhone,
    isTablet,
    gutter,
    moreColumns,
    contentMax,
    formMax,
    heroTitle,
    twoColWidth: isCompact ? ('100%' as const) : ('48%' as const),
  };
}

export function useLayout() {
  const { width, height } = useWindowDimensions();
  return { ...layoutFromWidth(width), height };
}
