# YOLO to TensorFlow Lite Conversion Guide

Your trained YOLO model is at:
`C:\Users\adamc\Desktop\personal projects\BugLord\BugLord\runs\detect\train4\weights\best.pt`

## Option 1: Use Roboflow's Pre-Trained Model

Since your Roboflow model is already trained and ready, you can:
1. Go to your Roboflow project: https://universe.roboflow.com/buglord/buglord-insect-detection
2. Click "Deploy" → "TensorFlow Lite"
3. Download the `.tflite` model file
4. Place it at: `assets/ml/insect_detector.tflite`
5. Update `assets/ml/labels.json` to: `{"labels": ["insect"]}`

## Option 2: Convert YOLO Model (Requires Working TensorFlow Environment)

### Step 1: Create a clean Python environment
```bash
python -m venv tflite_converter
tflite_converter\Scripts\activate
pip install ultralytics tensorflow==2.17.0
```

### Step 2: Export to TensorFlow Lite
```bash
yolo export model="C:\Users\adamc\Desktop\personal projects\BugLord\BugLord\runs\detect\train4\weights\best.pt" format=tflite int8=False
```

The exported model will be in:
`C:\Users\adamc\Desktop\personal projects\BugLord\BugLord\runs\detect\train4\weights\best_saved_model\best_float32.tflite`

### Step 3: Copy to your app
```bash
Copy-Item "runs\detect\train4\weights\best_saved_model\best_float32.tflite" -Destination "assets\ml\insect_detector.tflite"
```

### Step 4: Update labels
Edit `assets/ml/labels.json`:
```json
{
  "labels": ["insect"]
}
```

## Recommended Approach

**Use Option 1 (Roboflow)** - It's simpler and the model is already trained on the same dataset.

After deploying the model:
1. Rebuild your app: `npx expo prebuild --clean`
2. Test the detection in the capture screen
