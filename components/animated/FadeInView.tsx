import { MotiView } from 'moti';
import React from 'react';
import { ViewStyle } from 'react-native';

interface FadeInViewProps {
  children: React.ReactNode;
  delay?: number;
  duration?: number;
  /** Direction to slide from: 'up' (default), 'down', 'left', 'right', 'none' */
  direction?: 'up' | 'down' | 'left' | 'right' | 'none';
  distance?: number;
  style?: ViewStyle;
}

export const FadeInView: React.FC<FadeInViewProps> = ({
  children,
  delay = 0,
  duration = 300,
  direction = 'up',
  distance = 16,
  style,
}) => {
  const getInitialTranslate = () => {
    switch (direction) {
      case 'up': return distance;
      case 'down': return -distance;
      case 'left': return distance;
      case 'right': return -distance;
      default: return 0;
    }
  };

  const isX = direction === 'left' || direction === 'right';
  const initialTranslate = getInitialTranslate();

  const from = {
    opacity: 0,
    ...(direction !== 'none' && isX ? { translateX: initialTranslate } : {}),
    ...(direction !== 'none' && !isX ? { translateY: initialTranslate } : {}),
  };

  const animate = {
    opacity: 1,
    ...(direction !== 'none' && isX ? { translateX: 0 } : {}),
    ...(direction !== 'none' && !isX ? { translateY: 0 } : {}),
  };

  return (
    <MotiView
      from={from}
      animate={animate}
      transition={{ type: 'timing', duration, delay }}
      style={style}
    >
      {children}
    </MotiView>
  );
};
