import { useTheme } from '@/contexts/ThemeContext';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import React, { useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type ScanMode = 'photo' | 'liveScan';

interface BugCameraProps {
  onCapture: (photoUri: string) => void;
  onClose: () => void;
  mode?: ScanMode;
  /** Called in liveScan mode after taking a photo — runs ML and returns top label + confidence */
  onClassifyPhoto?: (photoUri: string) => Promise<{ label: string; confidence: number } | null>;
  /** Called when the user confirms a live scan result */
  onLiveScanConfirm?: (photoUri: string, label: string, confidence: number) => void;
}

export const BugCamera: React.FC<BugCameraProps> = ({
  onCapture,
  onClose,
  mode = 'photo',
  onClassifyPhoto,
  onLiveScanConfirm,
}) => {
  const { theme } = useTheme();
  const facing: CameraType = 'back';
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Live scan state — simple: idle → classifying → result
  const [liveScanState, setLiveScanState] = useState<'idle' | 'classifying' | 'result'>('idle');
  const [scanPhotoUri, setScanPhotoUri] = useState<string | null>(null);
  const [scanLabel, setScanLabel] = useState<string | null>(null);
  const [scanConfidence, setScanConfidence] = useState<number>(0);

  const styles = createStyles(theme);

  // ─── Permission screens ────────────────────────────────────
  if (!permission) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          Camera permission is required to photograph bugs for your collection.
        </Text>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.permissionContainer}>
        <Text style={styles.permissionText}>
          We need access to your camera to photograph bugs for your collection.
        </Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Grant Camera Permission</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // ─── Photo Mode: capture and return ────────────────────────
  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        exif: true,
      });

      if (photo?.uri) {
        onCapture(photo.uri);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  // ─── Live Scan: capture → classify → show result ───────────
  const takeScanPhoto = async () => {
    if (!cameraRef.current || !onClassifyPhoto) return;

    try {
      setLiveScanState('classifying');

      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        exif: true,
      });

      if (!photo?.uri) {
        setLiveScanState('idle');
        return;
      }

      setScanPhotoUri(photo.uri);

      // Run ML classification
      const result = await onClassifyPhoto(photo.uri);

      if (result === null) {
        // null means the ML model is not loaded yet (not just low confidence)
        setLiveScanState('idle');
        Alert.alert(
          'ML Model Not Ready',
          'The on-device model is still loading. Try again in a moment, or switch to Photo mode.',
          [{ text: 'OK' }]
        );
      } else if (result.confidence >= 0.5) {
        setScanLabel(result.label);
        setScanConfidence(result.confidence);
        setLiveScanState('result');
      } else {
        setLiveScanState('idle');
        Alert.alert(
          'No Bug Detected',
          result.confidence > 0
            ? `Low confidence (${Math.round(result.confidence * 100)}%). Try getting closer, improving lighting, or adjusting the angle.`
            : 'Could not identify a bug in this photo. Try getting closer or adjusting the angle.',
          [{ text: 'Try Again' }]
        );
      }
    } catch (error) {
      console.error('Live scan capture failed:', error);
      setLiveScanState('idle');
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  const handleConfirmScan = () => {
    if (scanPhotoUri && scanLabel && onLiveScanConfirm) {
      onLiveScanConfirm(scanPhotoUri, scanLabel, scanConfidence);
    }
  };

  const handleRetakeScan = () => {
    setScanPhotoUri(null);
    setScanLabel(null);
    setScanConfidence(0);
    setLiveScanState('idle');
  };

  const confidencePercent = Math.round(scanConfidence * 100);
  const confidenceColor =
    confidencePercent >= 80 ? '#10B981' :
    confidencePercent >= 60 ? '#F59E0B' :
    '#EF4444';

  // ─── Render ────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* Result preview (live scan mode after classification) */}
      {mode === 'liveScan' && liveScanState === 'result' && scanPhotoUri ? (
        <View style={styles.resultContainer}>
          {/* Preview photo */}
          <Image source={{ uri: scanPhotoUri }} style={styles.resultPhoto} resizeMode="cover" />

          {/* Result overlay */}
          <View style={styles.resultOverlay}>
            {/* Close button */}
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.buttonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Spacer */}
            <View style={{ flex: 1 }} />

            {/* Result card */}
            <View style={styles.resultCard}>
              <Text style={styles.resultEmoji}>🐛</Text>
              <Text style={styles.resultLabel}>{scanLabel}</Text>

              {/* Confidence bar */}
              <View style={styles.confidenceRow}>
                <Text style={[styles.confidenceText, { color: confidenceColor }]}>
                  {confidencePercent}% match
                </Text>
                <View style={styles.confidenceBarBg}>
                  <View
                    style={[
                      styles.confidenceBarFill,
                      { width: `${confidencePercent}%`, backgroundColor: confidenceColor },
                    ]}
                  />
                </View>
              </View>

              {/* Action buttons */}
              <View style={styles.resultActions}>
                <TouchableOpacity style={styles.retakeButton} onPress={handleRetakeScan}>
                  <Text style={styles.retakeButtonText}>↻ Retake</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmButton, { backgroundColor: theme.colors.primary }]}
                  onPress={handleConfirmScan}
                >
                  <Text style={styles.confirmButtonText}>✓ Capture Bug</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      ) : (
        /* Camera viewfinder (photo mode OR live scan idle/classifying) */
        <CameraView
          style={styles.camera}
          facing={facing}
          mode="picture"
          ref={cameraRef}
        >
          <View style={styles.overlay}>
            {/* Top controls */}
            <View style={styles.topBar}>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <Text style={styles.buttonText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Targeting reticle */}
            <View style={styles.reticle} />

            {/* Instruction text */}
            <Text style={styles.instructionText}>
              {mode === 'liveScan'
                ? '🎯 Point at a bug and tap to scan'
                : '🐛 Position the bug in the center circle and tap to capture'}
            </Text>

            {/* Classifying spinner */}
            {mode === 'liveScan' && liveScanState === 'classifying' && (
              <View style={styles.classifyingOverlay}>
                <View style={styles.classifyingCard}>
                  <ActivityIndicator size="large" color={theme.colors.primary} />
                  <Text style={styles.classifyingText}>🧠 Identifying bug...</Text>
                </View>
              </View>
            )}

            {/* Bottom controls */}
            <View style={styles.bottomBar}>
              <TouchableOpacity
                style={[
                  styles.captureButton,
                  liveScanState === 'classifying' && { opacity: 0.5 },
                ]}
                onPress={mode === 'liveScan' ? takeScanPhoto : takePicture}
                disabled={liveScanState === 'classifying'}
              >
                <View style={styles.captureIcon} />
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>
      )}
    </SafeAreaView>
  );
};

// ─── Styles ──────────────────────────────────────────────────
function createStyles(theme: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: '#000',
    },
    camera: {
      flex: 1,
    },
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'space-between',
    },
    topBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 50,
      paddingBottom: 20,
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
    buttonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '900',
    },
    bottomBar: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 50,
      paddingHorizontal: 20,
    },
    captureButton: {
      width: 76,
      height: 76,
      borderRadius: 12,
      backgroundColor: theme.colors.primary,
      borderWidth: 4,
      borderColor: '#FFFFFF',
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.3,
      shadowRadius: 4,
      elevation: 5,
    },
    captureIcon: {
      width: 56,
      height: 56,
      borderRadius: 8,
      backgroundColor: '#FFFFFF',
    },
    reticle: {
      position: 'absolute',
      top: '50%',
      left: '50%',
      transform: [{ translateX: -75 }, { translateY: -75 }],
      width: 150,
      height: 150,
      borderWidth: 3,
      borderColor: theme.colors.primary,
      borderRadius: 10,
      borderStyle: 'dashed',
    },
    instructionText: {
      position: 'absolute',
      bottom: 140,
      left: 0,
      right: 0,
      textAlign: 'center',
      color: '#FFFFFF',
      fontSize: 13,
      fontWeight: '800',
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      paddingVertical: 10,
      paddingHorizontal: 16,
      marginHorizontal: 40,
      borderRadius: 6,
      textTransform: 'uppercase',
      letterSpacing: 0.3,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    permissionContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: theme.colors.background,
      paddingHorizontal: 40,
    },
    permissionText: {
      textAlign: 'center',
      marginBottom: 20,
      fontSize: 16,
      color: theme.colors.text,
    },
    permissionButton: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 28,
      paddingVertical: 14,
      borderRadius: 8,
      borderWidth: 3,
      borderColor: `${theme.colors.primary}80`,
    },
    permissionButtonText: {
      color: '#FFFFFF',
      fontSize: 14,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    // ─── Live scan classifying overlay ────────
    classifyingOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    classifyingCard: {
      backgroundColor: 'rgba(0,0,0,0.85)',
      borderRadius: 16,
      paddingVertical: 24,
      paddingHorizontal: 32,
      alignItems: 'center',
      gap: 12,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.2)',
    },
    classifyingText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '700',
    },
    // ─── Live scan result screen ─────────────
    resultContainer: {
      flex: 1,
      backgroundColor: '#000',
    },
    resultPhoto: {
      flex: 1,
      width: '100%',
    },
    resultOverlay: {
      ...StyleSheet.absoluteFillObject,
    },
    resultCard: {
      backgroundColor: 'rgba(0,0,0,0.9)',
      marginHorizontal: 16,
      marginBottom: 40,
      borderRadius: 16,
      padding: 20,
      alignItems: 'center',
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.15)',
    },
    resultEmoji: {
      fontSize: 40,
      marginBottom: 8,
    },
    resultLabel: {
      color: '#FFFFFF',
      fontSize: 24,
      fontWeight: '900',
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 12,
    },
    confidenceRow: {
      width: '100%',
      marginBottom: 16,
    },
    confidenceText: {
      fontSize: 14,
      fontWeight: '700',
      marginBottom: 6,
      textAlign: 'center',
    },
    confidenceBarBg: {
      height: 8,
      backgroundColor: 'rgba(255,255,255,0.15)',
      borderRadius: 4,
      overflow: 'hidden',
    },
    confidenceBarFill: {
      height: '100%',
      borderRadius: 4,
    },
    resultActions: {
      flexDirection: 'row',
      gap: 12,
      width: '100%',
    },
    retakeButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      borderWidth: 2,
      borderColor: 'rgba(255,255,255,0.3)',
      alignItems: 'center',
    },
    retakeButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
    },
    confirmButton: {
      flex: 1,
      paddingVertical: 14,
      borderRadius: 10,
      alignItems: 'center',
    },
    confirmButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '800',
    },
  });
}
