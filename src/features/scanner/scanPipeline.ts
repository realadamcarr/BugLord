/**
 * scanPipeline.ts
 *
 * Orchestrates the honest bug-scan flow:
 *
 *  1. Run offline TFLite classifier → BugPrediction
 *  2. If the prediction is accepted (≥ 65 %, decisive gap),
 *     fire a GBIF enrichment query for taxonomy context.
 *  3. Return a ScanResult that the UI can render honestly.
 *
 * Rules:
 *  - GBIF is ENRICHMENT ONLY. It never reclassifies the image.
 *  - If the model is unavailable or the prediction is rejected,
 *    the UI must say so — no secret fallback to color analysis.
 */

import { classifyBugImage, isClassifierReady } from '../../ml/bugClassifier';
import { GbifSpeciesSuggestion, getSpeciesSuggestionsForBugType } from '../../services/gbifService';
import { BugPrediction, buildPrediction, evaluatePrediction } from '../../types/bugPrediction';

// ─── Public types ────────────────────────────────────────

export interface ScanResult {
  /** Output of the offline TFLite model. */
  prediction: BugPrediction;
  /** GBIF species suggestions (empty when prediction is rejected). */
  gbifSuggestions: GbifSpeciesSuggestion[];
  /** Timestamps for honest logging. */
  timing: {
    classifyMs: number;
    gbifMs: number;
    totalMs: number;
  };
}

// ─── Pipeline ────────────────────────────────────────────

/**
 * Run the full scan pipeline on a photo.
 *
 * @param photoUri  Local URI (file://, content://) of the image to scan.
 * @returns A {@link ScanResult} the UI can render directly.
 */
export async function runBugScanPipeline(photoUri: string): Promise<ScanResult> {
  const t0 = Date.now();

  // ── Step 1: Offline classifier ─────────────────────────
  let prediction: BugPrediction;
  const classifyStart = Date.now();

  if (isClassifierReady()) {
    try {
      const scores = await classifyBugImage(photoUri);
      const evaluation = evaluatePrediction(scores);
      prediction = buildPrediction(scores);

      console.log('[ScanPipeline] Evaluation detail:');
      console.log(`  topLabel        = ${evaluation.topLabel}`);
      console.log(`  topConfidence   = ${(evaluation.topConfidence * 100).toFixed(1)}%`);
      console.log(`  secondConfidence= ${(evaluation.secondConfidence * 100).toFixed(1)}%`);
      console.log(`  margin          = ${(evaluation.margin * 100).toFixed(1)}%`);
      console.log(`  accepted        = ${evaluation.accepted}`);
      if (evaluation.rejectionReason) {
        console.log(`  rejectionReason = ${evaluation.rejectionReason}`);
      }
    } catch (err: any) {
      console.error('[ScanPipeline] Classification error:', err);
      prediction = buildPrediction([]);
      prediction.reason = `Classification error: ${err?.message ?? err}`;
    }
  } else {
    console.log('[ScanPipeline] Classifier not ready — returning empty prediction');
    prediction = buildPrediction([]);
    prediction.reason = 'Offline classifier not loaded. Build with EAS dev-client to enable TFLite.';
  }

  const classifyMs = Date.now() - classifyStart;

  console.log(
    `[ScanPipeline] Prediction: ${prediction.broadClass} ` +
    `(${(prediction.confidence * 100).toFixed(1)}%) accepted=${prediction.accepted}` +
    (prediction.reason ? ` reason="${prediction.reason}"` : ''),
  );

  // ── Step 2: GBIF enrichment (only if accepted) ────────
  let gbifSuggestions: GbifSpeciesSuggestion[] = [];
  const gbifStart = Date.now();

  if (prediction.accepted && prediction.broadClass !== 'unknown') {
    try {
      gbifSuggestions = await getSpeciesSuggestionsForBugType(prediction.broadClass);
      console.log(`[ScanPipeline] GBIF returned ${gbifSuggestions.length} suggestions`);
    } catch (err) {
      console.warn('[ScanPipeline] GBIF enrichment failed (non-fatal):', err);
    }
  } else {
    console.log('[ScanPipeline] GBIF skipped — prediction rejected or unknown');
  }

  const gbifMs = Date.now() - gbifStart;
  const totalMs = Date.now() - t0;

  console.log(`[ScanPipeline] Done in ${totalMs} ms (classify ${classifyMs} ms, GBIF ${gbifMs} ms)`);

  return {
    prediction,
    gbifSuggestions,
    timing: { classifyMs, gbifMs, totalMs },
  };
}
