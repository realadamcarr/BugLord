/**
 * Native Step History Service
 *
 * Platform-specific historical step queries that work even when the app
 * was fully killed.
 *
 * - Android: Uses Health Connect (system health service records steps
 *   independently of any app).
 * - iOS: Uses Apple HealthKit (M-series coprocessor / CoreMotion data
 *   is stored in HealthKit and queryable at any time).
 * - Other: Returns 0 (web / unsupported).
 */

import { Platform } from 'react-native';

// ─── Android – Health Connect ────────────────────────────────────────────────

let _hcInitialized = false;

/**
 * Check if the react-native-health-connect native module is available.
 * Returns false if the module isn't linked or throws on require().
 */
function isHealthConnectModuleAvailable(): boolean {
  try {
    const mod = require('react-native-health-connect');
    // The module must have an initialize function to be usable
    return typeof mod.initialize === 'function';
  } catch {
    return false;
  }
}

async function initHealthConnect(): Promise<boolean> {
  if (_hcInitialized) return true;
  if (!isHealthConnectModuleAvailable()) return false;
  try {
    const { initialize } = require('react-native-health-connect');
    const ok = await initialize();
    _hcInitialized = ok;
    return ok;
  } catch (e) {
    console.warn('[NativeStepHistory] Health Connect init failed:', e);
    return false;
  }
}

async function hasAndroidStepsPermission(): Promise<boolean> {
  try {
    if (!(await initHealthConnect())) return false;
    const mod = require('react-native-health-connect');
    if (typeof mod.getGrantedPermissions !== 'function') return false;
    const granted = await mod.getGrantedPermissions();
    return Array.isArray(granted) && granted.some(
      (p: any) => p.accessType === 'read' && p.recordType === 'Steps',
    );
  } catch {
    return false;
  }
}

async function requestAndroidPermissions(): Promise<boolean> {
  try {
    if (!(await initHealthConnect())) return false;
    // Check if already granted — avoids calling requestPermission which
    // can crash natively if the Activity's result launcher hasn't been
    // registered yet (lateinit property requestPermission).
    if (await hasAndroidStepsPermission()) return true;
    const mod = require('react-native-health-connect');
    if (typeof mod.requestPermission !== 'function') return false;
    const granted = await mod.requestPermission([
      { accessType: 'read', recordType: 'Steps' },
    ]);
    return granted.length > 0;
  } catch (e) {
    console.warn('[NativeStepHistory] Android permission request failed:', e);
    return false;
  }
}

/**
 * Total steps between two dates, or null if Health Connect couldn't be read
 * (not installed, permission not granted, query error). Uses aggregateRecord
 * so steps written by several apps (e.g. Samsung Health + Google Fit) are
 * de-duplicated by Health Connect instead of being summed twice.
 */
async function queryAndroidSteps(from: Date, to: Date): Promise<number | null> {
  try {
    if (!(await initHealthConnect())) return null;
    if (!(await hasAndroidStepsPermission())) return null;
    const mod = require('react-native-health-connect');
    if (typeof mod.aggregateRecord !== 'function') return null;
    const result = await mod.aggregateRecord({
      recordType: 'Steps',
      timeRangeFilter: {
        operator: 'between',
        startTime: from.toISOString(),
        endTime: to.toISOString(),
      },
    });
    return typeof result?.COUNT_TOTAL === 'number' ? result.COUNT_TOTAL : 0;
  } catch (e) {
    console.warn('[NativeStepHistory] Android step query failed:', e);
    return null;
  }
}

// ─── iOS – HealthKit ─────────────────────────────────────────────────────────

async function requestIOSPermissions(): Promise<boolean> {
  try {
    const Healthkit = require('@kingstinct/react-native-healthkit');
    const ok = await Healthkit.requestAuthorization(
      ['HKQuantityTypeIdentifierStepCount'], // read
      [],                                     // write (none needed)
    );
    return ok;
  } catch (e) {
    console.warn('[NativeStepHistory] HealthKit permission request failed:', e);
    return false;
  }
}

async function queryIOSSteps(from: Date, to: Date): Promise<number | null> {
  try {
    const Healthkit = require('@kingstinct/react-native-healthkit');
    const samples: { quantity: number }[] =
      await Healthkit.queryQuantitySamples(
        'HKQuantityTypeIdentifierStepCount',
        {
          limit: -1, // all samples
          ascending: false,
          filter: {
            date: {
              startDate: from,
              endDate: to,
            },
          },
          unit: 'count',
        },
      );
    return samples.reduce((sum, s) => sum + s.quantity, 0);
  } catch (e) {
    console.warn('[NativeStepHistory] HealthKit step query failed:', e);
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Check whether the native health platform is available and can provide steps.
 * Returns 'available', 'needs_permission' (Android: installed but step read
 * access not granted yet), 'unavailable', or 'not_installed'.
 * On Android, Health Connect must be installed (built-in on Android 14+).
 */
export type NativeStepStatus = 'available' | 'needs_permission' | 'unavailable' | 'not_installed';

export async function getNativeStepStatus(): Promise<NativeStepStatus> {
  if (Platform.OS === 'android') {
    if (!isHealthConnectModuleAvailable()) return 'unavailable';
    try {
      // Try initializing — this is safer than getSdkStatus which can
      // crash natively on devices without Health Connect installed.
      const ok = await initHealthConnect();
      if (!ok) return 'not_installed';
      return (await hasAndroidStepsPermission()) ? 'available' : 'needs_permission';
    } catch {
      return 'not_installed';
    }
  }
  if (Platform.OS === 'ios') {
    try {
      const Healthkit = require('@kingstinct/react-native-healthkit');
      const avail = await Healthkit.isHealthDataAvailable();
      return avail ? 'available' : 'unavailable';
    } catch {
      return 'unavailable';
    }
  }
  return 'unavailable';
}

/**
 * Request read-only step permissions from the native health platform.
 * Returns `true` when permissions were granted (or the platform is unsupported
 * and we'll gracefully return 0 later).
 */
export async function requestNativeStepPermissions(): Promise<boolean> {
  if (Platform.OS === 'android') return requestAndroidPermissions();
  if (Platform.OS === 'ios') return requestIOSPermissions();
  return true; // nothing to request on web
}

/**
 * Query historical step count between two dates using the device's native
 * health data store. Works even if the app was fully killed in the interim.
 * Returns null when the store couldn't be read, so callers can tell
 * "no steps" apart from "don't know yet".
 */
export async function queryNativeStepHistory(
  from: Date,
  to: Date,
): Promise<number | null> {
  if (Platform.OS === 'android') return queryAndroidSteps(from, to);
  if (Platform.OS === 'ios') return queryIOSSteps(from, to);
  return null;
}
