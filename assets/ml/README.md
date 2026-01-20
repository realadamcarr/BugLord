# ML Model Assets

This directory contains the machine learning model files for on-device insect classification.

## Files

- `model.tflite` - TensorFlow Lite model (not committed to git, downloaded at runtime or bundled)
- `labels.json` - Class labels array matching model output indices

## Model Specifications

- **Input**: 224x224 RGB image (or 320x320 depending on model)
- **Output**: Probability distribution over insect classes
- **Format**: TensorFlow Lite (optimized for mobile)

## Updating Models

Models can be updated via the ModelUpdateService which:
1. Checks for new versions from server
2. Downloads model + labels
3. Verifies SHA256 checksums
4. Stores in FileSystem.documentDirectory/ml/
5. Updates local version tracking

## Initial Model

For first-time setup or development builds without network:
- Place a `model.tflite` file here
- Ensure `labels.json` matches the model's class indices
- Model will be copied to FileSystem on first run
