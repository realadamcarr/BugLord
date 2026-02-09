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

export interface UseWalkModeReturn {
  // State
  isActive: boolean;
  statistics: ReturnType<typeof walkModeService.getStatistics>;
  
  // Actions
  startWalkMode: () => Promise<void>;
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
  
  const [isActive, setIsActive] = useState(false);
  const [statistics, setStatistics] = useState(() => walkModeService.getStatistics());
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
      
      // Update initial state
      const stats = walkModeService.getStatistics();
      setStatistics(stats);
      setIsActive(stats.isActive);
      
    } catch (err) {
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

    // Find the first non-null bug in the party with HP > 0 (active bug)
    const activeBug = collection.party.find(bug => {
      if (!bug) return false;
      const maxHp = bug.maxHp || bug.maxXp;
      const currentHp = bug.currentHp !== undefined ? bug.currentHp : maxHp;
      return currentHp > 0;
    });
    
    if (!activeBug) {
      console.log('🚶‍♂️ No healthy bug in party, XP reward skipped');
      return;
    }

    // Add XP to the active bug
    const success = await addXpToBug(activeBug.id, reward.xpAmount);
    
    if (success) {
      console.log(
        `🚶‍♂️ Walk Mode: ${activeBug.name} gained ${reward.xpAmount} XP from walking! ` +
        `(${reward.stepsTriggered} steps)`
      );
      
      // Update reward with bug name for better logging
      reward.bugName = activeBug.name;
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
   * Start Walk Mode tracking
   */
  async function startWalkMode(): Promise<void> {
    try {
      setError(null);
      
      // Find the first active bug in party
      const activeBug = collection.party.find(bug => {
        if (!bug) return false;
        const maxHp = bug.maxHp || bug.maxXp;
        const currentHp = bug.currentHp !== undefined ? bug.currentHp : maxHp;
        return currentHp > 0;
      });
      
      await walkModeService.startTracking(activeBug?.id, activeBug?.name || activeBug?.nickname);
      
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
    statistics,
    
    // Actions
    startWalkMode,
    stopWalkMode,
    resetWalkMode,
    
    // Status
    isAvailable,
    error,
  };
}