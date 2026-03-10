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

async function initHealthConnect(): Promise<boolean> {
  if (_hcInitialized) return true;
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

async function requestAndroidPermissions(): Promise<boolean> {
  try {
    if (!(await initHealthConnect())) return false;
    const { requestPermission } = require('react-native-health-connect');
    const granted = await requestPermission([
      { accessType: 'read', recordType: 'Steps' },
    ]);
    return granted.length > 0;
  } catch (e) {
    console.warn('[NativeStepHistory] Android permission request failed:', e);
    return false;
  }
}

async function queryAndroidSteps(from: Date, to: Date): Promise<number> {
  try {
    if (!(await initHealthConnect())) return 0;
    const { readRecords } = require('react-native-health-connect');
    const result = await readRecords('Steps', {
      timeRangeFilter: {
        operator: 'between',
        startTime: from.toISOString(),
        endTime: to.toISOString(),
      },
    });
    return (result.records as { count: number }[]).reduce(
      (sum: number, r: { count: number }) => sum + r.count,
      0,
    );
  } catch (e) {
    console.warn('[NativeStepHistory] Android step query failed:', e);
    return 0;
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

async function queryIOSSteps(from: Date, to: Date): Promise<number> {
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
    return 0;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

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
 */
export async function queryNativeStepHistory(
  from: Date,
  to: Date,
): Promise<number> {
  if (Platform.OS === 'android') return queryAndroidSteps(from, to);
  if (Platform.OS === 'ios') return queryIOSSteps(from, to);
  return 0;
}
