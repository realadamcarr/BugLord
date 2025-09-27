import { useTheme } from '@/contexts/ThemeContext';
import { View, type ViewProps } from 'react-native';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
};

export function ThemedView({ style, lightColor, darkColor, ...otherProps }: ThemedViewProps) {
  const { theme } = useTheme();
  
  // Use custom colors if provided, otherwise use theme colors
  const backgroundColor = theme.isDark 
    ? (darkColor || theme.colors.surface)
    : (lightColor || theme.colors.surface);

  return <View style={[{ backgroundColor }, style]} {...otherProps} />;
}
