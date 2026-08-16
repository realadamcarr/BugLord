import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Surface } from 'react-native-paper';

interface StatPillProps {
  icon: string;
  value: string | number;
  label: string;
  color?: string;
  size?: 'sm' | 'md';
  style?: import('react-native').ViewStyle;
}

export const StatPill: React.FC<StatPillProps> = ({
  icon,
  value,
  label,
  color,
  size = 'md',
  style,
}) => {
  const { theme } = useTheme();
  const accentColor = color ?? theme.colors.primary;
  const isSmall = size === 'sm';

  return (
    <Surface
      style={[styles.pill, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }, style]}
      elevation={1}
    >
      <Text style={[styles.icon, { fontSize: isSmall ? 14 : 18 }]}>{icon}</Text>
      <View style={styles.textGroup}>
        <Text
          style={[
            styles.value,
            { color: accentColor, fontSize: isSmall ? 14 : 18 },
          ]}
        >
          {value}
        </Text>
        <Text style={[styles.label, { color: theme.colors.textMuted, fontSize: isSmall ? 9 : 10 }]}>
          {label.toUpperCase()}
        </Text>
      </View>
    </Surface>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 2,
  },
  icon: {
    lineHeight: 22,
  },
  textGroup: {
    gap: 1,
  },
  value: {
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.5,
  },
});
