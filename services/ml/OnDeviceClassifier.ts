/**
 * OnDeviceClassifier
 * 
 * Abstraction layer for on-device TensorFlow Lite inference.
 * Uses react-native-fast-tflite when available (EAS dev builds),
 * falls back to stubs in Expo Go.
 */

import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { Image } from 'react-native';
import { BoundingBox, DetectionModelConfig, DetectionResult, MLCandidate, MLClassifierConfig } from './types';

// Try to import react-native-fast-tflite, fallback gracefully
let TFLite: any = null;
let loadTensorflowModel: any = null;
try {
  const tfliteModule = require('react-native-fast-tflite');
  TFLite = tfliteModule;
  loadTensorflowModel = tfliteModule.loadTensorflowModel;
  console.log('✅ react-native-fast-tflite loaded successfully');
  console.log('🔧 TFLite object keys:', Object.keys(TFLite || {}));
  console.log('🔧 loadTensorflowModel function exists:', typeof loadTensorflowModel);
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
    try {
      const dirInfo = await FileSystem.getInfoAsync(mlDir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(mlDir, { intermediates: true }).catch(() => {
          console.warn('Could not create ML directory, may already exist:', mlDir);
        });
      }
    } catch (error) {
      try {
        await FileSystem.makeDirectoryAsync(mlDir, { intermediates: true });
      } catch {
        console.warn('Could not create ML directory, may already exist:', mlDir);
      }
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

  /** Tracks why real model isn't available — exposed for UI diagnostics */
  modelLoadError: string | null = null;

  /**
   * Load model and labels from specified paths (file:// URI approach).
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
      if (loadTensorflowModel) {
        try {
          this.model = await loadTensorflowModel({url: `file://${modelPath}`});
          this.modelLoadError = null;
          console.log('✅ TFLite classification model loaded with react-native-fast-tflite');
          console.log(`   Input shapes: ${JSON.stringify(this.model?.inputs)}`);
          console.log(`   Output shapes: ${JSON.stringify(this.model?.outputs)}`);
        } catch (modelError: any) {
          console.warn('⚠️  TFLite file-path loading failed:', modelError);
          this.modelLoadError = `TFLite load failed: ${modelError?.message ?? modelError}`;
          this.model = null;
        }
      } else {
        this.modelLoadError = 'react-native-fast-tflite not available (Expo Go?)';
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
   * Load model directly from a bundled asset module (most robust for production).
   * Uses react-native-fast-tflite's native asset resolution which avoids the
   * copy-to-document-directory dance entirely.
   *
   * @param assetModule - The return value of require('path/to/model.tflite')
   * @param labels - Either a labels file path (string) or pre-parsed labels array
   */
  async loadModelFromAsset(assetModule: number, labels: string | string[]): Promise<void> {
    console.log('🧠 Loading ML model from bundled asset...');

    try {
      // Load labels
      if (typeof labels === 'string') {
        this.labels = await this.readLabelsFile(labels);
      } else {
        this.labels = labels;
      }
      console.log(`✅ Loaded ${this.labels.length} class labels`);

      // Load TFLite model directly from asset module (number from require())
      if (loadTensorflowModel) {
        try {
          console.log('🔧 Calling loadTensorflowModel with asset module (require)...');
          this.model = await loadTensorflowModel(assetModule);
          this.modelLoadError = null;
          console.log('✅ TFLite model loaded from bundled asset!');
          console.log(`   Input shapes: ${JSON.stringify(this.model?.inputs)}`);
          console.log(`   Output shapes: ${JSON.stringify(this.model?.outputs)}`);
        } catch (modelError: any) {
          console.error('❌ TFLite asset loading failed:', modelError);
          this.modelLoadError = `TFLite asset load failed: ${modelError?.message ?? modelError}`;
          this.model = null;
        }
      } else {
        this.modelLoadError = 'react-native-fast-tflite not available (Expo Go?)';
        console.warn('⚠️  react-native-fast-tflite not available, using stub mode');
        this.model = null;
      }

      this.modelLoaded = true;
      this.config = {
        modelPath: '<bundled-asset>',
        labelsPath: typeof labels === 'string' ? labels : '<inline>',
        inputSize: 224,
        topK: 5,
        confidenceThreshold: 0.1,
      };
    } catch (error) {
      console.error('❌ Failed to load model from asset:', error);
      throw new Error(`Model asset loading failed: ${error}`);
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
      if (this.model && loadTensorflowModel) {
          console.log('🤖 USING REAL TENSORFLOW LITE INFERENCE (not stub mode)');
          
          // First pass: standard preprocessing
          const predictions = await this.runInference(imageUri);
          let topPredictions = this.sortTopK(predictions, topK);
          
          console.log('🏆 TOP PREDICTIONS FROM REAL TENSORFLOW LITE MODEL:');
          topPredictions.forEach((pred, idx) => {
            console.log(`  ${idx + 1}. ${pred.label}: ${(pred.confidence * 100).toFixed(2)}%`);
          });

          // Second pass: if top confidence is low, try enhanced preprocessing
          // This helps with dark subjects like black ants on dark backgrounds
          const LOW_CONFIDENCE_THRESHOLD = 0.45;
          if (topPredictions.length > 0 && topPredictions[0].confidence < LOW_CONFIDENCE_THRESHOLD) {
            console.log('🔆 Low confidence detected — trying enhanced preprocessing for dark subjects');
            try {
              const { mlPreprocessingService } = require('./MLPreprocessingService');
              const enhancedUri = await mlPreprocessingService.preprocessWithEnhancement(imageUri, 224);
              const enhancedPredictions = await this.runInference(enhancedUri);
              const enhancedTop = this.sortTopK(enhancedPredictions, topK);
              
              console.log('🔆 ENHANCED PREDICTIONS:');
              enhancedTop.forEach((pred, idx) => {
                console.log(`  ${idx + 1}. ${pred.label}: ${(pred.confidence * 100).toFixed(2)}%`);
              });
              
              // Use enhanced results if they're more confident
              if (enhancedTop.length > 0 && enhancedTop[0].confidence > topPredictions[0].confidence) {
                console.log('✅ Enhanced preprocessing gave better results — using those');
                topPredictions = enhancedTop;
              }
            } catch (enhanceErr) {
              console.warn('⚠️ Enhanced preprocessing failed (non-fatal):', enhanceErr);
            }
          }

          // Tag all predictions with source
          return topPredictions.map(p => ({ ...p, source: 'tflite' as const }));
          
      } else {
        // No real model available — return stub predictions tagged as such
        // so the UI can differentiate and show appropriate messaging
        console.warn('⚠️ TensorFlow Lite not available — returning stub predictions');
        console.warn('💡 To fix: Build a production APK with react-native-fast-tflite');
        const stubs = this.getStubPredictions(topK);
        return stubs.map(p => ({ ...p, source: 'stub' as const }));
      }

    } catch (error) {
      console.error('❌ Classification failed:', error);
      // Return stub predictions rather than crashing — never block the user
      if (this.labels.length > 0) {
        console.warn('⚠️ Falling back to stub predictions after error');
        const stubs = this.getStubPredictions(topK);
        return stubs.map(p => ({ ...p, source: 'stub' as const }));
      }
      return [];
    }
  }

  /**
   * Run a single inference pass on a preprocessed image URI.
   * Returns raw predictions (unsorted) for all labels.
   */
  private async runInference(imageUri: string): Promise<MLCandidate[]> {
    // Run inference directly — input should already be preprocessed to 224x224
    const outputs = await this.model.run(imageUri);
    
    // Process output tensor into predictions
    let outputTensor;
    
    // Handle different output formats from react-native-fast-tflite
    if (Array.isArray(outputs)) {
      outputTensor = outputs[0];
    } else if (outputs && typeof outputs === 'object' && outputs.data) {
      outputTensor = outputs.data;
    } else if (outputs && typeof outputs === 'object') {
      const keys = Object.keys(outputs);
      outputTensor = keys.length > 0 ? outputs[keys[0]] : outputs;
    } else {
      outputTensor = outputs;
    }
    
    if (!Array.isArray(outputTensor)) {
      throw new Error(`Expected array tensor output, got: ${typeof outputTensor}`);
    }

    // Apply softmax normalization to convert logits → proper probabilities
    const maxVal = Math.max(...outputTensor);
    const exps = outputTensor.map((v: number) => Math.exp(v - maxVal)); // subtract max for numerical stability
    const sumExps = exps.reduce((a: number, b: number) => a + b, 0);
    const softmaxValues = exps.map((e: number) => e / sumExps);

    // Compute entropy to measure prediction uncertainty
    // High entropy = spread across classes (likely not a real bug)
    // Low entropy = confident single-class prediction
    let entropy = 0;
    for (const p of softmaxValues) {
      if (p > 1e-10) {
        entropy -= p * Math.log2(p);
      }
    }
    const maxEntropy = Math.log2(this.labels.length); // uniform distribution
    const normalizedEntropy = entropy / maxEntropy; // 0 = certain, 1 = uniform/random
    console.log(`📊 Prediction entropy: ${entropy.toFixed(3)} / ${maxEntropy.toFixed(3)} (normalized: ${(normalizedEntropy * 100).toFixed(1)}%)`);

    // If entropy is very high (>0.85), the model is uncertain — likely not a real bug photo
    if (normalizedEntropy > 0.85) {
      console.log('⚠️ High entropy detected — model is very uncertain, likely not a bug photo');
      // Return predictions with dampened confidence to trigger rejection
      const predictions: MLCandidate[] = [];
      for (let i = 0; i < this.labels.length && i < softmaxValues.length; i++) {
        predictions.push({
          label: this.labels[i],
          confidence: softmaxValues[i] * 0.3, // dampen so it fails threshold
        });
      }
      return predictions;
    }
    
    // Map softmax values to labels
    const predictions: MLCandidate[] = [];
    for (let i = 0; i < this.labels.length && i < softmaxValues.length; i++) {
      predictions.push({
        label: this.labels[i],
        confidence: softmaxValues[i],
      });
    }

    return predictions;
  }

  /**
   * Check if model is loaded and ready (labels loaded)
   */
  isReady(): boolean {
    return this.modelLoaded;
  }

  /**
   * Returns true only when the real TFLite native module is available AND the model
   * is loaded — i.e. classifyImage() will run real inference, not stubs.
   */
  isUsingRealModel(): boolean {
    return this.modelLoaded && this.model != null && loadTensorflowModel != null;
  }

  /**
   * Returns true when the classifier can produce output:
   * either real TFLite inference or stub predictions (labels loaded).
   */
  isRunnable(): boolean {
    return this.modelLoaded && (this.isUsingRealModel() || this.labels.length > 0);
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
      if (loadTensorflowModel) {
        try {
          this.detectionModel = await loadTensorflowModel({url: `file://${modelPath}`});
          console.log('✅ TFLite detection model loaded with react-native-fast-tflite');
          console.log(`   Input shapes: ${JSON.stringify(this.detectionModel?.inputs)}`);
          console.log(`   Output shapes: ${JSON.stringify(this.detectionModel?.outputs)}`);
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
      if (this.detectionModel && loadTensorflowModel) {
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
    // Enhanced mock predictions using your trained 15-species model data
    console.log('🎭 Generating realistic mock predictions from trained model species');
    
    // Weighted probabilities based on common insect sightings (matches ALL trained model classes).
    // Every class the model can output must appear here so stubs never skew toward a subset.
    const speciesWeights: { [key: string]: number } = {
      'ant':        0.18,
      'Bees':       0.18,
      'bee':        0.18, // alternate casing used by some label files
      'Butterfly':  0.15,
      'Ladybug':    0.12,
      'wasp':       0.12,
      'dragonfly':  0.10,
      'scorpion':   0.08, // less common but must be represented
      'Scorpion':   0.08,
      'beetle':     0.06,
      'Beetle':     0.06,
      'grasshopper':0.04,
      'moth':       0.03,
    };

    // Select species based on weights (simulating YOLOv8 confidence scores)
    const predictions: MLCandidate[] = [];
    
    // Ensure labels are available, fallback to default species if not loaded
    const fallbackLabels = [
      "Bees", "Butterfly", "Ladybug", "ant", "dragonfly", "wasp"
    ];
    const labelsToUse = this.labels && this.labels.length > 0 ? this.labels : fallbackLabels;
    const availableSpecies = [...labelsToUse];
    
    // Primary prediction (30-55% confidence — stubs should never pass the 85% threshold)
    const primaryIdx = this.getWeightedRandomIndex(availableSpecies, speciesWeights);
    const primarySpecies = availableSpecies[primaryIdx];
    const primaryConfidence = 0.30 + Math.random() * 0.25; // 30-55%
    
    predictions.push({
      label: primarySpecies,
      confidence: primaryConfidence
    });
    
    // Remove primary species for other predictions
    availableSpecies.splice(primaryIdx, 1);
    
    // Secondary predictions with decreasing confidence
    let remainingConfidence = 1.0 - primaryConfidence;
    for (let i = 1; i < Math.min(topK, this.labels.length); i++) {
      if (availableSpecies.length === 0) break;
      
      const idx = this.getWeightedRandomIndex(availableSpecies, speciesWeights);
      const species = availableSpecies[idx];
      const confidence = remainingConfidence * (0.6 - i * 0.15); // Rapidly decreasing
      
      predictions.push({
        label: species,
        confidence: Math.max(0.01, confidence)
      });
      
      remainingConfidence -= confidence;
      availableSpecies.splice(idx, 1);
    }

    console.log(`🎯 Mock prediction: ${predictions[0].label} (${(predictions[0].confidence * 100).toFixed(1)}%)`);
    return predictions;
  }

  /**
   * Get weighted random index based on species probability
   */
  private getWeightedRandomIndex(species: string[], weights: { [key: string]: number }): number {
    const random = Math.random();
    let cumulativeWeight = 0;
    
    for (let i = 0; i < species.length; i++) {
      const weight = weights[species[i]] || 0.01; // Default small weight
      cumulativeWeight += weight;
      if (random <= cumulativeWeight) {
        return i;
      }
    }
    
    // Fallback to random if weights don't sum properly
    return Math.floor(Math.random() * species.length);
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
    try {
      const fileInfo = await FileSystem.getInfoAsync(targetPath);
      if (fileInfo.exists) {
        console.log('  ✅ Model already exists at:', targetPath);
        return targetPath;
      }
    } catch {
      // File doesn't exist, continue to copy
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
    try {
      const fileInfo = await FileSystem.getInfoAsync(targetPath);
      if (fileInfo.exists) {
        console.log('✅ Labels already in FileSystem:', targetPath);
        return targetPath;
      }
    } catch {
      // File doesn't exist, continue to copy
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
