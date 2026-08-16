import { ClassificationService } from '../src/application/classification/ClassificationService';
import type { ClassificationResult, PreparedImage } from '../src/domain/classification/ClassificationResult';
import type { ClassifierProvider } from '../src/infrastructure/inference/ClassifierProvider';
import { mapLocalScores } from '../src/infrastructure/inference/LocalClassifierProvider';
import { mapRemoteResult } from '../src/infrastructure/inference/RemoteClassifierProvider';
import type { SpeciesMetadataProvider } from '../src/infrastructure/metadata/SpeciesMetadataProvider';

const image: PreparedImage = { uri: 'file:///bug.jpg', originalUri: 'file:///bug.jpg', cropped: false };

function result(provider: ClassificationResult['provider'], label: string): ClassificationResult {
  return {
    provider,
    speciesName: provider === 'remote' ? label : null,
    scientificName: null,
    commonName: null,
    confidence: 0.9,
    category: 'bee',
    displayLabel: label,
    isInPrimaryCollection: true,
    rankedPredictions: [{
      displayLabel: label,
      confidence: 0.9,
      category: 'bee',
      speciesName: provider === 'remote' ? label : null,
      commonName: null,
    }],
    accepted: true,
    lowConfidence: false,
  };
}

function provider(id: ClassifierProvider['id'], implementation: () => Promise<ClassificationResult>): ClassifierProvider {
  return { id, classify: implementation };
}

const metadata: SpeciesMetadataProvider = { getSuggestions: async () => [] };

describe('classification boundary', () => {
  test('maps a remote backend response into the canonical result', () => {
    const mapped = mapRemoteResult({
      spriteType: 'butterfly',
      speciesName: 'Danaus plexippus',
      scientificName: 'Danaus plexippus',
      confidence: 0.92,
      isInPrimaryCollection: true,
      displayLabel: 'Monarch Butterfly',
      commonName: 'Monarch Butterfly',
      lowConfidence: false,
      raw: null,
      topPredictions: [],
    });

    expect(mapped.provider).toBe('remote');
    expect(mapped.displayLabel).toBe('Monarch Butterfly');
    expect(mapped.category).toBe('butterfly');
    expect(mapped.accepted).toBe(true);
  });

  test('maps six-class scores without fabricating species information', () => {
    const mapped = mapLocalScores([
      { label: 'bee', confidence: 0.9 },
      { label: 'fly', confidence: 0.05 },
    ]).result;

    expect(mapped.provider).toBe('local');
    expect(mapped.category).toBe('bee');
    expect(mapped.speciesName).toBeNull();
    expect(mapped.accepted).toBe(true);
  });

  test('falls back when the preferred provider throws', async () => {
    const service = new ClassificationService(
      provider('remote', async () => { throw new Error('offline'); }),
      provider('local', async () => result('local', 'Honey Bee')),
      provider('fallback', async () => result('fallback', 'Fallback Bee')),
      metadata,
    );

    const outcome = await service.classify(image);
    expect(outcome.status).toBe('classified');
    expect(outcome.result?.provider).toBe('local');
    expect(outcome.attemptedProviders).toEqual(['remote', 'local']);
  });

  test('returns a failure state when every provider fails', async () => {
    const failing = (id: ClassifierProvider['id']) => provider(id, async () => { throw new Error(`${id} failed`); });
    const service = new ClassificationService(failing('remote'), failing('local'), failing('fallback'), metadata);

    const outcome = await service.classify(image);
    expect(outcome.status).toBe('failed');
    expect(outcome.result).toBeUndefined();
  });

  test('callers depend only on canonical fields, not provider implementation details', async () => {
    const service = new ClassificationService(
      provider('remote', async () => result('remote', 'Honey Bee')),
      provider('local', async () => result('local', 'Bee')),
      provider('fallback', async () => result('fallback', 'Fallback Bee')),
      metadata,
    );

    const outcome = await service.classify(image);
    const screenView = outcome.result && {
      label: outcome.result.displayLabel,
      confidence: outcome.result.confidence,
      category: outcome.result.category,
    };
    expect(screenView).toEqual({ label: 'Honey Bee', confidence: 0.9, category: 'bee' });
  });
});
