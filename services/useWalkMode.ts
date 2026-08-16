/**
 * Walk Mode Hook
 * 
 * React hook for integrating Walk Mode with the UI and other systems.
 * Connects step tracking with BugCollection XP and Inventory.
 */

import { getItemDefinition } from '@/constants/Items';
import { useBugCollection } from '@/contexts/BugCollectionContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useEffect, useState } from 'react';
import { WalkHistoryEntry, WalkModeReward, walkModeService } from './WalkModeService';
import { showLevelUpNotification } from './WalkModeNotification';

export interface UseWalkModeReturn {
  // State
  isActive: boolean;
  statistics: ReturnType<typeof walkModeService.getStatistics>;
  
  // Actions
  startWalkMode: (bugId?: string, bugName?: string) => Promise<void>;
  stopWalkMode: () => Promise<void>;
  resetWalkMode: () => Promise<void>;
  
  // History
  getWalkHistory: () => Promise<WalkHistoryEntry[]>;
  
  // Status
  isAvailable: boolean;
  error: string | null;
}

/**
 * Hook for using Walk Mode in React components
 * Handles initialization, reward processing, and state management
 */
export function useWalkMode(): UseWalkModeReturn {
  const { collection, addXpToBug } = useBugCollection();
  const { addItem } = useInventory();
  
  // Initialize state from service immediately — if _layout.tsx already
  // initialized the service, this gives us the correct isActive on first render
  // instead of flashing "Start Training" before the polling corrects it.
  const initialStats = walkModeService.getStatistics();
  const [isActive, setIsActive] = useState(initialStats.isActive);
  const [statistics, setStatistics] = useState(initialStats);
  const [isAvailable, setIsAvailable] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize Walk Mode service on mount
  useEffect(() => {
    initializeWalkMode();
  }, []);

  // Update statistics when state changes
  useEffect(() => {
    const interval = setInterval(() => {
      const newStats = walkModeService.getStatistics();
      setStatistics(newStats);
      setIsActive(newStats.isActive);
    }, 1000); // Update every second

    return () => clearInterval(interval);
  }, []);

  // Subscribe to Walk Mode rewards
  useEffect(() => {
    const unsubscribe = walkModeService.onReward((reward) => {
      handleReward(reward);
    });

    return unsubscribe;
  }, [collection, addItem, addXpToBug]);

  /**
   * Initialize the Walk Mode service
   */
  async function initializeWalkMode(): Promise<void> {
    try {
      await walkModeService.initialize();
      setIsAvailable(true);
      setError(null);
      
      // Update initial state from the now-loaded persisted data
      const stats = walkModeService.getStatistics();
      setStatistics(stats);
      setIsActive(stats.isActive);

      // If walk mode was active, make sure the pedometer is subscribed.
      // On some OEMs it may have failed during cold-start init.
      walkModeService.retryPedometerIfNeeded();
      
    } catch (err) {
      // Even if initialization threw, the state may have been loaded
      // successfully from AsyncStorage.  Read it so the UI reflects
      // the persisted isActive flag (polling also does this every 1s).
      const stats = walkModeService.getStatistics();
      setStatistics(stats);
      setIsActive(stats.isActive);

      setError(err instanceof Error ? err.message : 'Unknown error');
      setIsAvailable(false);
      console.error('Failed to initialize Walk Mode:', err);
    }
  }

  /**
   * Handle rewards from Walk Mode service
   */
  async function handleReward(reward: WalkModeReward): Promise<void> {
    try {
      if (reward.type === 'xp') {
        await handleXpReward(reward);
      } else if (reward.type === 'item') {
        await handleItemReward(reward);
      }
    } catch (err) {
      console.error('Failed to process Walk Mode reward:', err);
      setError(err instanceof Error ? err.message : 'Failed to process reward');
    }
  }

  /**
   * Process XP rewards - give XP to the first active bug in party
   */
  async function handleXpReward(reward: WalkModeReward): Promise<void> {
    if (!reward.xpAmount) return;

    // Only award XP to the specific bug being walked, and only if it has HP > 0
    const walkBugId = walkModeService.getStatistics().activeBugId;
    const activeBug = collection.party.find(bug => {
      if (!bug) return false;
      // If a specific bug is being walked, only give XP to that bug
      if (walkBugId && bug.id !== walkBugId) return false;
      const maxHp = bug.maxHp || bug.maxXp;
      const currentHp = bug.currentHp !== undefined ? bug.currentHp : maxHp;
      return currentHp > 0;
    });
    
    if (!activeBug) {
      console.log('🚶‍♂️ No healthy walk bug found (fainted or missing), XP reward skipped');
      return;
    }

    // Snapshot the level before adding XP so we can detect a level-up
    const levelBefore = activeBug.level;

    // Add XP to the active bug
    const success = await addXpToBug(activeBug.id, reward.xpAmount);
    
    if (success) {
      console.log(
        `🚶‍♂️ Walk Mode: ${activeBug.name} gained ${reward.xpAmount} XP from walking! ` +
        `(${reward.stepsTriggered} steps)`
      );
      
      // Update reward with bug name for better logging
      reward.bugName = activeBug.name;

      // Check if the bug leveled up by computing what the new level would be
      let simXp = activeBug.xp + reward.xpAmount;
      let simLevel = levelBefore;
      let simMaxXp = activeBug.maxXp;
      while (simXp >= simMaxXp) {
        simXp -= simMaxXp;
        simLevel += 1;
        simMaxXp = Math.floor(simMaxXp * 1.2);
      }

      if (simLevel > levelBefore) {
        console.log(`🎉 Walk Mode: ${activeBug.name} leveled up! ${levelBefore} → ${simLevel}`);
        showLevelUpNotification(activeBug.nickname || activeBug.name, simLevel).catch(() => {});
      }
    } else {
      console.warn('🚶‍♂️ Failed to add XP to active bug');
    }
  }

  /**
   * Process item rewards - add items to inventory
   */
  async function handleItemReward(reward: WalkModeReward): Promise<void> {
    if (!reward.itemId || !reward.itemAmount) return;

    try {
      await addItem(reward.itemId, reward.itemAmount);
      
      // Get item definition for better logging
      const itemDef = getItemDefinition(reward.itemId);
      const itemName = itemDef?.name || reward.itemId;
      
      console.log(
        `🚶‍♂️ Walk Mode: Found ${reward.itemAmount}x ${itemName} while walking! ` +
        `(${reward.stepsTriggered} steps)`
      );
      
    } catch (err) {
      console.error('Failed to add item reward:', err);
    }
  }

  /**
   * Start Walk Mode tracking.
   * @param bugId  — explicit bug ID to train (from the UI selection)
   * @param bugName — display name for notifications / logging
   * If omitted, falls back to the first alive party bug.
   */
  async function startWalkMode(bugId?: string, bugName?: string): Promise<void> {
    try {
      setError(null);

      let trackBugId = bugId;
      let trackBugName = bugName;

      // Fallback: pick first alive party bug if caller didn't specify
      if (!trackBugId) {
        const activeBug = collection.party.find(bug => {
          if (!bug) return false;
          const maxHp = bug.maxHp || bug.maxXp;
          const currentHp = bug.currentHp !== undefined ? bug.currentHp : maxHp;
          return currentHp > 0;
        });
        trackBugId = activeBug?.id;
        trackBugName = activeBug?.name || activeBug?.nickname;
      }
      
      await walkModeService.startTracking(trackBugId, trackBugName);
      
      // Update state
      const stats = walkModeService.getStatistics();
      setStatistics(stats);
      setIsActive(stats.isActive);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start Walk Mode';
      setError(errorMessage);
      console.error('Failed to start Walk Mode:', err);
    }
  }

  /**
   * Stop Walk Mode tracking
   */
  async function stopWalkMode(): Promise<void> {
    try {
      setError(null);
      await walkModeService.stopTracking();
      
      // Update state
      const stats = walkModeService.getStatistics();
      setStatistics(stats);
      setIsActive(stats.isActive);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop Walk Mode';
      setError(errorMessage);
      console.error('Failed to stop Walk Mode:', err);
    }
  }

  /**
   * Reset Walk Mode data (for testing/debugging)
   */
  async function resetWalkMode(): Promise<void> {
    try {
      setError(null);
      await walkModeService.resetData();
      
      // Update state
      const stats = walkModeService.getStatistics();
      setStatistics(stats);
      setIsActive(stats.isActive);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reset Walk Mode';
      setError(errorMessage);
      console.error('Failed to reset Walk Mode:', err);
    }
  }

  /**
   * Get walk history
   */
  async function getWalkHistory(): Promise<WalkHistoryEntry[]> {
    try {
      return await walkModeService.getWalkHistory();
    } catch (err) {
      console.error('Failed to get walk history:', err);
      return [];
    }
  }

  return {
    // State
    isActive,
    statistics,
    
    // Actions
    startWalkMode,
    stopWalkMode,
    resetWalkMode,
    
    // History
    getWalkHistory,
    
    // Status
    isAvailable,
    error,
  };
}