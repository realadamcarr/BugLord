import { ConfirmationMethod, IdentificationCandidate } from '@/types/Bug';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'SCAN_LOGS';

export interface ScanLogEntry {
  id: string;
  imageUri?: string;
  capturedAt: string;
  provider: string;
  candidates: IdentificationCandidate[];
  confirmedLabel?: string;
  confirmationMethod?: ConfirmationMethod;
  meta?: Record<string, any>;
}

const genId = () => 'scan_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);

export async function appendScanLog(entry: Omit<ScanLogEntry, 'id' | 'capturedAt'> & { capturedAt?: string }): Promise<void> {
  const logs = await getScanLogs();
  const toSave: ScanLogEntry = {
    id: genId(),
    capturedAt: entry.capturedAt || new Date().toISOString(),
    imageUri: entry.imageUri,
    provider: entry.provider,
    candidates: entry.candidates,
    confirmedLabel: entry.confirmedLabel,
    confirmationMethod: entry.confirmationMethod,
    meta: entry.meta,
  };
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([toSave, ...logs].slice(0, 200)));
}

export async function getScanLogs(): Promise<ScanLogEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export async function clearScanLogs(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEY);
}
