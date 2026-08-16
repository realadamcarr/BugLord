import type { BugPrediction } from '../../types/bugPrediction';
import { buildPrediction } from '../../types/bugPrediction';
import type { GbifSpeciesSuggestion } from '../../services/gbifService';
import type {
  ClassificationProviderId,
  ClassificationResult,
  PreparedImage,
} from '../../domain/classification/ClassificationResult';
import type { ClassifierProvider } from '../../infrastructure/inference/ClassifierProvider';
import type { SpeciesMetadataProvider } from '../../infrastructure/metadata/SpeciesMetadataProvider';

export interface ConfirmedClassification {
  label: string;
  confidence: number;
  provider: 'remote' | 'local';
}

export interface ClassificationOutcome {
  status: 'classified' | 'rejected' | 'failed';
  result?: ClassificationResult;
  prediction: BugPrediction | null;
  metadataSuggestions: GbifSpeciesSuggestion[];
  attemptedProviders: ClassificationProviderId[];
  error?: string;
}

function predictionFor(result: ClassificationResult): BugPrediction | null {
  if (result.provider !== 'local') return null;
  return buildPrediction(result.rankedPredictions.map((item) => ({
    label: item.category ?? item.displayLabel,
    confidence: item.confidence,
  })));
}

function confirmedResult(confirmed: ConfirmedClassification): ClassificationResult {
  return {
    provider: confirmed.provider,
    speciesName: confirmed.provider === 'remote' ? confirmed.label : null,
    scientificName: null,
    commonName: confirmed.provider === 'remote' ? confirmed.label : null,
    confidence: confirmed.confidence,
    category: null,
    displayLabel: confirmed.label,
    isInPrimaryCollection: false,
    rankedPredictions: [{
      displayLabel: confirmed.label,
      confidence: confirmed.confidence,
      category: null,
      speciesName: confirmed.provider === 'remote' ? confirmed.label : null,
      commonName: confirmed.provider === 'remote' ? confirmed.label : null,
    }],
    accepted: true,
    lowConfidence: false,
  };
}

export class ClassificationService {
  constructor(
    private readonly remote: ClassifierProvider,
    private readonly local: ClassifierProvider,
    private readonly fallback: ClassifierProvider,
    private readonly metadata: SpeciesMetadataProvider,
  ) {}

  async classify(
    image: PreparedImage,
    confirmed?: ConfirmedClassification,
  ): Promise<ClassificationOutcome> {
    const attemptedProviders: ClassificationProviderId[] = [];
    let remoteRejectedNoInsect = false;

    if (confirmed?.provider === 'remote') {
      return this.success(confirmedResult(confirmed), attemptedProviders);
    }

    attemptedProviders.push(this.remote.id);
    try {
      const result = await this.remote.classify(image);
      if (result.accepted) return this.success(result, attemptedProviders);
      remoteRejectedNoInsect = result.failureReason === 'no_insect';
    } catch (error) {
      console.warn('[Classification] Remote provider unavailable; trying local:', error);
    }

    if (confirmed) return this.success(confirmedResult(confirmed), attemptedProviders);

    attemptedProviders.push(this.local.id);
    try {
      const result = await this.local.classify(image);
      if (remoteRejectedNoInsect) {
        return {
          status: 'rejected',
          result,
          prediction: predictionFor(result),
          metadataSuggestions: [],
          attemptedProviders,
          error: 'No insect detected',
        };
      }
      const metadataSuggestions = result.accepted && result.category
        ? await this.safeMetadataLookup(result.category)
        : [];
      return this.success(result, attemptedProviders, metadataSuggestions);
    } catch (error) {
      console.warn('[Classification] Local provider unavailable; trying legacy fallback:', error);
    }

    attemptedProviders.push(this.fallback.id);
    try {
      const result = await this.fallback.classify(image);
      if (remoteRejectedNoInsect) {
        return {
          status: 'rejected', result, prediction: null, metadataSuggestions: [],
          attemptedProviders, error: 'No insect detected',
        };
      }
      return this.success(result, attemptedProviders);
    } catch (error) {
      return {
        status: 'failed', prediction: null, metadataSuggestions: [], attemptedProviders,
        error: error instanceof Error ? error.message : 'Classification failed',
      };
    }
  }

  async classifyLive(image: PreparedImage): Promise<ClassificationOutcome> {
    const attemptedProviders: ClassificationProviderId[] = [this.remote.id];
    try {
      const remote = await this.remote.classify(image);
      if (remote.accepted) return this.success(remote, attemptedProviders);
      return {
        status: 'rejected', result: remote, prediction: null,
        metadataSuggestions: [], attemptedProviders, error: remote.message,
      };
    } catch (error) {
      console.warn('[Classification] Remote live scan failed; trying local:', error);
    }

    for (const provider of [this.local, this.fallback]) {
      attemptedProviders.push(provider.id);
      try {
        const result = await provider.classify(image);
        if (result.rankedPredictions.length > 0) return this.success(result, attemptedProviders);
      } catch (error) {
        console.warn(`[Classification] ${provider.id} live provider failed:`, error);
      }
    }

    const unknown = confirmedResult({ label: 'Unknown Bug', confidence: 0.15, provider: 'local' });
    unknown.provider = 'fallback';
    return this.success(unknown, attemptedProviders);
  }

  private success(
    result: ClassificationResult,
    attemptedProviders: ClassificationProviderId[],
    metadataSuggestions: GbifSpeciesSuggestion[] = [],
  ): ClassificationOutcome {
    return {
      status: 'classified', result, prediction: predictionFor(result),
      metadataSuggestions, attemptedProviders,
    };
  }

  private async safeMetadataLookup(category: NonNullable<ClassificationResult['category']>) {
    try {
      return await this.metadata.getSuggestions(category);
    } catch (error) {
      console.warn('[Classification] Species metadata enrichment failed (non-fatal):', error);
      return [];
    }
  }
}
