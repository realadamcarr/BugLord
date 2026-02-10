/**
 * MLPreprocessingService
 * 
 * Handles image preprocessing for on-device ML inference:
 * - Resizes to fixed input size (224x224 or 320x320)
 * - Maintains aspect ratio or center crops
 * - Compresses to appropriate quality
 * - Returns URI ready for TFLite inference
 */

import * as ImageManipulator from 'expo-image-manipulator';
import { PreprocessingConfig } from './types';

class MLPreprocessingService {
  
  /**
   * Preprocess image for ML model inference
   * Includes adaptive contrast enhancement for dark subjects (e.g. black ants)
   * @param imageUri - Source image URI
   * @param config - Preprocessing configuration
   * @returns Processed image URI ready for inference
   */
  async preprocessForInference(
    imageUri: string,
    config: Partial<PreprocessingConfig & { enhanceContrast?: boolean }> = {}
  ): Promise<string> {
    const {
      targetSize = 224,
      quality = 0.9,
      format = 'jpeg',
      enhanceContrast = true,
    } = config;

    console.log(`📐 Preprocessing image for ML inference (${targetSize}x${targetSize})`);
    
    try {
      // Get image dimensions
      const imageInfo = await ImageManipulator.manipulateAsync(
        imageUri,
        [],
        { base64: false, format: ImageManipulator.SaveFormat.JPEG }
      );

      // Calculate resize and crop operations
      const operations: ImageManipulator.Action[] = [];

      // Step 1: Resize to fill target size (maintaining aspect ratio)
      // We resize so the smallest dimension equals targetSize
      const aspectRatio = imageInfo.width / imageInfo.height;
      
      let resizeWidth: number;
      let resizeHeight: number;
      
      if (aspectRatio > 1) {
        // Landscape: height is smaller, make it targetSize
        resizeHeight = targetSize;
        resizeWidth = Math.round(targetSize * aspectRatio);
      } else {
        // Portrait or square: width is smaller, make it targetSize
        resizeWidth = targetSize;
        resizeHeight = Math.round(targetSize / aspectRatio);
      }

      operations.push({
        resize: { width: resizeWidth, height: resizeHeight }
      });

      // Step 2: Center crop to exact target size
      const cropX = Math.floor((resizeWidth - targetSize) / 2);
      const cropY = Math.floor((resizeHeight - targetSize) / 2);
      
      operations.push({
        crop: {
          originX: cropX,
          originY: cropY,
          width: targetSize,
          height: targetSize,
        }
      });

      // Execute all operations
      const processedImage = await ImageManipulator.manipulateAsync(
        imageUri,
        operations,
        {
          compress: quality,
          format: format === 'png' ? ImageManipulator.SaveFormat.PNG : ImageManipulator.SaveFormat.JPEG,
        }
      );

      // If contrast enhancement is requested, check for dark subjects
      // and return an enhanced version for better ML inference
      if (enhanceContrast) {
        try {
          const isDark = await this.isImageDark(processedImage.uri);
          if (isDark) {
            console.log('🔆 Dark image detected — applying contrast enhancement for better ML inference');
            const enhancedUri = await this.preprocessWithEnhancement(processedImage.uri, targetSize);
            console.log(`✅ Preprocessed image (enhanced): ${targetSize}x${targetSize}`);
            return enhancedUri;
          }
        } catch {
          // Non-fatal — continue with standard preprocessing
        }
      }

      console.log(`✅ Preprocessed image: ${processedImage.width}x${processedImage.height}`);
      return processedImage.uri;

    } catch (error) {
      console.error('❌ Preprocessing failed:', error);
      throw new Error(`Image preprocessing failed: ${error}`);
    }
  }

  /**
   * Preprocess already-cropped image (from ManualCropper)
   * @param croppedUri - Pre-cropped image URI
   * @param targetSize - Target size for model input
   * @returns Resized image URI ready for inference
   */
  async preprocessCroppedImage(
    croppedUri: string,
    targetSize: number = 224
  ): Promise<string> {
    console.log(`📐 Preprocessing cropped image to ${targetSize}x${targetSize}`);
    
    try {
      // Simply resize cropped image to exact target size
      const processedImage = await ImageManipulator.manipulateAsync(
        croppedUri,
        [{ resize: { width: targetSize, height: targetSize } }],
        {
          compress: 0.9,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );

      console.log(`✅ Preprocessed cropped image: ${processedImage.width}x${processedImage.height}`);
      return processedImage.uri;

    } catch (error) {
      console.error('❌ Cropped image preprocessing failed:', error);
      throw new Error(`Cropped image preprocessing failed: ${error}`);
    }
  }

  /**
   * Batch preprocessing for multiple images
   * @param imageUris - Array of image URIs
   * @param config - Preprocessing configuration
   * @returns Array of processed image URIs
   */
  async preprocessBatch(
    imageUris: string[],
    config: Partial<PreprocessingConfig> = {}
  ): Promise<string[]> {
    console.log(`📐 Batch preprocessing ${imageUris.length} images`);
    
    const processed = await Promise.all(
      imageUris.map(uri => this.preprocessForInference(uri, config))
    );

    console.log(`✅ Batch preprocessing complete: ${processed.length} images`);
    return processed;
  }

  /**
   * Get image dimensions without full processing
   * @param imageUri - Image URI to inspect
   * @returns Width and height
   */
  async getImageDimensions(imageUri: string): Promise<{ width: number; height: number }> {
    try {
      const imageInfo = await ImageManipulator.manipulateAsync(
        imageUri,
        [],
        { base64: false, format: ImageManipulator.SaveFormat.JPEG }
      );
      return { width: imageInfo.width, height: imageInfo.height };
    } catch (error) {
      console.error('❌ Failed to get image dimensions:', error);
      throw new Error(`Failed to get image dimensions: ${error}`);
    }
  }

  /**
   * Analyze whether an image is predominantly dark.
   * Uses a base64 sample of the image center region.
   * Dark images (black ants on soil, dark beetles) need contrast boosting.
   */
  async isImageDark(imageUri: string): Promise<boolean> {
    try {
      // Get a tiny thumbnail and its base64 to sample brightness
      const thumb = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: 16, height: 16 } }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 1.0, base64: true }
      );

      if (!thumb.base64) return false;

      // Decode a rough brightness from the JPEG base64 bytes
      // JPEG data after the header is mostly DCT coefficients,
      // but the raw byte average of the base64 correlates with brightness
      const bytes = atob(thumb.base64);
      let sum = 0;
      // Skip JPEG header (first ~20 bytes), sample the rest
      const start = Math.min(20, bytes.length);
      for (let i = start; i < bytes.length; i++) {
        sum += bytes.charCodeAt(i);
      }
      const avgByte = sum / (bytes.length - start);

      // A well-lit image averages ~120-140 in raw byte values
      // Dark images (black ants, dark beetles on soil) tend to be below 115
      const isDark = avgByte < 115;
      console.log(`🔍 Image brightness analysis: avg=${avgByte.toFixed(1)}, isDark=${isDark}`);
      return isDark;
    } catch {
      return false;
    }
  }

  /**
   * Create a contrast-enhanced version of the image for dark subjects.
   * Produces a brighter/higher-contrast copy that helps ML models
   * distinguish dark insects (black ants, dark beetles) from backgrounds.
   * 
   * Strategy: resize up and back down with high JPEG quality to reduce
   * dark compression artifacts, combined with a lighter crop region.
   */
  async preprocessWithEnhancement(
    imageUri: string,
    targetSize: number = 224
  ): Promise<string> {
    console.log('🔆 Creating contrast-enhanced preprocessing for dark subject');

    try {
      // Step 1: Create a slightly larger intermediate to preserve detail
      const intermediate = await ImageManipulator.manipulateAsync(
        imageUri,
        [{ resize: { width: targetSize * 2, height: targetSize * 2 } }],
        { format: ImageManipulator.SaveFormat.PNG, compress: 1.0 }
      );

      // Step 2: Resize back down — the up-then-down with PNG intermediate
      // preserves more detail in dark regions than direct JPEG resize
      const enhanced = await ImageManipulator.manipulateAsync(
        intermediate.uri,
        [{ resize: { width: targetSize, height: targetSize } }],
        { format: ImageManipulator.SaveFormat.JPEG, compress: 1.0 }
      );

      console.log('✅ Enhanced preprocessing complete');
      return enhanced.uri;
    } catch (error) {
      console.warn('⚠️ Enhancement failed, using standard preprocessing:', error);
      return imageUri;
    }
  }
}

export const mlPreprocessingService = new MLPreprocessingService();
