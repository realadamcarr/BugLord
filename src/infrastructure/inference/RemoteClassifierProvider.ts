import { predictInsect, type PredictionResult } from '../../../services/BackendPredictionService';
import type {
  ClassificationResult,
  PreparedImage,
  RankedClassification,
} from '../../domain/classification/ClassificationResult';
import type { ClassifierProvider } from './ClassifierProvider';

const MIN_REMOTE_CONFIDENCE = 0.15;

function rankedFromRemote(result: PredictionResult): RankedClassification[] {
  return result.topPredictions.map((prediction) => ({
    displayLabel: prediction.commonName
      || (prediction.mappedBuglordType
        ? prediction.mappedBuglordType.charAt(0).toUpperCase() + prediction.mappedBuglordType.slice(1)
        : prediction.speciesName),
    confidence: prediction.confidence,
    category: prediction.mappedBuglordType,
    speciesName: prediction.speciesName || null,
    commonName: prediction.commonName || null,
  }));
}

export function mapRemoteResult(result: PredictionResult): ClassificationResult {
  const noInsect = result.message?.includes('No insect detected') ?? false;
  const ranked = rankedFromRemote(result);
  const mainAccepted = !noInsect && result.confidence >= MIN_REMOTE_CONFIDENCE;
  const rankedAccepted = !noInsect && ranked.some((item) => item.confidence >= MIN_REMOTE_CONFIDENCE);
  const best = mainAccepted
    ? null
    : ranked.find((item) => item.category && item.confidence >= MIN_REMOTE_CONFIDENCE)
      ?? ranked.find((item) => item.confidence >= MIN_REMOTE_CONFIDENCE)
      ?? null;
  const displayLabel = mainAccepted
    ? result.commonName || result.displayLabel || result.speciesName || 'Unknown Bug'
    : best?.displayLabel ?? 'Unknown Bug';

  const primary: RankedClassification = {
    displayLabel,
    confidence: mainAccepted ? result.confidence : best?.confidence ?? 0,
    category: mainAccepted && result.spriteType !== 'unknown-bug'
      ? result.spriteType
      : best?.category ?? null,
    speciesName: mainAccepted ? result.speciesName || null : best?.speciesName ?? null,
    commonName: mainAccepted ? result.commonName || null : best?.commonName ?? null,
  };
  const rankedPredictions = (mainAccepted || best)
    ? [primary, ...ranked.filter((item) => item.displayLabel !== displayLabel)].slice(0, 6)
    : ranked.slice(0, 5);

  return {
    provider: 'remote',
    speciesName: primary.speciesName,
    scientificName: mainAccepted ? result.scientificName || null : null,
    commonName: primary.commonName,
    confidence: primary.confidence,
    category: primary.category,
    displayLabel,
    isInPrimaryCollection: primary.category !== null,
    inaturalistPhotoUrl: result.raw?.inatPhotoUrl,
    rankedPredictions,
    accepted: mainAccepted || rankedAccepted,
    lowConfidence: result.lowConfidence || (!mainAccepted && !rankedAccepted),
    failureReason: noInsect ? 'no_insect' : mainAccepted || rankedAccepted ? undefined : 'low_confidence',
    message: result.message,
  };
}

export class RemoteClassifierProvider implements ClassifierProvider {
  readonly id = 'remote' as const;

  async classify(image: PreparedImage): Promise<ClassificationResult> {
    return mapRemoteResult(await predictInsect(image.uri));
  }
}
