// ML Service Types
export interface MLCandidate {
  label: string;
  confidence: number;
}

export interface MLModelInfo {
  version: string;
  modelUrl: string;
  labelsUrl: string;
  sha256Model: string;
  sha256Labels: string;
  releaseDate: string;
  minAppVersion?: string;
}

export interface MLClassifierConfig {
  modelPath: string;
  labelsPath: string;
  inputSize: number; // e.g., 224 or 320
  topK: number;
  confidenceThreshold: number;
}

export interface PreprocessingConfig {
  targetSize: number;
  quality: number;
  format: 'jpeg' | 'png';
  normalize?: boolean;
}

export interface LabeledSample {
  imageUri: string;
  confirmedLabel: string;
  predictedCandidates: MLCandidate[];
  modelVersionUsed: string;
  capturedAt: string;
  cropInfo?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface UploadQueueItem extends LabeledSample {
  id: string;
  uploadAttempts: number;
  lastAttempt?: string;
  status: 'pending' | 'uploading' | 'failed' | 'success';
}
