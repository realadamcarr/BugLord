// Shared type for an honest bug prediction from the offline classifier.

import { BugClassLabel } from '../ml/labels';

export type BroadBugClass = BugClassLabel | 'unknown';

/** Structured rejection reasons for prediction gating. */
export type RejectionReason = 'low_confidence' | 'low_margin';

export interface BugPrediction {
  /** Always "offline-model" — the only source that actually classifies an image. */
  source: 'offline-model';
  /** Broad class from the TFLite model, or "unknown" if rejected. */
  broadClass: BroadBugClass;
  /** Top confidence score (0–1). */
  confidence: number;
  /** Full score distribution from the model. */
  scores: { label: string; confidence: number }[];
  /** Whether the prediction passed the confidence threshold. */
  accepted: boolean;
  /** Human-readable reason when rejected. */
  reason?: string;
  /** Machine-readable rejection reason for programmatic checks. */
  rejectionReason?: RejectionReason;
}

/** Result returned by {@link evaluatePrediction}. */
export interface PredictionEvaluation {
  topLabel: string | null;
  topConfidence: number;
  secondConfidence: number;
  margin: number;
  accepted: boolean;
  rejectionReason?: RejectionReason;
}

// ─── Acceptance thresholds ───────────────────────────────

/** Minimum confidence to accept a prediction. */
export const MIN_CONFIDENCE = 0.7;

/** Minimum gap between the top-2 predictions to be decisive. */
export const MIN_TOP2_GAP = 0.15;

/**
 * Evaluate raw classifier scores against acceptance thresholds.
 *
 * Rules:
 *   - top1 >= 0.70 AND (top1 - top2) >= 0.15 → accepted
 *   - otherwise rejected with a specific reason
 */
export function evaluatePrediction(
  scores: { label: string; confidence: number }[],
): PredictionEvaluation {
  if (scores.length === 0) {
    return {
      topLabel: null,
      topConfidence: 0,
      secondConfidence: 0,
      margin: 0,
      accepted: false,
      rejectionReason: 'low_confidence',
    };
  }

  const sorted = [...scores].sort((a, b) => b.confidence - a.confidence);
  const top1 = sorted[0];
  const top2 = sorted[1];
  const secondConfidence = top2?.confidence ?? 0;
  const margin = top1.confidence - secondConfidence;

  if (top1.confidence < MIN_CONFIDENCE) {
    return {
      topLabel: top1.label,
      topConfidence: top1.confidence,
      secondConfidence,
      margin,
      accepted: false,
      rejectionReason: 'low_confidence',
    };
  }

  if (margin < MIN_TOP2_GAP) {
    return {
      topLabel: top1.label,
      topConfidence: top1.confidence,
      secondConfidence,
      margin,
      accepted: false,
      rejectionReason: 'low_margin',
    };
  }

  return {
    topLabel: top1.label,
    topConfidence: top1.confidence,
    secondConfidence,
    margin,
    accepted: true,
  };
}

/** Build a BugPrediction from raw model scores. */
export function buildPrediction(
  scores: { label: string; confidence: number }[],
): BugPrediction {
  const evaluation = evaluatePrediction(scores);

  if (scores.length === 0) {
    return {
      source: 'offline-model',
      broadClass: 'unknown',
      confidence: 0,
      scores: [],
      accepted: false,
      reason: 'No model output.',
      rejectionReason: 'low_confidence',
    };
  }

  const sorted = [...scores].sort((a, b) => b.confidence - a.confidence);

  if (!evaluation.accepted) {
    const reasonText =
      evaluation.rejectionReason === 'low_confidence'
        ? `Low confidence (${(evaluation.topConfidence * 100).toFixed(0)}% < ${MIN_CONFIDENCE * 100}% threshold).`
        : `Top two predictions too close (${sorted[0].label} ${(evaluation.topConfidence * 100).toFixed(0)}% vs ${sorted[1]?.label ?? '?'} ${(evaluation.secondConfidence * 100).toFixed(0)}%, margin ${(evaluation.margin * 100).toFixed(0)}% < ${MIN_TOP2_GAP * 100}%).`;

    return {
      source: 'offline-model',
      broadClass: 'unknown',
      confidence: evaluation.topConfidence,
      scores: sorted,
      accepted: false,
      reason: reasonText,
      rejectionReason: evaluation.rejectionReason,
    };
  }

  return {
    source: 'offline-model',
    broadClass: evaluation.topLabel as BroadBugClass,
    confidence: evaluation.topConfidence,
    scores: sorted,
    accepted: true,
  };
}
