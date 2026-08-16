"""
BugLord ML Model Training Script

Trains a MobileNetV2-based insect classifier using TensorFlow and converts to TFLite.

Usage:
    python train_model.py --dataset dataset --epochs 20 --batch-size 32
"""

import argparse
import json
import os
from datetime import datetime
from pathlib import Path

import numpy as np
import tensorflow as tf
from PIL import ImageFile
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.callbacks import (EarlyStopping, ModelCheckpoint,
                                        ReduceLROnPlateau)
from tensorflow.keras.layers import Dense, Dropout, GlobalAveragePooling2D
from tensorflow.keras.models import Model
from tensorflow.keras.preprocessing.image import ImageDataGenerator

# Allow loading truncated images instead of crashing
ImageFile.LOAD_TRUNCATED_IMAGES = True

# Suppress TensorFlow warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'


def check_dataset(dataset_path: Path):
    """Validate dataset structure and print statistics"""
    print("\n📊 Dataset Statistics")
    print("="*60)

    if not dataset_path.exists():
        raise ValueError(f"Dataset path does not exist: {dataset_path}")

    species_dirs = [d for d in dataset_path.iterdir() if d.is_dir()]

    if len(species_dirs) < 2:
        raise ValueError("Need at least 2 species classes for training")

    total_images = 0
    for species_dir in species_dirs:
        images = list(species_dir.glob("*.jpg")) + list(species_dir.glob("*.jpeg")) + list(species_dir.glob("*.png"))
        num_images = len(images)
        total_images += num_images

        status = "✅" if num_images >= 50 else "⚠️ "
        print(f"{status} {species_dir.name}: {num_images} images")

    print(f"\nTotal classes: {len(species_dirs)}")
    print(f"Total images: {total_images}")
    print(f"Average per class: {total_images / len(species_dirs):.1f}")
    print("="*60 + "\n")

    return len(species_dirs)


def create_data_generators(dataset_path: Path, img_size: int, batch_size: int):
    """Create training and validation data generators with stronger augmentation"""

    train_datagen = ImageDataGenerator(
        rescale=1./255,
        rotation_range=40,
        width_shift_range=0.25,
        height_shift_range=0.25,
        shear_range=0.2,
        zoom_range=0.3,
        horizontal_flip=True,
        vertical_flip=False,  # Insects are rarely upside-down in photos
        brightness_range=[0.7, 1.3],
        channel_shift_range=30,
        fill_mode='nearest',
        validation_split=0.2  # 80% train, 20% validation
    )

    # Validation uses only rescaling (no augmentation)
    val_datagen = ImageDataGenerator(
        rescale=1./255,
        validation_split=0.2
    )

    print("🔄 Creating data generators...")

    train_generator = train_datagen.flow_from_directory(
        dataset_path,
        target_size=(img_size, img_size),
        batch_size=batch_size,
        class_mode='categorical',
        subset='training',
        shuffle=True
    )

    val_generator = val_datagen.flow_from_directory(
        dataset_path,
        target_size=(img_size, img_size),
        batch_size=batch_size,
        class_mode='categorical',
        subset='validation',
        shuffle=False
    )

    print(f"✅ Training samples: {train_generator.samples}")
    print(f"✅ Validation samples: {val_generator.samples}")
    print(f"✅ Classes: {len(train_generator.class_indices)}\n")

    return train_generator, val_generator


def build_model(num_classes: int, img_size: int = 224):
    """Build MobileNetV2-based model with transfer learning (2-phase approach)"""
    print("🏗️  Building model...")

    # Load pre-trained MobileNetV2 (ImageNet weights)
    base_model = MobileNetV2(
        weights='imagenet',
        include_top=False,
        input_shape=(img_size, img_size, 3)
    )

    # Phase 1: Freeze ALL base layers — only train the head
    base_model.trainable = False

    # Add custom classification head
    x = base_model.output
    x = GlobalAveragePooling2D()(x)
    x = Dense(256, activation='relu')(x)
    x = Dropout(0.5)(x)
    x = Dense(128, activation='relu')(x)
    x = Dropout(0.3)(x)
    predictions = Dense(num_classes, activation='softmax')(x)

    model = Model(inputs=base_model.input, outputs=predictions)

    # Phase 1 compile — higher LR is OK since base is frozen
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss='categorical_crossentropy',
        metrics=['accuracy', tf.keras.metrics.TopKCategoricalAccuracy(k=3, name='top_3_accuracy')]
    )

    print(f"✅ Model built: {model.count_params():,} total parameters")
    print(f"   Trainable (Phase 1 — head only): {sum([tf.keras.backend.count_params(w) for w in model.trainable_weights]):,}")
    print(f"   Frozen: {sum([tf.keras.backend.count_params(w) for w in model.non_trainable_weights]):,}\n")

    return model, base_model


def unfreeze_top_layers(model, base_model, num_layers: int = 30):
    """Phase 2: Unfreeze top N layers of the base model for fine-tuning"""
    print(f"\n🔓 Phase 2: Unfreezing top {num_layers} base layers for fine-tuning...")

    base_model.trainable = True
    for layer in base_model.layers[:-num_layers]:
        layer.trainable = False

    # Re-compile with much lower LR to avoid destroying pre-trained weights
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-4),
        loss='categorical_crossentropy',
        metrics=['accuracy', tf.keras.metrics.TopKCategoricalAccuracy(k=3, name='top_3_accuracy')]
    )

    trainable_count = sum([tf.keras.backend.count_params(w) for w in model.trainable_weights])
    print(f"   Trainable (Phase 2): {trainable_count:,}\n")

    return model


def train_model(model, train_gen, val_gen, epochs: int, output_dir: Path, base_model=None):
    """Train the model with 2-phase strategy: head-only then fine-tune"""
    print("🎓 Starting training...")

    # Create output directory
    output_dir.mkdir(exist_ok=True, parents=True)

    # Setup callbacks
    checkpoint_path = output_dir / "best_model.h5"
    callbacks = [
        ModelCheckpoint(
            checkpoint_path,
            monitor='val_accuracy',
            save_best_only=True,
            mode='max',
            verbose=1
        ),
        EarlyStopping(
            monitor='val_loss',
            patience=5,
            restore_best_weights=True,
            verbose=1
        ),
        ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=3,
            min_lr=1e-7,
            verbose=1
        )
    ]

    # ── Phase 1: Train head only (frozen base) ──────────────
    phase1_epochs = min(10, epochs // 2)
    print(f"\n🔒 Phase 1: Training classification head ({phase1_epochs} epochs)...")

    history1 = model.fit(
        train_gen,
        validation_data=val_gen,
        epochs=phase1_epochs,
        callbacks=callbacks,
        verbose=1
    )

    phase1_val_acc = max(history1.history.get('val_accuracy', [0]))
    print(f"✅ Phase 1 complete — best val accuracy: {phase1_val_acc:.1%}")

    # ── Phase 2: Fine-tune top base layers ──────────────────
    if base_model is not None:
        phase2_epochs = epochs - phase1_epochs
        print(f"\n🔓 Phase 2: Fine-tuning top layers ({phase2_epochs} epochs)...")

        model = unfreeze_top_layers(model, base_model, num_layers=30)

        # Reset callbacks for phase 2
        callbacks_p2 = [
            ModelCheckpoint(
                checkpoint_path,
                monitor='val_accuracy',
                save_best_only=True,
                mode='max',
                verbose=1
            ),
            EarlyStopping(
                monitor='val_loss',
                patience=7,
                restore_best_weights=True,
                verbose=1
            ),
            ReduceLROnPlateau(
                monitor='val_loss',
                factor=0.5,
                patience=3,
                min_lr=1e-7,
                verbose=1
            )
        ]

        history2 = model.fit(
            train_gen,
            validation_data=val_gen,
            epochs=phase1_epochs + phase2_epochs,
            initial_epoch=phase1_epochs,
            callbacks=callbacks_p2,
            verbose=1
        )

        # Merge histories
        history_dict = {}
        for key in history1.history:
            history_dict[key] = history1.history[key] + history2.history.get(key, [])
    else:
        history_dict = {k: list(v) for k, v in history1.history.items()}

    # Save training history
    history_path = output_dir / "training_history.json"
    with open(history_path, 'w') as f:
        serializable = {k: [float(v) for v in vals] for k, vals in history_dict.items()}
        json.dump(serializable, f, indent=2)

    final_val_acc = max(history_dict.get('val_accuracy', [0]))
    print(f"\n✅ Training complete!")
    print(f"🏆 Best validation accuracy: {final_val_acc:.1%}")
    print(f"📁 Best model saved to: {checkpoint_path}\n")

    return model, history_dict


def convert_to_tflite(model, output_dir: Path, quantize: bool = True):
    """Convert trained model to TensorFlow Lite format"""
    print("🔄 Converting to TensorFlow Lite...")

    # Create converter
    converter = tf.lite.TFLiteConverter.from_keras_model(model)

    if quantize:
        print("   Using quantization (smaller file, faster inference)")
        converter.optimizations = [tf.lite.Optimize.DEFAULT]

    # Convert
    tflite_model = converter.convert()

    # Save .tflite file
    tflite_path = output_dir / "model.tflite"
    with open(tflite_path, 'wb') as f:
        f.write(tflite_model)

    file_size_mb = len(tflite_model) / (1024 * 1024)
    print(f"✅ TFLite model saved: {tflite_path}")
    print(f"   Size: {file_size_mb:.2f} MB\n")

    return tflite_path


def save_labels(train_gen, output_dir: Path):
    """Save class labels as JSON"""
    labels = list(train_gen.class_indices.keys())

    labels_path = output_dir / "labels.json"
    with open(labels_path, 'w') as f:
        json.dump(labels, f, indent=2)

    print(f"✅ Labels saved: {labels_path}")
    print(f"   Classes: {', '.join(labels)}\n")

    return labels_path


def create_deployment_package(output_dir: Path, model_path: Path, labels_path: Path):
    """Create metadata and instructions for deployment"""

    version = datetime.now().strftime("%Y%m%d_%H%M%S")

    metadata = {
        "version": version,
        "created_at": datetime.now().isoformat(),
        "model_file": model_path.name,
        "labels_file": labels_path.name,
        "input_size": 224,
        "model_type": "MobileNetV2 + Custom Head",
        "framework": "TensorFlow Lite",
        "deployment_instructions": {
            "1": "Copy model.tflite to app: assets/ml/model.tflite",
            "2": "Copy labels.json to app: assets/ml/labels.json",
            "3": "Rebuild app with: npx expo prebuild && eas build",
            "4": "Or use ModelUpdateService to deploy remotely"
        }
    }

    metadata_path = output_dir / "deployment_metadata.json"
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)

    print(f"✅ Deployment metadata: {metadata_path}\n")


def main():
    parser = argparse.ArgumentParser(description="Train BugLord insect classifier")
    parser.add_argument(
        "--dataset",
        type=str,
        required=True,
        help="Path to dataset directory (with species subdirectories)"
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=20,
        help="Number of training epochs (default: 20)"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=32,
        help="Training batch size (default: 32)"
    )
    parser.add_argument(
        "--img-size",
        type=int,
        default=224,
        help="Input image size (default: 224)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="models",
        help="Output directory for trained models (default: models)"
    )
    parser.add_argument(
        "--no-quantize",
        action="store_true",
        help="Disable model quantization (larger file, slightly better accuracy)"
    )

    args = parser.parse_args()

    # Paths
    dataset_path = Path(args.dataset)
    output_dir = Path(args.output) / datetime.now().strftime("%Y%m%d_%H%M%S")

    print("\n🐛 BugLord ML Model Training")
    print("="*60)
    print(f"Dataset: {dataset_path.absolute()}")
    print(f"Output: {output_dir.absolute()}")
    print(f"Epochs: {args.epochs}")
    print(f"Batch size: {args.batch_size}")
    print(f"Image size: {args.img_size}x{args.img_size}")
    print("="*60)

    # 1. Check dataset
    num_classes = check_dataset(dataset_path)

    # 2. Create data generators
    train_gen, val_gen = create_data_generators(
        dataset_path,
        args.img_size,
        args.batch_size
    )

    # 3. Build model
    model, base_model = build_model(num_classes, args.img_size)

    # 4. Train (2-phase: head-only then fine-tune)
    model, history = train_model(model, train_gen, val_gen, args.epochs, output_dir, base_model)

    # 5. Convert to TFLite
    tflite_path = convert_to_tflite(model, output_dir, quantize=not args.no_quantize)

    # 6. Save labels
    labels_path = save_labels(train_gen, output_dir)

    # 7. Create deployment package
    create_deployment_package(output_dir, tflite_path, labels_path)

    # Final summary
    print("="*60)
    print("✅ Training Pipeline Complete!")
    print("="*60)
    print(f"\n📁 Output files in: {output_dir.absolute()}")
    print("\nTo deploy to BugLord app:")
    print(f"  1. Copy {tflite_path.name} → app/assets/ml/")
    print(f"  2. Copy {labels_path.name} → app/assets/ml/")
    print("  3. Rebuild: npx expo prebuild")
    print("  4. Build: eas build --profile development --platform android\n")


if __name__ == "__main__":
    main()
