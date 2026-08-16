"""
Simplified BugLord Object Detection Training
Uses TensorFlow/Keras directly without the full TFOD API
"""

import argparse
import json
from datetime import datetime
from pathlib import Path

import numpy as np
import tensorflow as tf
from PIL import Image

print("TensorFlow version:", tf.__version__)

def load_coco_dataset(annotations_path, images_dir, img_size=(300, 300)):
    """Load COCO format dataset for training"""
    print(f"\n📂 Loading dataset from {annotations_path}")

    with open(annotations_path, 'r') as f:
        coco_data = json.load(f)

    images = []
    boxes = []

    # Create image ID to annotations mapping
    img_id_to_anns = {}
    for ann in coco_data['annotations']:
        img_id = ann['image_id']
        if img_id not in img_id_to_anns:
            img_id_to_anns[img_id] = []
        img_id_to_anns[img_id].append(ann)

    # Load images and boxes
    for img_info in coco_data['images']:
        img_id = img_info['id']
        img_path = images_dir / img_info['file_name']

        if not img_path.exists():
            print(f"⚠️  Warning: {img_path} not found, skipping")
            continue

        # Load and resize image
        img = Image.open(img_path).convert('RGB')
        orig_width, orig_height = img.size
        img = img.resize(img_size)
        img_array = np.array(img) / 255.0  # Normalize to [0, 1]

        # Get bounding boxes for this image
        if img_id in img_id_to_anns:
            for ann in img_id_to_anns[img_id]:
                # COCO format: [x, y, width, height]
                x, y, w, h = ann['bbox']

                # Normalize to [0, 1] and convert to [ymin, xmin, ymax, xmax]
                xmin = x / orig_width
                ymin = y / orig_height
                xmax = (x + w) / orig_width
                ymax = (y + h) / orig_height

                # Clamp to [0, 1]
                xmin, ymin = max(0, xmin), max(0, ymin)
                xmax, ymax = min(1, xmax), min(1, ymax)

                images.append(img_array)
                boxes.append([ymin, xmin, ymax, xmax])

    images = np.array(images, dtype=np.float32)
    boxes = np.array(boxes, dtype=np.float32)

    print(f"✅ Loaded {len(images)} images with bounding boxes")
    print(f"   Image shape: {images.shape}")
    print(f"   Boxes shape: {boxes.shape}")

    return images, boxes


def create_simple_detector(input_shape=(300, 300, 3)):
    """Create a simple detection model using MobileNetV2 backbone"""
    print("\n🏗️  Building detection model...")

    # Use MobileNetV2 as backbone
    base_model = tf.keras.applications.MobileNetV2(
        input_shape=input_shape,
        include_top=False,
        weights='imagenet'
    )

    # Freeze early layers
    for layer in base_model.layers[:-30]:
        layer.trainable = False

    # Add detection head
    x = base_model.output
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dense(256, activation='relu')(x)
    x = tf.keras.layers.Dropout(0.3)(x)
    x = tf.keras.layers.Dense(128, activation='relu')(x)

    # Output: [ymin, xmin, ymax, xmax]
    bbox_output = tf.keras.layers.Dense(4, activation='sigmoid', name='bbox')(x)

    model = tf.keras.Model(inputs=base_model.input, outputs=bbox_output)

    print(f"✅ Model created:")
    print(f"   Total params: {model.count_params():,}")
    print(f"   Trainable params: {sum([tf.size(w).numpy() for w in model.trainable_weights]):,}")

    return model


def iou_loss(y_true, y_pred):
    """IoU (Intersection over Union) loss for bounding boxes"""
    # y_true and y_pred shape: [batch, 4] where 4 = [ymin, xmin, ymax, xmax]

    # Calculate intersection
    inter_ymin = tf.maximum(y_true[:, 0], y_pred[:, 0])
    inter_xmin = tf.maximum(y_true[:, 1], y_pred[:, 1])
    inter_ymax = tf.minimum(y_true[:, 2], y_pred[:, 2])
    inter_xmax = tf.maximum(y_true[:, 3], y_pred[:, 3])

    inter_width = tf.maximum(0.0, inter_xmax - inter_xmin)
    inter_height = tf.maximum(0.0, inter_ymax - inter_ymin)
    inter_area = inter_width * inter_height

    # Calculate union
    true_width = y_true[:, 3] - y_true[:, 1]
    true_height = y_true[:, 2] - y_true[:, 0]
    true_area = true_width * true_height

    pred_width = y_pred[:, 3] - y_pred[:, 1]
    pred_height = y_pred[:, 2] - y_pred[:, 0]
    pred_area = pred_width * pred_height

    union_area = true_area + pred_area - inter_area

    # IoU
    iou = inter_area / (union_area + 1e-7)

    # Return 1 - IoU as loss
    return 1.0 - tf.reduce_mean(iou)


def train_model(model, images, boxes, epochs=50, batch_size=16, validation_split=0.15):
    """Train the detection model"""
    print(f"\n🏋️  Training model...")
    print(f"   Epochs: {epochs}")
    print(f"   Batch size: {batch_size}")
    print(f"   Validation split: {validation_split}")

    # Compile model
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.001),
        loss=iou_loss,
        metrics=[
            tf.keras.metrics.MeanAbsoluteError(name='mae'),
        ]
    )

    # Callbacks
    callbacks = [
        tf.keras.callbacks.EarlyStopping(
            monitor='val_loss',
            patience=10,
            restore_best_weights=True,
            verbose=1
        ),
        tf.keras.callbacks.ReduceLROnPlateau(
            monitor='val_loss',
            factor=0.5,
            patience=5,
            min_lr=1e-6,
            verbose=1
        ),
        tf.keras.callbacks.ModelCheckpoint(
            'models_detection/best_model.keras',
            monitor='val_loss',
            save_best_only=True,
            verbose=1
        )
    ]

    # Train
    history = model.fit(
        images, boxes,
        epochs=epochs,
        batch_size=batch_size,
        validation_split=validation_split,
        callbacks=callbacks,
        verbose=1
    )

    print("\n✅ Training complete!")
    return history


def convert_to_tflite(model, output_path='models_detection/insect_detector.tflite'):
    """Convert Keras model to TFLite"""
    print(f"\n🔄 Converting to TFLite...")

    # Convert
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]

    # For better mobile performance
    converter.target_spec.supported_types = [tf.float16]

    tflite_model = converter.convert()

    # Save
    output_path = Path(output_path)
    output_path.parent.mkdir(exist_ok=True, parents=True)

    with open(output_path, 'wb') as f:
        f.write(tflite_model)

    size_mb = len(tflite_model) / (1024 * 1024)
    print(f"✅ TFLite model saved: {output_path}")
    print(f"   Size: {size_mb:.2f} MB")

    return output_path


def main():
    parser = argparse.ArgumentParser(description="Train simplified insect detector")
    parser.add_argument(
        "--dataset",
        type=str,
        required=True,
        help="Path to dataset directory with images/ and annotations.json"
    )
    parser.add_argument(
        "--epochs",
        type=int,
        default=50,
        help="Number of training epochs (default: 50)"
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=16,
        help="Training batch size (default: 16)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="models_detection/insect_detector.tflite",
        help="Output TFLite model path"
    )

    args = parser.parse_args()

    print("\n🐛 BugLord Simplified Detector Training")
    print("=" * 60)
    print(f"Dataset: {args.dataset}")
    print(f"Epochs: {args.epochs}")
    print(f"Batch size: {args.batch_size}")
    print(f"Output: {args.output}")
    print("=" * 60)

    # Load dataset
    dataset_path = Path(args.dataset)
    annotations_path = dataset_path / 'annotations.json'
    images_dir = dataset_path / 'images'

    images, boxes = load_coco_dataset(annotations_path, images_dir)

    # Create model
    model = create_simple_detector()

    # Train
    history = train_model(
        model, images, boxes,
        epochs=args.epochs,
        batch_size=args.batch_size
    )

    # Convert to TFLite
    tflite_path = convert_to_tflite(model, args.output)

    print("\n✅ All done! Next steps:")
    print(f"1. Copy {tflite_path} to assets/ml/")
    print("2. Update OnDeviceClassifier.ts to use the new model")
    print("3. Rebuild app with: eas build --platform android --profile preview")

    return tflite_path


if __name__ == '__main__':
    main()
