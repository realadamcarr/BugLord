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
import { AppState, AppStateStatus, Platform } from 'react-native';
import {
  consumeBackgroundSteps,
  registerBackgroundStepTracking,
  unregisterBackgroundStepTracking,
} from './BackgroundStepTracking';
import {
  dismissWalkModeNotification,
  requestNotificationPermission,
  showWalkModeNotification,
  updateWalkModeNotification,
} from './WalkModeNotification';

// Mock Pedometer for web/simulator
class MockPedometer {
  private stepCount = 0;
  private listeners: ((result: { steps: number }) => void)[] = [];
  private interval: ReturnType<typeof setInterval> | null = null;

  static async isAvailableAsync(): Promise<boolean> {
    return Promise.resolve(true);
  }

  static async getStepCountAsync(_start: Date, _end: Date): Promise<{ steps: number }> {
    // Simulate some steps taken while app was closed
    return { steps: Math.floor(Math.random() * 50) };
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
  STEPS_PER_XP_GAIN: 20,        // TESTING: 20 steps per milestone (normally 1312)
  XP_PER_MILESTONE: 15,          // 15 XP per milestone reached (3× base rate for walking)
  
  // Item Drop System  
  ITEM_DROP_CHANCE: 1.0,         // TESTING: 100% drop chance (normally 0.15)
  
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
  activeBugId: string | null;      // ID of the bug currently training in walk mode
  activeBugName: string | null;    // Name of the bug currently training in walk mode
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
  activeBugId: null,
  activeBugName: null,
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
  private _initPromise: Promise<void> | null = null;
  private pedometerSubscription: any = null;
  private rewardCallbacks: ((reward: WalkModeReward) => void)[] = [];
  private _subscriptionBaseline = 0;
  private _subscriptionBaselineSet = false;
  private _saveTimer: ReturnType<typeof setTimeout> | null = null;
  private _appStateSubscription: any = null;
  private _lastSavedSteps = 0;
  private _notifInterval: ReturnType<typeof setInterval> | null = null;
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
   * Loads persisted state and starts step tracking.
   * Uses a promise-based mutex so concurrent callers await the same init.
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      this.log('🚶 Walk Mode already initialized');
      return;
    }

    // Concurrency guard: if an init is already in-flight, wait for it
    if (this._initPromise) {
      this.log('🚶 Walk Mode init already in-flight, waiting...');
      return this._initPromise;
    }

    this._initPromise = this._doInitialize();
    try {
      await this._initPromise;
    } finally {
      this._initPromise = null;
    }
  }

  /**
   * Internal initializer — called exactly once by the mutex in initialize().
   */
  private async _doInitialize(): Promise<void> {
    try {
      this.log('🚶 Initializing Walk Mode service...');
      
      // Load persisted state
      await this.loadState();
      
      // Check if pedometer is available
      let pedometerAvailable = false;
      try {
        pedometerAvailable = await PedometerAPI.isAvailableAsync();
      } catch {
        this.log('⚠️ Pedometer availability check failed');
      }

      if (!pedometerAvailable) {
        this.log('⚠️ Pedometer not available — step counting will not work until permissions are granted');
        // Don't throw — still mark as initialized so resume/recovery can work
        // when the user grants permission later
      }

      // If walk mode was active before app closed, resume tracking
      if (this.state.isActive) {
        this.log('🔄 Resuming Walk Mode tracking for bug:', this.state.activeBugName || '(none)');
        
        // Recover steps taken while the app was closed
        await this.recoverMissedSteps();
        
        // Restore the in-memory session from persisted state
        this.currentSession = {
          startTime: new Date(),
          startSteps: this.state.totalSteps,
          bugId: this.state.activeBugId,
          bugName: this.state.activeBugName,
          xpGained: 0,
          itemsFound: []
        };
        
        // Reset subscription baseline for fresh delta tracking
        this._subscriptionBaseline = 0;
        this._subscriptionBaselineSet = false;
        
        // Re-subscribe to pedometer so steps are actually tracked.
        // Wrapped in try-catch: on some OEMs (OnePlus, Xiaomi) the pedometer
        // may not be available immediately on cold start. Walk mode state
        // must still be considered active so the UI reflects correctly;
        // the subscription will be retried when the user opens the screen.
        try {
          this.pedometerSubscription = PedometerAPI.watchStepCount((result) => {
            if (result && typeof result.steps === 'number') {
              this.handleStepUpdate(result.steps);
            }
          });
        } catch (pedometerErr) {
          this.log('⚠️ Pedometer subscription failed during resume (will retry):', pedometerErr);
        }

        // Re-register background fetch task in case OS unregistered it
        // (Android may drop tasks after app update or prolonged inactivity)
        await registerBackgroundStepTracking();

        // Re-show the persistent notification and start periodic updates
        this.startNotification();
        
        this.log('✅ Walk Mode tracking resumed');
      }

      // Listen for app state changes — save on background, recover steps on foreground
      if (!this._appStateSubscription) {
        this._appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
          if ((nextState === 'background' || nextState === 'inactive') && this.state.isActive) {
            this.log('📱 App going to background — force-saving walk state');
            this.forceSave();
          } else if (nextState === 'active' && this.state.isActive) {
            this.log('📱 App returned to foreground — recovering missed steps');
            this.recoverMissedSteps();
          }
        });
      }

      this.log('✅ Walk Mode service initialized');
      this.isInitialized = true;
      
    } catch (error) {
      this.log('❌ Failed to initialize Walk Mode:', error);
      throw error;
    }
  }

  /**
   * Retry pedometer subscription if it wasn't set up during initialization.
   * Call this when the walk mode screen is opened.
   */
  retryPedometerIfNeeded(): void {
    if (!this.state.isActive || this.pedometerSubscription) return;

    this.log('🔄 Retrying pedometer subscription...');
    try {
      this._subscriptionBaseline = 0;
      this._subscriptionBaselineSet = false;
      this.pedometerSubscription = PedometerAPI.watchStepCount((result) => {
        if (result && typeof result.steps === 'number') {
          this.handleStepUpdate(result.steps);
        }
      });
      this.log('✅ Pedometer subscription established on retry');
    } catch (err) {
      this.log('⚠️ Pedometer retry also failed:', err);
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
      
      // Reset session steps and persist the active bug info
      this.state.sessionSteps = 0;
      this.state.isActive = true;
      this.state.activeBugId = activeBugId || null;
      this.state.activeBugName = activeBugName || null;
      this.state.lastUpdateTimestamp = Date.now();
      
      // Reset subscription baseline for fresh delta tracking
      this._subscriptionBaseline = 0;
      this._subscriptionBaselineSet = false;
      
      // Start step tracking
      this.pedometerSubscription = PedometerAPI.watchStepCount((result) => {
        if (result && typeof result.steps === 'number') {
          this.handleStepUpdate(result.steps);
        }
      });

      // Register background fetch task so steps are tracked even when app is killed
      await registerBackgroundStepTracking();

      // Show persistent notification (keeps Android from killing the app)
      this.startNotification();

      await this.saveState();
      this.log('✅ Walk Mode tracking started');
      
    } catch (error) {
      this.log('❌ Failed to start Walk Mode tracking:', error);
      throw error;
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

      // Unregister background step tracking
      await unregisterBackgroundStepTracking();

      // Dismiss the persistent notification
      this.stopNotification();

      this.state.isActive = false;
      this.state.activeBugId = null;
      this.state.activeBugName = null;
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
   * Recover steps taken while the app was closed.
   * Uses Pedometer.getStepCountAsync to query the OS for step history
   * between the last persisted timestamp and now.
   * Public so the walk mode screen can trigger recovery on app resume.
   */
  async recoverMissedSteps(): Promise<void> {
    try {
      const lastUpdate = new Date(this.state.lastUpdateTimestamp);
      const now = new Date();
      const elapsed = now.getTime() - lastUpdate.getTime();

      let recoveredSteps = 0;

      // ── 1. Consume steps accumulated by the background fetch task ──
      //    These were tracked while the app was fully killed.
      try {
        const bgSteps = await consumeBackgroundSteps();
        if (bgSteps > 0) {
          recoveredSteps += bgSteps;
          this.log(`🔄 Consumed ${bgSteps} steps from background tracking`);
        }
      } catch (error_) {
        this.log('⚠️ Failed to consume background steps:', error_);
      }

      // ── 2. Query Pedometer.getStepCountAsync for steps while app was closed ──
      //    Works on both iOS (CoreMotion) and Android (TYPE_STEP_COUNTER).
      //    This is the primary recovery mechanism — it asks the OS how many
      //    steps the device recorded between lastUpdateTimestamp and now.
      if (elapsed >= 5000 && elapsed <= 7 * 24 * 60 * 60 * 1000) {
        try {
          const result = await PedometerAPI.getStepCountAsync(lastUpdate, now);
          if (result && result.steps > 0) {
            // Use the larger of background-accumulated or pedometer-reported steps
            // to avoid double-counting while still getting the best coverage.
            if (result.steps > recoveredSteps) {
              this.log(`🔄 Pedometer reported ${result.steps} steps (more than bg: ${recoveredSteps}), using pedometer value`);
              recoveredSteps = result.steps;
            }
          }
        } catch (pedometerError) {
          this.log('⚠️ Pedometer.getStepCountAsync failed:', pedometerError);
        }
      } else if (recoveredSteps === 0) {
        this.log('⏭️ Skipping pedometer recovery (gap too short or too long):', Math.round(elapsed / 1000), 's');
      }

      // Always advance the timestamp so the next recovery attempt
      // starts from now, regardless of whether we recovered steps.
      this.state.lastUpdateTimestamp = now.getTime();

      if (recoveredSteps > 0) {
        this.log(`🔄 Recovered ${recoveredSteps} total steps taken while app was closed`);
        this.state.sessionSteps += recoveredSteps;
        this.state.totalSteps += recoveredSteps;

        // Check for any XP milestones earned while away
        const stepsSinceLastReward = this.state.totalSteps - this.state.lastProcessedSteps;
        const xpMilestones = Math.floor(stepsSinceLastReward / WALK_MODE_CONFIG.STEPS_PER_XP_GAIN);
        if (xpMilestones > 0) {
          this.processRewards(xpMilestones);
        } else {
          await this.saveState();
        }
      } else {
        this.log('🔄 No missed steps to recover');
        await this.saveState();
      }
    } catch (error) {
      this.log('⚠️ Failed to recover missed steps (non-fatal):', error);
      // Even on total failure, advance the timestamp so we don't loop
      this.state.lastUpdateTimestamp = Date.now();
      await this.saveState();
    }
  }

  /**
   * Process step updates and calculate rewards
   */
  private handleStepUpdate(newSessionSteps: number): void {
    // newSessionSteps is steps since the current pedometer subscription started.
    // We use a delta approach to avoid double-counting with recovered steps.
    if (!this._subscriptionBaselineSet) {
      this._subscriptionBaseline = newSessionSteps;
      this._subscriptionBaselineSet = true;
    }
    const deltaFromSubscription = newSessionSteps - this._subscriptionBaseline;
    if (deltaFromSubscription <= 0) return;

    // Update the subscription baseline
    this._subscriptionBaseline = newSessionSteps;

    // Accumulate into persisted state
    this.state.sessionSteps += deltaFromSubscription;
    this.state.totalSteps += deltaFromSubscription;
    this.state.lastUpdateTimestamp = Date.now();
    
    this.log(`📊 Steps delta: +${deltaFromSubscription}, session: ${this.state.sessionSteps}, total: ${this.state.totalSteps}`);

    // Calculate how many XP milestones have been reached
    const stepsSinceLastReward = this.state.totalSteps - this.state.lastProcessedSteps;
    const xpMilestones = Math.floor(stepsSinceLastReward / WALK_MODE_CONFIG.STEPS_PER_XP_GAIN);
    
    if (xpMilestones > 0) {
      this.processRewards(xpMilestones);
    } else {
      // Save immediately on every step update so no steps are lost if app is killed.
      // Pedometer events are infrequent enough that this won't cause perf issues.
      if (this.state.sessionSteps !== this._lastSavedSteps) {
        this.saveState();
        this._lastSavedSteps = this.state.sessionSteps;
      }
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
   * Force save — called when app goes to background or is about to close.
   * Flushes any pending state and writes immediately and synchronously
   * (as much as possible) to avoid data loss when the OS kills the process.
   */
  private forceSave(): void {
    if (this._saveTimer) {
      clearTimeout(this._saveTimer);
      this._saveTimer = null;
    }
    // Fire-and-forget but log failures. On aggressive OEMs (OnePlus, Xiaomi)
    // the process may be killed before the write completes; the most critical
    // state (isActive, activeBugId) is already saved from startTracking().
    this.saveState().catch((err) => {
      this.log('⚠️ forceSave failed:', err);
    });
    this._lastSavedSteps = this.state.sessionSteps;
  }

  /**
   * Show the persistent walk mode notification and start periodic updates.
   * Requests notification permission if not already granted.
   */
  private startNotification(): void {
    // Request permission then show the notification
    requestNotificationPermission()
      .then((granted: boolean) => {
        if (!granted) {
          this.log('⚠️ Notification permission not granted — walk mode notification skipped');
          return;
        }
        showWalkModeNotification(this.state.activeBugName, this.state.sessionSteps);
      })
      .catch((e: unknown) => this.log('⚠️ Notification setup failed:', e));

    // Update the notification every 30 seconds with the latest step count
    if (this._notifInterval) clearInterval(this._notifInterval);
    this._notifInterval = setInterval(() => {
      if (this.state.isActive) {
        updateWalkModeNotification(this.state.activeBugName, this.state.sessionSteps).catch(() => {});
      }
    }, 30_000);
  }

  /**
   * Dismiss the walk mode notification and stop periodic updates.
   */
  private stopNotification(): void {
    if (this._notifInterval) {
      clearInterval(this._notifInterval);
      this._notifInterval = null;
    }
    dismissWalkModeNotification().catch(() => {});
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
      activeBugId: this.state.activeBugId,
      activeBugName: this.state.activeBugName,
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
        this.log('📱 Loaded Walk Mode state — isActive:', this.state.isActive,
          'activeBugId:', this.state.activeBugId,
          'totalSteps:', this.state.totalSteps);
      } else {
        this.log('📱 No saved Walk Mode state found in AsyncStorage, using defaults');
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
      const payload = JSON.stringify(this.state);
      await AsyncStorage.setItem(WALK_MODE_STORAGE_KEY, payload);
      // Verification read in dev — uncomment for debugging:
      // const verify = await AsyncStorage.getItem(WALK_MODE_STORAGE_KEY);
      // if (verify !== payload) this.log('⚠️ Save verification FAILED');
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