import { classifyBugImage, isClassifierReady } from '../../ml/bugClassifier';
import { buildPrediction, type BugPrediction } from '../../types/bugPrediction';
import type {
  ClassificationResult,
  PreparedImage,
} from '../../domain/classification/ClassificationResult';
import { ClassifierUnavailableError, type ClassifierProvider } from './ClassifierProvider';
import { categoryFor, displayLabelFor } from './classificationLabels';

export function mapLocalScores(scores: { label: string; confidence: number }[]): {
  result: ClassificationResult;
  prediction: BugPrediction;
} {
  const prediction = buildPrediction(scores);
  const rankedPredictions = prediction.scores.slice(0, 5).map((score) => ({
    displayLabel: displayLabelFor(score.label),
    confidence: score.confidence,
    category: categoryFor(score.label),
    speciesName: null,
    commonName: null,
  }));
  const top = rankedPredictions[0];

  return {
    prediction,
    result: {
      provider: 'local',
      speciesName: null,
      scientificName: null,
      commonName: null,
      confidence: prediction.confidence,
      category: prediction.accepted ? categoryFor(prediction.broadClass) : top?.category ?? null,
      displayLabel: prediction.accepted
        ? displayLabelFor(prediction.broadClass)
        : top?.displayLabel ?? 'Unknown Bug',
      isInPrimaryCollection: prediction.accepted && categoryFor(prediction.broadClass) !== null,
      rankedPredictions,
      accepted: prediction.accepted,
      lowConfidence: !prediction.accepted,
      failureReason: prediction.rejectionReason,
      message: prediction.reason,
    },
  };
}

export class LocalClassifierProvider implements ClassifierProvider {
  readonly id = 'local' as const;

  async classify(image: PreparedImage): Promise<ClassificationResult> {
    if (!isClassifierReady()) throw new ClassifierUnavailableError(this.id);
    return mapLocalScores(await classifyBugImage(image.uri)).result;
  }
}
