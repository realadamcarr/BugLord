// ML Service Types
export interface MLCandidate {
  label: string;
  confidence: number;
  /** Where this prediction came from: real TFLite inference or a stub fallback */
  source?: 'tflite' | 'tflite-yolov5' | 'stub';
  /** Optional bounding box from YOLOv5 detection output */
  bbox?: { x: number; y: number; w: number; h: number };
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

// Object Detection Types
export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
  confidence?: number;
  class?: string;
}

export interface DetectionResult {
  boxes: BoundingBox[];
  inferenceTime?: number;
  confidenceThreshold?: number;
}

export interface DetectionModelConfig {
  modelPath: string;
  labelsPath?: string;
  inputSize: number; // e.g., 300 or 320 for SSD
  confidenceThreshold: number;
  maxDetections: number;
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

// (duplicate detection types removed — see definitions above)
