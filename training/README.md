# BugLord ML Training Pipeline

Complete guide for training custom ML models for BugLord:
1. **Classification Model** - Identifies insect species
2. **Object Detection Model** - Locates insects in photos

## Quick Start

### 1. Setup Environment

```bash
# Create virtual environment
python -m venv venv

# Activate (Windows)
venv\Scripts\activate

# Activate (Mac/Linux)
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# For object detection (optional)
pip install tf-models-official
```

### 2. Choose Your Task

#### Option A: Classification Model (Species Identification)

```bash
# Fetch training data from iNaturalist
python fetch_inaturalist_data.py \
  --species "Monarch Butterfly,Ladybug,Honeybee,Dragonfly,Ant" \
  --per-species 100

# Train classifier
python train_model.py --dataset dataset --epochs 20

# Output: models/[timestamp]/model.tflite
```

#### Option B: Object Detection Model (Insect Localization)

```bash
# See detailed guide
See: OBJECT_DETECTION_GUIDE.md

# Quick version:
# 1. Annotate images with bounding boxes (LabelImg/CVAT)
# 2. Prepare COCO format dataset
python train_detector.py --dataset dataset_detection --num-steps 10000

# 3. Convert to TFLite
python convert_to_tflite.py \
  --saved-model-dir models_detection/[timestamp]/exported/saved_model \
  --output-file insect_detector.tflite \
  --quantize

# Output: insect_detector.tflite
```

## Classification Model Training

### 2. Fetch Training Data from iNaturalist

```bash
# Fetch common insects (100 images each)
python fetch_inaturalist_data.py \
  --species "Monarch Butterfly,Ladybug,Honeybee,Dragonfly,Ant" \
  --per-species 100

# Or fetch more species with more images
python fetch_inaturalist_data.py \
  --species "butterfly,beetle,ant,bee,wasp,dragonfly,moth,grasshopper" \
  --per-species 200
```

This will create a `dataset/` folder with subdirectories for each species:
```
dataset/
  ├── monarch_butterfly/
  │   ├── monarch_butterfly_12345_0.jpg
  │   ├── monarch_butterfly_12346_1.jpg
  │   └── ...
  ├── ladybug/
  │   └── ...
  └── ...
```

### 3. Train the Classifier

```bash
# Train with default settings (20 epochs)
python train_model.py --dataset dataset

# Or customize training
python train_model.py --dataset dataset --epochs 30 --batch-size 64
```

The script will:
- ✅ Validate your dataset
- ✅ Create train/validation split (80/20)
- ✅ Apply data augmentation
- ✅ Train using transfer learning (MobileNetV2)
- ✅ Save best model
- ✅ Convert to TensorFlow Lite
- ✅ Generate labels.json

### 4. Deploy to BugLord App

After training completes, you'll find these files in `models/YYYYMMDD_HHMMSS/`:
- `model.tflite` - Trained model for mobile
- `labels.json` - Class labels
- `best_model.h5` - Full Keras model (backup)
- `deployment_metadata.json` - Deployment info

**Copy to app:**

```bash
# Copy model files
cp models/YYYYMMDD_HHMMSS/model.tflite ../assets/ml/
cp models/YYYYMMDD_HHMMSS/labels.json ../assets/ml/

# Rebuild app
cd ..
npx expo prebuild
eas build --profile development --platform android
```

## Advanced Usage

### Custom Species List

Create a file `species_list.txt`:
```
Monarch Butterfly
Seven-spotted Ladybug
Western Honey Bee
Common Green Darner
Fire Ant
Paper Wasp
Luna Moth
```

Then run:
```bash
python fetch_inaturalist_data.py --species "$(cat species_list.txt | tr '\n' ',')" --per-species 150
```

### Training Parameters

```bash
python train_model.py \
  --dataset dataset \
  --epochs 50 \              # More epochs for better accuracy
  --batch-size 16 \          # Smaller if GPU memory limited
  --img-size 224 \           # Match MobileNetV2 default
  --output custom_models     # Custom output directory
```

### Data Augmentation

The training script automatically applies:
- Random rotation (±30°)
- Width/height shifts (±20%)
- Shear and zoom (20%)
- Horizontal and vertical flips

This helps the model generalize better to new photos.

## Recommendations

### For Best Accuracy

1. **More species**: 10-20 common insects
2. **More images**: 200+ per species
3. **Quality over quantity**: iNaturalist "research grade" images are pre-verified
4. **Balanced dataset**: Similar number of images per species
5. **Train longer**: 30-50 epochs with early stopping

### Expected Performance

With 10 species × 200 images:
- **Top-1 Accuracy**: 75-85%
- **Top-3 Accuracy**: 90-95%
- **Model Size**: 5-10 MB (quantized)
- **Inference Time**: 50-150ms on mobile

### Troubleshooting

**"Not enough images"**
- Need at least 50 images per species for decent results
- Fetch more: `--per-species 200`

**"Out of memory during training"**
- Reduce batch size: `--batch-size 16`
- Reduce image size: `--img-size 192` (not recommended)

**"Model not accurate"**
- More training data (200+ per species)
- More epochs with early stopping
- Check if species are visually similar (hard to distinguish)

**"iNaturalist rate limiting"**
- Script includes delays (0.5s between requests)
- If blocked, wait 1 hour and resume
- Script skips already-downloaded images

## Dataset Structure

Your final dataset should look like:
```
dataset/
  ├── species_1_name/
  │   ├── image_001.jpg
  │   ├── image_002.jpg
  │   └── ... (100-200 images)
  ├── species_2_name/
  │   └── ...
  └── species_N_name/
      └── ...
```

Requirements:
- ✅ At least 2 species (classes)
- ✅ 50+ images per species (100+ recommended)
- ✅ JPG/PNG format
- ✅ All images in species subdirectories

## Next Steps

After deploying:

1. **Test in app**: Capture bugs and verify predictions
2. **Collect user data**: Enable `DatasetUploadService` to gather real-world samples
3. **Retrain periodically**: Add user-captured images to dataset and retrain
4. **Remote deployment**: Use `ModelUpdateService` to push updates without app rebuild

## Resources

- [iNaturalist API Docs](https://api.inaturalist.org/v1/docs/)
- [TensorFlow Lite Guide](https://www.tensorflow.org/lite/guide)
- [MobileNetV2 Paper](https://arxiv.org/abs/1801.04381)
- BugLord ML Integration: See `ML_INTEGRATION_SUMMARY.md`
