import { useTheme } from '@/contexts/ThemeContext';
import React, { useCallback } from 'react';
import { Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface AppButtonProps {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  size?: Size;
  icon?: string;
  disabled?: boolean;
  style?: ViewStyle;
  fullWidth?: boolean;
}

const SPRING_CONFIG = { damping: 15, stiffness: 300, mass: 0.6 };

export const AppButton: React.FC<AppButtonProps> = ({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  style,
  fullWidth = false,
}) => {
  const { theme } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withSpring(0.94, SPRING_CONFIG);
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
  }, []);

  const bgColor: Record<Variant, string> = {
    primary: theme.colors.primary,
    secondary: theme.colors.surface,
    danger: theme.colors.error,
    ghost: 'transparent',
  };

  const textColor: Record<Variant, string> = {
    primary: '#FFFFFF',
    secondary: theme.colors.text,
    danger: '#FFFFFF',
    ghost: theme.colors.primary,
  };

  const borderColor: Record<Variant, string> = {
    primary: `${theme.colors.primary}80`,
    secondary: theme.colors.border,
    danger: `${theme.colors.error}80`,
    ghost: theme.colors.primary,
  };

  const paddingV: Record<Size, number> = { sm: 8, md: 13, lg: 18 };
  const paddingH: Record<Size, number> = { sm: 14, md: 20, lg: 28 };
  const fontSize: Record<Size, number> = { sm: 11, md: 13, lg: 16 };

  return (
    <Animated.View style={[animatedStyle, fullWidth && styles.fullWidth, style]}>
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        style={[
          styles.btn,
          {
            backgroundColor: disabled ? theme.colors.border : bgColor[variant],
            borderColor: disabled ? theme.colors.border : borderColor[variant],
            paddingVertical: paddingV[size],
            paddingHorizontal: paddingH[size],
            opacity: disabled ? 0.55 : 1,
          },
        ]}
      >
        {icon && <Text style={[styles.icon, { fontSize: fontSize[size] + 4 }]}>{icon}</Text>}
        <Text
          style={[
            styles.label,
            {
              color: disabled ? theme.colors.textMuted : textColor[variant],
              fontSize: fontSize[size],
            },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  fullWidth: { width: '100%' },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 2,
    gap: 8,
  },
  icon: { lineHeight: 22 },
  label: {
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
});
