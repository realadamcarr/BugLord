import { useTheme } from '@/contexts/ThemeContext';
import { View, type ViewProps } from 'react-native';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  className?: string;
};

export function ThemedView({ style, lightColor, darkColor, className, ...otherProps }: ThemedViewProps) {
  const { theme } = useTheme();
  
  // Use custom colors if provided, otherwise use theme colors
  const backgroundColor = theme.isDark 
    ? (darkColor || theme.colors.background)
    : (lightColor || theme.colors.background);

  return <View className={className} style={[{ backgroundColor }, style]} {...otherProps} />;
}
