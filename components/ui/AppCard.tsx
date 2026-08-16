import { useTheme } from '@/contexts/ThemeContext';
import { MotiView } from 'moti';
import React from 'react';
import { StyleSheet, ViewStyle } from 'react-native';

interface AppCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  /** Entrance delay in ms (stagger cards by passing different values) */
  delay?: number;
  /** Left accent bar color. Pass false to disable. */
  accent?: string | false;
  elevated?: boolean;
}

export const AppCard: React.FC<AppCardProps> = ({
  children,
  style,
  delay = 0,
  accent,
  elevated = false,
}) => {
  const { theme } = useTheme();

  return (
    <MotiView
      from={{ opacity: 0, translateY: 10 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 280, delay }}
      style={[
        styles.card,
        {
          backgroundColor: theme.colors.card,
          borderColor: theme.colors.border,
          borderLeftColor: accent !== false ? (accent ?? theme.colors.primary) : theme.colors.border,
          borderLeftWidth: accent !== false ? 4 : 2,
          shadowColor: theme.colors.shadow,
        },
        elevated && styles.elevated,
        style,
      ]}
    >
      {children}
    </MotiView>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 10,
    borderWidth: 2,
    padding: 14,
    marginBottom: 10,
  },
  elevated: {
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
});
