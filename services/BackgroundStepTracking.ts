/**
 * Background Step Tracking
 *
 * Uses expo-task-manager + expo-background-fetch to periodically wake the app
 * while it is fully closed and query the OS pedometer for steps taken since
 * the last check.  Accumulated steps are written to AsyncStorage so that
 * WalkModeService can merge them on next foreground resume.
 *
 * IMPORTANT: TaskManager.defineTask() must be called at the **module top level**
 * (outside any component/function) so that the task is registered before the
 * app renders.  This file is imported from app/_layout.tsx to guarantee that.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import { Pedometer } from 'expo-sensors';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

// ─── Constants ──────────────────────────────────────────────────────────────

export const BACKGROUND_STEP_TASK_NAME = 'background-step-tracking';

/** AsyncStorage key where background-accumulated step data is stored. */
export const BG_STEP_DATA_KEY = 'bg_step_tracking_data';

/** AsyncStorage key for the walk mode state (same one WalkModeService uses). */
const WALK_MODE_STORAGE_KEY = 'walk_mode_data';

/** Minimum interval between background fetch executions (seconds).
 *  Android/iOS impose their own minimums (~15 min).  We ask for 15 min. */
const FETCH_INTERVAL_SEC = 15 * 60;

// ─── Background-accumulated data shape ──────────────────────────────────────

export interface BgStepData {
  /** Steps accumulated by background fetches since the app was last in foreground. */
  accumulatedSteps: number;
  /** ISO timestamp of the last successful background pedometer query. */
  lastQueryTimestamp: string;
}

// ─── Helper: read / write BgStepData ────────────────────────────────────────

export async function readBgStepData(): Promise<BgStepData | null> {
  try {
    const raw = await AsyncStorage.getItem(BG_STEP_DATA_KEY);
    return raw ? (JSON.parse(raw) as BgStepData) : null;
  } catch {
    return null;
  }
}

export async function writeBgStepData(data: BgStepData): Promise<void> {
  try {
    await AsyncStorage.setItem(BG_STEP_DATA_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('[BgStep] Failed to write bg step data:', e);
  }
}

export async function clearBgStepData(): Promise<void> {
  try {
    await AsyncStorage.removeItem(BG_STEP_DATA_KEY);
  } catch {
    // best-effort
  }
}

// ─── Define the background task (top level!) ────────────────────────────────
if (!TaskManager.isTaskDefined(BACKGROUND_STEP_TASK_NAME)) {
  TaskManager.defineTask(BACKGROUND_STEP_TASK_NAME, async () => {
    try {
    // 1. Check if walk mode is active; if not, no work to do.
    const walkRaw = await AsyncStorage.getItem(WALK_MODE_STORAGE_KEY);
    if (!walkRaw) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }
    const walkState = JSON.parse(walkRaw);
    if (!walkState.isActive) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // 2. Determine the time window to query.
    const now = new Date();
    let fromDate: Date;

    const bgData = await readBgStepData();
    if (bgData?.lastQueryTimestamp) {
      fromDate = new Date(bgData.lastQueryTimestamp);
    } else {
      // Fall back to the last update timestamp from the walk mode state.
      fromDate = new Date(walkState.lastUpdateTimestamp || now.getTime() - 30 * 60 * 1000);
    }

    // Safety: clamp window to maximum 7 days
    const maxWindow = 7 * 24 * 60 * 60 * 1000;
    if (now.getTime() - fromDate.getTime() > maxWindow) {
      fromDate = new Date(now.getTime() - maxWindow);
    }

    // If window is too short (< 30 s), skip.
    if (now.getTime() - fromDate.getTime() < 30_000) {
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // 3. Query the OS pedometer for historical steps.
    //    Works on both iOS (CoreMotion/HealthKit) and Android
    //    (TYPE_STEP_COUNTER sensor via expo-sensors ≥ SDK 44).
    let steps = 0;
    try {
      const result = await Pedometer.getStepCountAsync(fromDate, now);
      steps = result?.steps ?? 0;
    } catch {
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }

    if (steps <= 0) {
      // Still update the timestamp so the next invocation starts from now.
      await writeBgStepData({
        accumulatedSteps: bgData?.accumulatedSteps ?? 0,
        lastQueryTimestamp: now.toISOString(),
      });
      return BackgroundFetch.BackgroundFetchResult.NoData;
    }

    // 4. Accumulate steps.
    const prevAccumulated = bgData?.accumulatedSteps ?? 0;
    await writeBgStepData({
      accumulatedSteps: prevAccumulated + steps,
      lastQueryTimestamp: now.toISOString(),
    });

    console.log(`[BgStep] Accumulated ${steps} steps (total bg: ${prevAccumulated + steps})`);
    return BackgroundFetch.BackgroundFetchResult.NewData;
    } catch (e) {
      console.warn('[BgStep] Background task error:', e);
      return BackgroundFetch.BackgroundFetchResult.Failed;
    }
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Register the background fetch task with the OS.
 * Call this when walk mode is started.
 */
export async function registerBackgroundStepTracking(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const status = await BackgroundFetch.getStatusAsync();
    if (
      status === BackgroundFetch.BackgroundFetchStatus.Denied ||
      status === BackgroundFetch.BackgroundFetchStatus.Restricted
    ) {
      console.warn('[BgStep] Background fetch unavailable on this device:', status);
      return;
    }

    // Check if already registered
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_STEP_TASK_NAME);
    if (isRegistered) {
      console.log('[BgStep] Background step task already registered');
      return;
    }

    await BackgroundFetch.registerTaskAsync(BACKGROUND_STEP_TASK_NAME, {
      minimumInterval: FETCH_INTERVAL_SEC,
      stopOnTerminate: false,   // Keep running after app is killed
      startOnBoot: true,        // Re-register after device reboot
    });

    // Seed the bg step data with current timestamp
    const existing = await readBgStepData();
    if (!existing) {
      await writeBgStepData({
        accumulatedSteps: 0,
        lastQueryTimestamp: new Date().toISOString(),
      });
    }

    console.log('[BgStep] Background step tracking registered');
  } catch (e) {
    console.warn('[BgStep] Failed to register background step tracking:', e);
  }
}

/**
 * Unregister the background fetch task.
 * Call this when walk mode is stopped.
 */
export async function unregisterBackgroundStepTracking(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const isRegistered = await TaskManager.isTaskRegisteredAsync(BACKGROUND_STEP_TASK_NAME);
    if (isRegistered) {
      await BackgroundFetch.unregisterTaskAsync(BACKGROUND_STEP_TASK_NAME);
      console.log('[BgStep] Background step tracking unregistered');
    }
    await clearBgStepData();
  } catch (e) {
    console.warn('[BgStep] Failed to unregister background step tracking:', e);
  }
}

/**
 * Consume any steps accumulated by background fetches.
 * Returns the number of steps and clears the accumulator.
 * Call this from WalkModeService when the app returns to foreground.
 */
export async function consumeBackgroundSteps(): Promise<number> {
  try {
    const data = await readBgStepData();
    if (!data || data.accumulatedSteps <= 0) return 0;

    const steps = data.accumulatedSteps;

    // Reset accumulator but keep timestamp
    await writeBgStepData({
      accumulatedSteps: 0,
      lastQueryTimestamp: data.lastQueryTimestamp,
    });

    console.log(`[BgStep] Consumed ${steps} background-accumulated steps`);
    return steps;
  } catch {
    return 0;
  }
}

/**
 * Restore background step tracking after app startup if walk mode is active.
 * Safe to call repeatedly.
 */
export async function restoreBackgroundStepTrackingIfNeeded(): Promise<void> {
  if (Platform.OS === 'web') return;

  try {
    const walkRaw = await AsyncStorage.getItem(WALK_MODE_STORAGE_KEY);
    if (!walkRaw) return;

    const walkState = JSON.parse(walkRaw);
    if (walkState?.isActive) {
      await registerBackgroundStepTracking();
    }
  } catch (e) {
    console.warn('[BgStep] Failed to restore background step tracking:', e);
  }
}
