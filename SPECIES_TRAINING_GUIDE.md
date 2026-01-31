# Species-Specific Model Training Guide

## Current Issue

Your model is trained with only 1 label: "insect" (generic). It can't distinguish between species.

## What You Need

### 1. Dataset with Species Labels

Your YOLO label files (`.txt`) need different class IDs:

- `0` = house_fly
- `1` = honey_bee
- `2` = ladybug
- `3` = paper_wasp
- `4` = hoverfly

Each label file format: `<class_id> <x_center> <y_center> <width> <height>`

Example:

```
# house_fly_001.txt
0 0.5 0.5 0.6 0.6

# honey_bee_002.txt
1 0.5 0.5 0.6 0.6
```

### 2. Create Species Dataset

#### Option A: Use Roboflow (Easiest)

1. Go to <https://roboflow.com>
2. Upload your insect images
3. **Manually label each image with species name** (not just "insect")
4. Export as YOLOv8 format
5. Download the dataset with proper species labels

#### Option B: Manual Dataset Creation

Create this structure:

```
C:\BugLordTraining\species_dataset\
  data.yaml
  train\
    images\
      house_fly_001.jpg
      honey_bee_001.jpg
      ladybug_001.jpg
      ...
    labels\
      house_fly_001.txt (content: 0 0.5 0.5 0.6 0.6)
      honey_bee_001.txt (content: 1 0.5 0.5 0.6 0.6)
      ladybug_001.txt   (content: 2 0.5 0.5 0.6 0.6)
      ...
  val\
    images\
    labels\
```

**data.yaml** content:

```yaml
train: train/images
val: val/images

nc: 5  # number of classes
names: ['house_fly', 'honey_bee', 'ladybug', 'paper_wasp', 'hoverfly']
```

### 3. Train the Model

```powershell
cd C:\BugLordTraining
.\.venv\Scripts\Activate.ps1

# Train with species data
.\.venv\Scripts\yolo.exe detect train `
  model=yolov8n.pt `
  data="species_dataset\data.yaml" `
  imgsz=640 `
  epochs=50 `
  batch=16
```

### 4. Export to TFLite

After training completes:

```powershell
# Export best model to TFLite
.\.venv\Scripts\yolo.exe export `
  model=runs\detect\train5\weights\best.pt `
  format=tflite `
  imgsz=224 `
  int8=False
```

Or use Roboflow to export directly to TFLite.

### 5. Update Your App

Copy the new model:

```powershell
Copy-Item "runs\detect\train5\weights\best.tflite" `
  -Destination "C:\Users\adamc\Desktop\personal projects\BugLord\BugLord\assets\ml\insect_detector.tflite"
```

Update `assets/ml/labels.json`:

```json
{
  "labels": ["house_fly", "honey_bee", "ladybug", "paper_wasp", "hoverfly"]
}
```

### 6. Remove Validation Workaround

Once you have a species-trained model, you can remove the confidence check and use ML predictions directly in `app/(tabs)/index.tsx`.

## Quick Test

To test if your new model works:

1. Take a photo of a honey bee
2. The app should identify it as "honey_bee" (not "house_fly")
3. Take a blank photo - should be rejected (low confidence)

## Need More Images?

If you don't have enough species-labeled images:

- Use iNaturalist.org to download species-specific datasets
- Use Google Images with species names
- Use Roboflow's public datasets
- Minimum ~30-50 images per species for decent accuracy
