import { Text, TextInput } from 'react-native';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';

export const INTER_FONTS = {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
};

export const FONT_REGULAR = 'Inter_400Regular';
export const FONT_MEDIUM = 'Inter_500Medium';
export const FONT_SEMIBOLD = 'Inter_600SemiBold';
export const FONT_BOLD = 'Inter_700Bold';

let applied = false;

/** Match Cosonova web (Inter) on every Text / TextInput. */
export function applyDefaultInter() {
  if (applied) return;
  applied = true;
  const base = { fontFamily: FONT_REGULAR };
  const patch = (Comp: typeof Text | typeof TextInput) => {
    const anyComp = Comp as typeof Comp & { defaultProps?: { style?: unknown } };
    anyComp.defaultProps = anyComp.defaultProps || {};
    anyComp.defaultProps.style = [base, anyComp.defaultProps.style];
  };
  patch(Text);
  patch(TextInput);
}
