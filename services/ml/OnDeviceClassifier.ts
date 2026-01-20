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
import { MLCandidate, MLClassifierConfig } from './types';

// TODO: Uncomment when native library is installed
// import { TensorflowModel } from 'react-native-fast-tflite';

class OnDeviceClassifier {
  private modelLoaded: boolean = false;
  private labels: string[] = [];
  private config: MLClassifierConfig | null = null;
  
  // TODO: Replace with actual TFLite model instance
  // private model: TensorflowModel | null = null;

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

      // TODO: Load actual TFLite model
      // When react-native-fast-tflite is installed:
      // this.model = await TensorflowModel.loadFromFile(modelPath);
      
      // For now: stub implementation
      console.log('⚠️  Using STUB classifier (no native TFLite loaded)');
      console.log('   Install native library and rebuild for real inference');
      
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
      // TODO: Real inference when native library is available
      // const results = await this.model!.run(imageUri);
      // const predictions = this.processPredictions(results, topK);
      // return predictions;

      // STUB: Return mock predictions
      console.log('⚠️  Using STUB predictions (no real inference)');
      return this.getStubPredictions(topK);

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
   * TODO: Process raw model output into predictions
   * Implement this when integrating real TFLite
   */
  // private processPredictions(rawOutput: Float32Array, topK: number): MLCandidate[] {
  //   // Convert raw output to label-confidence pairs
  //   const predictions: MLCandidate[] = [];
  //   
  //   for (let i = 0; i < rawOutput.length; i++) {
  //     predictions.push({
  //       label: this.labels[i] || 'Unknown',
  //       confidence: rawOutput[i],
  //     });
  //   }
  //   
  //   // Sort by confidence descending
  //   predictions.sort((a, b) => b.confidence - a.confidence);
  //   
  //   // Return top-K
  //   return predictions.slice(0, topK);
  // }

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
}

export const onDeviceClassifier = new OnDeviceClassifier();
