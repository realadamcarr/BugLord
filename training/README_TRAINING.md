# BugLord Object Detection Training Guide

Train a custom EfficientDet-Lite0 model to detect insects in photos.

## Overview

This directory contains everything needed to train a lightweight object detection model (EfficientDet-Lite0) that runs on-device via `react-native-fast-tflite`.

**What you'll get:**
- `models_detection/buglord_detector.tflite` (~4MB quantized model)
- `models_detection/labels.txt` (class labels: "insect")

**Current Dataset:**
- 200+ images in `dataset_detection/images/`
- COCO format annotations in `dataset_detection/annotations.json`
- Bounding boxes are estimated (center 60%) for MVP

⚠️ **Note:** Estimated boxes work but aren't perfect. For production quality, manually refine 50-100 boxes using [CVAT](https://www.cvat.ai/) or [Roboflow](https://roboflow.com/).

---

## Quick Start (Recommended: Google Colab)

**Why Colab?** Free GPU access trains in ~15 minutes vs 2-4 hours on CPU.

1. Open `colab_setup.md` and follow the step-by-step instructions
2. Upload your dataset or mount Google Drive
3. Run `efficientdet_lite0_train.py`
4. Download `buglord_detector.tflite` and `labels.txt`
5. Copy to `../assets/ml/` in your app

See: **[colab_setup.md](./colab_setup.md)** for detailed Colab instructions.

---

## Prerequisites

### For Google Colab (Recommended)
- Google account
- Dataset zip file (or Google Drive)
- ~15 minutes

### For Local Training
- **Python 3.10+** (3.12 may have TensorFlow issues)
- **8GB+ RAM**
- **4+ CPU cores** (or NVIDIA GPU with CUDA)
- **5GB disk space**

**Install dependencies:**
```bash
cd training

# Create Python 3.10 environment (if using Python 3.13, create 3.10 venv)
python3.10 -m venv .venv_train
source .venv_train/bin/activate  # Windows: .venv_train\Scripts\activate

# Install packages
pip install tensorflow==2.15.0
pip install tflite-model-maker
pip install pycocotools
pip install Pillow numpy
```

---

## Dataset Structure

Your dataset should follow this structure:

```
training/
  dataset_detection/
    images/
      00001.jpg
      00002.jpg
      ...
    annotations.json  # COCO format
```

**COCO Format Requirements:**
```json
{
  "images": [
    {"id": 1, "file_name": "00001.jpg", "width": 1920, "height": 1080}
  ],
  "annotations": [
    {
      "id": 1,
      "image_id": 1,
      "category_id": 1,
      "bbox": [x, y, width, height],  // pixels
      "area": 36000,
      "iscrowd": 0
    }
  ],
  "categories": [
    {"id": 1, "name": "insect", "supercategory": "animal"}
  ]
}
```

---

## Training Commands

### Google Colab (Recommended)
See **[colab_setup.md](./colab_setup.md)** for full instructions.

### Local Training
```bash
cd training

# Activate your Python 3.10 environment
source .venv_train/bin/activate  # Windows: .venv_train\Scripts\activate

# Run training (CPU: 2-4 hours, GPU: 15-30 min)
python efficientdet_lite0_train.py \
  --dataset dataset_detection \
  --epochs 30 \
  --batch-size 8 \
  --output models_detection

# Output:
# - models_detection/buglord_detector.tflite
# - models_detection/labels.txt
```

**Training Options:**
- `--epochs 30` - More epochs = better accuracy (30-50 recommended)
- `--batch-size 8` - Higher = faster but needs more RAM (4-16 typical)
- `--quantize` - Enable INT8 quantization (default: enabled)
- `--val-split 0.2` - Validation split ratio (default: 20%)

---

## Expected Training Time

| Hardware | Time | Notes |
|----------|------|-------|
| Google Colab (T4 GPU) | 15-20 min | Recommended |
| NVIDIA GTX 1080 | 30-45 min | Good local option |
| Intel i7 (8 cores) | 2-3 hours | Workable but slow |
| Intel i5 (4 cores) | 4-6 hours | Not recommended |

---

## Output Files

After training completes:

```
models_detection/
  buglord_detector.tflite    # ~4MB INT8 quantized model
  labels.txt                  # Class labels ("insect")
  training_log.txt            # Metrics and validation results
  metadata.json               # Training config and dataset info
```

**Deploy to App:**
```bash
# Copy model to app assets
cp models_detection/buglord_detector.tflite ../assets/ml/insect_detector.tflite

# Copy labels (if needed)
cp models_detection/labels.txt ../assets/ml/detection_labels.txt

# Rebuild app
cd ..
npx expo prebuild
eas build --profile development --platform android
```

---

## Validation & Metrics

The training script automatically:
- Splits data 80% train / 20% validation
- Evaluates on validation set
- Reports metrics:
  - **mAP@0.5** (mean Average Precision at 50% IoU)
  - **Loss** (lower is better)
  - **Detection rate** (% of images with detections)

**Good baseline metrics for MVP:**
- mAP@0.5: > 0.5 (50%)
- Detection rate: > 85%

**Improving results:**
1. Manually refine 50-100 bounding boxes
2. Add more diverse images (200 → 500+)
3. Train longer (30 → 50 epochs)
4. Use data augmentation (already enabled)

---

## Troubleshooting

### Import Error: `tflite-model-maker`
```bash
pip install tflite-model-maker
# If fails, try: pip install tflite-model-maker-nightly
```

### TensorFlow Version Conflicts
```bash
pip install tensorflow==2.15.0 --upgrade
pip install protobuf==3.20.3  # Downgrade if needed
```

### Out of Memory (OOM)
- Reduce batch size: `--batch-size 4`
- Reduce image resolution (edit script, change `model_spec`)
- Use Google Colab with GPU

### Training Too Slow
- Use Google Colab (free GPU)
- Or train overnight on local CPU

### Low Accuracy (<40% mAP)
- Dataset too small (add more images)
- Bounding boxes too inaccurate (refine manually)
- Train longer (50+ epochs)

---

## Advanced: Improving Your Dataset

### 1. Manual Annotation Refinement
Use [CVAT](https://www.cvat.ai/) (free online tool):
1. Upload your images
2. Import existing COCO annotations
3. Refine bounding boxes (fix loose/tight boxes)
4. Export updated COCO JSON
5. Replace `annotations.json`
6. Retrain

### 2. Add More Data
- Capture more diverse photos (different angles, lighting, backgrounds)
- Target 500+ images for production quality
- Include edge cases (tiny insects, multiple insects, etc.)

### 3. Data Augmentation (Automatic)
Training script already applies:
- Random crops
- Brightness/contrast adjustments
- Horizontal flips
- Color jitter

---

## Model Specs

**EfficientDet-Lite0:**
- Architecture: EfficientNet-B0 backbone + BiFPN
- Input: 320x320 RGB
- Output: Bounding boxes (ymin, xmin, ymax, xmax), scores, classes
- Size: ~4MB (INT8 quantized)
- Speed: ~50-100ms on mobile CPU

**Alternatives:**
- EfficientDet-Lite1 (larger, more accurate, slower)
- EfficientDet-Lite2 (largest, best accuracy, slowest)

To use Lite1/Lite2, edit `efficientdet_lite0_train.py` and change `model_spec`:
```python
spec = object_detector.EfficientDetLite1Spec()  # or Lite2Spec
```

---

## Next Steps

1. **Train on Colab** (15 min) → Get baseline model
2. **Test in app** → See if detection works
3. **Refine dataset** → Fix worst 50 boxes
4. **Retrain** → Improved accuracy
5. **Deploy** → Production build

---

## References

- [TensorFlow Lite Model Maker](https://www.tensorflow.org/lite/models/modify/model_maker/object_detection)
- [EfficientDet Paper](https://arxiv.org/abs/1911.09070)
- [COCO Dataset Format](https://cocodataset.org/#format-data)
- [CVAT Annotation Tool](https://www.cvat.ai/)
