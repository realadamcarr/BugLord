/**
 * LearningService — persists user identification choices and applies them
 * as score boosts in future scans.
 *
 * Data stored (AsyncStorage key: BUG_ID_LEARNING):
 *   confirmCounts[label]                   — how many times user accepted this label
 *   rejections[originalLabel][chosen]       — how many times user rescanned away from
 *                                             originalLabel and confirmed 'chosen' instead
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'BUG_ID_LEARNING';

interface LearningData {
  confirmCounts: Record<string, number>;
  rejections: Record<string, Record<string, number>>;
}

async function load(): Promise<LearningData> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { confirmCounts: {}, rejections: {} };
    return JSON.parse(raw);
  } catch {
    return { confirmCounts: {}, rejections: {} };
  }
}

async function save(data: LearningData): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // non-critical — ignore write failures
  }
}

/**
 * Record that the user confirmed `confirmedLabel`.
 * If `originalLabel` differs, also record a rejection of the original.
 */
export async function recordConfirmedLabel(
  originalLabel: string,
  confirmedLabel: string,
): Promise<void> {
  const data = await load();

  // Global confirmation boost
  data.confirmCounts[confirmedLabel] = (data.confirmCounts[confirmedLabel] ?? 0) + 1;

  // Rejection signal: user rescanned away from originalLabel
  if (originalLabel !== confirmedLabel) {
    if (!data.rejections[originalLabel]) data.rejections[originalLabel] = {};
    data.rejections[originalLabel][confirmedLabel] =
      (data.rejections[originalLabel][confirmedLabel] ?? 0) + 1;
    console.log(`🧠 Learning: preferred "${confirmedLabel}" over "${originalLabel}"`);
  }

  await save(data);
}

/**
 * Returns a multiplier (>= 1.0) for each candidate label.
 * Labels the user has frequently confirmed get a higher multiplier.
 * If `currentTopLabel` is provided, labels the user has preferred
 * when rescanning from that label get an extra boost.
 */
export async function getCandidateBoosts(
  candidateLabels: string[],
  currentTopLabel?: string,
): Promise<Record<string, number>> {
  const data = await load();
  const boosts: Record<string, number> = {};

  for (const label of candidateLabels) {
    // Base boost from global confirmation history (up to +35%)
    const confirmCount = data.confirmCounts[label] ?? 0;
    let multiplier = 1 + Math.min(confirmCount * 0.07, 0.35);

    // Extra boost if user has previously preferred this label when
    // the current top label was shown (rescan signal — up to +45%)
    if (currentTopLabel && currentTopLabel !== label) {
      const rejCount = data.rejections[currentTopLabel]?.[label] ?? 0;
      multiplier += Math.min(rejCount * 0.15, 0.45);
    }

    boosts[label] = multiplier;
  }

  return boosts;
}

/** Wipe all stored learning data (for debug/reset purposes). */
export async function clearLearningData(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
