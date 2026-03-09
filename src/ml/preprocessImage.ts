/**
 * preprocessImage.ts
 *
 * Resize / crop a photo to the 224 × 224 input the TFLite classifier expects.
 * Uses expo-image-manipulator (already a project dependency).
 *
 * Returns a local file URI that can be passed straight to loadTensorflowModel.run().
 */

import * as ImageManipulator from 'expo-image-manipulator';

export const INPUT_SIZE = 224;

/**
 * Resize-and-center-crop an image to `INPUT_SIZE x INPUT_SIZE` JPEG.
 *
 * 1. Resize so the shortest edge equals INPUT_SIZE (keeps aspect ratio).
 * 2. Center-crop the excess to get an exact square.
 */
export async function preprocessForClassifier(
  uri: string,
  quality: number = 0.85,
): Promise<string> {
  // Step 1: probe the original size (cheapest way via manipulate with no ops)
  const probe = await ImageManipulator.manipulateAsync(uri, [], {
    format: ImageManipulator.SaveFormat.JPEG,
    base64: false,
  });

  const { width, height } = probe;
  const aspect = width / height;

  // Resize so the *shorter* side = INPUT_SIZE
  let resizeW: number;
  let resizeH: number;
  if (aspect >= 1) {
    resizeH = INPUT_SIZE;
    resizeW = Math.round(INPUT_SIZE * aspect);
  } else {
    resizeW = INPUT_SIZE;
    resizeH = Math.round(INPUT_SIZE / aspect);
  }

  const cropX = Math.floor((resizeW - INPUT_SIZE) / 2);
  const cropY = Math.floor((resizeH - INPUT_SIZE) / 2);

  const result = await ImageManipulator.manipulateAsync(
    uri,
    [
      { resize: { width: resizeW, height: resizeH } },
      {
        crop: {
          originX: cropX,
          originY: cropY,
          width: INPUT_SIZE,
          height: INPUT_SIZE,
        },
      },
    ],
    { format: ImageManipulator.SaveFormat.JPEG, compress: quality },
  );

  // ─── Debug instrumentation ───────────────────────────
  console.log('[Preprocess][Debug] ── preprocessForClassifier ──');
  console.log(`  original uri    = ${uri}`);
  console.log(`  original size   = ${width}×${height}`);
  console.log(`  resized size    = ${resizeW}×${resizeH}`);
  console.log(`  cropX/cropY     = ${cropX}, ${cropY}`);
  console.log(`  final result uri= ${result.uri}`);

  return result.uri;
}
