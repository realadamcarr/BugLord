# ML-Based Object Detection Implementation

## Overview

This document explains the complete implementation of custom TFLite-based object detection for BugLord. The system uses a two-stage ML pipeline:

1. **Object Detection**: Locates insects in photos (bounding boxes)
2. **Classification**: Identifies the species of the detected insect

> **Note**: Both stages currently run in stub mode (returning mock data) until trained TFLite models are bundled. In Expo Go, native TFLite is unavailable; the app falls back to center-crop + API/heuristic identification automatically.

## Architecture

```
📷 Camera Photo
    ↓
🔍 Object Detection Model (SSD MobileNet 300x300)
    ↓ (bounding box)
✂️  Crop Insect Region
    ↓
📐 Preprocess for Classification (224x224)
    ↓
🤖 Classification Model (MobileNetV2)
    ↓
📋 Species Identification
```

## Implementation Status

### ✅ Completed

1. **Type Definitions** (`services/ml/types.ts`)
   - `BoundingBox` - Detection result format
   - `DetectionResult` - Full detection output
   - `DetectionModelConfig` - Model configuration

2. **OnDeviceClassifier** (`services/ml/OnDeviceClassifier.ts`)
   - `loadDetectionModel()` - Load object detection model
   - `detectObjects()` - Run inference and get bounding boxes
   - `isDetectionReady()` - Check model status
   - Stub implementation for development without native deps

3. **ImageProcessingService** (`services/ImageProcessingService.ts`)
   - `initialize()` - Load detection model on startup
   - `detectInsect()` - ML-based insect detection with fallback
   - `preprocessForDetection()` - Prepare images for 300x300 input
   - Automatic integration with existing pipeline

4. **Training Infrastructure**
   - `train_detector.py` - Object detection training script
   - `convert_to_tflite.py` - Model export and quantization
   - `OBJECT_DETECTION_GUIDE.md` - Complete training documentation

### 🔄 Next Steps (To Enable Real Detection)

#### Step 1: Collect & Annotate Training Data

```bash
cd training

# Option A: Use LabelImg for manual annotation
pip install labelImg
labelImg

# Option B: Download from iNaturalist (if script supports bboxes)
python fetch_inaturalist_data.py \
  --taxon-ids 47158 184884 47120 \
  --max-images 500 \
  --include-bboxes \
  --output dataset_detection
```

**Dataset Structure**:
```
dataset_detection/
  images/
    img_001.jpg
    img_002.jpg
    ...
  annotations.json  # COCO format
```

#### Step 2: Train Detection Model

```bash
# Install TensorFlow Object Detection API
pip install tf-models-official

# Download pre-trained checkpoint
wget http://download.tensorflow.org/models/object_detection/tf2/20200711/ssd_mobilenet_v2_fpnlite_320x320_coco17_tpu-8.tar.gz
tar -xzf ssd_mobilenet_v2_fpnlite_320x320_coco17_tpu-8.tar.gz

# Prepare config
python train_detector.py \
  --dataset dataset_detection \
  --num-steps 10000 \
  --output models_detection

# Train (requires TF Object Detection API)
python model_main_tf2.py \
  --pipeline_config_path=models_detection/[timestamp]/pipeline.config \
  --model_dir=models_detection/[timestamp]/training \
  --num_train_steps=10000

# Export to TFLite
python convert_to_tflite.py \
  --saved-model-dir=models_detection/[timestamp]/exported/saved_model \
  --output-file=insect_detector.tflite \
  --quantize
```

#### Step 3: Deploy Model to App

```bash
# Copy model to assets
cp training/models_detection/[timestamp]/insect_detector.tflite assets/ml/

# Model should now be bundled with app
```

#### Step 4: Install Native TFLite Library

**Option A: react-native-fast-tflite (Recommended)**

```bash
npm install react-native-fast-tflite

# Prebuild native modules
npx expo prebuild --clean

# Build development version
eas build --profile development --platform android
```

**Option B: @tensorflow/tfjs-react-native**

```bash
npm install @tensorflow/tfjs-react-native
npm install @react-native-async-storage/async-storage
npm install react-native-fs

npx expo prebuild --clean
eas build --profile development --platform android
```

#### Step 5: Enable Real Inference

**5.1 Uncomment Model Loading** in `ImageProcessingService.ts`:

```typescript
async initialize(): Promise<void> {
  if (this.initialized) return;
  
  try {
    console.log('📷 Initializing ImageProcessingService...');
    
    // UNCOMMENT THESE LINES:
    const detectionModelPath = await onDeviceClassifier.copyBundledModel(
      require('@/assets/ml/insect_detector.tflite'),
      'insect_detector.tflite'
    );
    await onDeviceClassifier.loadDetectionModel(detectionModelPath);
    
    this.initialized = true;
    console.log('✅ ImageProcessingService initialized');
  } catch (error) {
    console.warn('⚠️  ImageProcessingService initialization failed:', error);
  }
}
```

**5.2 Implement Real Inference** in `OnDeviceClassifier.ts`:

```typescript
// UNCOMMENT IMPORT:
import { TensorflowModel } from 'react-native-fast-tflite';

class OnDeviceClassifier {
  private detectionModel: TensorflowModel | null = null;

  async loadDetectionModel(modelPath: string): Promise<void> {
    console.log('🎯 Loading object detection model...');
    
    // REPLACE STUB WITH:
    this.detectionModel = await TensorflowModel.loadFromFile(modelPath);
    this.detectionModelLoaded = true;
    
    console.log('✅ Detection model loaded');
  }

  async detectObjects(imageUri: string, options?: {...}): Promise<DetectionResult> {
    const startTime = Date.now();
    
    // REPLACE STUB WITH:
    const results = await this.detectionModel!.run(imageUri);
    const boxes = this.parseDetectionResults(
      results,
      confidenceThreshold,
      maxDetections
    );
    
    return { boxes, inferenceTime: Date.now() - startTime };
  }

  // IMPLEMENT PARSER:
  private parseDetectionResults(
    rawOutput: any,
    confidenceThreshold: number,
    maxDetections: number
  ): BoundingBox[] {
    // SSD output format: [boxes, classes, scores, num_detections]
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
}
```

#### Step 6: Test & Validate

```bash
# Build and install
eas build --profile development --platform android
adb install build.apk

# Test detection:
# 1. Open app
# 2. Navigate to Capture tab
# 3. Take photo of an insect
# 4. Check console logs for detection results
```

**Expected Logs**:
```
🖼️ Starting insect photo processing...
🤖 Using ML-based object detection...
🔍 Detecting objects in: file:///...
✅ Detected insect with 87.3% confidence
   Inference time: 52ms
📸 Image processed: {...}
```

## Current Behavior (Without Native Library)

The system gracefully falls back when native TFLite is not available:

1. **Detection Model**: Uses stub that returns center-biased bounding boxes
2. **Fallback**: Reverts to heuristic center crop (60% of image)
3. **Classification**: Still works with API or local heuristic

This allows development and testing without requiring native builds.

## Performance Expectations

### With Real Detection Model

| Metric | Value |
|--------|-------|
| Model Size | ~4MB (quantized) |
| Inference Time | 50-100ms (Android mid-range) |
| Detection Accuracy | 85-95% (with 500+ training images) |
| False Positive Rate | <5% |

### Tuning Parameters

```typescript
// In ImageProcessingService.ts
const detectionResult = await onDeviceClassifier.detectObjects(preprocessed, {
  confidenceThreshold: 0.3,  // Lower = more detections
  maxDetections: 5,          // Limit results
});

// In OnDeviceClassifier.ts
this.detectionConfig = {
  modelPath,
  inputSize: 300,              // 300 or 320 for SSD
  confidenceThreshold: 0.3,    // Adjust based on testing
  maxDetections: 10,
};
```

## Troubleshooting

### Issue: Detection Not Working

**Check**:
1. Model file exists: `assets/ml/insect_detector.tflite`
2. Native library installed: `react-native-fast-tflite`
3. App rebuilt: `npx expo prebuild --clean`
4. Logs show model loading success

### Issue: Low Detection Accuracy

**Solutions**:
1. Add more training data (500+ images)
2. Increase training steps (20,000+)
3. Lower confidence threshold
4. Use data augmentation

### Issue: Slow Inference

**Optimizations**:
1. Ensure quantization is enabled (INT8)
2. Use 300x300 input (not 512x512)
3. Enable GPU delegate (if supported)
4. Reduce `maxDetections` to 3-5

## Integration Flow

```typescript
// app/(tabs)/index.tsx
const handleCameraCapture = async (photoUri: string) => {
  await processAndClassify(photoUri, photoUri);
};

const processAndClassify = async (imageToClassify, originalPhoto) => {
  // 1. Image Processing (includes detection)
  const processedImage = await imageProcessingService.processInsectPhoto(
    originalPhoto,
    { detectObjects: true }  // Enables ML detection
  );
  
  // processedImage.croppedImage now contains the detected insect
  // processedImage.boundingBox contains coordinates
  
  // 2. ML Classification
  const mlInput = await mlPreprocessingService.preprocessForInference(
    imageToClassify,
    { targetSize: 224 }
  );
  
  const mlCandidates = await onDeviceClassifier.classifyImage(mlInput, 5);
  
  // 3. Display results
  setIdentificationResult({ candidates: mlCandidates, ... });
};
```

## Files Modified

1. ✅ `services/ml/types.ts` - Added detection types
2. ✅ `services/ml/OnDeviceClassifier.ts` - Detection model support
3. ✅ `services/ImageProcessingService.ts` - ML detection integration
4. ✅ `training/train_detector.py` - Object detection training
5. ✅ `training/convert_to_tflite.py` - TFLite conversion
6. ✅ `training/OBJECT_DETECTION_GUIDE.md` - Documentation

## Next Actions for Developer

**Priority 1 (Enable Detection)**:
- [ ] Annotate 200-500 insect images with bounding boxes
- [ ] Train object detection model
- [ ] Copy trained model to `assets/ml/`
- [ ] Install `react-native-fast-tflite`
- [ ] Uncomment model loading in `ImageProcessingService.ts`
- [ ] Implement real inference in `OnDeviceClassifier.ts`
- [ ] Build and test on device

**Priority 2 (Optimize)**:
- [ ] Collect user feedback on detection quality
- [ ] Add hard negative examples to training set
- [ ] Fine-tune confidence thresholds
- [ ] Implement GPU acceleration

**Priority 3 (Advanced)**:
- [ ] Multi-class detection (different insect orders)
- [ ] Real-time detection in camera preview
- [ ] On-device model updates via ModelUpdateService

## References

- Training Guide: `training/OBJECT_DETECTION_GUIDE.md`
- TFLite Integration: [Expo Docs](https://docs.expo.dev/versions/latest/sdk/gl-view/)
- TF Object Detection API: [GitHub](https://github.com/tensorflow/models/tree/master/research/object_detection)
