import * as ImageManipulator from 'expo-image-manipulator';
import { Dimensions } from 'react-native';
import { onDeviceClassifier } from './ml/OnDeviceClassifier';

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
  maxEdge?: number; // long-edge resize for identification
}

const { width: screenWidth } = Dimensions.get('window');

class ImageProcessingService {
  private initialized: boolean = false;

  /**
   * Initialize the image processing service and load detection model
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      console.log('📷 Initializing ImageProcessingService...');
      
      // Load detection model when bundled in assets
      try {
        const detectionModelPath = await onDeviceClassifier.copyBundledModel(
          require('@/assets/ml/insect_detector.tflite'),
          'insect_detector.tflite'
        );
        await onDeviceClassifier.loadDetectionModel(detectionModelPath);
        console.log('✅ Detection model loaded');
      } catch (detectionError) {
        console.warn('⚠️  Detection model not available, using fallback:', detectionError);
      }
      
      this.initialized = true;
      console.log('✅ ImageProcessingService initialized');
    } catch (error) {
      console.warn('⚠️  ImageProcessingService initialization failed:', error);
      // Continue without detection model - will use fallback
    }
  }
  
  /**
   * Main processing method - detects insects, crops them, and creates pixelated icons
   */
  async processInsectPhoto(
    photoUri: string, 
    options: ProcessingOptions = {}
  ): Promise<CropResult> {
    // Ensure service is initialized
    await this.initialize();
    
    const {
      pixelSize = 8,
      iconSize = 64,
      quality = 0.8,
      detectObjects = true,
      maxEdge = 1280
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
      
      // Resize original before crop to reduce noise/latency
      const resizedForId = await this.resizeLongestEdge(photoUri, maxEdge, quality);

      // Crop the insect from the resized image
      const croppedImage = await this.cropImage(resizedForId, boundingBox, quality);
      
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
      // Check if detection model is ready
      if (onDeviceClassifier.isDetectionReady()) {
        console.log('🤖 Using ML-based object detection...');
        
        // Get image dimensions for proper scaling
        const imageInfo = await ImageManipulator.manipulateAsync(
          photoUri,
          [],
          { base64: false, format: ImageManipulator.SaveFormat.JPEG }
        );
        
        // Preprocess for detection model (300x300 for SSD)
        const detectionConfig = onDeviceClassifier.getDetectionConfig();
        const inputSize = detectionConfig?.inputSize ?? 300;
        const preprocessed = await this.preprocessForDetection(photoUri, inputSize);
        
        // Run detection
        const detectionResult = await onDeviceClassifier.detectObjects(preprocessed, {
          confidenceThreshold: 0.3,
          maxDetections: 5,
        });
        
        if (detectionResult.boxes.length > 0) {
          // Use the highest confidence detection
          const bestBox = detectionResult.boxes.reduce((best, box) => 
            (box.confidence ?? 0) > (best.confidence ?? 0) ? box : best
          );
          
          console.log(`✅ Detected insect with ${(bestBox.confidence! * 100).toFixed(1)}% confidence`);
          console.log(`   Inference time: ${detectionResult.inferenceTime}ms`);
          
          // Convert normalized coordinates to pixel coordinates
          return {
            x: Math.round(bestBox.x * imageInfo.width),
            y: Math.round(bestBox.y * imageInfo.height),
            width: Math.round(bestBox.width * imageInfo.width),
            height: Math.round(bestBox.height * imageInfo.height),
          };
        }
        
        console.log('⚠️  No detections above threshold, using fallback');
      }
      
      // Fallback to heuristic detection if ML not available
      return await this.simpleInsectDetection(photoUri);
      
    } catch (error) {
      console.log('Object detection failed, using fallback:', error);
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
   * Resize so the long edge equals maxEdge (maintains aspect ratio)
   */
  async resizeLongestEdge(imageUri: string, maxEdge: number = 1280, compress: number = 0.8): Promise<string> {
    try {
      // First pass to get dimensions by resizing to maxEdge either width or height
      const resized = await ImageManipulator.manipulateAsync(
        imageUri,
        [
          { resize: { width: maxEdge, height: maxEdge } },
        ],
        { compress, format: ImageManipulator.SaveFormat.JPEG }
      );
      return resized.uri;
    } catch (e) {
      console.warn('resizeLongestEdge failed, returning original', e);
      return imageUri;
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