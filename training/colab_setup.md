# Google Colab Training Setup for BugLord

Train your BugLord object detection model on Google Colab with free GPU access. Training takes ~15 minutes vs 2-4 hours on local CPU.

---

## Prerequisites

- Google account
- Your dataset: `dataset_detection.zip` containing:
  - `images/` folder with JPG images
  - `annotations.json` (COCO format)

---

## Step 1: Prepare Your Dataset

### Option A: Create ZIP File

On your local machine:

```bash
cd training
zip -r dataset_detection.zip dataset_detection/

# Windows (PowerShell):
Compress-Archive -Path dataset_detection -DestinationPath dataset_detection.zip
```

### Option B: Use Google Drive

1. Upload `training/dataset_detection/` folder to Google Drive
2. Note the folder path (e.g., `My Drive/BugLord/dataset_detection`)

---

## Step 2: Open Google Colab

1. Go to [Google Colab](https://colab.research.google.com/)
2. Create a new notebook: **File → New notebook**
3. Enable GPU: **Runtime → Change runtime type → Hardware accelerator → T4 GPU**
4. Click **Save**

---

## Step 3: Install Dependencies

**Cell 1:** Install required packages

```python
# Install TensorFlow Lite Model Maker
!pip install -q tflite-model-maker
!pip install -q pycocotools

print("✅ Dependencies installed")
```

Run this cell (Shift+Enter). Wait ~1 minute for installation.

---

## Step 4: Upload Dataset

Choose **Option A** (upload ZIP) or **Option B** (Google Drive):

### Option A: Upload ZIP File

**Cell 2:** Upload and extract dataset

```python
from google.colab import files
import zipfile
import os

# Upload dataset ZIP
print("📤 Upload your dataset_detection.zip file...")
uploaded = files.upload()

# Extract
zip_name = list(uploaded.keys())[0]
with zipfile.ZipFile(zip_name, 'r') as zip_ref:
    zip_ref.extractall('.')

# Verify
if os.path.exists('dataset_detection'):
    print(f"✅ Dataset extracted: {len(os.listdir('dataset_detection/images'))} images")
else:
    print("❌ Dataset not found. Check ZIP structure.")
```

### Option B: Mount Google Drive

**Cell 2 (Alternative):** Mount Drive

```python
from google.colab import drive
import os

# Mount Google Drive
drive.mount('/content/drive')

# Link to your dataset
dataset_path = '/content/drive/My Drive/BugLord/dataset_detection'

# Verify
if os.path.exists(dataset_path):
    print(f"✅ Dataset found: {len(os.listdir(dataset_path + '/images'))} images")

    # Symlink for convenience
    !ln -s "{dataset_path}" dataset_detection
else:
    print("❌ Dataset not found. Check the path in Google Drive.")
```

---

## Step 5: Upload Training Script

**Cell 3:** Upload `efficientdet_lite0_train.py`

```python
from google.colab import files

print("📤 Upload efficientdet_lite0_train.py from your training/ folder...")
uploaded = files.upload()

# Verify
if 'efficientdet_lite0_train.py' in uploaded:
    print("✅ Training script uploaded")
else:
    print("❌ Training script not found")
```

Alternatively, you can paste the script directly (see below).

---

## Step 6: Run Training

**Cell 4:** Train the model

```python
# Run training (takes ~15 minutes on T4 GPU)
!python efficientdet_lite0_train.py \
    --dataset dataset_detection \
    --epochs 30 \
    --batch-size 16 \
    --output models_detection

print("\n✅ Training complete! Check output above for metrics.")
```

**Monitor progress:**
- You'll see validation metrics printed during training
- Loss should decrease over time
- mAP@0.5 (if shown) should be >0.5 for decent results

---

## Step 7: Download Outputs

**Cell 5:** Download trained model

```python
from google.colab import files
import os

# Check outputs
if os.path.exists('models_detection/buglord_detector.tflite'):
    print("✅ Model found!")

    # Download files
    files.download('models_detection/buglord_detector.tflite')
    files.download('models_detection/labels.txt')
    files.download('models_detection/metadata.json')

    # Show model size
    size_mb = os.path.getsize('models_detection/buglord_detector.tflite') / (1024*1024)
    print(f"\n📦 Model size: {size_mb:.2f} MB")
else:
    print("❌ Model not found. Check training output for errors.")
```

---

## Step 8: Deploy to BugLord App

On your local machine:

1. Copy downloaded files to your app:
   ```bash
   cp buglord_detector.tflite BugLord/assets/ml/insect_detector.tflite
   cp labels.txt BugLord/assets/ml/detection_labels.txt
   ```

2. Rebuild app with EAS:
   ```bash
   cd BugLord
   npx expo prebuild
   eas build --profile development --platform android
   ```

3. Test detection in the app's capture screen!

---

## Alternative: Full Script in One Cell

If you don't want to upload files, paste this complete script into a single cell:

<details>
<summary>Click to expand full inline script</summary>

```python
# Install dependencies
!pip install -q tflite-model-maker pycocotools

# Upload dataset
from google.colab import files
import zipfile
print("📤 Upload dataset_detection.zip...")
uploaded = files.upload()
with zipfile.ZipFile(list(uploaded.keys())[0], 'r') as zip_ref:
    zip_ref.extractall('.')

# Paste training script here (copy from efficientdet_lite0_train.py)
# ... or upload it separately as shown above

# Run training
!python -c "exec(open('efficientdet_lite0_train.py').read())" \
    --dataset dataset_detection \
    --epochs 30 \
    --batch-size 16

# Download outputs
if os.path.exists('models_detection/buglord_detector.tflite'):
    files.download('models_detection/buglord_detector.tflite')
    files.download('models_detection/labels.txt')
    print("✅ Download complete!")
```

</details>

---

## Troubleshooting

### "ModuleNotFoundError: No module named 'tflite_model_maker'"

Run installation cell again:
```python
!pip install --upgrade tflite-model-maker
```

### "ResourceExhausted: OOM when allocating tensor"

Reduce batch size:
```python
!python efficientdet_lite0_train.py --batch-size 8  # or 4
```

### "Dataset not found"

Check paths:
```python
!ls -la dataset_detection/
!ls -la dataset_detection/images/ | head
```

### Training takes forever

Check GPU is enabled:
```python
import tensorflow as tf
print("GPU available:", tf.config.list_physical_devices('GPU'))
```

If empty, enable GPU: **Runtime → Change runtime type → T4 GPU**

### Low accuracy (<40% mAP)

- Dataset too small: collect more images (500+ ideal)
- Bounding boxes inaccurate: refine 50-100 manually
- Train longer: `--epochs 50`

---

## Tips for Best Results

1. **GPU Runtime:** Always use T4 GPU (free tier)
2. **Batch Size:** Use 16 on GPU, 8 on CPU
3. **Epochs:** 30 is good baseline, 50 for production
4. **Dataset:** 200+ images minimum, 500+ ideal
5. **Save Work:** Download outputs immediately (Colab resets after 12 hours idle)

---

## Next Steps

1. ✅ Train model on Colab (~15 min)
2. ✅ Download `buglord_detector.tflite`
3. ✅ Copy to `assets/ml/insect_detector.tflite`
4. ✅ Rebuild app with `eas build`
5. ✅ Test in app capture screen
6. ⭐ Refine dataset and retrain for better accuracy

Happy training! 🐛✨
