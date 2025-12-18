/**
 * Learn more about light and dark modes:
 * https://docs.expo.dev/guides/color-schemes/
 */

import { useTheme } from '@/contexts/ThemeContext';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof import('@/contexts/ThemeContext').Theme['colors'] = 'text'
) {
  const { theme } = useTheme();
  const colorFromProps = props && (theme.isDark ? props.dark : props.light);

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return (theme.colors as any)[colorName] || theme.colors.text;
  }
}
