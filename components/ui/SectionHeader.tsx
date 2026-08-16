import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Divider } from 'react-native-paper';

interface SectionHeaderProps {
  title: string;
  icon?: string;
  actionLabel?: string;
  onAction?: () => void;
  accent?: string;
}

export const SectionHeader: React.FC<SectionHeaderProps> = ({
  title,
  icon,
  actionLabel,
  onAction,
  accent,
}) => {
  const { theme } = useTheme();
  const accentColor = accent ?? theme.colors.primary;

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <View style={styles.titleGroup}>
          {icon && <Text style={styles.icon}>{icon}</Text>}
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          <View style={[styles.accent, { backgroundColor: accentColor }]} />
        </View>
        {actionLabel && onAction && (
          <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
            <Text style={[styles.action, { color: accentColor }]}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
      <Divider style={{ backgroundColor: accentColor + '30' }} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  icon: {
    fontSize: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  accent: {
    width: 4,
    height: 14,
    borderRadius: 2,
  },
  action: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
});
