import type {
  ClassificationProviderId,
  ClassificationResult,
  PreparedImage,
} from '../../domain/classification/ClassificationResult';

export interface ClassifierProvider {
  readonly id: ClassificationProviderId;
  classify(image: PreparedImage): Promise<ClassificationResult>;
}

export class ClassifierUnavailableError extends Error {
  constructor(provider: ClassificationProviderId) {
    super(`${provider} classifier is unavailable`);
    this.name = 'ClassifierUnavailableError';
  }
}
