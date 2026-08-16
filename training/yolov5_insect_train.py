#!/usr/bin/env python3
"""
YOLOv5 Insect Classification → TFLite Export
=============================================
Based on: https://www.kaggle.com/code/vencerlanz09/insect-images-classification-using-yolov5

This script:
  1. Clones YOLOv5 if not present
  2. Trains on the Kaggle "Insect Images" dataset (12 classes)
  3. Exports the best checkpoint to TFLite (int8-quantised, 224×224)
  4. Copies the .tflite file into assets/ml/model.tflite

12 classes:  Butterfly, Dragonfly, Grasshopper, Ladybug, Mosquito, Moth,
             Bees, ant, beetle, caterpillar, earthworms, wasp

Requirements
------------
- Python 3.9+
- pip install torch torchvision  (CPU is fine for export; GPU for training)
- pip install kaggle              (for dataset download)
- Kaggle API key at ~/.kaggle/kaggle.json

Usage (Google Colab / local)
----------------------------
    python yolov5_insect_train.py --download --train --export
    python yolov5_insect_train.py --export          # just re-export an existing best.pt
    python yolov5_insect_train.py --download         # just fetch the dataset
"""

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent          # training/
PROJECT_ROOT = ROOT.parent                       # BugLord repo root
YOLOV5_DIR = ROOT / "yolov5"
DATASET_DIR = ROOT / "insect-dataset"
RUNS_DIR = ROOT / "runs"
BEST_PT = RUNS_DIR / "classify" / "insect_train" / "weights" / "best.pt"
TFLITE_OUT = PROJECT_ROOT / "assets" / "ml" / "model.tflite"
IMG_SIZE = 224
EPOCHS = 50
BATCH_SIZE = 64


def run(cmd: str, cwd: str | None = None) -> None:
    """Run a shell command and stream output."""
    print(f"\n>>> {cmd}")
    subprocess.check_call(cmd, shell=True, cwd=cwd)


# ──────────────────────────────────────────────────────────
#  1. Download dataset from Kaggle
# ──────────────────────────────────────────────────────────
def download_dataset():
    """Download the Kaggle 'Insect Images' dataset."""
    print("\n📦 Downloading Kaggle dataset...")
    DATASET_DIR.mkdir(parents=True, exist_ok=True)
    run(
        f"kaggle datasets download -d vencerlanz09/insect-images -p \"{DATASET_DIR}\" --unzip",
    )
    # The dataset extracts into subfolders per class, typically under
    # insect-dataset/Insect Images/...  Adjust if your extract differs.
    print("✅ Dataset downloaded to", DATASET_DIR)


# ──────────────────────────────────────────────────────────
#  2. Clone YOLOv5 repo
# ──────────────────────────────────────────────────────────
def setup_yolov5():
    if YOLOV5_DIR.exists():
        print("✅ YOLOv5 already cloned at", YOLOV5_DIR)
        return
    print("\n🔧 Cloning YOLOv5...")
    run(f"git clone https://github.com/ultralytics/yolov5 \"{YOLOV5_DIR}\"")
    run(f"pip install -r \"{YOLOV5_DIR / 'requirements.txt'}\"")
    # Also need onnx + tensorflow for TFLite export
    run("pip install onnx onnxruntime tensorflow")


# ──────────────────────────────────────────────────────────
#  3. Train
# ──────────────────────────────────────────────────────────
def train():
    """Train YOLOv5 classification model on the insect dataset."""
    setup_yolov5()

    # Locate the extracted image root.  Kaggle usually puts them under
    # insect-dataset/Insect Images/  with one subfolder per class.
    data_root = DATASET_DIR
    # Try common nested folder
    nested = DATASET_DIR / "Insect Images"
    if nested.exists():
        data_root = nested

    print(f"\n🏋️ Training YOLOv5-cls for {EPOCHS} epochs  (data: {data_root})")
    run(
        f"python classify/train.py"
        f" --model yolov5s-cls.pt"
        f" --data \"{data_root}\""
        f" --epochs {EPOCHS}"
        f" --img {IMG_SIZE}"
        f" --batch {BATCH_SIZE}"
        f" --project \"{RUNS_DIR / 'classify'}\""
        f" --name insect_train"
        f" --exist-ok",
        cwd=str(YOLOV5_DIR),
    )
    print("✅ Training complete.  Best weights:", BEST_PT)


# ──────────────────────────────────────────────────────────
#  4. Export to TFLite (int8 quantised, 224×224)
# ──────────────────────────────────────────────────────────
def export_tflite():
    """Export best.pt → TFLite."""
    setup_yolov5()

    if not BEST_PT.exists():
        # Fall back to the latest run folder
        alt = sorted(
            (RUNS_DIR / "classify").glob("insect_train*/weights/best.pt"),
            key=os.path.getmtime,
        )
        if alt:
            best = alt[-1]
        else:
            sys.exit(f"❌ best.pt not found at {BEST_PT}. Train first with --train.")
    else:
        best = BEST_PT

    print(f"\n📤 Exporting {best}  →  TFLite (int8, {IMG_SIZE}×{IMG_SIZE})")
    run(
        f"python export.py"
        f" --weights \"{best}\""
        f" --include tflite"
        f" --img {IMG_SIZE}"
        f" --int8",
        cwd=str(YOLOV5_DIR),
    )

    # Find the generated .tflite next to best.pt
    tflite_src = best.with_suffix(".tflite")
    if not tflite_src.exists():
        # Sometimes YOLOv5 appends -int8
        tflite_src = best.with_name("best-int8.tflite")
    if not tflite_src.exists():
        # Search in same directory
        candidates = list(best.parent.glob("*.tflite"))
        if candidates:
            tflite_src = candidates[0]
        else:
            sys.exit(f"❌ TFLite file not found near {best}")

    TFLITE_OUT.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(tflite_src, TFLITE_OUT)
    size_mb = TFLITE_OUT.stat().st_size / (1024 * 1024)
    print(f"✅ Copied to {TFLITE_OUT}  ({size_mb:.1f} MB)")

    # Also write labels.json next to the model
    import json
    labels = [
        "Butterfly", "Dragonfly", "Grasshopper", "Ladybug",
        "Mosquito", "Moth", "Bees", "ant",
        "beetle", "caterpillar", "earthworms", "wasp",
    ]
    labels_path = TFLITE_OUT.parent / "labels.json"
    labels_path.write_text(json.dumps(labels, indent=2))
    print(f"✅ Wrote {labels_path}")


# ──────────────────────────────────────────────────────────
#  CLI
# ──────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="YOLOv5 insect model → TFLite")
    parser.add_argument("--download", action="store_true", help="Download Kaggle dataset")
    parser.add_argument("--train", action="store_true", help="Train YOLOv5-cls model")
    parser.add_argument("--export", action="store_true", help="Export best.pt → TFLite")
    parser.add_argument("--epochs", type=int, default=EPOCHS)
    parser.add_argument("--batch", type=int, default=BATCH_SIZE)
    parser.add_argument("--img", type=int, default=IMG_SIZE)
    args = parser.parse_args()

    global EPOCHS, BATCH_SIZE, IMG_SIZE
    EPOCHS = args.epochs
    BATCH_SIZE = args.batch
    IMG_SIZE = args.img

    if not (args.download or args.train or args.export):
        parser.print_help()
        print("\nExample: python yolov5_insect_train.py --download --train --export")
        return

    if args.download:
        download_dataset()
    if args.train:
        train()
    if args.export:
        export_tflite()

    print("\n🎉 Done!")


if __name__ == "__main__":
    main()
