/**
 * bugClassifier.ts
 *
 * Thin wrapper around react-native-fast-tflite that ONLY loads the insect
 * classification model and returns raw score arrays.  No heuristics, no
 * enrichment APIs — just the model.
 *
 * Usage:
 *   await loadBugClassifier();
 *   const scores = await classifyBugImage(photoUri);
 *   // scores: { label: string; confidence: number }[]
 */

import { BUG_CLASSIFIER_LABELS, NUM_CLASSES } from './labels';
import { preprocessForClassifier } from './preprocessImage';

// ─── TFLite dynamic import (graceful fallback) ──────────

let loadTensorflowModel: any = null;
try {
  const tflite = require('react-native-fast-tflite');
  loadTensorflowModel = tflite.loadTensorflowModel;
} catch {
  // Expected in Expo Go — will surface via isReady().
}

// ─── Module state ────────────────────────────────────────

let model: any = null;
let modelError: string | null = null;
let loading = false;

// ─── Debug cache (compare consecutive scans) ────────────
let _lastPhotoUri: string | null = null;
let _lastProcessedUri: string | null = null;
let _lastTopScores: string | null = null;   // JSON of top-3 for quick compare

// ─── Public API ──────────────────────────────────────────

/** True when the native TFLite model is loaded and ready for inference. */
export function isClassifierReady(): boolean {
  return model != null;
}

/** Human-readable error when loading failed. */
export function getClassifierError(): string | null {
  return modelError;
}

/**
 * Load the bundled TFLite insect classification model.
 * Safe to call multiple times — subsequent calls are no-ops.
 *
 * @param assetModule  `require('../../assets/ml/model.tflite')`
 *   Passed in by the call-site so Metro can track the asset.
 */
export async function loadBugClassifier(assetModule: number): Promise<void> {
  if (model) return;          // already loaded
  if (loading) return;        // in-flight
  loading = true;

  try {
    if (!loadTensorflowModel) {
      modelError = 'react-native-fast-tflite not available (Expo Go?)';
      console.warn(`[BugClassifier] ${modelError}`);
      return;
    }

    console.log('[BugClassifier] Loading TFLite model from bundled asset…');
    model = await loadTensorflowModel(assetModule);
    modelError = null;
    console.log('[BugClassifier] Model loaded ✓');
    console.log(`  inputs : ${JSON.stringify(model?.inputs)}`);
    console.log(`  outputs: ${JSON.stringify(model?.outputs)}`);
  } catch (err: any) {
    modelError = err?.message ?? String(err);
    model = null;
    console.error('[BugClassifier] Load failed:', modelError);
  } finally {
    loading = false;
  }
}

/**
 * Run the TFLite classifier on an image and return per-class scores.
 *
 * @param photoUri  Any local file:// or content:// URI the device can read.
 * @returns Sorted array (descending confidence) of { label, confidence }.
 *          Empty array when the model is unavailable.
 */
export async function classifyBugImage(
  photoUri: string,
): Promise<{ label: string; confidence: number }[]> {
  if (!model) {
    console.warn('[BugClassifier] classifyBugImage called but model not loaded');
    return [];
  }

  // ── Debug: log incoming URI + compare to previous ──────
  console.log('[BugClassifier][Debug] ── classifyBugImage START ──');
  console.log(`[BugClassifier][Debug] photoUri = ${photoUri}`);
  console.log(`[BugClassifier][Debug] photoUri same as last? ${photoUri === _lastPhotoUri}`);

  // 1. Preprocess — 224×224 center-crop
  const processedUri = await preprocessForClassifier(photoUri);

  console.log(`[BugClassifier][Debug] processedUri = ${processedUri}`);
  console.log(`[BugClassifier][Debug] processedUri same as last? ${processedUri === _lastProcessedUri}`);

  // 2. Read processed image as raw bytes for the model
  const FileSystem = require('expo-file-system/legacy');

  // ── Debug: file size of the processed image ────────────
  try {
    const info = await FileSystem.getInfoAsync(processedUri, { size: true });
    console.log(`[BugClassifier][Debug] processed file size = ${info.size ?? 'unknown'} bytes`);
  } catch {
    console.log('[BugClassifier][Debug] could not read processed file info');
  }
  const base64 = await FileSystem.readAsStringAsync(processedUri, {
    encoding: FileSystem.EncodingType.Base64,
  });

  // Decode base64 → Uint8Array
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.codePointAt(i) ?? 0;
  }

  // Decode JPEG → RGBA, convert to RGB Float32, normalize to [-1, 1]
  const pixelCount = 224 * 224;
  let input: Float32Array;

  console.log('[BugClassifier][Debug] preprocess mode = minus_one_to_one');

  try {
    const jpeg = require('jpeg-js');
    const decoded = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true });
    const rgba = decoded.data as Uint8Array;

    input = new Float32Array(pixelCount * 3);
    // Normalize to [-1, 1]  (MobileNet v2/v3 convention)
    for (let i = 0; i < pixelCount; i++) {
      input[i * 3]     = rgba[i * 4]     / 127.5 - 1; // R
      input[i * 3 + 1] = rgba[i * 4 + 1] / 127.5 - 1; // G
      input[i * 3 + 2] = rgba[i * 4 + 2] / 127.5 - 1; // B
    }
  } catch {
    // If jpeg-js fails, fall back to a mid-grey placeholder (0.0 ≈ 128 in [-1,1])
    console.warn('[BugClassifier] JPEG decode failed, using 0 placeholder');
    input = new Float32Array(pixelCount * 3);
    input.fill(0);
  }

  // ── Debug: tensor stats before inference ───────────────
  let tMin = Infinity;
  let tMax = -Infinity;
  let tSum = 0;
  for (const v of input) {
    if (v < tMin) tMin = v;
    if (v > tMax) tMax = v;
    tSum += v;
  }
  const midStart = Math.floor(input.length / 2) - 6;
  const fmt = (v: number) => v.toFixed(4);
  console.log('[BugClassifier][Debug] Tensor stats:');
  console.log(`  length  = ${input.length}`);
  console.log(`  min     = ${tMin}`);
  console.log(`  max     = ${tMax}`);
  console.log(`  mean    = ${(tSum / input.length).toFixed(6)}`);
  console.log(`  first12 = [${Array.from(input.slice(0, 12)).map(fmt).join(', ')}]`);
  console.log(`  mid12   = [${Array.from(input.slice(midStart, midStart + 12)).map(fmt).join(', ')}]`);
  console.log(`  last12  = [${Array.from(input.slice(-12)).map(fmt).join(', ')}]`);

  // 3. Run inference
  //    react-native-fast-tflite expects a typed array matching the model input.
  const output: any = model.runSync([input]);

  // 4. Parse the output tensor → label/confidence pairs.
  //    Output shape is typically [1, NUM_CLASSES] or [NUM_CLASSES].
  const rawScores = flattenOutput(output);

  // ── Debug: raw output tensor ───────────────────────────
  console.log('[BugClassifier][Debug] Raw output tensor:');
  console.log(`  length    = ${rawScores.length}`);
  console.log(`  first10   = [${rawScores.slice(0, 10).map((v) => v.toFixed(6)).join(', ')}]`);

  // Apply softmax when the model outputs raw logits (values outside [0,1])
  const applySoftmax = needsSoftmax(rawScores);
  const scores = applySoftmax ? softmax(rawScores) : rawScores;
  console.log(`[BugClassifier][Debug] softmax applied? ${applySoftmax}`);

  // ── Debug: per-index score map (BEFORE sorting) ────────
  //    This makes it obvious which output index maps to which label.
  //    Compare against the training script's class_names order.
  const numClasses = Math.min(scores.length, NUM_CLASSES);
  console.log('[BugClassifier][Debug] Score vector by raw index:');
  for (let i = 0; i < numClasses; i++) {
    console.log(`  [${i}] ${BUG_CLASSIFIER_LABELS[i]} = ${scores[i].toFixed(4)}`);
  }

  // Pair each score with its label
  const pairs: { label: string; confidence: number }[] = [];
  for (let i = 0; i < numClasses; i++) {
    pairs.push({ label: BUG_CLASSIFIER_LABELS[i], confidence: scores[i] });
  }

  // Sort descending
  pairs.sort((a, b) => b.confidence - a.confidence);

  const scoreLog = pairs.map((p) => p.label + ' ' + (p.confidence * 100).toFixed(1) + '%').join(', ');
  console.log('[BugClassifier] Scores: ' + scoreLog);

  // ── Debug: cache comparison ────────────────────────────
  const currentTopScores = JSON.stringify(pairs.slice(0, 3).map((p) => [p.label, +p.confidence.toFixed(4)]));
  console.log(`[BugClassifier][Debug] top3 same as last scan? ${currentTopScores === _lastTopScores}`);
  if (_lastTopScores) {
    console.log(`[BugClassifier][Debug]   prev top3 = ${_lastTopScores}`);
    console.log(`[BugClassifier][Debug]   curr top3 = ${currentTopScores}`);
  }

  // Update debug cache
  _lastPhotoUri = photoUri;
  _lastProcessedUri = processedUri;
  _lastTopScores = currentTopScores;

  console.log('[BugClassifier][Debug] ── classifyBugImage END ──');
  return pairs;
}

// ─── Helpers ─────────────────────────────────────────────

/** Flatten nested typed arrays from TFLite output to a plain number[]. */
function flattenOutput(raw: any): number[] {
  if (Array.isArray(raw)) {
    // Could be [[Float32Array]] or [Float32Array] or number[]
    const inner = raw[0];
    if (inner && typeof inner[Symbol.iterator] === 'function') {
      return Array.from(inner as Iterable<number>);
    }
    return raw as number[];
  }
  if (raw && typeof raw[Symbol.iterator] === 'function') {
    return Array.from(raw as Iterable<number>);
  }
  return [];
}

/** Heuristic: if any value is outside [0,1] or if they don't sum to ~1. */
function needsSoftmax(scores: number[]): boolean {
  if (scores.length === 0) return false;
  const hasNeg = scores.some((s) => s < 0);
  const hasAbove1 = scores.some((s) => s > 1.05);
  if (hasNeg || hasAbove1) return true;
  const sum = scores.reduce((a, b) => a + b, 0);
  return Math.abs(sum - 1) > 0.2;
}

function softmax(logits: number[]): number[] {
  const max = Math.max(...logits);
  const exps = logits.map((l) => Math.exp(l - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}
