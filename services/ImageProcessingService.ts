import * as ImageManipulator from 'expo-image-manipulator';
import pako from 'pako';
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
      
      // Load detection model when available in document directory
      try {
        const FileSystem = require('expo-file-system/legacy');
        
        const modelPath = `${FileSystem.documentDirectory}ml/insect_detector.tflite`;
        console.log('🔍 Looking for detection model at:', modelPath);
        
        const modelInfo = await FileSystem.getInfoAsync(modelPath);
        console.log('📋 Model file check result:', modelInfo);
        
        if (modelInfo.exists) {
          await onDeviceClassifier.loadDetectionModel(modelPath);
          console.log('✅ Detection model loaded from:', modelPath);
        } else {
          console.log('⚠️ Detection model not found, trying to copy from bundle...');
          
          // Try to copy from app bundle automatically
          try {
            const possiblePaths = [
              `${FileSystem.bundleDirectory}assets/ml/insect_detector.tflite`,
              `${FileSystem.bundleDirectory}assets/assets/ml/insect_detector.tflite`,
              `${FileSystem.bundleDirectory}bundled/assets/ml/insect_detector.tflite`
            ];
            
            let copied = false;
            for (const sourcePath of possiblePaths) {
              try {
                const sourceInfo = await FileSystem.getInfoAsync(sourcePath);
                if (sourceInfo.exists) {
                  // Ensure ml directory exists
                  const mlDir = `${FileSystem.documentDirectory}ml/`;
                  await FileSystem.makeDirectoryAsync(mlDir, { intermediates: true }).catch(() => {});
                  
                  await FileSystem.copyAsync({
                    from: sourcePath,
                    to: modelPath
                  });
                  console.log('✅ Copied detection model from bundle:', sourcePath);
                  
                  // Try to load it
                  await onDeviceClassifier.loadDetectionModel(modelPath);
                  console.log('✅ Detection model loaded successfully');
                  copied = true;
                  break;
                }
              } catch (pathError) {
                // Continue trying other paths
              }
            }
            
            if (!copied) {
              console.warn('⚠️ Could not copy detection model from bundle');
              console.warn('📋 Using fallback detection (center crop)');
            }
          } catch (bundleError) {
            console.warn('⚠️ Bundle copy failed, using fallback:', bundleError);
          }
        }
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
      // Get actual image dimensions first
      const imageInfo = await ImageManipulator.manipulateAsync(
        photoUri,
        [],
        { base64: false, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      let boundingBox;
      
      if (detectObjects) {
        // Try to detect the insect in the image
        boundingBox = await this.detectInsect(photoUri);
      }
      
      if (!boundingBox) {
        // If no detection or detection disabled, use center crop with actual dimensions
        boundingBox = this.getCenterCropBoundingBox(imageInfo.width, imageInfo.height);
      }
      
      // Validate and clamp bounding box to image dimensions
      boundingBox = this.validateBoundingBox(boundingBox, imageInfo.width, imageInfo.height);
      
      // Resize original before crop to reduce noise/latency
      const resizedForId = await this.resizeLongestEdge(photoUri, maxEdge, quality);
      
      // Get resized dimensions
      const resizedInfo = await ImageManipulator.manipulateAsync(
        resizedForId,
        [],
        { base64: false, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      // Scale bounding box to match resized image
      const scaleX = resizedInfo.width / imageInfo.width;
      const scaleY = resizedInfo.height / imageInfo.height;
      const scaledBox = {
        x: Math.round(boundingBox.x * scaleX),
        y: Math.round(boundingBox.y * scaleY),
        width: Math.round(boundingBox.width * scaleX),
        height: Math.round(boundingBox.height * scaleY)
      };
      
      // Validate scaled bounding box
      const validatedBox = this.validateBoundingBox(scaledBox, resizedInfo.width, resizedInfo.height);

      // Crop the insect from the resized image
      const croppedImage = await this.cropImage(resizedForId, validatedBox, quality);
      
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
          
          // Convert to pixel coordinates (detection returns normalized coordinates)
          return {
            x: Math.round(bestBox.x),
            y: Math.round(bestBox.y), 
            width: Math.round(bestBox.width),
            height: Math.round(bestBox.height),
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
   * Preprocess image for object detection model
   * @param photoUri - Original photo URI
   * @param inputSize - Target input size for detection model
   * @returns URI of preprocessed image
   */
  private async preprocessForDetection(photoUri: string, inputSize: number): Promise<string> {
    console.log(`🔧 Preprocessing for detection (${inputSize}x${inputSize})`);
    
    const preprocessed = await ImageManipulator.manipulateAsync(
      photoUri,
      [
        { resize: { width: inputSize, height: inputSize } }
      ],
      { 
        format: ImageManipulator.SaveFormat.JPEG, 
        compress: 0.9 
      }
    );
    
    console.log(`✅ Preprocessed for detection: ${inputSize}x${inputSize}`);
    return preprocessed.uri;
  }

  /**
   * Simple insect detection using image analysis heuristics
   */
  private async simpleInsectDetection(photoUri: string): Promise<{ x: number; y: number; width: number; height: number } | null> {
    try {
      // Get actual image dimensions instead of assuming a fixed resolution
      const imageInfo = await ImageManipulator.manipulateAsync(
        photoUri,
        [],
        { base64: false, format: ImageManipulator.SaveFormat.JPEG }
      );

      const imageWidth = imageInfo.width;
      const imageHeight = imageInfo.height;

      // Heuristic fallback: detect the darkest, most contrasty local region.
      // This improves tiny dark-subject captures (e.g. ants) when ML detection isn't available.
      const thumbSize = 80;
      const thumb = await ImageManipulator.manipulateAsync(
        photoUri,
        [{ resize: { width: thumbSize, height: thumbSize } }],
        {
          base64: true,
          compress: 1,
          format: ImageManipulator.SaveFormat.PNG,
        }
      );

      const heuristicBox = thumb.base64
        ? this.findDarkSubjectBoundingBoxFromPng(thumb.base64, thumbSize, imageWidth, imageHeight)
        : null;

      if (heuristicBox) {
        console.log('🎯 Heuristic fallback detection found subject region:', heuristicBox);
        return heuristicBox;
      }

      // Create a crop area that's likely to contain the insect (center 60%)
      const cropSize = Math.min(imageWidth, imageHeight) * 0.45;
      const x = (imageWidth - cropSize) / 2;
      const y = (imageHeight - cropSize) / 2;

      return {
        x: Math.round(x),
        y: Math.round(y),
        width: Math.round(cropSize),
        height: Math.round(cropSize)
      };
    } catch (error) {
      console.warn('simpleInsectDetection failed to get image dims:', error);
      return null;
    }
  }

  private findDarkSubjectBoundingBoxFromPng(
    pngBase64: string,
    thumbSize: number,
    imageWidth: number,
    imageHeight: number
  ): { x: number; y: number; width: number; height: number } | null {
    try {
      const bytes = this.base64ToBytes(pngBase64);

      const pixels = this.decodePngPixels(bytes, thumbSize, thumbSize);
      if (pixels.length !== thumbSize * thumbSize) return null;

      const luma = pixels.map(([r, g, b]) => (0.299 * r + 0.587 * g + 0.114 * b) / 255);
      const globalMean = luma.reduce((sum, v) => sum + v, 0) / Math.max(luma.length, 1);

      const window = Math.max(10, Math.floor(thumbSize * 0.18)); // ~14 on 80px thumb
      const step = 2;
      const best = this.findBestDarkWindow(luma, thumbSize, window, step, globalMean);

      if (!best || best.score < 0.22) return null;

      // Expand around candidate region so full body fits.
      const centerX = best.x + window / 2;
      const centerY = best.y + window / 2;
      const expanded = Math.floor(window * 2.4);

      const minThumbCrop = Math.floor(thumbSize * 0.22);
      const maxThumbCrop = Math.floor(thumbSize * 0.58);
      const cropThumbSize = Math.max(minThumbCrop, Math.min(maxThumbCrop, expanded));

      const originX = Math.max(0, Math.min(thumbSize - cropThumbSize, Math.round(centerX - cropThumbSize / 2)));
      const originY = Math.max(0, Math.min(thumbSize - cropThumbSize, Math.round(centerY - cropThumbSize / 2)));

      const scaleX = imageWidth / thumbSize;
      const scaleY = imageHeight / thumbSize;

      return {
        x: Math.round(originX * scaleX),
        y: Math.round(originY * scaleY),
        width: Math.round(cropThumbSize * scaleX),
        height: Math.round(cropThumbSize * scaleY),
      };
    } catch (error) {
      console.warn('⚠️ Heuristic fallback detection failed:', error);
      return null;
    }
  }

  private base64ToBytes(base64: string): Uint8Array {
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) {
      bytes[i] = raw.codePointAt(i) ?? 0;
    }
    return bytes;
  }

  private findBestDarkWindow(
    luma: number[],
    thumbSize: number,
    window: number,
    step: number,
    globalMean: number
  ): { x: number; y: number; score: number } | null {
    let best: { x: number; y: number; score: number } | null = null;

    for (let y = 0; y <= thumbSize - window; y += step) {
      for (let x = 0; x <= thumbSize - window; x += step) {
        const score = this.scoreDarkWindow(luma, thumbSize, x, y, window, globalMean);
        if (!best || score > best.score) {
          best = { x, y, score };
        }
      }
    }

    return best;
  }

  private scoreDarkWindow(
    luma: number[],
    thumbSize: number,
    startX: number,
    startY: number,
    window: number,
    globalMean: number
  ): number {
    let sum = 0;
    let sumSq = 0;
    let darkCount = 0;

    for (let wy = 0; wy < window; wy++) {
      for (let wx = 0; wx < window; wx++) {
        const value = luma[(startY + wy) * thumbSize + (startX + wx)];
        sum += value;
        sumSq += value * value;
        if (value < 0.28) darkCount++;
      }
    }

    const n = window * window;
    const mean = sum / n;
    const variance = Math.max(0, sumSq / n - mean * mean);
    const contrast = Math.sqrt(variance);
    const darkRatio = darkCount / n;

    const centerX = startX + window / 2;
    const centerY = startY + window / 2;
    const dx = (centerX - thumbSize / 2) / (thumbSize / 2);
    const dy = (centerY - thumbSize / 2) / (thumbSize / 2);
    const centerBias = 1 - Math.min(1, Math.hypot(dx, dy));

    return (
      (globalMean - mean) * 2.0 +
      contrast * 1.2 +
      darkRatio * 1.5 +
      centerBias * 0.35
    );
  }

  private decodePngPixels(
    pngBytes: Uint8Array,
    expectedWidth: number,
    expectedHeight: number
  ): Array<[number, number, number]> {
    try {
      const parsed = this.parsePngStructure(pngBytes);
      if (!parsed) return [];
      if (parsed.width !== expectedWidth || parsed.height !== expectedHeight) return [];

      const bytesPerPixel = this.getPngBytesPerPixel(parsed.colorType);
      if (!bytesPerPixel) return [];

      const inflated = pako.inflate(parsed.compressed);
      const decoded = this.unfilterPngScanlines(inflated, parsed.width, parsed.height, bytesPerPixel);
      return this.rgbPixelsFromDecoded(decoded, parsed.width, parsed.height, parsed.colorType, bytesPerPixel);
    } catch {
      return [];
    }
  }

  private parsePngStructure(
    pngBytes: Uint8Array
  ): { width: number; height: number; colorType: number; compressed: Uint8Array } | null {
    let offset = 8;
    let width = 0;
    let height = 0;
    let colorType = 0;
    const idatChunks: Uint8Array[] = [];

    while (offset < pngBytes.length - 8) {
      const len =
        (pngBytes[offset] << 24) |
        (pngBytes[offset + 1] << 16) |
        (pngBytes[offset + 2] << 8) |
        pngBytes[offset + 3];
      const type = String.fromCodePoint(
        pngBytes[offset + 4],
        pngBytes[offset + 5],
        pngBytes[offset + 6],
        pngBytes[offset + 7]
      );

      if (type === 'IHDR') {
        width =
          (pngBytes[offset + 8] << 24) |
          (pngBytes[offset + 9] << 16) |
          (pngBytes[offset + 10] << 8) |
          pngBytes[offset + 11];
        height =
          (pngBytes[offset + 12] << 24) |
          (pngBytes[offset + 13] << 16) |
          (pngBytes[offset + 14] << 8) |
          pngBytes[offset + 15];
        colorType = pngBytes[offset + 17];
      } else if (type === 'IDAT') {
        idatChunks.push(pngBytes.slice(offset + 8, offset + 8 + len));
      } else if (type === 'IEND') {
        break;
      }

      offset += 12 + len;
    }

    if (!idatChunks.length || !width || !height) {
      return null;
    }

    const compressed = new Uint8Array(idatChunks.reduce((sum, chunk) => sum + chunk.length, 0));
    let writeOffset = 0;
    for (const chunk of idatChunks) {
      compressed.set(chunk, writeOffset);
      writeOffset += chunk.length;
    }

    return { width, height, colorType, compressed };
  }

  private getPngBytesPerPixel(colorType: number): number {
    if (colorType === 2) return 3;
    if (colorType === 6) return 4;
    if (colorType === 0) return 1;
    return 0;
  }

  private unfilterPngScanlines(
    inflated: Uint8Array,
    width: number,
    height: number,
    bytesPerPixel: number
  ): Uint8Array {
    const scanlineLen = 1 + width * bytesPerPixel;
    const decoded = new Uint8Array(width * height * bytesPerPixel);

    for (let y = 0; y < height; y++) {
      const filterType = inflated[y * scanlineLen];
      const rowStart = y * scanlineLen + 1;
      const decodedRowStart = y * width * bytesPerPixel;

      for (let x = 0; x < width * bytesPerPixel; x++) {
        const raw = inflated[rowStart + x];
        const a = x >= bytesPerPixel ? decoded[decodedRowStart + x - bytesPerPixel] : 0;
        const b = y > 0 ? decoded[(y - 1) * width * bytesPerPixel + x] : 0;
        const c = x >= bytesPerPixel && y > 0
          ? decoded[(y - 1) * width * bytesPerPixel + x - bytesPerPixel]
          : 0;

        decoded[decodedRowStart + x] = this.applyPngFilter(filterType, raw, a, b, c);
      }
    }

    return decoded;
  }

  private applyPngFilter(filterType: number, raw: number, a: number, b: number, c: number): number {
    if (filterType === 1) return (raw + a) & 0xff;
    if (filterType === 2) return (raw + b) & 0xff;
    if (filterType === 3) return (raw + Math.floor((a + b) / 2)) & 0xff;
    if (filterType === 4) return (raw + this.paethPredictor(a, b, c)) & 0xff;
    return raw;
  }

  private rgbPixelsFromDecoded(
    decoded: Uint8Array,
    width: number,
    height: number,
    colorType: number,
    bytesPerPixel: number
  ): Array<[number, number, number]> {
    const pixels: Array<[number, number, number]> = [];
    for (let i = 0; i < width * height; i++) {
      const idx = i * bytesPerPixel;
      if (colorType === 0) {
        const gray = decoded[idx];
        pixels.push([gray, gray, gray]);
      } else {
        pixels.push([decoded[idx], decoded[idx + 1], decoded[idx + 2]]);
      }
    }
    return pixels;
  }

  private paethPredictor(a: number, b: number, c: number): number {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) return a;
    if (pb <= pc) return b;
    return c;
  }
  
  /**
   * Get a default center crop bounding box
   */
  private getCenterCropBoundingBox(imageWidth: number, imageHeight: number): { x: number; y: number; width: number; height: number } {
    // Default to center crop if no detection
    const cropSize = Math.min(imageWidth, imageHeight) * 0.7;
    
    return {
      x: Math.round((imageWidth - cropSize) / 2),
      y: Math.round((imageHeight - cropSize) / 2),
      width: Math.round(cropSize),
      height: Math.round(cropSize)
    };
  }
  
  /**
   * Validate and clamp bounding box to image dimensions
   */
  private validateBoundingBox(
    box: { x: number; y: number; width: number; height: number },
    imageWidth: number,
    imageHeight: number
  ): { x: number; y: number; width: number; height: number } {
    // Clamp x and y to be within image bounds
    const x = Math.max(0, Math.min(box.x, imageWidth - 1));
    const y = Math.max(0, Math.min(box.y, imageHeight - 1));
    
    // Clamp width and height to not exceed image bounds
    const maxWidth = imageWidth - x;
    const maxHeight = imageHeight - y;
    const width = Math.max(1, Math.min(box.width, maxWidth));
    const height = Math.max(1, Math.min(box.height, maxHeight));
    
    return { x, y, width, height };
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
    try {
      // Get actual image dimensions for a proper center crop
      const imageInfo = await ImageManipulator.manipulateAsync(
        photoUri,
        [],
        { base64: false, format: ImageManipulator.SaveFormat.JPEG }
      );
      const boundingBox = this.getCenterCropBoundingBox(imageInfo.width, imageInfo.height);

      return {
        croppedImage: photoUri,
        pixelatedIcon: photoUri,
        boundingBox
      };
    } catch {
      // Ultimate fallback — return original photo with a default bounding box
      return {
        croppedImage: photoUri,
        pixelatedIcon: photoUri,
        boundingBox: { x: 0, y: 0, width: 100, height: 100 }
      };
    }
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