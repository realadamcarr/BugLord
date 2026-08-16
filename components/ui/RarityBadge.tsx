import { useTheme } from '@/contexts/ThemeContext';
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Chip } from 'react-native-paper';

type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

const RARITY_COLORS: Record<Rarity, { bg: string; text: string; border: string }> = {
  common:    { bg: '#4A8C3F22', text: '#4A8C3F', border: '#4A8C3F44' },
  uncommon:  { bg: '#3D6B3522', text: '#3D6B35', border: '#3D6B3544' },
  rare:      { bg: '#D4940A22', text: '#D4940A', border: '#D4940A44' },
  epic:      { bg: '#A0522D22', text: '#A0522D', border: '#A0522D44' },
  legendary: { bg: '#FFD70022', text: '#B8860B', border: '#FFD70055' },
};

const RARITY_COLORS_DARK: Record<Rarity, { bg: string; text: string; border: string }> = {
  common:    { bg: '#6ABF5E22', text: '#6ABF5E', border: '#6ABF5E44' },
  uncommon:  { bg: '#5EA65222', text: '#5EA652', border: '#5EA65244' },
  rare:      { bg: '#F0B42922', text: '#F0B429', border: '#F0B42944' },
  epic:      { bg: '#E0853D22', text: '#E0853D', border: '#E0853D44' },
  legendary: { bg: '#FFD70033', text: '#FFD700', border: '#FFD70066' },
};

interface RarityBadgeProps {
  rarity: string;
  size?: 'sm' | 'md' | 'lg';
  showDot?: boolean;
}

export const RarityBadge: React.FC<RarityBadgeProps> = ({
  rarity,
  size = 'md',
  showDot = false,
}) => {
  const { theme } = useTheme();
  const key = (rarity?.toLowerCase() ?? 'common') as Rarity;
  const palette = theme.isDark ? RARITY_COLORS_DARK : RARITY_COLORS;
  const colors = palette[key] ?? palette.common;

  const compact = size === 'sm';

  return (
    <View style={styles.wrapper}>
      <Chip
        compact={compact}
        mode="flat"
        icon={showDot ? () => <View style={[styles.dot, { backgroundColor: colors.text }]} /> : undefined}
        textStyle={[
          styles.text,
          {
            color: colors.text,
            fontSize: size === 'sm' ? 9 : size === 'lg' ? 13 : 11,
          },
        ]}
        style={[
          styles.badge,
          {
            backgroundColor: colors.bg,
            borderColor: colors.border,
          },
        ]}
      >
        {rarity?.toUpperCase() ?? 'COMMON'}
      </Chip>
    </View>
  );
};

const styles = StyleSheet.create({
const styles = StyleSheet.create({
  wrapper: {
    alignSelf: 'flex-start',
  },
  badge: {
    borderRadius: 6,
    borderWidth: 1,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 3,
  },
  text: {
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
});
