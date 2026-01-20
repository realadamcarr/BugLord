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
   * @param imageUri - Source image URI
   * @param config - Preprocessing configuration
   * @returns Processed image URI ready for inference
   */
  async preprocessForInference(
    imageUri: string,
    config: Partial<PreprocessingConfig> = {}
  ): Promise<string> {
    const {
      targetSize = 224,
      quality = 0.9,
      format = 'jpeg',
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
}

export const mlPreprocessingService = new MLPreprocessingService();
