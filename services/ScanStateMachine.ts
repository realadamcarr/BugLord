/**
 * Scan State Machine
 * 
 * Manages the live-scan capture flow for BugLord.
 * Processes camera frames through ML classification and locks on
 * when a bug is detected with sufficient confidence across
 * multiple consecutive frames.
 * 
 * States: IDLE → SCANNING → LOCKED → IDENTIFYING → CONFIRMED
 *                                                   ↓
 *                                                 ERROR
 */

import { IdentificationCandidate } from '@/types/Bug';

// ─── State & Event Types ────────────────────────────────────

export type ScanState =
  | 'IDLE'
  | 'SCANNING'
  | 'LOCKED'
  | 'IDENTIFYING'
  | 'CONFIRMED'
  | 'ERROR';

export type ScanEvent =
  | { type: 'START' }
  | { type: 'FRAME_RESULT'; label: string; confidence: number; candidates: IdentificationCandidate[] }
  | { type: 'NO_DETECTION' }
  | { type: 'LOCK_EXPIRED' }
  | { type: 'CONFIRM_CAPTURE'; frameUri: string }
  | { type: 'IDENTIFICATION_DONE'; result: { candidates: IdentificationCandidate[]; provider: string; isFromAPI: boolean } }
  | { type: 'CANCEL' }
  | { type: 'ERROR'; error: string }
  | { type: 'RETRY' };

export interface ScanContext {
  state: ScanState;
  // Detection tracking
  currentLabel: string | null;
  currentConfidence: number;
  candidates: IdentificationCandidate[];
  consecutiveDetections: number;
  lockStartTime: number | null;
  // Result
  identificationResult: {
    candidates: IdentificationCandidate[];
    provider: string;
    isFromAPI: boolean;
  } | null;
  capturedFrameUri: string | null;
  // Error
  errorMessage: string | null;
}

// ─── Configuration ──────────────────────────────────────────

export const SCAN_CONFIG = {
  /** Minimum confidence to consider a detection valid */
  LOCK_THRESHOLD: 0.50,
  /** Number of consecutive frames with same label before locking */
  CONSECUTIVE_FRAMES_TO_LOCK: 3,
  /** Auto-unlock after this many ms if user doesn't confirm */
  LOCK_TIMEOUT_MS: 5000,
  /** Interval between frame captures (ms) — ~2.5 FPS */
  FRAME_INTERVAL_MS: 400,
  /** Quality for frame snapshots (low for speed) */
  FRAME_QUALITY: 0.3,
  /** Quality for final capture photo (high for storage) */
  CAPTURE_QUALITY: 0.85,
} as const;

// ─── Initial Context ────────────────────────────────────────

const INITIAL_CONTEXT: ScanContext = {
  state: 'IDLE',
  currentLabel: null,
  currentConfidence: 0,
  candidates: [],
  consecutiveDetections: 0,
  lockStartTime: null,
  identificationResult: null,
  capturedFrameUri: null,
  errorMessage: null,
};

// ─── State Machine ──────────────────────────────────────────

export class ScanStateMachine {
  private ctx: ScanContext = { ...INITIAL_CONTEXT };
  private listeners: ((ctx: ScanContext) => void)[] = [];
  private lockTimer: ReturnType<typeof setTimeout> | null = null;

  /** Get a read-only snapshot of the current context */
  getContext(): Readonly<ScanContext> {
    return { ...this.ctx };
  }

  /** Subscribe to context changes. Returns an unsubscribe function. */
  subscribe(listener: (ctx: ScanContext) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(): void {
    const snapshot = { ...this.ctx };
    this.listeners.forEach(l => l(snapshot));
  }

  /** Send an event to the state machine, triggering a transition */
  send(event: ScanEvent): void {
    const prev = this.ctx.state;

    switch (this.ctx.state) {
      // ─── IDLE ─────────────────────────────────────────
      case 'IDLE':
        if (event.type === 'START') {
          this.ctx = { ...INITIAL_CONTEXT, state: 'SCANNING' };
        }
        break;

      // ─── SCANNING ─────────────────────────────────────
      case 'SCANNING':
        if (event.type === 'FRAME_RESULT') {
          this.handleFrameResult(event);
        } else if (event.type === 'NO_DETECTION') {
          // Reset consecutive counter on empty frame
          this.ctx.consecutiveDetections = 0;
        } else if (event.type === 'CANCEL') {
          this.ctx = { ...INITIAL_CONTEXT };
        } else if (event.type === 'ERROR') {
          this.transitionToError(event.error);
        }
        break;

      // ─── LOCKED ───────────────────────────────────────
      case 'LOCKED':
        if (event.type === 'CONFIRM_CAPTURE') {
          this.clearLockTimer();
          this.ctx.state = 'IDENTIFYING';
          this.ctx.capturedFrameUri = event.frameUri;
        } else if (event.type === 'LOCK_EXPIRED' || event.type === 'CANCEL') {
          this.clearLockTimer();
          this.ctx.state = 'SCANNING';
          this.ctx.consecutiveDetections = 0;
          this.ctx.lockStartTime = null;
        } else if (event.type === 'NO_DETECTION') {
          // Lost the bug from view — unlock
          this.clearLockTimer();
          this.ctx.state = 'SCANNING';
          this.ctx.consecutiveDetections = 0;
          this.ctx.currentLabel = null;
          this.ctx.currentConfidence = 0;
        } else if (event.type === 'FRAME_RESULT') {
          // While locked, keep updating confidence but stay locked
          if (event.label === this.ctx.currentLabel && event.confidence >= SCAN_CONFIG.LOCK_THRESHOLD) {
            this.ctx.currentConfidence = event.confidence;
            this.ctx.candidates = event.candidates;
          }
        }
        break;

      // ─── IDENTIFYING ─────────────────────────────────
      case 'IDENTIFYING':
        if (event.type === 'IDENTIFICATION_DONE') {
          this.ctx.state = 'CONFIRMED';
          this.ctx.identificationResult = event.result;
        } else if (event.type === 'ERROR') {
          this.transitionToError(event.error);
        } else if (event.type === 'CANCEL') {
          // Cancel identification and go back to scanning
          this.ctx.state = 'SCANNING';
          this.ctx.consecutiveDetections = 0;
          this.ctx.capturedFrameUri = null;
        }
        break;

      // ─── CONFIRMED ────────────────────────────────────
      case 'CONFIRMED':
        if (event.type === 'CANCEL' || event.type === 'START') {
          // User dismissed or wants to scan again
          this.ctx = { ...INITIAL_CONTEXT, state: event.type === 'START' ? 'SCANNING' : 'IDLE' };
        }
        break;

      // ─── ERROR ────────────────────────────────────────
      case 'ERROR':
        if (event.type === 'RETRY') {
          this.ctx = { ...INITIAL_CONTEXT, state: 'SCANNING' };
        } else if (event.type === 'CANCEL') {
          this.ctx = { ...INITIAL_CONTEXT };
        }
        break;
    }

    if (this.ctx.state !== prev) {
      console.log(`🔄 Scan: ${prev} → ${this.ctx.state}`);
    }
    this.emit();
  }

  /**
   * Handle a frame result during SCANNING state.
   * Tracks consecutive detections of the same label and
   * transitions to LOCKED once the threshold is met.
   */
  private handleFrameResult(event: Extract<ScanEvent, { type: 'FRAME_RESULT' }>): void {
    const { label, confidence, candidates } = event;

    if (confidence < SCAN_CONFIG.LOCK_THRESHOLD) {
      // Below threshold — reset streak
      this.ctx.consecutiveDetections = 0;
      this.ctx.currentLabel = null;
      this.ctx.currentConfidence = 0;
      return;
    }

    if (label === this.ctx.currentLabel) {
      // Same label — extend streak
      this.ctx.consecutiveDetections++;
    } else {
      // Different label — start new streak
      this.ctx.currentLabel = label;
      this.ctx.consecutiveDetections = 1;
    }

    this.ctx.currentConfidence = confidence;
    this.ctx.candidates = candidates;

    // Lock after enough consecutive detections
    if (this.ctx.consecutiveDetections >= SCAN_CONFIG.CONSECUTIVE_FRAMES_TO_LOCK) {
      this.ctx.state = 'LOCKED';
      this.ctx.lockStartTime = Date.now();
      this.startLockTimer();
      console.log(`🔒 Locked on: ${label} (${Math.round(confidence * 100)}%)`);
    }
  }

  private transitionToError(error: string): void {
    this.clearLockTimer();
    this.ctx.state = 'ERROR';
    this.ctx.errorMessage = error;
  }

  private startLockTimer(): void {
    this.clearLockTimer();
    this.lockTimer = setTimeout(() => {
      this.send({ type: 'LOCK_EXPIRED' });
    }, SCAN_CONFIG.LOCK_TIMEOUT_MS);
  }

  private clearLockTimer(): void {
    if (this.lockTimer) {
      clearTimeout(this.lockTimer);
      this.lockTimer = null;
    }
  }

  /** Reset the machine to IDLE, clearing all timers */
  reset(): void {
    this.clearLockTimer();
    this.ctx = { ...INITIAL_CONTEXT };
    this.emit();
  }
}
