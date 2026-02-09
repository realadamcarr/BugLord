import { useTheme } from '@/contexts/ThemeContext';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { ThemedText } from './ThemedText';

interface XPProgressBarProps {
  currentXP: number;
  maxXP: number;
  level: number;
  animated?: boolean;
  showTooltip?: boolean;
}

export const XPProgressBar: React.FC<XPProgressBarProps> = ({
  currentXP,
  maxXP,
  level,
  animated = true,
  showTooltip = true,
}) => {
  const { theme } = useTheme();
  const progressAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  
  const progressPercentage = Math.min((currentXP / maxXP) * 100, 100);
  const xpToNext = maxXP - currentXP;

  const styles = StyleSheet.create({
    container: {
      marginVertical: 8,
    },
    tooltip: {
      backgroundColor: theme.colors.card,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 6,
      alignSelf: 'center',
      marginBottom: 8,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    tooltipText: {
      color: theme.colors.text,
      fontSize: 11,
      fontWeight: '800',
      textAlign: 'center',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
    xpBarContainer: {
      position: 'relative',
    },
    xpBarBackground: {
      width: '100%',
      height: 14,
      backgroundColor: theme.colors.xpBackground,
      borderRadius: 4,
      overflow: 'hidden',
      marginBottom: 6,
      borderWidth: 2,
      borderColor: theme.colors.border,
    },
    xpBarFill: {
      height: '100%',
      backgroundColor: theme.colors.xpFill,
      borderRadius: 2,
      shadowColor: theme.colors.xpFill,
      shadowOffset: { width: 0, height: 0 },
      shadowRadius: 4,
      elevation: 2,
    },
    xpTextContainer: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    xpText: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.colors.warning,
      letterSpacing: 0.3,
    },
    levelBadge: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 8,
      paddingVertical: 2,
      borderRadius: 4,
      borderWidth: 2,
      borderColor: `${theme.colors.primary}80`,
    },
    levelBadgeText: {
      color: '#fff',
      fontSize: 11,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.3,
    },
  });

  useEffect(() => {
    if (animated) {
      Animated.timing(progressAnim, {
        toValue: progressPercentage,
        duration: 800,
        useNativeDriver: false,
      }).start();

      // Glow animation for active progress
      if (progressPercentage > 0) {
        Animated.loop(
          Animated.sequence([
            Animated.timing(glowAnim, {
              toValue: 1,
              duration: 1500,
              useNativeDriver: false,
            }),
            Animated.timing(glowAnim, {
              toValue: 0.3,
              duration: 1500,
              useNativeDriver: false,
            }),
          ])
        ).start();
      }
    } else {
      progressAnim.setValue(progressPercentage);
    }
  }, [progressPercentage, animated, progressAnim, glowAnim]);

  return (
    <View style={styles.container}>
      {showTooltip && xpToNext > 0 && (
        <View style={styles.tooltip}>
          <ThemedText style={styles.tooltipText}>
            {xpToNext} XP to Lv. {level + 1}! 🚀
          </ThemedText>
        </View>
      )}
      
      <View style={styles.xpBarContainer}>
        <View style={styles.xpBarBackground}>
          <Animated.View 
            style={[
              styles.xpBarFill,
              {
                width: progressAnim.interpolate({
                  inputRange: [0, 100],
                  outputRange: ['0%', '100%'],
                }),
                shadowOpacity: glowAnim,
              }
            ]} 
          />
        </View>
        
        <View style={styles.xpTextContainer}>
          <ThemedText style={styles.xpText}>
            {currentXP}/{maxXP} XP
          </ThemedText>
          <View style={styles.levelBadge}>
            <ThemedText style={styles.levelBadgeText}>
              Lv. {level}
            </ThemedText>
          </View>
        </View>
      </View>
    </View>
  );
};
