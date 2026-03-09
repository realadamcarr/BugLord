/**
 * Backend Prediction Service
 *
 * Uploads a captured insect photo to the FastAPI backend and returns
 * a structured result the app can use for sprite rendering, display
 * labels, and collection logic.
 */

import { BugCategory } from '@/constants/bugSprites';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Base URL of the FastAPI backend. Change for production / staging. */
// const API_BASE_URL = 'http://10.0.2.2:8000'; // Android emulator → host
// const API_BASE_URL = 'http://localhost:8000';  // iOS simulator / web
// const API_BASE_URL = 'http://10.59.130.194:8000'; // Physical device → PC Wi-Fi IP
// const API_BASE_URL = 'https://api.buglord.app'; // Production HTTPS (needs domain + cert)
const API_BASE_URL = 'http://37.27.8.1'; // Hetzner VPS via Nginx

const PREDICT_ENDPOINT = `${API_BASE_URL}/api/predict`;

/** Request timeout in milliseconds. */
const TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape of `prediction` in the backend JSON response. */
export interface BackendPrediction {
  speciesName: string;
  scientificName: string;
  confidence: number;
  mappedBuglordType: BugCategory | null;
  isInPrimaryCollection: boolean;
  fallbackCategory: string;
  displayLabel: string;
}

/** Full JSON envelope returned by POST /api/predict. */
interface BackendResponse {
  success: boolean;
  prediction: BackendPrediction | null;
  topPredictions?: {
    speciesName: string;
    confidence: number;
    mappedBuglordType: BugCategory | null;
  }[];
  lowConfidence?: boolean;
  message?: string;
}

/** Normalised result consumed by the rest of the app. */
export interface PredictionResult {
  /** Sprite category to render — one of the 6 types or 'unknown-bug'. */
  spriteType: BugCategory | 'unknown-bug';
  /** Human-readable species name for display. */
  speciesName: string;
  /** Scientific (binomial) name, may be empty. */
  scientificName: string;
  /** Model confidence 0–1. */
  confidence: number;
  /** Whether the species maps to one of the 6 primary BugLord types. */
  isInPrimaryCollection: boolean;
  /** Backend display label (e.g. "Butterfly" or "Unknown Bug"). */
  displayLabel: string;
  /** True when confidence is 0.35–0.59 — model is uncertain. */
  lowConfidence: boolean;
  /** Optional message from the backend (e.g. "Uncertain scan"). */
  message?: string;
  /** Raw backend prediction for advanced / debug usage. */
  raw: BackendPrediction | null;
  /** Top-N predictions from backend for runner-up display. */
  topPredictions: { speciesName: string; confidence: number; mappedBuglordType: BugCategory | null }[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a `FormData` payload from a local image URI (file:// or content://).
 *
 * React Native's `fetch` / `XMLHttpRequest` handles the `uri` field
 * specially — it streams the file without loading it fully into JS memory.
 */
function buildFormData(imageUri: string): FormData {
  const filename = imageUri.split('/').pop() ?? 'photo.jpg';
  const ext = filename.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    webp: 'image/webp',
  };
  const mime = mimeTypes[ext] ?? 'image/jpeg';

  const form = new FormData();
  form.append('file', {
    uri: imageUri,
    name: filename,
    type: mime,
  } as unknown as Blob); // RN FormData accepts {uri, name, type}

  return form;
}

/**
 * Wrap `fetch` with an `AbortController` timeout.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number = TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Upload an image to the BugLord FastAPI backend and return a normalised
 * prediction result.
 *
 * @param imageUri  Local file URI (e.g. from expo-camera or expo-image-picker).
 * @returns         Parsed prediction with sprite type resolved.
 * @throws          On network errors, timeouts, or non-200 responses.
 *
 * @example
 * ```ts
 * const result = await predictInsect(photo.uri);
 * console.log(result.spriteType);   // "butterfly"
 * console.log(result.speciesName);  // "Monarch Butterfly"
 * console.log(result.confidence);   // 0.92
 * ```
 */
export async function predictInsect(imageUri: string): Promise<PredictionResult> {
  // ── 1. Build multipart payload ──────────────────────────────────────
  const form = buildFormData(imageUri);

  // ── 2. POST to backend ─────────────────────────────────────────────
  let response: Response;
  try {
    response = await fetchWithTimeout(PREDICT_ENDPOINT, {
      method: 'POST',
      body: form,
      // Let fetch set Content-Type with the multipart boundary automatically
    });
  } catch (error: unknown) {
    // React Native doesn't have DOMException — detect abort by name/message.
    const isAbort =
      (error instanceof Error && error.name === 'AbortError') ||
      (typeof error === 'object' && error !== null && (error as any).name === 'AbortError');
    if (isAbort) {
      throw new Error('Prediction request timed out — is the backend running?');
    }
    throw new Error(
      `Network error contacting prediction backend: ${
        error instanceof Error ? error.message : 'unknown error'
      }`,
    );
  }

  // ── 3. Handle HTTP errors ──────────────────────────────────────────
  if (!response.ok) {
    let detail = `HTTP ${response.status}`;
    try {
      const body = await response.json();
      if (body?.detail) detail += `: ${body.detail}`;
    } catch {
      // non-JSON error body — keep the status code message
    }
    throw new Error(`Prediction failed — ${detail}`);
  }

  // ── 4. Parse JSON ──────────────────────────────────────────────────
  const data: BackendResponse = await response.json();

  // Backend returns success=false for very low confidence (< 0.35).
  // We still return a result with confidence 0 so callers can decide.
  const pred = data.prediction ?? null;

  // ── 5. Resolve sprite type ─────────────────────────────────────────
  const spriteType: BugCategory | 'unknown-bug' =
    pred?.mappedBuglordType ?? 'unknown-bug';

  return {
    spriteType,
    speciesName: pred?.speciesName ?? 'Unknown',
    scientificName: pred?.scientificName ?? '',
    confidence: pred?.confidence ?? 0,
    isInPrimaryCollection: pred?.isInPrimaryCollection ?? false,
    displayLabel: pred?.displayLabel ?? 'Unknown Bug',
    lowConfidence: data.lowConfidence ?? false,
    message: data.message,
    raw: pred,
    topPredictions: data.topPredictions ?? [],
  };
}
