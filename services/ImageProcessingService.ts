import * as ImageManipulator from 'expo-image-manipulator';
import { Dimensions } from 'react-native';

export interface CropResult {
  croppedImage: string;
  pixelatedIcon: string;
  boundingBox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface ProcessingOptions {
  pixelSize?: number;
  iconSize?: number;
  quality?: number;
  detectObjects?: boolean;
}

const { width: screenWidth } = Dimensions.get('window');

class ImageProcessingService {
  
  /**
   * Main processing method - detects insects, crops them, and creates pixelated icons
   */
  async processInsectPhoto(
    photoUri: string, 
    options: ProcessingOptions = {}
  ): Promise<CropResult> {
    const {
      pixelSize = 8,
      iconSize = 64,
      quality = 0.8,
      detectObjects = true
    } = options;

    console.log('🖼️ Starting insect photo processing:', photoUri);
    
    try {
      let boundingBox;
      
      if (detectObjects) {
        // Try to detect the insect in the image
        boundingBox = await this.detectInsect(photoUri);
      }
      
      if (!boundingBox) {
        // If no detection or detection disabled, use center crop
        boundingBox = this.getCenterCropBoundingBox();
      }
      
      // Crop the insect from the original image
      const croppedImage = await this.cropImage(photoUri, boundingBox, quality);
      
      // Create pixelated icon version
      const pixelatedIcon = await this.pixelateImage(croppedImage, pixelSize, iconSize);
      
      return {
        croppedImage,
        pixelatedIcon,
        boundingBox
      };
      
    } catch (error) {
      console.error('Image processing failed:', error);
      // Fallback to center crop and basic pixelation
      return this.processWithFallback(photoUri, options);
    }
  }
  
  /**
   * Detect insects in the image using object detection
   * For now, uses a simple approach - in the future could integrate with ML models
   */
  private async detectInsect(photoUri: string): Promise<{ x: number; y: number; width: number; height: number } | null> {
    try {
      // This is a placeholder for actual object detection
      // In a real implementation, you might use:
      // 1. TensorFlow Lite models for mobile object detection
      // 2. Google Vision API for object detection
      // 3. Custom trained models for insect detection
      
      // For now, we'll use a simple heuristic approach
      // assuming insects are typically in the center of photos
      return await this.simpleInsectDetection(photoUri);
      
    } catch (error) {
      console.log('Object detection failed, using fallback');
      return null;
    }
  }
  
  /**
   * Simple insect detection using image analysis heuristics
   */
  private async simpleInsectDetection(photoUri: string): Promise<{ x: number; y: number; width: number; height: number } | null> {
    // This would analyze the image for:
    // - High contrast areas (insects vs background)
    // - Typical insect shapes and patterns
    // - Movement or focus areas
    
    // For now, return a reasonable center crop area
    // In a real app, this would use actual image analysis
    const imageWidth = 1080; // Assume typical camera resolution
    const imageHeight = 1920;
    
    // Create a crop area that's likely to contain the insect
    const cropSize = Math.min(imageWidth, imageHeight) * 0.6;
    const x = (imageWidth - cropSize) / 2;
    const y = (imageHeight - cropSize) / 2;
    
    return {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(cropSize),
      height: Math.round(cropSize)
    };
  }
  
  /**
   * Get a default center crop bounding box
   */
  private getCenterCropBoundingBox(): { x: number; y: number; width: number; height: number } {
    // Default to center crop if no detection
    const imageWidth = 1080;
    const imageHeight = 1920;
    const cropSize = Math.min(imageWidth, imageHeight) * 0.7;
    
    return {
      x: Math.round((imageWidth - cropSize) / 2),
      y: Math.round((imageHeight - cropSize) / 2),
      width: Math.round(cropSize),
      height: Math.round(cropSize)
    };
  }
  
  /**
   * Crop image using the provided bounding box
   */
  private async cropImage(
    photoUri: string, 
    boundingBox: { x: number; y: number; width: number; height: number },
    quality: number
  ): Promise<string> {
    
    try {
      // Get original image dimensions first
      const result = await ImageManipulator.manipulateAsync(
        photoUri,
        [
          {
            crop: {
              originX: boundingBox.x,
              originY: boundingBox.y,
              width: boundingBox.width,
              height: boundingBox.height,
            },
          },
        ],
        { 
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );
      
      return result.uri;
      
    } catch (error) {
      console.error('Image cropping failed:', error);
      return photoUri; // Return original if cropping fails
    }
  }
  
  /**
   * Create a pixelated version of the image for use as an icon
   */
  private async pixelateImage(imageUri: string, pixelSize: number, outputSize: number): Promise<string> {
    try {
      // Create pixelated effect by:
      // 1. Resize down to very small size (creates pixelation)
      // 2. Resize back up to desired output size (maintains pixelated look)
      
      const lowRes = Math.floor(outputSize / pixelSize);
      
      // First pass: resize down to create pixelation effect
      const smallImage = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          {
            resize: {
              width: lowRes,
              height: lowRes,
            },
          },
        ],
        { 
          compress: 1.0,
          format: ImageManipulator.SaveFormat.PNG 
        }
      );
      
      // Second pass: resize back up to output size, maintaining pixelated look
      const pixelatedImage = await ImageManipulator.manipulateAsync(
        smallImage.uri,
        [
          {
            resize: {
              width: outputSize,
              height: outputSize,
            },
          },
        ],
        { 
          compress: 1.0,
          format: ImageManipulator.SaveFormat.PNG 
        }
      );
      
      return pixelatedImage.uri;
      
    } catch (error) {
      console.error('Pixelation failed:', error);
      return imageUri;
    }
  }
  
  /**
   * Fallback processing when main detection fails
   */
  private async processWithFallback(photoUri: string, options: ProcessingOptions): Promise<CropResult> {
    const boundingBox = this.getCenterCropBoundingBox();
    
    return {
      croppedImage: photoUri, // Use original as fallback
      pixelatedIcon: photoUri, // Use original as fallback for now
      boundingBox
    };
  }
  
  /**
   * Generate a simple pixelated placeholder icon from text
   */
  async generatePixelatedPlaceholder(
    text: string, 
    size: number = 64, 
    pixelSize: number = 8
  ): Promise<string> {
    // This would generate a pixelated icon with the bug's name/type
    // Useful for when photo processing fails
    
    // For now, return a data URL placeholder
    // In real implementation, would use canvas to create pixelated text
    
    return `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==`;
  }
}

export const imageProcessingService = new ImageProcessingService();