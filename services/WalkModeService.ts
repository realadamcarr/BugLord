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
import { Pedometer } from 'expo-sensors';
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
        return;
      }

      // Register background task for step tracking
      await this.registerBackgroundTask();

      this.log('✅ Walk Mode service initialized');
      this.isInitialized = true;
      
    } catch (error) {
      this.log('❌ Failed to initialize Walk Mode:', error);
    }
  }

  /**
   * Register background fetch task for step tracking
   */
  private async registerBackgroundTask(): Promise<void> {
    if (Platform.OS === 'web') {
      this.log('⚠️ Background tasks not supported on web');
      return;
    }

    try {
      // Define the background task
      TaskManager.defineTask(BACKGROUND_STEP_TASK, async () => {
        try {
          this.log('🔄 Background task executing...');
          
          // Update step count in background
          const now = new Date();
          const start = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Last 24 hours
          
          const result = await Pedometer.getStepCountAsync(start, now);
          if (result && typeof result.steps === 'number') {
            // Update state with new steps
            const newSessionSteps = result.steps - (this.state.totalSteps - this.state.sessionSteps);
            if (newSessionSteps > 0) {
              this.handleStepUpdate(newSessionSteps);
              await this.saveState();
            }
          }
          
          return BackgroundFetch.BackgroundFetchResult.NewData;
        } catch (error) {
          this.log('❌ Background task failed:', error);
          return BackgroundFetch.BackgroundFetchResult.Failed;
        }
      });

      // Register the task
      await BackgroundFetch.registerTaskAsync(BACKGROUND_STEP_TASK, {
        minimumInterval: 60 * 15, // 15 minutes
        stopOnTerminate: false, // Continue after app closes
        startOnBoot: true, // Start on device boot
      });

      this.log('✅ Background task registered');
    } catch (error) {
      this.log('⚠️ Failed to register background task:', error);
    }
  }

  /**
   * Start step tracking and reward processing
   * Call this when the user enables Walk Mode
   */
  async startTracking(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.state.isActive) {
      this.log('🚶 Walk Mode already active');
      return;
    }

    try {
      this.log('🚶 Starting Walk Mode tracking...');
      
      // Reset session steps
      this.state.sessionSteps = 0;
      this.state.isActive = true;
      
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
      
      // Stop pedometer subscription
      if (this.pedometerSubscription) {
        this.pedometerSubscription.remove();
        this.pedometerSubscription = null;
      }

      this.state.isActive = false;
      await this.saveState();
      
      this.log('✅ Walk Mode tracking stopped');
      
    } catch (error) {
      this.log('❌ Failed to stop Walk Mode tracking:', error);
    }
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