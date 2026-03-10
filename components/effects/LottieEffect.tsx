import React, { useRef } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';

// Attempt to import Lottie — fail gracefully if unavailable
let LottieView: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  LottieView = require('lottie-react-native').default;
} catch {
  // Lottie not available — component renders nothing
}

interface LottieEffectProps {
  /** Require'd Lottie .json asset, e.g. require('../../assets/animations/capture.json') */
  source: any;
  /** Play automatically on mount */
  autoPlay?: boolean;
  loop?: boolean;
  style?: ViewStyle;
  speed?: number;
  onAnimationFinish?: () => void;
}

/**
 * Thin Lottie wrapper that fails gracefully if the animation file
 * or the lottie-react-native module is unavailable.
 */
export const LottieEffect = React.forwardRef<any, LottieEffectProps>(
  ({ source, autoPlay = true, loop = false, style, speed = 1, onAnimationFinish }, ref) => {
    const internalRef = useRef<any>(null);
    const animRef = (ref as any) ?? internalRef;

    if (!LottieView || !source) return null;

    try {
      return (
        <View style={[styles.container, style]}>
          <LottieView
            ref={animRef}
            source={source}
            autoPlay={autoPlay}
            loop={loop}
            speed={speed}
            onAnimationFinish={onAnimationFinish}
            style={StyleSheet.absoluteFill}
            resizeMode="contain"
          />
        </View>
      );
    } catch {
      return null;
    }
  }
);

LottieEffect.displayName = 'LottieEffect';

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
