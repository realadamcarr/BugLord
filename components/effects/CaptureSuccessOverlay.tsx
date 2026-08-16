import { useTheme } from '@/contexts/ThemeContext';
import React, { useEffect } from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import ReAnimated, {
    Easing,
    interpolate,
    useAnimatedStyle,
    useSharedValue,
    withTiming
} from 'react-native-reanimated';
import { LottieEffect } from './LottieEffect';

let captureAsset: any = null;
try { captureAsset = require('../../assets/animations/capture-success.json'); } catch { /* no asset yet */ }

interface CaptureSuccessOverlayProps {
  visible: boolean;
  bugName: string;
  rarity: string;
  onFinish: () => void;
}

const RARITY_COLORS: Record<string, string> = {
  common: '#6ABF5E',
  uncommon: '#5EA652',
  rare: '#F0B429',
  epic: '#E0853D',
  legendary: '#FFD700',
};

export const CaptureSuccessOverlay: React.FC<CaptureSuccessOverlayProps> = ({
  visible,
  bugName,
  rarity,
  onFinish,
}) => {
  const { theme } = useTheme();
  const accentColor = RARITY_COLORS[rarity?.toLowerCase()] ?? theme.colors.primary;

  const progress = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      progress.value = 0;
      progress.value = withTiming(1, { duration: 600, easing: Easing.out(Easing.cubic) });

      const t = setTimeout(onFinish, 2600);
      return () => clearTimeout(t);
    }
  }, [visible, onFinish]);

  const glowStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.5, 1], [0.6, 0.3, 0]),
    transform: [{ scale: interpolate(progress.value, [0, 1], [0.4, 1.8]) }],
  }));

  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0, 0.3], [0, 1]),
    transform: [{ scale: interpolate(progress.value, [0, 0.4, 0.6], [0.6, 1.05, 1]) }],
  }));

  const emojiStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: interpolate(progress.value, [0.15, 0.5], [0.5, 1], 'clamp') },
      { rotate: `${interpolate(progress.value, [0.15, 0.5], [-15, 0], 'clamp')}deg` },
    ],
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: interpolate(progress.value, [0.3, 0.6], [0, 1], 'clamp'),
    transform: [{ translateY: interpolate(progress.value, [0.3, 0.6], [10, 0], 'clamp') }],
  }));

  if (!visible) return null;

  return (
    <Modal transparent animationType="none" visible={visible}>
      <View style={styles.backdrop}>
        {/* Radial glow ring */}
        <ReAnimated.View
          style={[
            styles.glowRing,
            { borderColor: accentColor },
            glowStyle,
          ]}
        />

        {/* Main card pop-in */}
        <ReAnimated.View
          style={[
            styles.card,
            { backgroundColor: theme.colors.card, borderColor: accentColor },
            cardStyle,
          ]}
        >
          {/* Lottie overlay (shows nothing if asset not present) */}
          <View style={styles.lottieWrapper} pointerEvents="none">
            <LottieEffect source={captureAsset} autoPlay loop={false} />
          </View>

          <ReAnimated.View style={emojiStyle}>
            <Text style={styles.bugEmoji}>🐛</Text>
          </ReAnimated.View>

          <ReAnimated.View style={textStyle}>
            <Text style={styles.caughtLabel}>Bug Captured!</Text>
            <Text style={[styles.bugName, { color: theme.colors.text }]}>
              {bugName}
            </Text>
            <View style={[styles.rarityPill, { backgroundColor: `${accentColor}22`, borderColor: `${accentColor}55` }]}>
              <Text style={[styles.rarityText, { color: accentColor }]}>
                {rarity?.toUpperCase() ?? 'COMMON'}
              </Text>
            </View>
          </ReAnimated.View>
        </ReAnimated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowRing: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 3,
  },
  card: {
    borderRadius: 16,
    borderWidth: 3,
    padding: 32,
    alignItems: 'center',
    gap: 10,
    width: 260,
    overflow: 'hidden',
  },
  lottieWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 0,
  },
  bugEmoji: {
    fontSize: 52,
    zIndex: 1,
  },
  caughtLabel: {
    color: '#F0B429',
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 2,
    textAlign: 'center',
    zIndex: 1,
  },
  bugName: {
    fontSize: 20,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    textAlign: 'center',
    zIndex: 1,
  },
  rarityPill: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
    marginTop: 4,
    zIndex: 1,
  },
  rarityText: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
});
