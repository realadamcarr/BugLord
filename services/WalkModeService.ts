/**
 * Walk Mode Service
 * 
 * Passive progression system that rewards real-world walking with:
 * - XP for the active bug in party
 * - Random item drops for use in Hive Mode
 * 
 * Features:
 * - Step tracking using Expo Sensors (Pedometer)
 * - Configurable XP per steps ratio
 * - Random item drop system with rarity weights
 * - Persistent state across app restarts
 * - Console logging for debugging
 */

import { BUG_TRAP, FULL_REVIVE, POTION, REVIVE_SEED, SUPER_POTION } from '@/constants/Items';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundFetch from 'expo-background-fetch';
import { Pedometer } from 'expo-sensors';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

// Background task name
const BACKGROUND_STEP_TASK = 'background-step-tracking';

// Mock Pedometer for web/simulator
class MockPedometer {
  private stepCount = 0;
  private listeners: ((result: { steps: number }) => void)[] = [];
  private interval: NodeJS.Timeout | null = null;

  static async isAvailableAsync(): Promise<boolean> {
    return Promise.resolve(true);
  }

  static watchStepCount(callback: (result: { steps: number }) => void) {
    const instance = new MockPedometer();
    console.log('🚶‍♂️ [WalkMode] Starting mock step tracking (web/simulator mode)');
    instance.listeners.push(callback);
    
    // Simulate steps every 10 seconds for testing
    instance.interval = setInterval(() => {
      instance.stepCount += Math.floor(Math.random() * 20) + 5; // 5-25 steps
      instance.listeners.forEach(listener => {
        listener({ steps: instance.stepCount });
      });
    }, 10000);

    return {
      remove: () => {
        if (instance.interval) {
          clearInterval(instance.interval);
          instance.interval = null;
        }
      }
    };
  }
}

// Use real Pedometer on device, mock on web
const PedometerAPI = Platform.OS === 'web' ? MockPedometer : Pedometer;

// Storage key for Walk Mode data
const WALK_MODE_STORAGE_KEY = 'walk_mode_data';
const WALK_HISTORY_STORAGE_KEY = 'walk_mode_history';

// Walk History Entry Interface
export interface WalkHistoryEntry {
  id: string;
  date: string; // ISO string
  duration: number; // minutes
  stepsWalked: number;
  bugName: string;
  bugId: string;
  xpGained: number;
  itemsFound: { itemId: string; amount: number; name: string }[];
  startTime: string; // ISO string
  endTime: string; // ISO string
}

// Walk Mode Configuration
export const WALK_MODE_CONFIG = {
  // XP Conversion
  STEPS_PER_XP_GAIN: 1312,       // Every 1312 steps (1 km) = XP gain
  XP_PER_MILESTONE: 5,           // 5 XP per milestone reached
  
  // Item Drop System  
  ITEM_DROP_CHANCE: 0.15,        // 15% chance per XP milestone to drop item
  
  // Item Drop Weights (higher = more common)
  ITEM_DROP_WEIGHTS: {
    [BUG_TRAP.id]: 50,           // Common - Bug Trap
    [POTION.id]: 25,             // Uncommon - Basic Heal
    [SUPER_POTION.id]: 15,       // Uncommon - Better Heal
    [REVIVE_SEED.id]: 8,         // Rare - Basic Revive
    [FULL_REVIVE.id]: 2,         // Very Rare - Full Revive
  },
  
  // Logging
  ENABLE_CONSOLE_LOGS: true,     // Set to false to disable walk mode logs
} as const;

// Walk Mode State Interface
export interface WalkModeState {
  totalSteps: number;              // Total steps recorded since install
  lastProcessedSteps: number;      // Last step count that was processed for rewards
  lastUpdateTimestamp: number;     // When state was last updated
  sessionSteps: number;            // Steps in current session (resets on app restart)
  totalXpEarned: number;          // Total XP earned from walking
  totalItemsDropped: number;       // Total items received from walking
  isActive: boolean;               // Whether walk mode is currently active
}

// Default Walk Mode State
const DEFAULT_WALK_MODE_STATE: WalkModeState = {
  totalSteps: 0,
  lastProcessedSteps: 0,
  lastUpdateTimestamp: Date.now(),
  sessionSteps: 0,
  totalXpEarned: 0,
  totalItemsDropped: 0,
  isActive: false,
};

// Walk Mode Reward Interface
export interface WalkModeReward {
  type: 'xp' | 'item';
  xpAmount?: number;
  itemId?: string;
  itemAmount?: number;
  stepsTriggered: number;
  bugName?: string;               // Name of bug that received XP
}

class WalkModeService {
  private state: WalkModeState = { ...DEFAULT_WALK_MODE_STATE };
  private isInitialized = false;
  private pedometerSubscription: any = null;
  private rewardCallbacks: ((reward: WalkModeReward) => void)[] = [];
  private currentSession: {
    startTime: Date;
    startSteps: number;
    bugId: string | null;
    bugName: string | null;
    xpGained: number;
    itemsFound: { itemId: string; amount: number; name: string }[];
  } | null = null;

  /**
   * Initialize Walk Mode service
   * Loads persisted state and starts step tracking
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.log('🚶 Walk Mode already initialized');
      return;
    }

    try {
      this.log('🚶 Initializing Walk Mode service...');
      
      // Load persisted state
      await this.loadState();
      
      // Check if pedometer is available
      const isAvailable = await PedometerAPI.isAvailableAsync();
      if (!isAvailable) {
        this.log('⚠️ Pedometer not available on this device');
        throw new Error('Pedometer not available on this device');
      }

      this.log('✅ Walk Mode service initialized');
      this.isInitialized = true;
      
    } catch (error) {
      this.log('❌ Failed to initialize Walk Mode:', error);
      throw error;
    }
  }

  /**
   * Start step tracking and reward processing
   * Call this when the user enables Walk Mode
   */
  async startTracking(activeBugId?: string, activeBugName?: string): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.state.isActive) {
      this.log('🚶 Walk Mode already active');
      return;
    }

    try {
      this.log('🚶 Starting Walk Mode tracking...');
      
      // Start new session
      this.currentSession = {
        startTime: new Date(),
        startSteps: this.state.totalSteps,
        bugId: activeBugId || null,
        bugName: activeBugName || null,
        xpGained: 0,
        itemsFound: []
      };
      
      // Reset session steps
      this.state.sessionSteps = 0;
      this.state.isActive = true;
      
      // Start step tracking
      this.pedometerSubscription = PedometerAPI.watchStepCount((result) => {
        if (result && typeof result.steps === 'number') {
          this.handleStepUpdate(result.steps);
        }
      });

      await this.saveState();
      this.log('✅ Walk Mode tracking started');
      
    } catch (error) {
      this.log('❌ Failed to start Walk Mode tracking:', error);
      throw error;
    }
  }
      
      // Start step counting from now
      this.pedometerSubscription = PedometerAPI.watchStepCount((result) => {
        this.handleStepUpdate(result.steps);
      });

      // Start background fetch if on device
      if (Platform.OS !== 'web') {
        await BackgroundFetch.setMinimumIntervalAsync(60 * 15); // 15 minutes
      }

      await this.saveState();
      this.log('✅ Walk Mode tracking started (background enabled)');
      
    } catch (error) {
      this.log('❌ Failed to start Walk Mode tracking:', error);
    }
  }

  /**
   * Stop step tracking
   * Call this when the user disables Walk Mode
   */
  async stopTracking(): Promise<void> {
    if (!this.state.isActive) {
      this.log('🚶 Walk Mode not active');
      return;
    }

    try {
      this.log('🚶 Stopping Walk Mode tracking...');
      
      // Save walk session to history
      if (this.currentSession) {
        await this.saveWalkSession();
      }
      
      // Stop pedometer subscription
      if (this.pedometerSubscription) {
        this.pedometerSubscription.remove();
        this.pedometerSubscription = null;
      }

      this.state.isActive = false;
      this.currentSession = null;
      await this.saveState();
      
      this.log('✅ Walk Mode tracking stopped');
      
    } catch (error) {
      this.log('❌ Failed to stop Walk Mode tracking:', error);
      throw error;
    }
  }

  /**
   * Save current walk session to history
   */
  private async saveWalkSession(): Promise<void> {
    if (!this.currentSession) return;

    const endTime = new Date();
    const duration = Math.round((endTime.getTime() - this.currentSession.startTime.getTime()) / (1000 * 60)); // minutes
    const stepsWalked = this.state.sessionSteps;

    if (duration < 1 || stepsWalked < 10) {
      this.log('🚶 Session too short to save to history');
      return;
    }

    const historyEntry: WalkHistoryEntry = {
      id: 'walk_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      date: this.currentSession.startTime.toISOString().split('T')[0], // YYYY-MM-DD
      duration,
      stepsWalked,
      bugName: this.currentSession.bugName || 'No Bug',
      bugId: this.currentSession.bugId || '',
      xpGained: this.currentSession.xpGained,
      itemsFound: [...this.currentSession.itemsFound],
      startTime: this.currentSession.startTime.toISOString(),
      endTime: endTime.toISOString(),
    };

    try {
      const existingHistory = await this.getWalkHistory();
      const newHistory = [historyEntry, ...existingHistory];
      
      // Keep only last 100 entries
      const trimmedHistory = newHistory.slice(0, 100);
      
      await AsyncStorage.setItem(WALK_HISTORY_STORAGE_KEY, JSON.stringify(trimmedHistory));
      this.log('💾 Walk session saved to history');
      
    } catch (error) {
      this.log('❌ Failed to save walk history:', error);
    }
  }

  /**
   * Get walk history
   */
  async getWalkHistory(): Promise<WalkHistoryEntry[]> {
    try {
      const stored = await AsyncStorage.getItem(WALK_HISTORY_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as WalkHistoryEntry[];
      }
    } catch (error) {
      this.log('❌ Failed to load walk history:', error);
    }
    return [];
  }

  /**
   * Process step updates and calculate rewards
   */
  private handleStepUpdate(sessionSteps: number): void {
    this.state.sessionSteps = sessionSteps;
    this.state.totalSteps = this.state.lastProcessedSteps + sessionSteps;
    
    // Calculate how many XP milestones have been reached
    const stepsSinceLastReward = this.state.totalSteps - this.state.lastProcessedSteps;
    const xpMilestones = Math.floor(stepsSinceLastReward / WALK_MODE_CONFIG.STEPS_PER_XP_GAIN);
    
    if (xpMilestones > 0) {
      this.processRewards(xpMilestones);
    }
  }

  /**
   * Process XP and item rewards for completed milestones
   */
  private processRewards(milestones: number): void {
    this.log(`🚶 Processing ${milestones} XP milestone(s)...`);
    
    for (let i = 0; i < milestones; i++) {
      // Award XP
      const xpReward: WalkModeReward = {
        type: 'xp',
        xpAmount: WALK_MODE_CONFIG.XP_PER_MILESTONE,
        stepsTriggered: this.state.totalSteps,
      };
      
      this.state.totalXpEarned += WALK_MODE_CONFIG.XP_PER_MILESTONE;
      
      // Track XP in current session
      if (this.currentSession) {
        this.currentSession.xpGained += WALK_MODE_CONFIG.XP_PER_MILESTONE;
      }
      
      this.notifyReward(xpReward);
      
      // Roll for item drop
      if (Math.random() < WALK_MODE_CONFIG.ITEM_DROP_CHANCE) {
        const droppedItem = this.rollRandomItem();
        if (droppedItem) {
          const itemReward: WalkModeReward = {
            type: 'item',
            itemId: droppedItem,
            itemAmount: 1,
            stepsTriggered: this.state.totalSteps,
          };
          
          this.state.totalItemsDropped += 1;
          
          // Track item in current session
          if (this.currentSession && droppedItem) {
            const itemDef = require('@/constants/Items').getItemDefinition?.(droppedItem);
            const itemName = itemDef?.name || droppedItem;
            
            const existingItem = this.currentSession.itemsFound.find(item => item.itemId === droppedItem);
            if (existingItem) {
              existingItem.amount += 1;
            } else {
              this.currentSession.itemsFound.push({
                itemId: droppedItem,
                amount: 1,
                name: itemName
              });
            }
          }
          
          this.notifyReward(itemReward);
        }
      }
    }
    
    // Update processed steps
    this.state.lastProcessedSteps = this.state.totalSteps;
    this.state.lastUpdateTimestamp = Date.now();
    this.saveState();
  }

  /**
   * Roll for random item based on weighted probabilities
   */
  private rollRandomItem(): string | null {
    const weights = WALK_MODE_CONFIG.ITEM_DROP_WEIGHTS;
    const totalWeight = Object.values(weights).reduce((sum, weight) => sum + weight, 0);
    
    let random = Math.random() * totalWeight;
    
    for (const [itemId, weight] of Object.entries(weights)) {
      random -= weight;
      if (random <= 0) {
        return itemId;
      }
    }
    
    return null; // Fallback (should not happen)
  }

  /**
   * Register callback for reward notifications
   */
  onReward(callback: (reward: WalkModeReward) => void): () => void {
    this.rewardCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.rewardCallbacks.indexOf(callback);
      if (index > -1) {
        this.rewardCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Notify all subscribers about rewards
   */
  private notifyReward(reward: WalkModeReward): void {
    this.rewardCallbacks.forEach(callback => {
      try {
        callback(reward);
      } catch (error) {
        this.log('❌ Error in reward callback:', error);
      }
    });
  }

  /**
   * Get current Walk Mode state (read-only)
   */
  getState(): Readonly<WalkModeState> {
    return { ...this.state };
  }

  /**
   * Get Walk Mode statistics for UI display
   */
  getStatistics() {
    const stepsToNextXp = WALK_MODE_CONFIG.STEPS_PER_XP_GAIN - 
      ((this.state.totalSteps - this.state.lastProcessedSteps) % WALK_MODE_CONFIG.STEPS_PER_XP_GAIN);
    
    return {
      isActive: this.state.isActive,
      sessionSteps: this.state.sessionSteps,
      totalSteps: this.state.totalSteps,
      stepsToNextXp,
      totalXpEarned: this.state.totalXpEarned,
      totalItemsDropped: this.state.totalItemsDropped,
      xpPerMilestone: WALK_MODE_CONFIG.XP_PER_MILESTONE,
      stepsPerXp: WALK_MODE_CONFIG.STEPS_PER_XP_GAIN,
    };
  }

  /**
   * Load persisted Walk Mode state from AsyncStorage
   */
  private async loadState(): Promise<void> {
    try {
      const savedData = await AsyncStorage.getItem(WALK_MODE_STORAGE_KEY);
      if (savedData) {
        const parsedData = JSON.parse(savedData);
        this.state = { ...DEFAULT_WALK_MODE_STATE, ...parsedData };
        this.log('📱 Loaded Walk Mode state:', this.state);
      } else {
        this.log('📱 No saved Walk Mode state, using defaults');
      }
    } catch (error) {
      this.log('❌ Failed to load Walk Mode state:', error);
      this.state = { ...DEFAULT_WALK_MODE_STATE };
    }
  }

  /**
   * Save Walk Mode state to AsyncStorage
   */
  private async saveState(): Promise<void> {
    try {
      await AsyncStorage.setItem(WALK_MODE_STORAGE_KEY, JSON.stringify(this.state));
      this.log('💾 Walk Mode state saved');
    } catch (error) {
      this.log('❌ Failed to save Walk Mode state:', error);
    }
  }

  /**
   * Reset all Walk Mode data (for testing/debugging)
   */
  async resetData(): Promise<void> {
    this.log('🔄 Resetting Walk Mode data...');
    await this.stopTracking();
    this.state = { ...DEFAULT_WALK_MODE_STATE };
    await AsyncStorage.removeItem(WALK_MODE_STORAGE_KEY);
    this.log('✅ Walk Mode data reset');
  }

  /**
   * Log messages with emoji prefix (can be disabled via config)
   */
  private log(message: string, ...args: any[]): void {
    if (WALK_MODE_CONFIG.ENABLE_CONSOLE_LOGS) {
      console.log(`🚶‍♂️ [WalkMode] ${message}`, ...args);
    }
  }
}

// Export singleton instance
export const walkModeService = new WalkModeService();