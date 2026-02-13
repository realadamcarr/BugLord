# Insect Detector Model Placeholder

This file will be replaced with a trained object detection model.

## Current Status: Placeholder

The app will use fallback heuristic detection until a trained model is placed here.

## To Train and Deploy

1. **Annotate Images**: Use LabelImg to annotate 200+ insect images
   ```bash
   # Run labelImg (already installed)
   labelImg
   
   # Annotate images in: training/dataset_detection/images/
   # Save annotations to: training/dataset_detection/annotations.json
   ```

2. **Train Model**: Follow the guide in `training/OBJECT_DETECTION_GUIDE.md`
   ```bash
   cd training
   python train_detector.py --dataset dataset_detection --num-steps 10000
   ```

3. **Convert to TFLite**:
   ```bash
   python convert_to_tflite.py \
     --saved-model-dir models_detection/[timestamp]/exported/saved_model \
     --output-file insect_detector.tflite \
     --quantize
   ```

4. **Replace This File**:
   ```bash
   cp training/insect_detector.tflite assets/ml/insect_detector.tflite
   ```

5. **Rebuild**:
   ```bash
   npx expo prebuild
   eas build --profile development --platform android
   ```

## Model Specifications

- **Architecture**: SSD MobileNet V2 FPNLite
- **Input Size**: 300x300 pixels
- **Output**: Bounding boxes [x, y, width, height] normalized 0-1
- **Format**: TensorFlow Lite (.tflite)
- **Quantization**: INT8 (recommended)
- **Expected Size**: ~4MB

## Fallback Behavior

Without this model, the app will:
- Use center-crop heuristic (60% of image)
- Log warning: "Detection model not available, using fallback"
- Continue to work with classification
