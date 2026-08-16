// Classifier labels for the bundled BugLord TFLite model.
// These must match the model's output order exactly.

/*
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║  CRITICAL — LABEL ORDER VERIFICATION                           ║
 * ║                                                                ║
 * ║  This array MUST exactly match the `class_names` order used    ║
 * ║  when the TFLite model was trained / exported.                 ║
 * ║                                                                ║
 * ║  If you retrain or re-export model.tflite, open the training   ║
 * ║  script / notebook and find the order of class_names (or       ║
 * ║  dataset.class_names in tf.keras.utils.image_dataset_from_     ║
 * ║  directory). Then update this array to match that order         ║
 * ║  EXACTLY, index-for-index.                                     ║
 * ║                                                                ║
 * ║  A mismatch here means the model's output[i] is paired with   ║
 * ║  the WRONG label, producing confident but wrong predictions.   ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

/** Labels the bundled buglord_insect_classifier.tflite was trained on. */
export const BUG_CLASSIFIER_LABELS = [
  'bee',        // index 0
  'butterfly',  // index 1
  'beetle',     // index 2
  'fly',        // index 3
  'spider',     // index 4
  'ant',        // index 5
] as const;

export type BugClassLabel = (typeof BUG_CLASSIFIER_LABELS)[number];

/** Number of classes the model outputs. */
export const NUM_CLASSES = BUG_CLASSIFIER_LABELS.length;
