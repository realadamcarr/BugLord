/**
 * LiveScanOverlay
 * 
 * Overlay component rendered on top of the camera during live scan mode.
 * Shows different UI based on the scan state:
 * - SCANNING: animated scan lines + "Searching..." text
 * - LOCKED: bug label + confidence bar + "Capture!" button
 * - IDENTIFYING: spinner
 * - ERROR: error message + retry
 */

import { useTheme } from '@/contexts/ThemeContext';
import { ScanContext } from '@/services/ScanStateMachine';
import React, { useEffect, useRef } from 'react';
import {
    ActivityIndicator,
    Animated,
    Easing,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface LiveScanOverlayProps {
  ctx: ScanContext;
  onConfirm: () => void;
  onCancel: () => void;
  onRetry: () => void;
}

export const LiveScanOverlay: React.FC<LiveScanOverlayProps> = ({
  ctx,
  onConfirm,
  onCancel,
  onRetry,
}) => {
  const { theme } = useTheme();
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const lockProgressAnim = useRef(new Animated.Value(0)).current;

  // Scanning animation — line sweeps vertically
  useEffect(() => {
    if (ctx.state === 'SCANNING') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
      return () => loop.stop();
    }
  }, [ctx.state]);

  // Pulse animation when locked
  useEffect(() => {
    if (ctx.state === 'LOCKED') {
      const loop = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();

      // Lock timeout progress bar (5 seconds)
      Animated.timing(lockProgressAnim, {
        toValue: 1,
        duration: 5000,
        easing: Easing.linear,
        useNativeDriver: false,
      }).start();

      return () => {
        loop.stop();
        lockProgressAnim.setValue(0);
      };
    }
  }, [ctx.state]);

  const confidencePercent = Math.round(ctx.currentConfidence * 100);
  const confidenceColor =
    confidencePercent >= 80 ? '#10B981' :
    confidencePercent >= 60 ? '#F59E0B' :
    '#EF4444';

  return (
    <View style={styles.container}>
      {/* ─── SCANNING State ──────────────────── */}
      {ctx.state === 'SCANNING' && (
        <>
          {/* Animated scan line */}
          <Animated.View
            style={[
              styles.scanLine,
              {
                backgroundColor: theme.colors.primary,
                transform: [{
                  translateY: scanLineAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 300],
                  }),
                }],
              },
            ]}
          />

          {/* Reticle */}
          <View style={[styles.reticle, { borderColor: theme.colors.primary }]}>
            {/* Corner accents */}
            <View style={[styles.cornerTL, { borderColor: theme.colors.primary }]} />
            <View style={[styles.cornerTR, { borderColor: theme.colors.primary }]} />
            <View style={[styles.cornerBL, { borderColor: theme.colors.primary }]} />
            <View style={[styles.cornerBR, { borderColor: theme.colors.primary }]} />
          </View>

          {/* Status text */}
          <View style={styles.statusContainer}>
            <View style={styles.statusPill}>
              <Text style={styles.statusDot}>●</Text>
              <Text style={styles.statusText}>
                {ctx.consecutiveDetections > 0
                  ? `Detecting: ${ctx.currentLabel} (${ctx.consecutiveDetections}/3)`
                  : 'Searching for bugs...'}
              </Text>
            </View>
          </View>
        </>
      )}

      {/* ─── LOCKED State ────────────────────── */}
      {ctx.state === 'LOCKED' && (
        <>
          {/* Locked reticle with pulse */}
          <Animated.View
            style={[
              styles.lockedReticle,
              {
                borderColor: confidenceColor,
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />

          {/* Bug info card */}
          <View style={styles.lockedInfoContainer}>
            <View style={[styles.lockedInfoCard, { backgroundColor: 'rgba(0,0,0,0.85)' }]}>
              <Text style={styles.lockedLabel}>🐛 {ctx.currentLabel}</Text>
              
              {/* Confidence bar */}
              <View style={styles.confidenceRow}>
                <Text style={styles.confidenceText}>{confidencePercent}%</Text>
                <View style={styles.confidenceBarBg}>
                  <View style={[styles.confidenceBarFill, { width: `${confidencePercent}%`, backgroundColor: confidenceColor }]} />
                </View>
              </View>

              {/* Lock timeout progress */}
              <Animated.View
                style={[
                  styles.lockTimerBar,
                  {
                    backgroundColor: theme.colors.primary,
                    width: lockProgressAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['100%', '0%'],
                    }),
                  },
                ]}
              />
            </View>
          </View>

          {/* Capture button */}
          <View style={styles.captureContainer}>
            <TouchableOpacity
              style={[styles.captureButton, { backgroundColor: theme.colors.primary }]}
              onPress={onConfirm}
              activeOpacity={0.8}
            >
              <Text style={styles.captureButtonText}>🎯 Capture!</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {/* ─── IDENTIFYING State ───────────────── */}
      {ctx.state === 'IDENTIFYING' && (
        <View style={styles.identifyingContainer}>
          <View style={styles.identifyingCard}>
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text style={styles.identifyingText}>Identifying {ctx.currentLabel}...</Text>
          </View>
        </View>
      )}

      {/* ─── ERROR State ─────────────────────── */}
      {ctx.state === 'ERROR' && (
        <View style={styles.errorContainer}>
          <View style={styles.errorCard}>
            <Text style={styles.errorEmoji}>⚠️</Text>
            <Text style={styles.errorText}>{ctx.errorMessage || 'Something went wrong'}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={onRetry}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* ─── Close button (always visible) ───── */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.closeButton} onPress={onCancel}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },

  // ─── Top bar ──────────────────
  topBar: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'flex-start',
  },
  closeButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 8,
    width: 46,
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '900',
  },

  // ─── Scanning ─────────────────
  scanLine: {
    position: 'absolute',
    top: '25%',
    left: '15%',
    right: '15%',
    height: 2,
    opacity: 0.7,
  },
  reticle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -80 }, { translateY: -80 }],
    width: 160,
    height: 160,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    borderRadius: 10,
  },
  cornerTL: {
    position: 'absolute', top: -2, left: -2,
    width: 24, height: 24,
    borderTopWidth: 3, borderLeftWidth: 3,
    borderTopLeftRadius: 10,
  },
  cornerTR: {
    position: 'absolute', top: -2, right: -2,
    width: 24, height: 24,
    borderTopWidth: 3, borderRightWidth: 3,
    borderTopRightRadius: 10,
  },
  cornerBL: {
    position: 'absolute', bottom: -2, left: -2,
    width: 24, height: 24,
    borderBottomWidth: 3, borderLeftWidth: 3,
    borderBottomLeftRadius: 10,
  },
  cornerBR: {
    position: 'absolute', bottom: -2, right: -2,
    width: 24, height: 24,
    borderBottomWidth: 3, borderRightWidth: 3,
    borderBottomRightRadius: 10,
  },
  statusContainer: {
    position: 'absolute',
    bottom: 140,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  statusDot: {
    color: '#10B981',
    fontSize: 8,
    marginRight: 8,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ─── Locked ───────────────────
  lockedReticle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: [{ translateX: -80 }, { translateY: -80 }],
    width: 160,
    height: 160,
    borderWidth: 3,
    borderRadius: 10,
  },
  lockedInfoContainer: {
    position: 'absolute',
    top: '30%',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  lockedInfoCard: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    minWidth: 200,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  lockedLabel: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
    textTransform: 'capitalize',
  },
  confidenceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 10,
  },
  confidenceText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
    width: 40,
  },
  confidenceBarBg: {
    flex: 1,
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  confidenceBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  lockTimerBar: {
    height: 2,
    borderRadius: 1,
    marginTop: 8,
    alignSelf: 'flex-start',
  },

  // ─── Capture button ───────────
  captureContainer: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  captureButton: {
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  captureButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.5,
  },

  // ─── Identifying ──────────────
  identifyingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  identifyingCard: {
    backgroundColor: 'rgba(0,0,0,0.85)',
    paddingVertical: 28,
    paddingHorizontal: 36,
    borderRadius: 16,
    alignItems: 'center',
    gap: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  identifyingText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },

  // ─── Error ────────────────────
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  errorCard: {
    backgroundColor: 'rgba(0,0,0,0.9)',
    paddingVertical: 28,
    paddingHorizontal: 36,
    borderRadius: 16,
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  errorEmoji: {
    fontSize: 36,
  },
  errorText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    maxWidth: 250,
  },
  retryButton: {
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    paddingHorizontal: 28,
    borderRadius: 8,
    marginTop: 4,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
