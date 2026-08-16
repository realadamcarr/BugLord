/**
 * Animated Tab Bar
 *
 * Custom bottom tab bar with:
 * - Sliding highlight indicator that glides between tabs
 * - Bouncy scale animation on the active icon
 * - Haptic feedback on press (iOS)
 *
 * Uses react-native-reanimated for performant, native-thread animations.
 */

import { useTheme } from '@/contexts/ThemeContext';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect } from 'react';
import {
    Dimensions,
    Platform,
    StyleSheet,
    TouchableOpacity,
    View,
} from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSequence,
    withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function AnimatedTabBar({ state, descriptors, navigation }: Readonly<BottomTabBarProps>) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const tabCount = state.routes.length;
  const tabWidth = SCREEN_WIDTH / tabCount;

  // ── Sliding indicator ─────────────────────────────────────────────────
  const indicatorX = useSharedValue(state.index * tabWidth);

  useEffect(() => {
    indicatorX.value = withSpring(state.index * tabWidth, {
      damping: 18,
      stiffness: 200,
      mass: 0.8,
    });
  }, [state.index, tabWidth]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value + 12 }],
  }));

  // ── Per-tab scale animations ──────────────────────────────────────────
  const scales = state.routes.map(() => useSharedValue(1));

  const animatePress = useCallback((index: number) => {
    scales[index].value = withSequence(
      withSpring(0.8, { damping: 15, stiffness: 400 }),
      withSpring(1.15, { damping: 10, stiffness: 300 }),
      withSpring(1, { damping: 12, stiffness: 250 }),
    );
  }, [scales]);

  // When the active tab changes externally, play the scale animation
  useEffect(() => {
    animatePress(state.index);
  }, [state.index]);

  const defaultPad = Platform.OS === 'ios' ? 20 : 6;
  const bottomPad = insets.bottom > 0 ? insets.bottom : defaultPad;

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          paddingBottom: bottomPad,
          height: 62 + bottomPad,
        },
      ]}
    >
      {/* Sliding indicator */}
      <Animated.View
        style={[
          styles.indicator,
          {
            width: tabWidth - 24,
            backgroundColor: theme.colors.primary + '25',
            borderColor: theme.colors.primary + '50',
          },
          indicatorStyle,
        ]}
      />

      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const isFocused = state.index === index;
        const color = isFocused ? theme.colors.primary : theme.colors.textMuted;

        const icon = options.tabBarIcon?.({
          focused: isFocused,
          color,
          size: 26,
        });

        let label = route.name;
        if (typeof options.tabBarLabel === 'string') {
          label = options.tabBarLabel;
        } else if (typeof options.title === 'string') {
          label = options.title;
        }

        const onPress = () => {
          if (Platform.OS === 'ios') {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
          }

          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name, route.params);
          }

          animatePress(index);
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        return (
          <TabItem
            key={route.key}
            scale={scales[index]}
            icon={icon}
            label={label}
            color={color}
            isFocused={isFocused}
            onPress={onPress}
            onLongPress={onLongPress}
            accessibilityLabel={options.tabBarAccessibilityLabel}
          />
        );
      })}
    </View>
  );
}

/** Individual tab — extracted so each can use its own useAnimatedStyle */
function TabItem({
  scale,
  icon,
  label,
  color,
  isFocused,
  onPress,
  onLongPress,
  accessibilityLabel,
}: {
  scale: import('react-native-reanimated').SharedValue<number>;
  icon: React.ReactNode;
  label: string;
  color: string;
  isFocused: boolean;
  onPress: () => void;
  onLongPress: () => void;
  accessibilityLabel?: string;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      activeOpacity={0.7}
      style={styles.tab}
    >
      <Animated.View style={[{ alignItems: 'center' }, animatedStyle]}>
        {icon}
        <Animated.Text
          style={[
            styles.label,
            {
              color,
              opacity: isFocused ? 1 : 0.7,
              fontWeight: isFocused ? '900' : '700',
            },
          ]}
          numberOfLines={1}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderTopWidth: 3,
    paddingTop: 6,
    elevation: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  indicator: {
    position: 'absolute',
    top: 3,
    height: 56,
    borderRadius: 12,
    borderWidth: 1.5,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 10,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 2,
  },
});
