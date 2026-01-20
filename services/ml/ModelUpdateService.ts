/**
 * ModelUpdateService
 * 
 * Manages automatic model updates from remote server:
 * - Checks for newer model versions
 * - Downloads model + labels files
 * - Verifies integrity via SHA256 checksums
 * - Stores downloaded models in FileSystem
 * - Tracks update frequency to avoid excessive checks
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system';
import { MLModelInfo } from './types';

const MODEL_VERSION_KEY = 'MODEL_VERSION';
const LAST_MODEL_CHECK_KEY = 'LAST_MODEL_CHECK';
const UPDATE_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in ms

interface ModelUpdateConfig {
  baseUrl: string;
  enabled: boolean;
  checkIntervalMs: number;
}

const DEFAULT_CONFIG: ModelUpdateConfig = {
  baseUrl: '', // Set via env or runtime
  enabled: false, // Enable when backend is ready
  checkIntervalMs: UPDATE_CHECK_INTERVAL,
};

class ModelUpdateService {
  private config: ModelUpdateConfig = DEFAULT_CONFIG;
  private modelDir: string;

  constructor() {
    this.modelDir = `${FileSystem.documentDirectory!}ml/`;
  }

  /**
   * Initialize service with configuration
   */
  async initialize(config?: Partial<ModelUpdateConfig>): Promise<void> {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Ensure ml directory exists
    const dirInfo = await FileSystem.getInfoAsync(this.modelDir);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(this.modelDir, { intermediates: true });
      console.log('📁 Created ml directory:', this.modelDir);
    }

    console.log('🔄 ModelUpdateService initialized:', {
      enabled: this.config.enabled,
      baseUrl: this.config.baseUrl || '(not set)',
    });
  }

  /**
   * Check for model updates
   * @param force - Force check even if recently checked
   * @returns Latest model info if update available, null otherwise
   */
  async checkForUpdate(force: boolean = false): Promise<MLModelInfo | null> {
    if (!this.config.enabled || !this.config.baseUrl) {
      console.log('🔄 Model updates disabled or not configured');
      return null;
    }

    // Check if we should skip (recently checked)
    if (!force) {
      const shouldCheck = await this.shouldCheckForUpdate();
      if (!shouldCheck) {
        console.log('⏭️  Skipping update check (recently checked)');
        return null;
      }
    }

    console.log('🔄 Checking for model updates...');

    try {
      // Fetch latest model info from server
      const endpoint = `${this.config.baseUrl}/model/latest`;
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`Update check failed: ${response.status}`);
      }

      const latestInfo: MLModelInfo = await response.json();
      
      // Record check time
      await AsyncStorage.setItem(LAST_MODEL_CHECK_KEY, new Date().toISOString());

      // Compare with current version
      const currentVersion = await this.getCurrentVersion();
      
      if (this.isNewerVersion(latestInfo.version, currentVersion)) {
        console.log(`✨ New model available: ${latestInfo.version} (current: ${currentVersion || 'none'})`);
        return latestInfo;
      }

      console.log(`✅ Model up to date: ${currentVersion}`);
      return null;

    } catch (error) {
      console.error('❌ Update check failed:', error);
      return null;
    }
  }

  /**
   * Download and activate a new model version
   * @param modelInfo - Model information from checkForUpdate
   */
  async downloadAndActivate(modelInfo: MLModelInfo): Promise<void> {
    console.log(`📥 Downloading model ${modelInfo.version}...`);

    try {
      // Download model file
      const modelPath = `${this.modelDir}model_${modelInfo.version}.tflite`;
      const modelDownload = await FileSystem.downloadAsync(
        modelInfo.modelUrl,
        modelPath
      );

      if (modelDownload.status !== 200) {
        throw new Error(`Model download failed: ${modelDownload.status}`);
      }

      // Verify model checksum
      const modelHash = await this.calculateSHA256(modelPath);
      if (modelHash !== modelInfo.sha256Model) {
        await FileSystem.deleteAsync(modelPath, { idempotent: true });
        throw new Error('Model checksum mismatch');
      }

      console.log('✅ Model downloaded and verified');

      // Download labels file
      const labelsPath = `${this.modelDir}labels_${modelInfo.version}.json`;
      const labelsDownload = await FileSystem.downloadAsync(
        modelInfo.labelsUrl,
        labelsPath
      );

      if (labelsDownload.status !== 200) {
        throw new Error(`Labels download failed: ${labelsDownload.status}`);
      }

      // Verify labels checksum
      const labelsHash = await this.calculateSHA256(labelsPath);
      if (labelsHash !== modelInfo.sha256Labels) {
        await FileSystem.deleteAsync(labelsPath, { idempotent: true });
        throw new Error('Labels checksum mismatch');
      }

      console.log('✅ Labels downloaded and verified');

      // Create symlinks for 'current' model
      const currentModelPath = `${this.modelDir}model.tflite`;
      const currentLabelsPath = `${this.modelDir}labels.json`;

      // Remove old symlinks/files
      await FileSystem.deleteAsync(currentModelPath, { idempotent: true });
      await FileSystem.deleteAsync(currentLabelsPath, { idempotent: true });

      // Copy versioned files to current
      await FileSystem.copyAsync({ from: modelPath, to: currentModelPath });
      await FileSystem.copyAsync({ from: labelsPath, to: currentLabelsPath });

      // Update version tracking
      await AsyncStorage.setItem(MODEL_VERSION_KEY, modelInfo.version);

      console.log(`✨ Model ${modelInfo.version} activated successfully`);

      // Clean up old versioned files (keep only latest 2)
      await this.cleanupOldVersions(modelInfo.version);

    } catch (error) {
      console.error('❌ Model download/activation failed:', error);
      throw error;
    }
  }

  /**
   * Get currently installed model version
   */
  async getCurrentVersion(): Promise<string | null> {
    try {
      const version = await AsyncStorage.getItem(MODEL_VERSION_KEY);
      return version;
    } catch (error) {
      console.error('Failed to get current model version:', error);
      return null;
    }
  }

  /**
   * Get paths to current model files
   */
  getCurrentModelPaths(): { modelPath: string; labelsPath: string } {
    return {
      modelPath: `${this.modelDir}model.tflite`,
      labelsPath: `${this.modelDir}labels.json`,
    };
  }

  /**
   * Check if model files exist locally
   */
  async hasLocalModel(): Promise<boolean> {
    const { modelPath, labelsPath } = this.getCurrentModelPaths();
    
    const modelInfo = await FileSystem.getInfoAsync(modelPath);
    const labelsInfo = await FileSystem.getInfoAsync(labelsPath);
    
    return modelInfo.exists && labelsInfo.exists;
  }

  /**
   * Determine if we should check for updates
   */
  private async shouldCheckForUpdate(): Promise<boolean> {
    try {
      const lastCheckStr = await AsyncStorage.getItem(LAST_MODEL_CHECK_KEY);
      if (!lastCheckStr) return true;

      const lastCheck = new Date(lastCheckStr);
      const now = new Date();
      const elapsed = now.getTime() - lastCheck.getTime();

      return elapsed >= this.config.checkIntervalMs;
    } catch (error) {
      return true; // Check on error
    }
  }

  /**
   * Compare version strings (simple semantic versioning)
   */
  private isNewerVersion(newVersion: string, currentVersion: string | null): boolean {
    if (!currentVersion) return true;

    const newParts = newVersion.split('.').map(Number);
    const currentParts = currentVersion.split('.').map(Number);

    for (let i = 0; i < Math.max(newParts.length, currentParts.length); i++) {
      const newPart = newParts[i] || 0;
      const currentPart = currentParts[i] || 0;

      if (newPart > currentPart) return true;
      if (newPart < currentPart) return false;
    }

    return false; // Versions are equal
  }

  /**
   * Calculate SHA256 hash of a file
   */
  private async calculateSHA256(filePath: string): Promise<string> {
      const fileContent = await FileSystem.readAsStringAsync(filePath, {
        encoding: 'base64',
      });    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      fileContent,
      { encoding: Crypto.CryptoEncoding.HEX }
    );

    return hash;
  }

  /**
   * Clean up old model versions (keep latest 2)
   */
  private async cleanupOldVersions(currentVersion: string): Promise<void> {
    try {
      const files = await FileSystem.readDirectoryAsync(this.modelDir);
      
      const versionedFiles = files.filter(f => 
        (f.startsWith('model_') || f.startsWith('labels_')) &&
        !f.includes(currentVersion)
      );

      for (const file of versionedFiles) {
        const filePath = `${this.modelDir}${file}`;
        await FileSystem.deleteAsync(filePath, { idempotent: true });
        console.log(`🗑️  Removed old file: ${file}`);
      }
    } catch (error) {
      console.warn('Failed to cleanup old versions:', error);
    }
  }

  /**
   * Force a full re-download of current version
   */
  async refreshCurrentModel(): Promise<void> {
    const latestInfo = await this.checkForUpdate(true);
    if (latestInfo) {
      await this.downloadAndActivate(latestInfo);
    } else {
      console.log('No update available to refresh');
    }
  }
}

export const modelUpdateService = new ModelUpdateService();
