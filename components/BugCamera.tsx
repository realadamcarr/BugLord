import { useTheme } from '@/contexts/ThemeContext';
import { useScanStateMachine } from '@/hooks/useScanStateMachine';
import { IdentificationCandidate } from '@/types/Bug';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import Constants from 'expo-constants';
import * as MediaLibrary from 'expo-media-library';
import React, { useRef } from 'react';
import { Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export type ScanMode = 'photo' | 'liveScan';

interface BugCameraProps {
  onCapture: (photoUri: string) => void;
  onClose: () => void;
  mode?: ScanMode;
  /** Called every frame interval in liveScan mode — run ML classification on the URI and return candidates */
  onClassifyFrame?: (photoUri: string) => Promise<IdentificationCandidate[]>;
  /** Called when the user taps "Capture!" in liveScan mode after lock — receives the final photo URI and locked label */
  onLiveScanConfirm?: (photoUri: string, label: string, confidence: number) => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const BugCamera: React.FC<BugCameraProps> = ({
  onCapture,
  onClose,
  mode = 'photo',
  onClassifyFrame,
  onLiveScanConfirm,
}) => {
  const { theme } = useTheme();
  const facing: CameraType = 'back';
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const isExpoGo = Constants.appOwnership === 'expo';
  const frameLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessingRef = useRef(false);
  const { ctx: scanCtx, send: scanSend, reset: scanReset, isActive: isScanActive } = useScanStateMachine();

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
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
      transform: [
        { translateX: -75 },
        { translateY: -75 }
      ],
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
  });

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


  const takePicture = async () => {
    if (!cameraRef.current) return;

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        exif: true,
      });

      if (photo?.uri) {
        // In Expo Go, skip saving to gallery (limited access)
        if (!isExpoGo) {
          try {
            await MediaLibrary.saveToLibraryAsync(photo.uri);
          } catch (error) {
            console.warn('Could not save to media library:', error);
          }
        }
        onCapture(photo.uri);
      }
    } catch (error) {
      console.error('Error taking picture:', error);
      Alert.alert('Error', 'Failed to capture photo. Please try again.');
    }
  };

  // ─── Live Scan: frame processing loop ─────────────────────────
  const processFrame = useCallback(async () => {
    if (isProcessingRef.current || !cameraRef.current || !onClassifyFrame) return;
    if (scanCtx.state !== 'SCANNING') return;

    isProcessingRef.current = true;
    try {
      // Take a low-quality snapshot for ML classification
      const snap = await cameraRef.current.takePictureAsync({
        quality: 0.3,
        base64: false,
        exif: false,
      });

      if (snap?.uri) {
        const candidates = await onClassifyFrame(snap.uri);
        if (candidates.length > 0 && candidates[0].confidence !== undefined) {
          scanSend({
            type: 'FRAME_RESULT',
            label: candidates[0].label,
            confidence: candidates[0].confidence,
          });
        } else {
          scanSend({ type: 'NO_DETECTION' });
        }
      }
    } catch (err) {
      console.warn('Live scan frame error:', err);
    } finally {
      isProcessingRef.current = false;
    }
  }, [onClassifyFrame, scanCtx.state, scanSend]);

  // Start / stop the frame loop when in liveScan mode
  useEffect(() => {
    if (mode !== 'liveScan') return;

    // Auto-start scanning when camera opens in live mode
    if (scanCtx.state === 'IDLE') {
      scanSend({ type: 'START_SCAN' });
    }

    if (scanCtx.state === 'SCANNING') {
      frameLoopRef.current = setInterval(processFrame, 400); // SCAN_CONFIG.FRAME_INTERVAL_MS
    }

    return () => {
      if (frameLoopRef.current) {
        clearInterval(frameLoopRef.current);
        frameLoopRef.current = null;
      }
    };
  }, [mode, scanCtx.state, processFrame]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (frameLoopRef.current) clearInterval(frameLoopRef.current);
      scanReset();
    };
  }, []);

  // Handle "Capture!" press in live scan locked state
  const handleLiveScanConfirm = async () => {
    if (!cameraRef.current) return;
    scanSend({ type: 'CONFIRM' });

    try {
      // Take a high-quality photo for identification
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        base64: true,
        exif: true,
      });

      if (photo?.uri && onLiveScanConfirm) {
        onLiveScanConfirm(photo.uri, scanCtx.currentLabel, scanCtx.currentConfidence);
      }
    } catch (error) {
      console.error('Live scan capture failed:', error);
      scanSend({ type: 'ERROR', message: 'Failed to capture photo' });
    }
  };

  const handleLiveScanCancel = () => {
    if (frameLoopRef.current) {
      clearInterval(frameLoopRef.current);
      frameLoopRef.current = null;
    }
    scanReset();
    onClose();
  };

  const handleLiveScanRetry = () => {
    scanReset();
    scanSend({ type: 'START_SCAN' });
  };

  return (
    <SafeAreaView style={styles.container}>
      <CameraView 
        style={styles.camera} 
        facing={facing}
        mode="picture"
        ref={cameraRef}
      >
        {mode === 'photo' ? (
          /* ─── Photo Mode Overlay ─────────────── */
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
              🐛 Position the bug in the center circle and tap to capture
            </Text>

            {/* Bottom controls */}
            <View style={styles.bottomBar}>
              <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
                <View style={styles.captureIcon} />
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          /* ─── Live Scan Mode Overlay ─────────── */
          <LiveScanOverlay
            ctx={scanCtx}
            onConfirm={handleLiveScanConfirm}
            onCancel={handleLiveScanCancel}
            onRetry={handleLiveScanRetry}
          />
        )}
      </CameraView>
    </SafeAreaView>
  );
};