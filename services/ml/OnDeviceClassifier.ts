/**
 * OnDeviceClassifier
 * 
 * Abstraction layer for on-device TensorFlow Lite inference.
 * Uses react-native-fast-tflite when available (EAS dev builds),
 * falls back to stubs in Expo Go.
 */

import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';
import { BoundingBox, DetectionModelConfig, DetectionResult, MLCandidate, MLClassifierConfig } from './types';

// Try to import react-native-fast-tflite, fallback gracefully
let TFLite: any = null;
try {
  TFLite = require('react-native-fast-tflite');
  console.log('✅ react-native-fast-tflite loaded successfully');
} catch (e) {
  console.warn('⚠️  react-native-fast-tflite not available (running in Expo Go?)', e);
}

class OnDeviceClassifier {
  private modelLoaded: boolean = false;
  private labels: string[] = [];
  private config: MLClassifierConfig | null = null;
  
  // Detection model state
  private detectionModelLoaded: boolean = false;
  private detectionConfig: DetectionModelConfig | null = null;
  
  // TFLite model instances (react-native-fast-tflite)
  private model: any = null;
  private detectionModel: any = null;

  /**
   * Ensure ML directory exists in document storage
   */
  private async ensureMlDirExists(): Promise<void> {
    const mlDir = `${FileSystem.documentDirectory!}ml/`;
    const dirInfo = await FileSystem.getInfoAsync(mlDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(mlDir, { intermediates: true });
    }
  }

  /**
   * Read and parse labels JSON file
   */
  private async readLabelsFile(path: string): Promise<string[]> {
    const content = await FileSystem.readAsStringAsync(path);
    return JSON.parse(content);
  }

  /**
   * Get original image dimensions
   */
  private async getImageSize(uri: string): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      Image.getSize(
        uri,
        (width, height) => resolve({ width, height }),
        reject
      );
    });
  }

  /**
   * Clamp value between min and max
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Sort and return top K candidates
   */
  private sortTopK(candidates: MLCandidate[], k: number): MLCandidate[] {
    return candidates
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, k);
  }

  /**
   * Load model and labels from specified paths
   * @param modelPath - Path to .tflite model file
   * @param labelsPath - Path to labels JSON file
   */
  async loadModel(modelPath: string, labelsPath: string): Promise<void> {
    console.log('🧠 Loading ML classification model...');
    console.log('  Model:', modelPath);
    console.log('  Labels:', labelsPath);

    try {
      // Load labels
      this.labels = await this.readLabelsFile(labelsPath);
      console.log(`✅ Loaded ${this.labels.length} class labels`);

      // Load TFLite model if native module available
      if (TFLite && TFLite.loadModel) {
        try {
          this.model = await TFLite.loadModel(modelPath);
          console.log('✅ TFLite classification model loaded with react-native-fast-tflite');
          console.log(`   Input: ${JSON.stringify(this.model?.inputs)}`);
          console.log(`   Output: ${JSON.stringify(this.model?.outputs)}`);
        } catch (modelError) {
          console.warn('⚠️  TFLite loading failed, using fallback:', modelError);
          this.model = null;
        }
      } else {
        console.warn('⚠️  react-native-fast-tflite not available, using stub mode');
        console.log('   Build with: npx expo prebuild && eas build');
        this.model = null;
      }
      
      this.modelLoaded = true;
      this.config = {
        modelPath,
        labelsPath,
        inputSize: 224,
        topK: 5,
        confidenceThreshold: 0.1,
      };

    } catch (error) {
      console.error('❌ Failed to load model:', error);
      throw new Error(`Model loading failed: ${error}`);
    }
  }

  /**
   * Classify image and return top-K predictions
   * @param imageUri - Image URI to classify
   * @param topK - Number of top predictions to return
   * @returns Array of candidates with label and confidence
   */
  async classifyImage(imageUri: string, topK: number = 5): Promise<MLCandidate[]> {
    if (!this.modelLoaded) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    console.log(`🔍 Classifying image: ${imageUri}`);

    try {
      // Real inference when model is available
      if (this.model && TFLite) {
        // Preprocess image to 224x224 RGB
        const resized = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: 224, height: 224 } }],
          { format: ImageManipulator.SaveFormat.JPEG, compress: 0.9 }
        );

        // Run inference
        // Note: react-native-fast-tflite handles image loading and tensor conversion
        const outputs = await this.model.run(resized.uri);
        
        // Process output tensor into predictions
        const predictions: MLCandidate[] = [];
        const outputTensor = Array.isArray(outputs) ? outputs[0] : outputs;
        
        // Map output values to labels
        for (let i = 0; i < this.labels.length && i < outputTensor.length; i++) {
          predictions.push({
            label: this.labels[i],
            confidence: outputTensor[i],
          });
        }

        // Sort and return top-K
        const topPredictions = this.sortTopK(predictions, topK);
        console.log(`✅ Classification complete: ${topPredictions[0]?.label} (${(topPredictions[0]?.confidence * 100).toFixed(1)}%)`);
        return topPredictions;
        
      } else {
        // Fallback to stub if model not loaded
        console.warn('⚠️  Using STUB predictions (TFLite not available)');
        return this.getStubPredictions(topK);
      }

    } catch (error) {
      console.error('❌ Classification failed:', error);
      console.warn('⚠️  Falling back to stub predictions');
      return this.getStubPredictions(topK);
    }
  }

  /**
   * Check if model is loaded and ready
   */
  isReady(): boolean {
    return this.modelLoaded;
  }

  /**
   * Get current model configuration
   */
  getConfig(): MLClassifierConfig | null {
    return this.config;
  }

  /**
   * Unload model and free resources
   */
  async unloadModel(): Promise<void> {
    console.log('🧹 Unloading ML model...');
    
    // Dispose native model if available
    if (this.model && typeof this.model.dispose === 'function') {
      try {
        await this.model.dispose();
      } catch (e) {
        console.warn('Error disposing model:', e);
      }
    }

    this.model = null;
    this.modelLoaded = false;
    this.labels = [];
    this.config = null;
    
    console.log('✅ Model unloaded');
  }

  /**
   * Load object detection model for insect localization
   * @param modelPath - Path to detection .tflite model (EfficientDet-Lite0)
   */
  async loadDetectionModel(modelPath: string): Promise<void> {
    console.log('🎯 Loading object detection model...');
    console.log('  Model:', modelPath);

    try {
      // Load TFLite detection model if native module available
      if (TFLite && TFLite.loadModel) {
        try {
          this.detectionModel = await TFLite.loadModel(modelPath);
          console.log('✅ TFLite detection model loaded with react-native-fast-tflite');
          console.log(`   Input: ${JSON.stringify(this.detectionModel?.inputs)}`);
          console.log(`   Output: ${JSON.stringify(this.detectionModel?.outputs)}`);
        } catch (modelError) {
          console.warn('⚠️  TFLite detection loading failed, using fallback:', modelError);
          this.detectionModel = null;
        }
      } else {
        console.warn('⚠️  react-native-fast-tflite not available for detection');
        this.detectionModel = null;
      }
      
      this.detectionModelLoaded = true;
      this.detectionConfig = {
        modelPath,
        inputSize: 320, // EfficientDet-Lite0 input size
        confidenceThreshold: 0.45,
        maxDetections: 10,
      };

    } catch (error) {
      console.error('❌ Failed to load detection model:', error);
      throw new Error(`Detection model loading failed: ${error}`);
    }
  }

  /**
   * Detect insects in image and return bounding boxes
   * @param imageUri - Image URI to detect objects in
   * @param options - Detection options
   * @returns Detection results with bounding boxes in original image coordinates
   */
  async detectObjects(imageUri: string, options?: {
    confidenceThreshold?: number;
    maxDetections?: number;
  }): Promise<DetectionResult> {
    if (!this.detectionModelLoaded) {
      throw new Error('Detection model not loaded. Call loadDetectionModel() first.');
    }

    const confidenceThreshold = options?.confidenceThreshold ?? this.detectionConfig!.confidenceThreshold;
    const maxDetections = options?.maxDetections ?? this.detectionConfig!.maxDetections;

    console.log(`🔍 Detecting objects in: ${imageUri}`);

    try {
      // Real detection when model is available
      if (this.detectionModel && TFLite) {
        // Get original image dimensions
        const originalSize = await this.getImageSize(imageUri);
        
        // Preprocess image to 320x320 for EfficientDet-Lite0
        const resized = await ImageManipulator.manipulateAsync(
          imageUri,
          [{ resize: { width: 320, height: 320 } }],
          { format: ImageManipulator.SaveFormat.JPEG, compress: 0.9 }
        );

        // Run detection inference
        const outputs = await this.detectionModel.run(resized.uri);
        
        // Parse EfficientDet outputs
        // Typical format: [boxes, scores, classes, numDetections]
        // boxes: [1, N, 4] (ymin, xmin, ymax, xmax) normalized 0..1
        // scores: [1, N]
        // classes: [1, N]
        // numDetections: [1]
        
        const boxes: BoundingBox[] = [];
        const numDets = Array.isArray(outputs[3]) ? outputs[3][0] : Math.min(outputs[1]?.length || 0, maxDetections);
        
        for (let i = 0; i < numDets; i++) {
          const score = outputs[1]?.[i] ?? outputs[1]?.[0]?.[i];
          
          if (score && score >= confidenceThreshold) {
            // Extract normalized coordinates
            const ymin = outputs[0]?.[i * 4] ?? outputs[0]?.[0]?.[i]?.[0];
            const xmin = outputs[0]?.[i * 4 + 1] ?? outputs[0]?.[0]?.[i]?.[1];
            const ymax = outputs[0]?.[i * 4 + 2] ?? outputs[0]?.[0]?.[i]?.[2];
            const xmax = outputs[0]?.[i * 4 + 3] ?? outputs[0]?.[0]?.[i]?.[3];
            
            // Convert to original image pixel coordinates
            const x = this.clamp(xmin, 0, 1) * originalSize.width;
            const y = this.clamp(ymin, 0, 1) * originalSize.height;
            const width = this.clamp(xmax - xmin, 0, 1) * originalSize.width;
            const height = this.clamp(ymax - ymin, 0, 1) * originalSize.height;
            
            boxes.push({
              x: Math.round(x),
              y: Math.round(y),
              width: Math.round(width),
              height: Math.round(height),
              confidence: score,
            });
          }
        }
        
        console.log(`✅ Detection complete: Found ${boxes.length} objects`);
        return { 
          boxes, 
          confidenceThreshold 
        };
        
      } else {
        // Fallback to stub if model not loaded
        console.warn('⚠️  Using STUB object detection (TFLite not available)');
        const originalSize = await this.getImageSize(imageUri);
        const boxes = this.getStubDetection(confidenceThreshold, originalSize);
        return { boxes, confidenceThreshold };
      }

    } catch (error) {
      console.error('❌ Object detection failed:', error);
      console.warn('⚠️  Falling back to empty detection');
      return { boxes: [], confidenceThreshold };
    }
  }

  /**
   * Check if detection model is loaded and ready
   */
  isDetectionReady(): boolean {
    return this.detectionModelLoaded;
  }

  /**
   * Get current detection model configuration
   */
  getDetectionConfig(): DetectionModelConfig | null {
    return this.detectionConfig;
  }

  /**
   * STUB: Generate mock predictions for development/testing
   * Used when TFLite is not available
   */
  private getStubPredictions(topK: number): MLCandidate[] {
    // Simulate inference with random but plausible predictions
    const candidateIndices = this.getRandomIndices(this.labels.length, topK);
    const predictions: MLCandidate[] = [];

    let remainingConfidence = 1.0;
    for (let i = 0; i < candidateIndices.length; i++) {
      const idx = candidateIndices[i];
      const confidence = remainingConfidence * (0.4 - i * 0.08);
      
      predictions.push({
        label: this.labels[idx] || 'Unknown',
        confidence: Math.max(0.05, confidence),
      });
      
      remainingConfidence -= confidence;
    }

    // Normalize confidences to sum to ~1.0
    const total = predictions.reduce((sum, p) => sum + p.confidence, 0);
    predictions.forEach(p => p.confidence = p.confidence / total);

    return predictions;
  }

  /**
   * Get random unique indices for stub predictions
   */
  private getRandomIndices(maxIndex: number, count: number): number[] {
    const indices: number[] = [];
    while (indices.length < Math.min(count, maxIndex)) {
      const idx = Math.floor(Math.random() * maxIndex);
      if (!indices.includes(idx)) {
        indices.push(idx);
      }
    }
    return indices;
  }

  /**
   * Helper: Copy bundled model to FileSystem if needed
   * @param assetModule - Bundled asset module (e.g., require('../../assets/ml/model.tflite'))
   * @param fileName - Target filename
   * @returns FileSystem path to model
   */
  async copyBundledModel(assetModule: any, fileName: string): Promise<string> {
    await this.ensureMlDirExists();
    const targetPath = `${FileSystem.documentDirectory!}ml/${fileName}`;
    
    // Check if already copied
    const fileInfo = await FileSystem.getInfoAsync(targetPath);
    if (fileInfo.exists) {
      console.log('✅ Model already in FileSystem:', targetPath);
      return targetPath;
    }

    console.log('📦 Copying bundled model to FileSystem...');

    // Load asset and copy
    const asset = Asset.fromModule(assetModule);
    await asset.downloadAsync();
    
    if (asset.localUri) {
      await FileSystem.copyAsync({
        from: asset.localUri,
        to: targetPath,
      });
      console.log('✅ Model copied to:', targetPath);
      return targetPath;
    }

    throw new Error('Failed to load bundled model asset');
  }

  /**
   * Helper: Copy bundled labels to FileSystem
   */
  async copyBundledLabels(assetModule: any, fileName: string): Promise<string> {
    await this.ensureMlDirExists();
    const targetPath = `${FileSystem.documentDirectory!}ml/${fileName}`;
    
    // Check if already copied
    const fileInfo = await FileSystem.getInfoAsync(targetPath);
    if (fileInfo.exists) {
      console.log('✅ Labels already in FileSystem:', targetPath);
      return targetPath;
    }

    console.log('📦 Copying bundled labels to FileSystem...');

    // Load asset and copy
    const asset = Asset.fromModule(assetModule);
    await asset.downloadAsync();
    
    if (asset.localUri) {
      await FileSystem.copyAsync({
        from: asset.localUri,
        to: targetPath,
      });
      console.log('✅ Labels copied to:', targetPath);
      return targetPath;
    }

    throw new Error('Failed to load bundled labels asset');
  }

  /**
   * STUB: Generate mock detection for development/testing
   * Returns center-biased bounding box in original image pixel coordinates
   */
  private getStubDetection(
    confidenceThreshold: number,
    imageSize: { width: number; height: number }
  ): BoundingBox[] {
    // Simulate a center-biased detection
    const centerX = 0.5;
    const centerY = 0.5;
    const size = 0.6; // 60% of image (matching our training annotations)
    
    const xmin = centerX - size / 2;
    const ymin = centerY - size / 2;
    const width = size;
    const height = size;
    
    return [{
      x: Math.round(xmin * imageSize.width),
      y: Math.round(ymin * imageSize.height),
      width: Math.round(width * imageSize.width),
      height: Math.round(height * imageSize.height),
      confidence: 0.75,
    }];
  }
}

export const onDeviceClassifier = new OnDeviceClassifier();
