"""
BugLord EfficientDet-Lite0 Training Script

Trains an object detection model using TensorFlow Lite Model Maker.
Exports a quantized .tflite model for on-device inference.

Usage:
    python efficientdet_lite0_train.py --dataset dataset_detection --epochs 30

Requirements:
    pip install tensorflow tflite-model-maker pycocotools Pillow numpy
"""

import argparse
import json
import os
import random
import sys
from datetime import datetime
from pathlib import Path

import numpy as np


def validate_coco_dataset(annotations_path, images_dir):
    """Validate COCO dataset and print statistics"""
    print("\n📊 Validating COCO dataset...")

    if not os.path.exists(annotations_path):
        print(f"❌ Annotations file not found: {annotations_path}")
        sys.exit(1)

    if not os.path.exists(images_dir):
        print(f"❌ Images directory not found: {images_dir}")
        sys.exit(1)

    with open(annotations_path, 'r') as f:
        coco_data = json.load(f)

    # Validate required fields
    if 'images' not in coco_data:
        print("❌ Missing 'images' field in COCO JSON")
        sys.exit(1)
    if 'annotations' not in coco_data:
        print("❌ Missing 'annotations' field in COCO JSON")
        sys.exit(1)
    if 'categories' not in coco_data:
        print("❌ Missing 'categories' field in COCO JSON")
        sys.exit(1)

    num_images = len(coco_data['images'])
    num_annotations = len(coco_data['annotations'])
    categories = coco_data['categories']

    print(f"✅ Valid COCO dataset:")
    print(f"   Images: {num_images}")
    print(f"   Annotations: {num_annotations}")
    print(f"   Categories: {[cat['name'] for cat in categories]}")

    # Check for missing image files
    missing_count = 0
    for img_info in coco_data['images']:
        img_path = os.path.join(images_dir, img_info['file_name'])
        if not os.path.exists(img_path):
            missing_count += 1
            if missing_count <= 5:  # Only print first 5
                print(f"⚠️  Missing image: {img_info['file_name']}")

    if missing_count > 0:
        print(f"⚠️  Warning: {missing_count} images referenced in annotations.json not found in {images_dir}")
        print("   Training will skip these images.")

    if num_images < 50:
        print("⚠️  Warning: Dataset is very small (<50 images). Consider collecting more data.")
    elif num_images < 200:
        print("⚠️  Warning: Dataset is small (<200 images). Results may not be optimal.")

    return coco_data


def split_dataset(coco_data, images_dir, output_dir, val_split=0.2, seed=42):
    """Split COCO dataset into train/val sets"""
    print(f"\n📂 Splitting dataset (train {int((1-val_split)*100)}% / val {int(val_split*100)}%)...")

    random.seed(seed)
    np.random.seed(seed)

    # Shuffle images
    images = coco_data['images'].copy()
    random.shuffle(images)

    # Split
    split_idx = int(len(images) * (1 - val_split))
    train_images = images[:split_idx]
    val_images = images[split_idx:]

    print(f"   Train: {len(train_images)} images")
    print(f"   Val: {len(val_images)} images")

    # Create train/val annotation files
    train_img_ids = {img['id'] for img in train_images}
    val_img_ids = {img['id'] for img in val_images}

    train_annotations = [ann for ann in coco_data['annotations'] if ann['image_id'] in train_img_ids]
    val_annotations = [ann for ann in coco_data['annotations'] if ann['image_id'] in val_img_ids]

    # Create split datasets
    train_coco = {
        'images': train_images,
        'annotations': train_annotations,
        'categories': coco_data['categories']
    }

    val_coco = {
        'images': val_images,
        'annotations': val_annotations,
        'categories': coco_data['categories']
    }

    # Save split files
    os.makedirs(output_dir, exist_ok=True)

    train_path = os.path.join(output_dir, 'train_annotations.json')
    val_path = os.path.join(output_dir, 'val_annotations.json')

    with open(train_path, 'w') as f:
        json.dump(train_coco, f, indent=2)

    with open(val_path, 'w') as f:
        json.dump(val_coco, f, indent=2)

    print(f"✅ Split files created:")
    print(f"   {train_path}")
    print(f"   {val_path}")

    return train_path, val_path


def train_efficientdet_lite0(
    dataset_dir,
    epochs=30,
    batch_size=8,
    val_split=0.2,
    output_dir='models_detection',
    quantize=True
):
    """Train EfficientDet-Lite0 using TFLite Model Maker"""

    print("\n🚀 Starting EfficientDet-Lite0 Training")
    print("=" * 60)

    # Import TFLite Model Maker (check if available)
    try:
        from tflite_model_maker import object_detector
        from tflite_model_maker.config import ExportFormat, QuantizationConfig
        print("✅ TFLite Model Maker loaded successfully")
    except ImportError as e:
        print("❌ Failed to import tflite-model-maker")
        print("   Install with: pip install tflite-model-maker")
        print(f"   Error: {e}")
        sys.exit(1)

    # Paths
    dataset_path = Path(dataset_dir)
    annotations_path = dataset_path / 'annotations.json'
    images_dir = dataset_path / 'images'

    # Validate dataset
    coco_data = validate_coco_dataset(str(annotations_path), str(images_dir))

    # Split dataset
    split_dir = dataset_path / 'splits'
    train_ann_path, val_ann_path = split_dataset(
        coco_data, str(images_dir), str(split_dir), val_split=val_split
    )

    # Load dataset using Model Maker
    print("\n📥 Loading dataset into Model Maker format...")
    try:
        train_data = object_detector.DataLoader.from_coco_format(
            images_dir=str(images_dir),
            annotations_json_filepath=train_ann_path
        )

        val_data = object_detector.DataLoader.from_coco_format(
            images_dir=str(images_dir),
            annotations_json_filepath=val_ann_path
        )

        print(f"✅ Dataset loaded:")
        print(f"   Train: {len(train_data)} samples")
        print(f"   Val: {len(val_data)} samples")
    except Exception as e:
        print(f"❌ Failed to load dataset: {e}")
        print("   Make sure images exist and paths are correct.")
        sys.exit(1)

    # Configure model spec
    print("\n🏗️  Configuring EfficientDet-Lite0...")
    spec = object_detector.EfficientDetLite0Spec()

    # Train model
    print("\n🏋️  Training model...")
    print(f"   Epochs: {epochs}")
    print(f"   Batch size: {batch_size}")
    print(f"   Model: EfficientDet-Lite0 (320x320)")
    print("\n⏳ This may take 15-30 minutes on GPU, 2-4 hours on CPU...")

    try:
        model = object_detector.create(
            train_data=train_data,
            model_spec=spec,
            batch_size=batch_size,
            epochs=epochs,
            validation_data=val_data,
            do_train=True
        )
        print("\n✅ Training complete!")
    except Exception as e:
        print(f"\n❌ Training failed: {e}")
        sys.exit(1)

    # Evaluate
    print("\n📊 Evaluating on validation set...")
    try:
        eval_result = model.evaluate(val_data)
        print("✅ Evaluation metrics:")
        for key, value in eval_result.items():
            print(f"   {key}: {value:.4f}")
    except Exception as e:
        print(f"⚠️  Evaluation failed: {e}")
        print("   Continuing to export...")

    # Export
    print(f"\n💾 Exporting model to {output_dir}/...")
    os.makedirs(output_dir, exist_ok=True)

    model_path = os.path.join(output_dir, 'buglord_detector.tflite')
    labels_path = os.path.join(output_dir, 'labels.txt')

    try:
        # Configure quantization
        if quantize:
            print("   Applying INT8 quantization...")
            quant_config = QuantizationConfig.for_int8(
                representative_data=train_data,
                quantization_steps=500
            )
        else:
            quant_config = None

        # Export TFLite model
        model.export(
            export_dir=output_dir,
            tflite_filename='buglord_detector.tflite',
            quantization_config=quant_config,
            export_format=ExportFormat.TFLITE
        )

        print(f"✅ Model exported: {model_path}")

        # Create labels file
        categories = coco_data['categories']
        with open(labels_path, 'w') as f:
            for cat in sorted(categories, key=lambda x: x['id']):
                f.write(f"{cat['name']}\n")

        print(f"✅ Labels exported: {labels_path}")

        # Get model size
        model_size_mb = os.path.getsize(model_path) / (1024 * 1024)
        print(f"   Model size: {model_size_mb:.2f} MB")

    except Exception as e:
        print(f"❌ Export failed: {e}")
        sys.exit(1)

    # Save metadata
    metadata = {
        'timestamp': datetime.now().isoformat(),
        'dataset': str(dataset_dir),
        'num_train_images': len(train_data),
        'num_val_images': len(val_data),
        'epochs': epochs,
        'batch_size': batch_size,
        'model': 'EfficientDet-Lite0',
        'quantized': quantize,
        'categories': [cat['name'] for cat in categories]
    }

    metadata_path = os.path.join(output_dir, 'metadata.json')
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"✅ Metadata saved: {metadata_path}")

    print("\n" + "=" * 60)
    print("🎉 Training complete!")
    print("=" * 60)
    print(f"\n📦 Output files:")
    print(f"   {model_path}")
    print(f"   {labels_path}")
    print(f"   {metadata_path}")
    print("\n📱 Deploy to app:")
    print(f"   cp {model_path} ../assets/ml/insect_detector.tflite")
    print(f"   cd .. && npx expo prebuild")
    print(f"   eas build --profile development --platform android")
    print()


def main():
    parser = argparse.ArgumentParser(
        description='Train EfficientDet-Lite0 for BugLord insect detection'
    )
    parser.add_argument(
        '--dataset',
        type=str,
        default='dataset_detection',
        help='Path to dataset directory with images/ and annotations.json'
    )
    parser.add_argument(
        '--epochs',
        type=int,
        default=30,
        help='Number of training epochs (default: 30)'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=8,
        help='Training batch size (default: 8)'
    )
    parser.add_argument(
        '--val-split',
        type=float,
        default=0.2,
        help='Validation split ratio (default: 0.2)'
    )
    parser.add_argument(
        '--output',
        type=str,
        default='models_detection',
        help='Output directory for trained model (default: models_detection)'
    )
    parser.add_argument(
        '--no-quantize',
        action='store_true',
        help='Disable INT8 quantization (not recommended)'
    )

    args = parser.parse_args()

    print("\n🐛 BugLord Object Detection Training")
    print("=" * 60)
    print(f"Dataset: {args.dataset}")
    print(f"Epochs: {args.epochs}")
    print(f"Batch size: {args.batch_size}")
    print(f"Val split: {args.val_split}")
    print(f"Output: {args.output}")
    print(f"Quantization: {'Enabled' if not args.no_quantize else 'Disabled'}")
    print("=" * 60)

    try:
        train_efficientdet_lite0(
            dataset_dir=args.dataset,
            epochs=args.epochs,
            batch_size=args.batch_size,
            val_split=args.val_split,
            output_dir=args.output,
            quantize=not args.no_quantize
        )
    except KeyboardInterrupt:
        print("\n\n⚠️  Training interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n\n❌ Training failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
