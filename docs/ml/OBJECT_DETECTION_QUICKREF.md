# Object Detection Quick Reference

## What Was Implemented

Custom TFLite-based object detection for accurate insect localization before classification.

**Key Files Created/Modified**:
- ✅ `services/ml/types.ts` - Added `BoundingBox`, `DetectionResult`, `DetectionModelConfig`
- ✅ `services/ml/OnDeviceClassifier.ts` - Added detection model loading & inference methods
- ✅ `services/ImageProcessingService.ts` - Integrated ML detection into image processing pipeline
- ✅ `training/train_detector.py` - Object detection model training script
- ✅ `training/convert_to_tflite.py` - TFLite conversion with quantization
- ✅ `training/OBJECT_DETECTION_GUIDE.md` - Complete training documentation

## Current Status

🟡 **STUB MODE** - Detection infrastructure in place, using fallback until:
1. Detection model is trained
2. Native TFLite library is installed
3. Real inference is uncommented

## To Enable Real Detection

### 1-Minute Overview

```bash
# 1. Annotate 200+ images with bounding boxes (LabelImg)
pip install labelImg
labelImg  # Draw boxes around insects

# 2. Train detection model (requires TF Object Detection API)
cd training
python train_detector.py --dataset dataset_detection --num-steps 10000

# 3. Convert to TFLite
python convert_to_tflite.py \
  --saved-model-dir models_detection/.../exported/saved_model \
  --output-file insect_detector.tflite \
  --quantize

# 4. Deploy to app
cp insect_detector.tflite ../assets/ml/

# 5. Install native library
npm install react-native-fast-tflite
npx expo prebuild --clean

# 6. Uncomment in ImageProcessingService.ts:
# const detectionModelPath = await onDeviceClassifier.copyBundledModel(...)
# await onDeviceClassifier.loadDetectionModel(detectionModelPath)

# 7. Uncomment in OnDeviceClassifier.ts:
# this.detectionModel = await TensorflowModel.loadFromFile(modelPath)

# 8. Build and test
eas build --profile development --platform android
```

## Key Methods Added

### OnDeviceClassifier

```typescript
// Load detection model
await onDeviceClassifier.loadDetectionModel(
  'path/to/insect_detector.tflite',
  'path/to/labels.json'  // optional
);

// Detect objects
const result = await onDeviceClassifier.detectObjects(imageUri, {
  confidenceThreshold: 0.3,
  maxDetections: 5,
});
// Returns: { boxes: BoundingBox[], inferenceTime: number }

// Check status
const ready = onDeviceClassifier.isDetectionReady();
```

### ImageProcessingService

```typescript
// Automatically uses ML detection if available
const processed = await imageProcessingService.processInsectPhoto(photoUri, {
  detectObjects: true,  // Enable ML detection
  pixelSize: 8,
  iconSize: 64,
});
// Returns: { croppedImage, pixelatedIcon, boundingBox }
```

## Integration Flow

```
Photo → ML Detection → Crop → Classification → Display
        (300x300)      ↓      (224x224)
                   BoundingBox
```

## Testing Without Native Library

Current stub implementation:
- Returns center-biased bounding boxes
- Logs detection attempts
- Falls back to heuristic crop
- Allows full app testing

## Documentation

- **Full Guide**: `training/OBJECT_DETECTION_GUIDE.md`
- **Implementation**: `ML_OBJECT_DETECTION_IMPLEMENTATION.md`
- **Training**: `training/README.md`

## Support

If you see these logs, detection is working:
```
🤖 Using ML-based object detection...
✅ Detected insect with 87.3% confidence
   Inference time: 52ms
```

If you see this, stub is active (normal for now):
```
⚠️  Using STUB object detector (no native TFLite loaded)
```
