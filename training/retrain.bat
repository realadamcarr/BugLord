
@echo off
REM BugLord ML Model Retraining Script
REM Run this from the training/ directory

echo ============================================
echo    BugLord Model Retraining Pipeline
echo ============================================

REM 1. Activate venv (create if needed)
if not exist "venv\Scripts\activate.bat" (
    echo Creating virtual environment...
    python -m venv venv
)
call venv\Scripts\activate.bat
pip install -r requirements.txt --quiet

echo.
echo === Step 1: Fetch more training data ===
echo Fetching 300 images per species for 15 insect classes...
python fetch_inaturalist_data.py ^
  --species "Apis mellifera,Danaus plexippus,Coccinella septempunctata,Anax junius,Solenopsis invicta,Camponotus,Vespa,Pieris rapae,Lucanus cervus,Musca domestica,Argiope aurantia,Mantis religiosa,Gryllus,Papilio,Bombus" ^
  --per-species 300 ^
  --output dataset_v2

echo.
echo === Step 2: Train model ===
python train_model.py --dataset dataset_v2 --epochs 30 --batch-size 32

echo.
echo === Step 3: Deploy ===
echo.
echo Training complete! To deploy the new model:
echo   1. Copy the model.tflite from models/[latest]/ to ../assets/ml/model.tflite
echo   2. Copy the labels.json from models/[latest]/ to ../assets/ml/labels.json
echo   3. Rebuild: cd .. ^&^& eas build --platform android --profile preview
echo.
pause
