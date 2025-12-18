import { useTheme } from '@/contexts/ThemeContext';
import { CameraType, CameraView, useCameraPermissions } from 'expo-camera';
import Constants from 'expo-constants';
import * as MediaLibrary from 'expo-media-library';
import React, { useRef } from 'react';
import { Alert, Dimensions, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

interface BugCameraProps {
  onCapture: (photoUri: string) => void;
  onClose: () => void;
}

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export const BugCamera: React.FC<BugCameraProps> = ({ onCapture, onClose }) => {
  const { theme } = useTheme();
  const facing: CameraType = 'back';
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const isExpoGo = Constants.appOwnership === 'expo';

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
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      borderRadius: 25,
      width: 50,
      height: 50,
      justifyContent: 'center',
      alignItems: 'center',
    },
    buttonText: {
      color: '#FFFFFF',
      fontSize: 18,
      fontWeight: 'bold',
    },
    bottomBar: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      paddingBottom: 50,
      paddingHorizontal: 20,
    },
    captureButton: {
      width: 80,
      height: 80,
      borderRadius: 40,
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
      width: 60,
      height: 60,
      borderRadius: 30,
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
      borderWidth: 2,
      borderColor: theme.colors.primary,
      borderRadius: 75,
      borderStyle: 'dashed',
    },
    instructionText: {
      position: 'absolute',
      bottom: 140,
      left: 0,
      right: 0,
      textAlign: 'center',
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      paddingVertical: 10,
      paddingHorizontal: 20,
      marginHorizontal: 40,
      borderRadius: 10,
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
      paddingHorizontal: 30,
      paddingVertical: 15,
      borderRadius: 10,
    },
    permissionButtonText: {
      color: '#FFFFFF',
      fontSize: 16,
      fontWeight: '600',
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

  return (
    <SafeAreaView style={styles.container}>
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
            🐛 Position the bug in the center circle and tap to capture
          </Text>

          {/* Bottom controls */}
          <View style={styles.bottomBar}>
            <TouchableOpacity style={styles.captureButton} onPress={takePicture}>
              <View style={styles.captureIcon} />
            </TouchableOpacity>
          </View>
        </View>
      </CameraView>
    </SafeAreaView>
  );
};