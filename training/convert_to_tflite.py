"""
Convert TensorFlow SavedModel to TensorFlow Lite format with quantization.

Usage:
    python convert_to_tflite.py \
        --saved-model-dir models_detection/20260128_120000/exported/saved_model \
        --output-file models_detection/20260128_120000/insect_detector.tflite \
        --quantize
"""

import argparse
from pathlib import Path

import tensorflow as tf


def convert_to_tflite(
    saved_model_dir: Path,
    output_file: Path,
    quantize: bool = True,
    input_size: int = 300
):
    """Convert SavedModel to TFLite with optional quantization"""

    print(f"\n🔄 Converting SavedModel to TFLite")
    print(f"   Input: {saved_model_dir}")
    print(f"   Output: {output_file}")
    print(f"   Quantize: {quantize}")
    print(f"   Input size: {input_size}x{input_size}\n")

    # Load SavedModel
    print("📥 Loading SavedModel...")
    converter = tf.lite.TFLiteConverter.from_saved_model(str(saved_model_dir))

    if quantize:
        print("🔧 Enabling quantization (INT8)...")
        converter.optimizations = [tf.lite.Optimize.DEFAULT]

        # For full integer quantization, provide representative dataset
        # This improves accuracy and enables INT8 inference
        def representative_dataset_gen():
            # Generate sample inputs (random images for now)
            for _ in range(100):
                # Random uint8 image data
                data = tf.random.uniform(
                    [1, input_size, input_size, 3],
                    minval=0,
                    maxval=256,
                    dtype=tf.float32
                )
                yield [tf.cast(data, tf.uint8)]

        converter.representative_dataset = representative_dataset_gen
        converter.target_spec.supported_ops = [
            tf.lite.OpsSet.TFLITE_BUILTINS_INT8,
            tf.lite.OpsSet.TFLITE_BUILTINS
        ]
        converter.inference_input_type = tf.uint8
        converter.inference_output_type = tf.uint8

    # Enable SELECT_TF_OPS for compatibility
    converter.target_spec.supported_ops.append(tf.lite.OpsSet.SELECT_TF_OPS)

    # Convert
    print("⚙️  Converting (this may take a few minutes)...")
    tflite_model = converter.convert()

    # Save
    output_file.parent.mkdir(parents=True, exist_ok=True)
    with open(output_file, 'wb') as f:
        f.write(tflite_model)

    # Report size
    file_size_mb = len(tflite_model) / (1024 * 1024)
    print(f"\n✅ Conversion complete!")
    print(f"   File: {output_file}")
    print(f"   Size: {file_size_mb:.2f} MB")

    # Test model
    print("\n🧪 Testing model...")
    try:
        interpreter = tf.lite.Interpreter(model_content=tflite_model)
        interpreter.allocate_tensors()

        input_details = interpreter.get_input_details()
        output_details = interpreter.get_output_details()

        print(f"   Input shape: {input_details[0]['shape']}")
        print(f"   Input dtype: {input_details[0]['dtype']}")
        print(f"   Outputs: {len(output_details)}")

        for i, output in enumerate(output_details):
            print(f"     Output {i}: {output['shape']} ({output['dtype']})")

        print("   ✅ Model loaded successfully!")

    except Exception as e:
        print(f"   ⚠️  Model test failed: {e}")

    print("\n" + "="*60)
    print("Deployment Instructions:")
    print("="*60)
    print(f"1. Copy to app assets:")
    print(f"   cp {output_file} ../assets/ml/insect_detector.tflite")
    print("\n2. Uncomment initialization in ImageProcessingService.ts")
    print("\n3. Install native TFLite library:")
    print("   npm install react-native-fast-tflite")
    print("\n4. Prebuild and deploy:")
    print("   npx expo prebuild --clean")
    print("   eas build --profile development --platform android")
    print("="*60 + "\n")


def main():
    parser = argparse.ArgumentParser(description="Convert SavedModel to TFLite")
    parser.add_argument(
        "--saved-model-dir",
        type=str,
        required=True,
        help="Path to TensorFlow SavedModel directory"
    )
    parser.add_argument(
        "--output-file",
        type=str,
        required=True,
        help="Output path for TFLite model (e.g., insect_detector.tflite)"
    )
    parser.add_argument(
        "--quantize",
        action="store_true",
        default=True,
        help="Apply INT8 quantization (default: True)"
    )
    parser.add_argument(
        "--no-quantize",
        action="store_true",
        help="Disable quantization"
    )
    parser.add_argument(
        "--input-size",
        type=int,
        default=300,
        help="Model input size (default: 300)"
    )

    args = parser.parse_args()

    saved_model_dir = Path(args.saved_model_dir)
    output_file = Path(args.output_file)
    quantize = args.quantize and not args.no_quantize

    if not saved_model_dir.exists():
        print(f"❌ Error: SavedModel directory not found: {saved_model_dir}")
        return 1

    try:
        convert_to_tflite(saved_model_dir, output_file, quantize, args.input_size)
        return 0
    except Exception as e:
        print(f"\n❌ Conversion failed: {e}")
        return 1


if __name__ == "__main__":
    exit(main())
