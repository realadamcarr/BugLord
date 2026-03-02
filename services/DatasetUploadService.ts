/**
 * DatasetUploadService
 * 
 * Manages upload of labeled insect samples to external training dataset.
 * Implements:
 * - Queue management for offline/online scenarios
 * - Retry logic for failed uploads
 * - AsyncStorage persistence of upload queue
 * - Network status awareness
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { LabeledSample, UploadQueueItem } from './ml/types';

const UPLOAD_QUEUE_KEY = 'UPLOAD_QUEUE';
const UPLOAD_CONFIG_KEY = 'UPLOAD_CONFIG';

interface UploadConfig {
  baseUrl: string;
  maxRetries: number;
  enabled: boolean;
}

const DEFAULT_CONFIG: UploadConfig = {
  baseUrl: '', // Set via env or runtime config
  maxRetries: 3,
  enabled: false, // Enable when backend is ready
};

class DatasetUploadService {
  private config: UploadConfig = DEFAULT_CONFIG;
  private isUploading: boolean = false;

  /**
   * Initialize service and load config
   */
  async initialize(config?: Partial<UploadConfig>): Promise<void> {
    // Load saved config
    try {
      const savedConfig = await AsyncStorage.getItem(UPLOAD_CONFIG_KEY);
      if (savedConfig) {
        this.config = { ...DEFAULT_CONFIG, ...JSON.parse(savedConfig) };
      }
    } catch (error) {
      console.warn('Failed to load upload config:', error);
    }

    // Apply runtime config overrides
    if (config) {
      this.config = { ...this.config, ...config };
      await this.saveConfig();
    }

    console.log('📤 DatasetUploadService initialized:', {
      enabled: this.config.enabled,
      baseUrl: this.config.baseUrl || '(not set)',
    });
  }

  /**
   * Update configuration
   */
  async setConfig(config: Partial<UploadConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    await this.saveConfig();
  }

  private async saveConfig(): Promise<void> {
    try {
      await AsyncStorage.setItem(UPLOAD_CONFIG_KEY, JSON.stringify(this.config));
    } catch (error) {
      console.error('Failed to save upload config:', error);
    }
  }

  /**
   * Queue a labeled sample for upload
   * @param sample - Labeled sample to queue
   */
  async queueUpload(sample: LabeledSample): Promise<void> {
    if (!this.config.enabled) {
      console.log('📤 Upload disabled, skipping queue');
      return;
    }

    console.log('📤 Queuing sample for upload:', sample.confirmedLabel);

    try {
      const queue = await this.getQueue();
      
      const queueItem: UploadQueueItem = {
        ...sample,
        id: `upload_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        uploadAttempts: 0,
        status: 'pending',
      };

      queue.push(queueItem);
      await this.saveQueue(queue);

      console.log(`✅ Queued (${queue.length} pending)`);

      // Try immediate upload if online
      this.processQueue().catch(err => 
        console.log('Background upload failed:', err)
      );

    } catch (error) {
      console.error('❌ Failed to queue upload:', error);
    }
  }

  /**
   * Process upload queue
   */
  async processQueue(): Promise<void> {
    if (this.isUploading) {
      console.log('📤 Already processing queue');
      return;
    }

    if (!this.config.enabled || !this.config.baseUrl) {
      console.log('📤 Upload not configured, skipping');
      return;
    }

    this.isUploading = true;

    try {
      const queue = await this.getQueue();
      const pendingItems = queue.filter(item => 
        item.status === 'pending' || item.status === 'failed'
      );

      console.log(`📤 Processing ${pendingItems.length} pending uploads`);

      for (const item of pendingItems) {
        try {
          await this.uploadItem(item);
          item.status = 'success';
          console.log(`✅ Uploaded: ${item.confirmedLabel}`);
        } catch (error) {
          item.uploadAttempts += 1;
          item.lastAttempt = new Date().toISOString();

          if (item.uploadAttempts >= this.config.maxRetries) {
            item.status = 'failed';
            console.error(`❌ Upload failed after ${item.uploadAttempts} attempts:`, error);
          } else {
            item.status = 'pending';
            console.warn(`⚠️  Upload attempt ${item.uploadAttempts} failed, will retry`);
          }
        }
      }

      // Remove successful items, keep failed for retry
      const updatedQueue = queue.filter(item => item.status !== 'success');
      await this.saveQueue(updatedQueue);

      console.log(`📤 Queue processed. ${updatedQueue.length} items remaining.`);

    } catch (error) {
      console.error('❌ Queue processing error:', error);
    } finally {
      this.isUploading = false;
    }
  }

  /**
   * Upload a single item to server
   */
  private async uploadItem(item: UploadQueueItem): Promise<void> {
    const endpoint = `${this.config.baseUrl}/captures`;

    // Read image file as base64 or blob
    let imageData: string;
    try {
      imageData = await FileSystem.readAsStringAsync(item.imageUri, {
        encoding: 'base64',
      });
    } catch (error) {
      throw new Error(`Failed to read image file: ${error}`);
    }

    // Prepare form data
    const formData = new FormData();
    formData.append('file', {
      uri: item.imageUri,
      type: 'image/jpeg',
      name: 'capture.jpg',
    } as any);

    formData.append('json', JSON.stringify({
      confirmedLabel: item.confirmedLabel,
      predictedCandidates: item.predictedCandidates,
      modelVersionUsed: item.modelVersionUsed,
      timestamp: item.capturedAt,
      cropInfo: item.cropInfo,
    }));

    // Upload
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData,
      headers: {
        'Accept': 'application/json',
        // Add auth headers if needed
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();
    console.log('📤 Upload response:', result);
  }

  /**
   * Get current upload queue
   */
  async getQueue(): Promise<UploadQueueItem[]> {
    try {
      const queueJson = await AsyncStorage.getItem(UPLOAD_QUEUE_KEY);
      if (queueJson) {
        return JSON.parse(queueJson);
      }
    } catch (error) {
      console.error('Failed to load upload queue:', error);
    }
    return [];
  }

  /**
   * Save upload queue
   */
  private async saveQueue(queue: UploadQueueItem[]): Promise<void> {
    try {
      await AsyncStorage.setItem(UPLOAD_QUEUE_KEY, JSON.stringify(queue));
    } catch (error) {
      console.error('Failed to save upload queue:', error);
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    total: number;
    pending: number;
    failed: number;
    uploading: number;
  }> {
    const queue = await this.getQueue();
    return {
      total: queue.length,
      pending: queue.filter(i => i.status === 'pending').length,
      failed: queue.filter(i => i.status === 'failed').length,
      uploading: queue.filter(i => i.status === 'uploading').length,
    };
  }

  /**
   * Clear upload queue (all items)
   */
  async clearQueue(): Promise<void> {
    await AsyncStorage.removeItem(UPLOAD_QUEUE_KEY);
    console.log('🗑️  Upload queue cleared');
  }

  /**
   * Clear only successful uploads
   */
  async clearSuccessful(): Promise<void> {
    const queue = await this.getQueue();
    const filtered = queue.filter(item => item.status !== 'success');
    await this.saveQueue(filtered);
    console.log(`🗑️  Cleared successful uploads (${queue.length - filtered.length} removed)`);
  }

  /**
   * Retry all failed uploads
   */
  async retryFailed(): Promise<void> {
    const queue = await this.getQueue();
    queue.forEach(item => {
      if (item.status === 'failed') {
        item.status = 'pending';
        item.uploadAttempts = 0;
      }
    });
    await this.saveQueue(queue);
    console.log('🔄 Reset failed uploads to pending');

    await this.processQueue();
  }
}

export const datasetUploadService = new DatasetUploadService();
