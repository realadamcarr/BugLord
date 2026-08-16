"""
BugLord Object Detection Model Training Script

Trains an SSD MobileNet model for insect detection using TensorFlow Object Detection API.
This model locates insects in photos (bounding boxes) rather than classifying them.

Usage:
    python train_detector.py --dataset dataset_detection --epochs 50 --batch-size 16

Dataset Structure:
    dataset_detection/
        images/
            img_001.jpg
            img_002.jpg
            ...
        annotations.json  # COCO format annotations

Requirements:
    - TensorFlow Object Detection API installed
    - COCO-format annotations (use VGG Image Annotator, CVAT, or LabelImg)
    - Pre-trained SSD MobileNet checkpoint
"""

import argparse
import json
import os
import sys
from datetime import datetime
from pathlib import Path

# Add TensorFlow models/research to Python path
models_research_path = Path(__file__).parent.parent / 'models' / 'research'
if models_research_path.exists():
    sys.path.insert(0, str(models_research_path))
    print(f"Added to Python path: {models_research_path}")

import numpy as np
import tensorflow as tf
from object_detection import model_lib_v2
from object_detection.builders import model_builder
from object_detection.utils import config_util, label_map_util

# Suppress TensorFlow warnings
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'


def create_label_map(output_path: Path, class_name: str = 'insect'):
    """Create label map for single-class detection"""
    label_map_content = f"""
item {{
  id: 1
  name: '{class_name}'
}}
"""

    label_map_path = output_path / 'label_map.pbtxt'
    with open(label_map_path, 'w') as f:
        f.write(label_map_content.strip())

    print(f"✅ Created label map: {label_map_path}")
    return label_map_path


def create_pipeline_config(
    output_dir: Path,
    label_map_path: Path,
    train_record: Path,
    val_record: Path,
    num_classes: int = 1,
    batch_size: int = 16,
    num_steps: int = 10000
):
    """Create TensorFlow Object Detection API pipeline config"""

    # Use pre-trained SSD MobileNet V2 FPNLite config
    config_template = f"""
model {{
  ssd {{
    num_classes: {num_classes}
    image_resizer {{
      fixed_shape_resizer {{
        height: 300
        width: 300
      }}
    }}
    feature_extractor {{
      type: "ssd_mobilenet_v2_fpn_keras"
      depth_multiplier: 1.0
      min_depth: 16
      conv_hyperparams {{
        regularizer {{
          l2_regularizer {{
            weight: 0.00004
          }}
        }}
        initializer {{
          truncated_normal_initializer {{
            mean: 0.0
            stddev: 0.03
          }}
        }}
        activation: RELU_6
        batch_norm {{
          decay: 0.997
          center: true
          scale: true
          epsilon: 0.001
        }}
      }}
      override_base_feature_extractor_hyperparams: true
      fpn {{
        min_level: 3
        max_level: 7
      }}
    }}
    box_coder {{
      faster_rcnn_box_coder {{
        y_scale: 10.0
        x_scale: 10.0
        height_scale: 5.0
        width_scale: 5.0
      }}
    }}
    matcher {{
      argmax_matcher {{
        matched_threshold: 0.5
        unmatched_threshold: 0.5
        ignore_thresholds: false
        negatives_lower_than_unmatched: true
        force_match_for_each_row: true
        use_matmul_gather: true
      }}
    }}
    box_predictor {{
      convolutional_box_predictor {{
        conv_hyperparams {{
          regularizer {{
            l2_regularizer {{
              weight: 0.00004
            }}
          }}
          initializer {{
            random_normal_initializer {{
              mean: 0.0
              stddev: 0.01
            }}
          }}
          activation: RELU_6
        }}
        min_depth: 0
        max_depth: 0
        num_layers_before_predictor: 0
        use_dropout: false
        dropout_keep_probability: 0.8
        kernel_size: 3
        box_code_size: 4
        apply_sigmoid_to_scores: false
      }}
    }}
    anchor_generator {{
      multiscale_anchor_generator {{
        min_level: 3
        max_level: 7
        anchor_scale: 4.0
        aspect_ratios: 1.0
        aspect_ratios: 2.0
        aspect_ratios: 0.5
        scales_per_octave: 2
      }}
    }}
    post_processing {{
      batch_non_max_suppression {{
        score_threshold: 0.3
        iou_threshold: 0.6
        max_detections_per_class: 10
        max_total_detections: 10
      }}
      score_converter: SIGMOID
    }}
    normalize_loss_by_num_matches: true
    loss {{
      localization_loss {{
        weighted_smooth_l1 {{}}
      }}
      classification_loss {{
        weighted_sigmoid_focal {{
          gamma: 2.0
          alpha: 0.25
        }}
      }}
      classification_weight: 1.0
      localization_weight: 1.0
    }}
  }}
}}

train_config {{
  batch_size: {batch_size}
  data_augmentation_options {{
    random_horizontal_flip {{}}
  }}
  data_augmentation_options {{
    random_crop_image {{
      min_object_covered: 0.0
      min_aspect_ratio: 0.75
      max_aspect_ratio: 3.0
      min_area: 0.75
      max_area: 1.0
      overlap_thresh: 0.0
    }}
  }}
  sync_replicas: true
  optimizer {{
    momentum_optimizer {{
      learning_rate {{
        cosine_decay_learning_rate {{
          learning_rate_base: 0.08
          total_steps: {num_steps}
          warmup_learning_rate: 0.026666
          warmup_steps: 1000
        }}
      }}
      momentum_optimizer_value: 0.9
    }}
    use_moving_average: false
  }}
  fine_tune_checkpoint: "pre_trained/ssd_mobilenet_v2_fpnlite_320x320_coco17_tpu-8/checkpoint/ckpt-0"
  num_steps: {num_steps}
  startup_delay_steps: 0.0
  replicas_to_aggregate: 8
  max_number_of_boxes: 100
  unpad_groundtruth_tensors: false
  fine_tune_checkpoint_type: "detection"
  fine_tune_checkpoint_version: V2
}}

train_input_reader {{
  label_map_path: "{label_map_path}"
  tf_record_input_reader {{
    input_path: "{train_record}"
  }}
}}

eval_config {{
  metrics_set: "coco_detection_metrics"
  use_moving_averages: false
  batch_size: 1
}}

eval_input_reader {{
  label_map_path: "{label_map_path}"
  shuffle: false
  num_epochs: 1
  tf_record_input_reader {{
    input_path: "{val_record}"
  }}
}}
"""

    config_path = output_dir / 'pipeline.config'
    with open(config_path, 'w') as f:
        f.write(config_template.strip())

    print(f"✅ Created pipeline config: {config_path}")
    return config_path


def convert_coco_to_tfrecord(annotations_path: Path, images_dir: Path, output_path: Path):
    """Convert COCO format annotations to TFRecord"""
    print(f"\n🔄 Converting COCO annotations to TFRecord...")

    # This is a simplified placeholder - in production, use:
    # https://github.com/tensorflow/models/blob/master/research/object_detection/dataset_tools/create_coco_tf_record.py

    print("⚠️  Please use TensorFlow Object Detection API's create_coco_tf_record.py")
    print(f"   python create_coco_tf_record.py \\")
    print(f"     --logtostderr \\")
    print(f"     --train_image_dir={images_dir} \\")
    print(f"     --val_image_dir={images_dir} \\")
    print(f"     --train_annotations_file={annotations_path} \\")
    print(f"     --val_annotations_file={annotations_path} \\")
    print(f"     --output_dir={output_path}")

    return output_path / 'train.record', output_path / 'val.record'


def export_to_tflite(checkpoint_dir: Path, config_path: Path, output_dir: Path):
    """Export trained model to TensorFlow Lite format"""
    print("\n🔄 Exporting to TensorFlow Lite...")

    # Load pipeline config
    configs = config_util.get_configs_from_pipeline_file(str(config_path))
    model_config = configs['model']

    # Build detection model
    detection_model = model_builder.build(model_config=model_config, is_training=False)

    # Restore checkpoint
    ckpt = tf.compat.v2.train.Checkpoint(model=detection_model)
    ckpt.restore(str(checkpoint_dir / 'ckpt-0')).expect_partial()

    # Define inference function
    @tf.function
    def detect_fn(image):
        image, shapes = detection_model.preprocess(image)
        prediction_dict = detection_model.predict(image, shapes)
        detections = detection_model.postprocess(prediction_dict, shapes)
        return detections

    # Convert to TFLite
    converter = tf.lite.TFLiteConverter.from_concrete_functions([detect_fn.get_concrete_function(
        tf.TensorSpec(shape=[1, 300, 300, 3], dtype=tf.uint8)
    )])

    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.target_spec.supported_ops = [
        tf.lite.OpsSet.TFLITE_BUILTINS,
        tf.lite.OpsSet.SELECT_TF_OPS
    ]

    tflite_model = converter.convert()

    # Save TFLite model
    tflite_path = output_dir / 'insect_detector.tflite'
    with open(tflite_path, 'wb') as f:
        f.write(tflite_model)

    file_size_mb = len(tflite_model) / (1024 * 1024)
    print(f"✅ TFLite model saved: {tflite_path}")
    print(f"   Size: {file_size_mb:.2f} MB\n")

    return tflite_path


def main():
    parser = argparse.ArgumentParser(description="Train BugLord insect detector")
    parser.add_argument(
        "--dataset",
        type=str,
        required=True,
        help="Path to COCO-format dataset directory"
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
        "--num-steps",
        type=int,
        default=10000,
        help="Total training steps (default: 10000)"
    )
    parser.add_argument(
        "--output",
        type=str,
        default="models_detection",
        help="Output directory for trained models (default: models_detection)"
    )

    args = parser.parse_args()

    # Paths
    dataset_path = Path(args.dataset)
    output_dir = Path(args.output) / datetime.now().strftime("%Y%m%d_%H%M%S")
    output_dir.mkdir(exist_ok=True, parents=True)

    print("\n🐛 BugLord Object Detection Model Training")
    print("="*60)
    print(f"Dataset: {dataset_path.absolute()}")
    print(f"Output: {output_dir.absolute()}")
    print(f"Steps: {args.num_steps}")
    print(f"Batch size: {args.batch_size}")
    print("="*60)

    # 1. Create label map
    label_map_path = create_label_map(output_dir, class_name='insect')

    # 2. Convert annotations to TFRecord
    annotations_path = dataset_path / 'annotations.json'
    images_dir = dataset_path / 'images'
    tfrecord_dir = output_dir / 'tfrecords'
    tfrecord_dir.mkdir(exist_ok=True)

    train_record, val_record = convert_coco_to_tfrecord(
        annotations_path, images_dir, tfrecord_dir
    )

    # 3. Create pipeline config
    config_path = create_pipeline_config(
        output_dir,
        label_map_path,
        train_record,
        val_record,
        num_classes=1,
        batch_size=args.batch_size,
        num_steps=args.num_steps
    )

    print("\n" + "="*60)
    print("⚠️  MANUAL TRAINING REQUIRED")
    print("="*60)
    print("\nThis script has prepared the configuration files.")
    print("To train the model, run:")
    print(f"\n  python model_main_tf2.py \\")
    print(f"    --pipeline_config_path={config_path} \\")
    print(f"    --model_dir={output_dir}/training \\")
    print(f"    --alsologtostderr")
    print("\nAfter training, export to TFLite:")
    print(f"  python export_tflite_graph_tf2.py \\")
    print(f"    --pipeline_config_path={config_path} \\")
    print(f"    --trained_checkpoint_dir={output_dir}/training \\")
    print(f"    --output_directory={output_dir}")
    print("\nThen deploy to BugLord:")
    print(f"  1. Copy insect_detector.tflite → app/assets/ml/")
    print("  2. Rebuild: npx expo prebuild")
    print("  3. Build: eas build --profile development --platform android\n")


if __name__ == "__main__":
    main()
