import type { BugCategory } from '../../../constants/bugSprites';

export type ClassificationProviderId = 'remote' | 'local' | 'fallback';
export type ClassificationFailureReason =
  | 'no_insect'
  | 'low_confidence'
  | 'low_margin'
  | 'unavailable'
  | 'error';

export interface PreparedImage {
  uri: string;
  originalUri: string;
  cropped: boolean;
}

export interface RankedClassification {
  displayLabel: string;
  confidence: number;
  category: BugCategory | null;
  speciesName: string | null;
  commonName: string | null;
}

export interface ClassificationResult {
  provider: ClassificationProviderId;
  speciesName: string | null;
  scientificName: string | null;
  commonName: string | null;
  confidence: number;
  category: BugCategory | null;
  displayLabel: string;
  isInPrimaryCollection: boolean;
  inaturalistPhotoUrl?: string;
  rankedPredictions: RankedClassification[];
  accepted: boolean;
  lowConfidence: boolean;
  failureReason?: ClassificationFailureReason;
  message?: string;
}
