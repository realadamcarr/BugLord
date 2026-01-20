/**
 * ManualCropper
 * 
 * Allows users to manually define a crop rectangle on captured photos
 * before running ML inference. Improves accuracy by focusing on the insect.
 */

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { useTheme } from '@/contexts/ThemeContext';
import * as ImageManipulator from 'expo-image-manipulator';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    Image,
    Modal,
    StyleSheet,
    TouchableOpacity,
    View
} from 'react-native';
import { GestureHandlerRootView, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface ManualCropperProps {
  visible: boolean;
  imageUri: string;
  onCropComplete: (croppedUri: string) => void;
  onSkip: () => void;
  onCancel: () => void;
}

export const ManualCropper: React.FC<ManualCropperProps> = ({
  visible,
  imageUri,
  onCropComplete,
  onSkip,
  onCancel,
}) => {
  const { theme } = useTheme();
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  const [displayDimensions, setDisplayDimensions] = useState({ width: 0, height: 0 });
  const [isCropping, setIsCropping] = useState(false);

  // Crop rectangle in display coordinates (percentage of display size)
  const [cropRect, setCropRect] = useState({
    x: 0.15, // 15% from left
    y: 0.25, // 25% from top
    width: 0.7, // 70% width
    height: 0.5, // 50% height
  });

  const styles = createStyles(theme);

  // Load image dimensions when visible
  React.useEffect(() => {
    if (visible && imageUri) {
      Image.getSize(imageUri, (width, height) => {
        setImageDimensions({ width, height });
        
        // Calculate display dimensions (fit within screen with padding)
        const maxWidth = screenWidth - 40;
        const maxHeight = screenHeight * 0.6;
        const aspectRatio = width / height;
        
        let displayWidth = maxWidth;
        let displayHeight = displayWidth / aspectRatio;
        
        if (displayHeight > maxHeight) {
          displayHeight = maxHeight;
          displayWidth = displayHeight * aspectRatio;
        }
        
        setDisplayDimensions({ width: displayWidth, height: displayHeight });
      });
    }
  }, [visible, imageUri]);

  const handleCrop = async () => {
    setIsCropping(true);
    try {
      // Convert display coordinates to image coordinates
      const scaleX = imageDimensions.width / displayDimensions.width;
      const scaleY = imageDimensions.height / displayDimensions.height;

      const cropOriginX = Math.round(cropRect.x * displayDimensions.width * scaleX);
      const cropOriginY = Math.round(cropRect.y * displayDimensions.height * scaleY);
      const cropWidth = Math.round(cropRect.width * displayDimensions.width * scaleX);
      const cropHeight = Math.round(cropRect.height * displayDimensions.height * scaleY);

      console.log('🔲 Cropping image:', { cropOriginX, cropOriginY, cropWidth, cropHeight });

      const croppedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [{
          crop: {
            originX: cropOriginX,
            originY: cropOriginY,
            width: cropWidth,
            height: cropHeight,
          }
        }],
        {
          compress: 0.9,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      console.log('✅ Image cropped successfully');
      onCropComplete(croppedImage.uri);
    } catch (error) {
      console.error('❌ Crop failed:', error);
      alert('Crop failed. Please try again or skip.');
    } finally {
      setIsCropping(false);
    }
  };

  const handlePanGesture = (event: PanGestureHandlerGestureEvent, handle: 'tl' | 'tr' | 'bl' | 'br' | 'move') => {
    // Simplified: For now, just allow skipping crop
    // Full implementation would handle drag gestures to resize/move crop box
    // This is a placeholder for the gesture handling logic
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onCancel}
    >
      <GestureHandlerRootView style={styles.container}>
        <ThemedView style={styles.container}>
          <View style={styles.header}>
            <ThemedText style={styles.title}>Crop Your Bug</ThemedText>
            <ThemedText style={styles.subtitle}>
              Adjust the box to frame the insect, or skip for auto-crop
            </ThemedText>
          </View>

          <View style={styles.imageContainer}>
            {imageUri && displayDimensions.width > 0 ? (
              <>
                <Image
                  source={{ uri: imageUri }}
                  style={{
                    width: displayDimensions.width,
                    height: displayDimensions.height,
                  }}
                  resizeMode="contain"
                />
                {/* Crop overlay */}
                <View
                  style={[
                    styles.cropBox,
                    {
                      left: cropRect.x * displayDimensions.width,
                      top: cropRect.y * displayDimensions.height,
                      width: cropRect.width * displayDimensions.width,
                      height: cropRect.height * displayDimensions.height,
                    }
                  ]}
                >
                  {/* Corner handles - simplified for now */}
                  <View style={[styles.handle, styles.handleTL]} />
                  <View style={[styles.handle, styles.handleTR]} />
                  <View style={[styles.handle, styles.handleBL]} />
                  <View style={[styles.handle, styles.handleBR]} />
                </View>
              </>
            ) : (
              <ActivityIndicator size="large" color={theme.colors.primary} />
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onCancel}
              disabled={isCropping}
            >
              <ThemedText style={styles.buttonText}>Cancel</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.skipButton]}
              onPress={onSkip}
              disabled={isCropping}
            >
              <ThemedText style={styles.buttonText}>Skip Crop</ThemedText>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={handleCrop}
              disabled={isCropping}
            >
              {isCropping ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <ThemedText style={[styles.buttonText, styles.confirmButtonText]}>
                  Crop & Continue
                </ThemedText>
              )}
            </TouchableOpacity>
          </View>
        </ThemedView>
      </GestureHandlerRootView>
    </Modal>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
    textAlign: 'center',
  },
  imageContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  cropBox: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: theme.colors.primary,
    borderStyle: 'dashed',
  },
  handle: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    borderWidth: 2,
    borderColor: '#fff',
  },
  handleTL: { top: -10, left: -10 },
  handleTR: { top: -10, right: -10 },
  handleBL: { bottom: -10, left: -10 },
  handleBR: { bottom: -10, right: -10 },
  actions: {
    flexDirection: 'row',
    padding: 20,
    gap: 10,
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: theme.colors.border || '#666',
  },
  skipButton: {
    backgroundColor: theme.colors.secondary || '#888',
  },
  confirmButton: {
    backgroundColor: theme.colors.primary,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  confirmButtonText: {
    color: '#fff',
  },
});
