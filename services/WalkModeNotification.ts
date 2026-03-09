/**
 * Walk Mode Notification Service
 *
 * Shows a persistent/ongoing Android notification while walk mode is active.
 * This serves two purposes:
 *  1. UX — the user sees that BugLord is still tracking their steps.
 *  2. Process priority — Android is far less likely to kill an app that has
 *     an active notification, keeping the pedometer subscription alive longer.
 *
 * On iOS the notification is scheduled normally (no "ongoing" concept).
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// ─── Constants ──────────────────────────────────────────────────────────────

const WALK_CHANNEL_ID = 'walk-mode';
const WALK_NOTIFICATION_ID = 'walk-mode-active';

// ─── Channel Setup (Android) ────────────────────────────────────────────────

let channelReady = false;

async function ensureChannel(): Promise<void> {
  if (channelReady || Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(WALK_CHANNEL_ID, {
      name: 'Walk Mode',
      importance: Notifications.AndroidImportance.LOW, // no sound, just persistent
      description: 'Shows while Walk Mode is tracking your steps',
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      enableVibrate: false,
      enableLights: false,
    });
    channelReady = true;
  } catch (e) {
    console.warn('[WalkNotif] Failed to create notification channel:', e);
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Request notification permissions (call once, e.g. on walk mode start).
 * Returns true if granted.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === 'granted') return true;
    const { status } = await Notifications.requestPermissionsAsync();
    return status === 'granted';
  } catch {
    return false;
  }
}

/**
 * Show (or update) the persistent walk mode notification.
 * @param bugName  Name of the bug being trained (shown in the notification body).
 * @param steps    Current session step count.
 */
export async function showWalkModeNotification(
  bugName: string | null,
  steps: number,
): Promise<void> {
  try {
    await ensureChannel();

    // Dismiss any existing walk notification before re-posting
    await Notifications.dismissNotificationAsync(WALK_NOTIFICATION_ID).catch(() => {});

    await Notifications.scheduleNotificationAsync({
      identifier: WALK_NOTIFICATION_ID,
      content: {
        title: '🚶 Walk Mode Active',
        body: bugName
          ? `Training ${bugName} — ${steps.toLocaleString()} steps`
          : `${steps.toLocaleString()} steps tracked`,
        sticky: true,                    // Android: cannot be swiped away
        autoDismiss: false,
        ...(Platform.OS === 'android' && {
          channelId: WALK_CHANNEL_ID,
          priority: Notifications.AndroidNotificationPriority.LOW,
        }),
      },
      trigger: null, // show immediately
    });
  } catch (e) {
    console.warn('[WalkNotif] Failed to show notification:', e);
  }
}

/**
 * Update the step count on the walk mode notification without re-creating it.
 * Falls through to a full re-post if the lightweight update fails.
 */
export async function updateWalkModeNotification(
  bugName: string | null,
  steps: number,
): Promise<void> {
  // expo-notifications doesn't support in-place updates; re-schedule with same ID
  await showWalkModeNotification(bugName, steps);
}

/**
 * Dismiss the walk mode notification (call when walk mode stops).
 */
export async function dismissWalkModeNotification(): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(WALK_NOTIFICATION_ID);
  } catch {
    // best effort
  }
}

/**
 * Show a one-time notification when a bug levels up during walk mode.
 * Uses the default notification channel so it plays a sound/vibration.
 */
export async function showLevelUpNotification(
  bugName: string,
  newLevel: number,
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: '🎉 Level Up!',
        body: `${bugName} grew to Level ${newLevel} while walking!`,
        sound: true,
        ...(Platform.OS === 'android' && {
          priority: Notifications.AndroidNotificationPriority.HIGH,
        }),
      },
      trigger: null, // show immediately
    });
  } catch (e) {
    console.warn('[WalkNotif] Failed to show level-up notification:', e);
  }
}
