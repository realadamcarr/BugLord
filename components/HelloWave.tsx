import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';

export function HelloWave() {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(rotation, { toValue: 25, duration: 150, useNativeDriver: true }),
        Animated.timing(rotation, { toValue: 0, duration: 150, useNativeDriver: true }),
      ]),
      { iterations: 4 }
    ).start();
  }, []);

  const rotateDeg = rotation.interpolate({ inputRange: [0, 25], outputRange: ['0deg', '25deg'] });

  return (
    <Animated.View style={{ transform: [{ rotate: rotateDeg }] }}>
      <ThemedText style={styles.text}>👋</ThemedText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  text: {
    fontSize: 28,
    lineHeight: 32,
    marginTop: -6,
  },
});
