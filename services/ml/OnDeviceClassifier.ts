/**
 * OnDeviceClassifier
 * 
 * Abstraction layer for on-device TensorFlow Lite inference.
 * 
 * IMPORTANT: This requires a native TFLite runtime library.
 * Recommended options:
 * - react-native-fast-tflite (if available/maintained)
 * - @tensorflow/tfjs-react-native (heavier but more compatible)
 * - Custom native module wrapping TFLite
 * 
 * Current implementation uses a stub/fallback that compiles without native deps.
 * When ready to integrate real TFLite:
 * 1. Install native library: npm install react-native-fast-tflite (or equivalent)
 * 2. Run: npx expo prebuild && eas build --profile development
 * 3. Replace stub methods with actual TFLite calls
 * 4. Test in development build (NOT Expo Go)
 */

import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system';
import { BoundingBox, DetectionModelConfig, DetectionResult, MLCandidate, MLClassifierConfig } from './types';
// Native TFLite library

class OnDeviceClassifier {
  private modelLoaded: boolean = false;
  private labels: string[] = [];
  private config: MLClassifierConfig | null = null;
  
  // Detection model state
  private detectionModelLoaded: boolean = false;
  private detectionConfig: DetectionModelConfig | null = null;
  
  // TFLite model instances
  private model: TensorflowModel | null = null;
  private detectionModel: TensorflowModel | null = null;

  /**
   * Load model and labels from specified paths
   * @param modelPath - Path to .tflite model file
   * @param labelsPath - Path to labels JSON file
   */
  async loadModel(modelPath: string, labelsPath: string): Promise<void> {
    console.log('🧠 Loading ML model...');
    console.log('  Model:', modelPath);
    console.log('  Labels:', labelsPath);

    try {
      // Load labels
      const labelsContent = await FileSystem.readAsStringAsync(labelsPath);
      this.labels = JSON.parse(labelsContent);
      console.log(`✅ Loaded ${this.labels.length} class labels`);

      // Load actual TFLite model
      try {
        this.model = await TensorflowModel.loadFromFile(modelPath);
        console.log('✅ TFLite classification model loaded');
      } catch (modelError) {
        console.warn('⚠️  Native TFLite loading failed, using stub:', modelError);
        console.log('   Make sure to rebuild with: npx expo prebuild');
      }
      
      this.modelLoaded = true;
      this.config = {
        modelPath,
        labelsPath,
        inputSize: 224, // Default, should match model spec
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
   * @param imageUri - Preprocessed image URI (should be model input size)
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
      if (this.model) {
        const results = await this.model.run(imageUri);
        const predictions = this.processPredictions(results, topK);
        return predictions;
      } else {
        // Fallback to stub if model not loaded
        console.log('⚠️  Using STUB predictions (model not loaded)');
        return this.getStubPredictions(topK);
      }

    } catch (error) {
      console.error('❌ Classification failed:', error);
      
      // Fallback to stub on error
      console.log('⚠️  Falling back to stub predictions due to error');
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
    
    // TODO: Dispose native model
    // if (this.model) {
    //   await this.model.dispose();
    //   this.model = null;
    // }

    this.modelLoaded = false;
    this.labels = [];
    this.config = null;
    
    console.log('✅ Model unloaded');
  }

  /**
   * Load object detection model for insect localization
   * @param modelPath - Path to detection .tflite model (e.g., SSD MobileNet)
   * @param labelsPath - Optional path to detection class labels
   */
  async loadDetectionModel(modelPath: string, labelsPath?: string): Promise<void> {
    console.log('🎯 Loading object detection model...');
    console.log('  Model:', modelPath);

    try {
      // Load labels if provided
      let detectionLabels: string[] = [];
      if (labelsPath) {
        const labelsContent = await FileSystem.readAsStringAsync(labelsPath);
        detectionLabels = JSON.parse(labelsContent);
        console.log(`✅ Loaded ${detectionLabels.length} detection class labels`);
      }

      // Load actual TFLite detection model
      try {
        this.detectionModel = await TensorflowModel.loadFromFile(modelPath);
        console.log('✅ TFLite detection model loaded');
      } catch (modelError) {
        console.warn('⚠️  Native TFLite loading failed, using stub:', modelError);
        console.log('   Make sure detection model exists and rebuild with: npx expo prebuild');
      }
      
      this.detectionModelLoaded = true;
      this.detectionConfig = {
        modelPath,
        labelsPath,
        inputSize: 300, // Standard SSD input size
        confidenceThreshold: 0.3,
        maxDetections: 10,
      };

    } catch (error) {
      console.error('❌ Failed to load detection model:', error);
      throw new Error(`Detection model loading failed: ${error}`);
    }
  }

  /**
   * Detect insects in image and return bounding boxes
   * @param imageUri - Preprocessed image URI (should be detection model input size)
   * @param options - Detection options
   * @returns Detection results with bounding boxes
   */
  async detectObjects(imageUri: string, options?: {
    confidenceThreshold?: number;
    maxDetections?: number;
  }): Promise<DetectionResult> {
    if (!this.detectionModelLoaded) {
      throw new Error('Detection model not loaded. Call loadDetectionModel() first.');
    }

    const startTime = Date.now();
    console.log(`🔍 Detecting objects in: ${imageUri}`);

    const confidenceThreshold = options?.confidenceThreshold ?? this.detectionConfig!.confidenceThreshold;
    const maxDetections = options?.maxDetections ?? this.detectionConfig!.maxDetections;

    try {
      // Real detection when model is available
      if (this.detectionModel) {
        const results = await this.detectionModel.run(imageUri);
        const boxes = this.parseDetectionResults(results, confidenceThreshold, maxDetections);
        return { boxes, inferenceTime: Date.now() - startTime };
      } else {
        // Fallback to stub if model not loaded
        console.log('⚠️  Using STUB object detection (model not loaded)');
        const boxes = this.getStubDetection(confidenceThreshold);
        return { boxes, inferenceTime: Date.now() - startTime };
      }

    } catch (error) {
      console.error('❌ Object detection failed:', error);
      
      // Fallback to empty detection on error
      console.log('⚠️  Falling back to empty detection due to error');
      return { boxes: [], inferenceTime: Date.now() - startTime };
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
   * Replace this with real model inference once native library is integrated
   */
  private getStubPredictions(topK: number): MLCandidate[] {
    // Simulate inference with random but plausible predictions
    const candidateIndices = this.getRandomIndices(this.labels.length, topK);
    const predictions: MLCandidate[] = [];

    let remainingConfidence = 1.0;
    for (let i = 0; i < candidateIndices.length; i++) {
      const idx = candidateIndices[i];
      // First prediction gets highest confidence, descending
      const confidence = remainingConfidence * (0.4 - i * 0.08);
      
      predictions.push({
        label: this.labels[idx] || 'Unknown',
        confidence: Math.max(0.05, confidence), // Min 5%
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
   * Process raw model output into predictions
   */
  private processPredictions(rawOutput: Float32Array, topK: number): MLCandidate[] {
    // Convert raw output to label-confidence pairs
    const predictions: MLCandidate[] = [];
    
    for (let i = 0; i < rawOutput.length && i < this.labels.length; i++) {
      predictions.push({
        label: this.labels[i] || 'Unknown',
        confidence: rawOutput[i],
      });
    }
    
    // Sort by confidence descending
    predictions.sort((a, b) => b.confidence - a.confidence);
    
    // Return top-K
    return predictions.slice(0, topK);
  }

  /**
   * Parse raw detection model output into bounding boxes
   * SSD model output format: [boxes, classes, scores, num_detections]
   */
  private parseDetectionResults(
    rawOutput: any,
    confidenceThreshold: number,
    maxDetections: number
  ): BoundingBox[] {
    // SSD output format: [boxes, classes, scores, num_detections]
    // boxes: [batch, max_detections, 4] - [y1, x1, y2, x2] normalized 0-1
    // classes: [batch, max_detections]
    // scores: [batch, max_detections]
    // num_detections: [batch]
    
    const boxes: BoundingBox[] = [];
    const numDetections = Math.min(rawOutput[3][0], maxDetections);
    
    for (let i = 0; i < numDetections; i++) {
      const score = rawOutput[2][i];
      if (score < confidenceThreshold) continue;
      
      // Convert from [y1, x1, y2, x2] to [x, y, width, height]
      const y1 = rawOutput[0][i * 4];
      const x1 = rawOutput[0][i * 4 + 1];
      const y2 = rawOutput[0][i * 4 + 2];
      const x2 = rawOutput[0][i * 4 + 3];
      
      boxes.push({
        x: x1,
        y: y1,
        width: x2 - x1,
        height: y2 - y1,
        confidence: score,
        class: 'insect',
      });
    }
    
    return boxes;
  }

  /**
   * Helper: Copy bundled model to FileSystem if needed
   * @param assetPath - Path to bundled asset (e.g., require('../../assets/ml/model.tflite'))
   * @param targetFilename - Target filename in DocumentDirectory
   * @returns FileSystem path to model
   */
  async copyBundledModel(assetModule: any, targetFilename: string): Promise<string> {
    const targetPath = `${FileSystem.documentDirectory!}ml/${targetFilename}`;
    
    // Check if already copied
    const fileInfo = await FileSystem.getInfoAsync(targetPath);
    if (fileInfo.exists) {
      console.log('✅ Model already in FileSystem:', targetPath);
      return targetPath;
    }

    console.log('📦 Copying bundled model to FileSystem...');
    
    // Create ml directory if needed
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory!}ml/`, { intermediates: true });

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
  async copyBundledLabels(assetModule: any, targetFilename: string): Promise<string> {
    const targetPath = `${FileSystem.documentDirectory!}ml/${targetFilename}`;
    
    // Check if already copied
    const fileInfo = await FileSystem.getInfoAsync(targetPath);
    if (fileInfo.exists) {
      console.log('✅ Labels already in FileSystem:', targetPath);
      return targetPath;
    }

    console.log('📦 Copying bundled labels to FileSystem...');
    
    // Create ml directory if needed
    await FileSystem.makeDirectoryAsync(`${FileSystem.documentDirectory!}ml/`, { intermediates: true });

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
   * Replace this with real model inference once native library is integrated
   */
  private getStubDetection(confidenceThreshold: number): BoundingBox[] {
    // Simulate a center-biased detection with some randomness
    const numDetections = Math.floor(Math.random() * 2) + 1; // 1-2 detections
    const boxes: BoundingBox[] = [];

    for (let i = 0; i < numDetections; i++) {
      // Simulated detection centered with some variance
      const centerX = 0.5 + (Math.random() - 0.5) * 0.3;
      const centerY = 0.5 + (Math.random() - 0.5) * 0.3;
      const size = 0.3 + Math.random() * 0.2; // 30-50% of image
      
      boxes.push({
        x: centerX - size / 2,
        y: centerY - size / 2,
        width: size,
        height: size,
        confidence: 0.5 + Math.random() * 0.4, // 50-90%
        class: 'insect',
      });
    }

    return boxes.filter(box => (box.confidence ?? 0) >= confidenceThreshold);
  }
}

export const onDeviceClassifier = new OnDeviceClassifier();
