# Object Detection Training Guide

This guide explains how to train a custom TensorFlow Lite object detection model for BugLord to accurately locate insects in photos.

## Overview

The object detection model finds and crops insects from photos before classification. This improves accuracy by ensuring the classifier focuses on the bug, not the background.

**Architecture**: SSD MobileNet V2 FPNLite 300x300

- Lightweight and fast on mobile devices
- Good accuracy for small objects (insects)
- ~4MB model size after quantization

## Prerequisites

### 1. Install TensorFlow Object Detection API

```bash
# Clone TensorFlow models repo
git clone https://github.com/tensorflow/models.git
cd models/research

# Install dependencies
pip install tf-models-official
pip install tensorflow-datasets

# Compile protos
protoc object_detection/protos/*.proto --python_out=.

# Test installation
python object_detection/builders/model_builder_tf2_test.py
```

### 2. Download Pre-trained Checkpoint

```bash
cd BugLord/training
mkdir -p pre_trained
cd pre_trained

# Download SSD MobileNet V2 FPNLite
wget http://download.tensorflow.org/models/object_detection/tf2/20200711/ssd_mobilenet_v2_fpnlite_320x320_coco17_tpu-8.tar.gz

tar -xzf ssd_mobilenet_v2_fpnlite_320x320_coco17_tpu-8.tar.gz
```

## Dataset Preparation

### Option 1: Annotate Your Own Data

**Tools**: LabelImg, CVAT, or VGG Image Annotator

1. **Collect Images**
   - Take 200-500 photos of insects
   - Vary angles, lighting, backgrounds
   - Include different insect types

2. **Annotate Bounding Boxes**

   Using LabelImg:

   ```bash
   pip install labelImg
   labelImg
   ```

   - Open image directory
   - Draw rectangle around each insect
   - Label as "insect"
   - Save in COCO JSON format

3. **Organize Dataset**

   ```
   dataset_detection/
     images/
       img_001.jpg
       img_002.jpg
       ...
     annotations.json  # COCO format
   ```

### Option 2: Use iNaturalist Dataset

Download pre-annotated insect images:

```python
# Use fetch_inaturalist_data.py with bounding box support
python fetch_inaturalist_data.py \
  --taxon-ids 47158 184884 47120 \
  --max-images 500 \
  --include-bboxes \
  --output dataset_detection
```

### COCO Annotation Format

```json
{
  "images": [
    {
      "id": 1,
      "file_name": "img_001.jpg",
      "width": 1920,
      "height": 1080
    }
  ],
  "annotations": [
    {
      "id": 1,
      "image_id": 1,
      "category_id": 1,
      "bbox": [100, 150, 200, 180],
      "area": 36000,
      "iscrowd": 0
    }
  ],
  "categories": [
    {
      "id": 1,
      "name": "insect",
      "supercategory": "animal"
    }
  ]
}
```

## Training

### 1. Prepare Configuration

```bash
cd BugLord/training

# Generate pipeline config
python train_detector.py \
  --dataset dataset_detection \
  --num-steps 10000 \
  --batch-size 16 \
  --output models_detection
```

This creates:

- `label_map.pbtxt` - Class labels
- `pipeline.config` - Model configuration
- `tfrecords/` - Training data

### 2. Convert to TFRecord

```bash
cd ../models/research/object_detection

python dataset_tools/create_coco_tf_record.py \
  --logtostderr \
  --train_image_dir=../../../BugLord/training/dataset_detection/images \
  --val_image_dir=../../../BugLord/training/dataset_detection/images \
  --train_annotations_file=../../../BugLord/training/dataset_detection/annotations.json \
  --val_annotations_file=../../../BugLord/training/dataset_detection/annotations.json \
  --output_dir=../../../BugLord/training/models_detection/[timestamp]/tfrecords \
  --include_masks=False
```

### 3. Train Model

```bash
cd BugLord/training

python ../models/research/object_detection/model_main_tf2.py \
  --pipeline_config_path=models_detection/[timestamp]/pipeline.config \
  --model_dir=models_detection/[timestamp]/training \
  --alsologtostderr \
  --num_train_steps=10000 \
  --checkpoint_every_n=1000
```

Monitor training:

```bash
tensorboard --logdir=models_detection/[timestamp]/training
```

### 4. Export to TFLite

```bash
# Export SavedModel
python ../models/research/object_detection/export_tflite_graph_tf2.py \
  --pipeline_config_path=models_detection/[timestamp]/pipeline.config \
  --trained_checkpoint_dir=models_detection/[timestamp]/training \
  --output_directory=models_detection/[timestamp]/exported

# Convert to TFLite
python convert_to_tflite.py \
  --saved_model_dir=models_detection/[timestamp]/exported/saved_model \
  --output_file=models_detection/[timestamp]/insect_detector.tflite \
  --quantize
```

## Deployment

### 1. Copy Model to Assets

```bash
cp models_detection/[timestamp]/insect_detector.tflite ../assets/ml/
```

### 2. Update Code

Uncomment in `ImageProcessingService.ts`:

```typescript
async initialize(): Promise<void> {
  const detectionModelPath = await onDeviceClassifier.copyBundledModel(
    require('@/assets/ml/insect_detector.tflite'),
    'insect_detector.tflite'
  );
  await onDeviceClassifier.loadDetectionModel(detectionModelPath);
}
```

### 3. Install Native TFLite

```bash
npm install react-native-fast-tflite
# or
npm install @tensorflow/tfjs-react-native

npx expo prebuild --clean
```

### 4. Implement Real Inference

In `OnDeviceClassifier.ts`, replace stub methods:

```typescript
import { TensorflowModel } from 'react-native-fast-tflite';

async loadDetectionModel(modelPath: string): Promise<void> {
  this.detectionModel = await TensorflowModel.loadFromFile(modelPath);
  this.detectionModelLoaded = true;
}

async detectObjects(imageUri: string): Promise<DetectionResult> {
  const results = await this.detectionModel!.run(imageUri);
  return this.parseDetectionResults(results);
}
```

### 5. Build and Test

```bash
eas build --profile development --platform android
```

## Performance Optimization

### Model Quantization

Reduces model size by 4x with minimal accuracy loss:

```python
converter.optimizations = [tf.lite.Optimize.DEFAULT]
converter.representative_dataset = representative_dataset_gen
```

### Input Resolution

Balance speed vs accuracy:

- 300x300: Faster inference (~50ms)
- 512x512: Better accuracy for small insects
- 640x640: Best accuracy, slower (~150ms)

### Confidence Threshold

Adjust in `ImageProcessingService.ts`:

```typescript
await onDeviceClassifier.detectObjects(preprocessed, {
  confidenceThreshold: 0.3,  // Lower = more detections
  maxDetections: 5,          // Limit results
});
```

## Troubleshooting

### Low Detection Rate

- Add more training data (500+ images)
- Increase training steps (20,000+)
- Lower confidence threshold (0.2)
- Use larger input size (512x512)

### False Positives

- Increase confidence threshold (0.5)
- Add hard negative examples
- Train longer with data augmentation

### Slow Inference

- Use INT8 quantization
- Reduce input size to 300x300
- Enable GPU delegate (if available)

## Next Steps

1. **Continuous Improvement**: Use `DatasetUploadService` to collect user-confirmed detections
2. **Multi-Class Detection**: Extend to detect different insect orders
3. **Background Filtering**: Train to ignore humans, plants, etc.
4. **Edge Cases**: Add training data for challenging scenarios

## References

- [TensorFlow Object Detection API](https://github.com/tensorflow/models/tree/master/research/object_detection)
- [TFLite Model Maker](https://www.tensorflow.org/lite/models/modify/model_maker/object_detection)
- [SSD MobileNet Papers](https://arxiv.org/abs/1512.02325)
