import { bugIdentificationService } from '../../../services/BugIdentificationService';
import { mlPreprocessingService } from '../../../services/ml/MLPreprocessingService';
import { onDeviceClassifier } from '../../../services/ml/OnDeviceClassifier';
import type {
  ClassificationResult,
  PreparedImage,
  RankedClassification,
} from '../../domain/classification/ClassificationResult';
import { ClassifierUnavailableError, type ClassifierProvider } from './ClassifierProvider';
import { categoryFor, displayLabelFor } from './classificationLabels';

function toResult(rankedPredictions: RankedClassification[]): ClassificationResult {
  const top = rankedPredictions[0];
  return {
    provider: 'fallback',
    speciesName: top?.speciesName ?? null,
    scientificName: null,
    commonName: top?.commonName ?? null,
    confidence: top?.confidence ?? 0,
    category: top?.category ?? null,
    displayLabel: top?.displayLabel ?? 'Unknown Bug',
    isInPrimaryCollection: top?.category !== null && top?.category !== undefined,
    rankedPredictions,
    accepted: rankedPredictions.length > 0,
    lowConfidence: rankedPredictions.length === 0,
    failureReason: rankedPredictions.length > 0 ? undefined : 'unavailable',
  };
}

export class LegacyClassifierProvider implements ClassifierProvider {
  readonly id = 'fallback' as const;

  async classify(image: PreparedImage): Promise<ClassificationResult> {
    let localCandidates: RankedClassification[] = [];
    let localHint: string | undefined;

    if (onDeviceClassifier.isReady()) {
      try {
        const input = await mlPreprocessingService.preprocessForInference(image.uri, {
          targetSize: 224,
          quality: 0.9,
        });
        const candidates = await onDeviceClassifier.classifyImage(input, 5);
        localHint = candidates.find((candidate) => candidate.source !== 'stub')?.label;
        localCandidates = candidates
          .filter((candidate) => candidate.source !== 'stub')
          .map((candidate) => ({
            displayLabel: displayLabelFor(candidate.label),
            confidence: candidate.confidence,
            category: categoryFor(candidate.label),
            speciesName: null,
            commonName: null,
          }));
      } catch (error) {
        console.warn('[Classification] Legacy TFLite provider failed:', error);
      }
    }

    let metadataCandidates: RankedClassification[] = [];
    try {
      let identification = localHint
        ? await bugIdentificationService.identifyWithINaturalistQuery(localHint)
        : await bugIdentificationService.identify(image.uri);
      if (!identification?.candidates?.length && localHint) {
        identification = await bugIdentificationService.identify(image.uri);
      }
      metadataCandidates = (identification?.candidates ?? []).map((candidate) => ({
        displayLabel: displayLabelFor(candidate.label || candidate.species || 'Unknown Bug'),
        confidence: candidate.confidence ?? 0,
        category: candidate.category ?? categoryFor(candidate.label),
        speciesName: candidate.species ?? null,
        commonName: candidate.label || null,
      }));
    } catch (error) {
      console.warn('[Classification] Legacy iNaturalist fallback failed:', error);
    }

    const localTopConfidence = localCandidates[0]?.confidence ?? 0;
    const primary = localCandidates.length > 0 && metadataCandidates.length > 0
      ? localTopConfidence >= 0.4
        ? [...localCandidates, ...metadataCandidates]
        : [...metadataCandidates, ...localCandidates]
      : localCandidates.length > 0 ? localCandidates : metadataCandidates;
    const seen = new Set<string>();
    const ranked = primary.filter((candidate) => {
      if (seen.has(candidate.displayLabel)) return false;
      seen.add(candidate.displayLabel);
      return true;
    }).slice(0, 10);

    if (ranked.length === 0) throw new ClassifierUnavailableError(this.id);
    return toResult(ranked);
  }
}
