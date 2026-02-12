/**
 * useScanStateMachine Hook
 * 
 * React hook wrapping the ScanStateMachine for use in components.
 * Provides reactive state, event dispatching, and cleanup.
 */

import { ScanContext, ScanEvent, ScanStateMachine } from '@/services/ScanStateMachine';
import { useCallback, useEffect, useRef, useState } from 'react';

export interface UseScanStateMachineReturn {
  /** Current state machine context (reactive) */
  ctx: ScanContext;
  /** Dispatch an event to the state machine */
  send: (event: ScanEvent) => void;
  /** Reset state machine to IDLE */
  reset: () => void;
  /** Whether a scan session is active (not IDLE) */
  isActive: boolean;
  /** Whether the machine is in a state that processes frames */
  isProcessingFrames: boolean;
}

export function useScanStateMachine(): UseScanStateMachineReturn {
  const machineRef = useRef<ScanStateMachine>(new ScanStateMachine());
  const [ctx, setCtx] = useState<ScanContext>(() => machineRef.current.getContext());

  useEffect(() => {
    const unsubscribe = machineRef.current.subscribe((newCtx) => {
      setCtx(newCtx);
    });

    return () => {
      unsubscribe();
      machineRef.current.reset();
    };
  }, []);

  const send = useCallback((event: ScanEvent) => {
    machineRef.current.send(event);
  }, []);

  const reset = useCallback(() => {
    machineRef.current.reset();
  }, []);

  const isActive = ctx.state !== 'IDLE';
  const isProcessingFrames = ctx.state === 'SCANNING';

  return { ctx, send, reset, isActive, isProcessingFrames };
}
