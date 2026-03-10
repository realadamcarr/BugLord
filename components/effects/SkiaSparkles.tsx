import React, { useEffect, useMemo } from 'react';
import { ViewStyle } from 'react-native';

let SkiaCanvas: any = null;
let SkiaCircle: any = null;

try {
  const Skia = require('@shopify/react-native-skia');
  SkiaCanvas = Skia.Canvas;
  SkiaCircle = Skia.Circle;
} catch {
  // Skia not available — component renders nothing
}

let reanimated: any = null;
try {
  reanimated = require('react-native-reanimated');
} catch {}

interface Particle {
  cx: number;
  cy: number;
  r: number;
  color: string;
  speed: number;
  phase: number;
}

interface SkiaSparklesProps {
  width: number;
  height: number;
  count?: number;
  colors?: string[];
  style?: ViewStyle;
}

/**
 * Skia-powered twinkling sparkle particles.
 * Uses a Reanimated shared value as the animation driver so the Canvas
 * redraws every frame via Skia's Reanimated integration.
 * Falls gracefully to null when Skia or Reanimated aren't available.
 */
export const SkiaSparkles: React.FC<SkiaSparklesProps> = ({
  width,
  height,
  count = 12,
  colors = ['#FFD700', '#F0B429', '#6ABF5E', '#FFFFFF'],
  style,
}) => {
  if (!SkiaCanvas || !SkiaCircle || !reanimated) return null;

  const { useSharedValue, useDerivedValue, withRepeat, withTiming, Easing } = reanimated;

  const tick = useSharedValue(0);

  useEffect(() => {
    tick.value = 0;
    tick.value = withRepeat(
      withTiming(1, { duration: 2400, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const particles = useMemo<Particle[]>(() => {
    const result: Particle[] = [];
    for (let i = 0; i < count; i++) {
      result.push({
        cx: Math.random() * width,
        cy: Math.random() * height,
        r: 1.5 + Math.random() * 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
        speed: 0.8 + Math.random() * 0.4,
        phase: Math.random(),
      });
    }
    return result;
  }, [width, height, count]);

  return (
    <SkiaCanvas style={[{ width, height }, style]} pointerEvents="none">
      {particles.map((p, i) => (
        <SparkleParticle key={i} particle={p} tick={tick} height={height} />
      ))}
    </SkiaCanvas>
  );
};

function SparkleParticle({
  particle,
  tick,
  height,
}: {
  particle: Particle;
  tick: { value: number };
  height: number;
}) {
  if (!reanimated || !SkiaCircle) return null;
  const { useDerivedValue } = reanimated;

  const cy = useDerivedValue(() => {
    'worklet';
    const drift = ((tick.value * particle.speed) + particle.phase) % 1;
    return particle.cy - drift * height * 0.15;
  }, [tick]);

  const opacity = useDerivedValue(() => {
    'worklet';
    return 0.2 + 0.8 * Math.abs(Math.sin(((tick.value + particle.phase) % 1) * Math.PI));
  }, [tick]);

  return (
    <SkiaCircle
      cx={particle.cx}
      cy={cy}
      r={particle.r}
      color={particle.color}
      opacity={opacity}
    />
  );
}
