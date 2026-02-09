/**
 * Inventory Context
 * 
 * Centralized state management for player inventory.
 * Handles item ownership, persistence via AsyncStorage, and item usage.
 * 
 * Features:
 * - Add items to inventory
 * - Use items with validation
 * - Persist state automatically
 * - Basic error handling and logging
 */

import { getItemDefinition } from '@/constants/Items';
import { Bug } from '@/types/Bug';
import { InventorySlot, InventoryState, ItemUseResult } from '@/types/Item';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';

const INVENTORY_STORAGE_KEY = 'INVENTORY_STATE';

interface InventoryContextType {
  // State
  inventory: InventorySlot[];
  loading: boolean;
  error: string | null;

  // Actions
  addItem: (itemId: string, amount: number) => Promise<void>;
  useItem: (itemId: string, targetBug?: Bug) => Promise<ItemUseResult>;
  removeItem: (itemId: string, amount: number) => Promise<void>;
  getItemQuantity: (itemId: string) => number;
  getInventorySummary: () => InventorySlot[];

  // Admin/Debug
  clearInventory: () => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

/**
 * Inventory Provider - wraps app with inventory state management
 */
export const InventoryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [inventory, setInventory] = useState<InventorySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize inventory from AsyncStorage on mount
  useEffect(() => {
    loadInventory();
  }, []);

  /**
   * Load inventory from persistent storage
   */
  const loadInventory = useCallback(async () => {
    try {
      setLoading(true);
      const stored = await AsyncStorage.getItem(INVENTORY_STORAGE_KEY);
      
      if (stored) {
        const state: InventoryState = JSON.parse(stored);
        setInventory(state.slots);
        console.log('📦 Inventory loaded:', state.slots.length, 'item types');
      } else {
        setInventory([]);
        console.log('📦 No inventory found, starting fresh');
      }
      
      setError(null);
    } catch (err) {
      console.error('❌ Failed to load inventory:', err);
      setError('Failed to load inventory');
      setInventory([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Save inventory to persistent storage
   */
  const saveInventory = useCallback(async (slots: InventorySlot[]) => {
    try {
      const state: InventoryState = {
        slots,
        lastUpdated: new Date().toISOString(),
      };
      await AsyncStorage.setItem(INVENTORY_STORAGE_KEY, JSON.stringify(state));
      console.log('💾 Inventory saved:', slots.length, 'item types');
    } catch (err) {
      console.error('❌ Failed to save inventory:', err);
      setError('Failed to save inventory');
    }
  }, []);

  /**
   * Add items to inventory (or create new slot if not owned)
   * @param itemId - Item ID to add
   * @param amount - Quantity to add
   */
  const addItem = useCallback(async (itemId: string, amount: number) => {
    if (amount <= 0) {
      console.warn('⚠️  Cannot add 0 or negative items');
      return;
    }

    // Validate item exists
    const itemDef = getItemDefinition(itemId);
    if (!itemDef) {
      setError(`Item ${itemId} not found in catalog`);
      console.error('❌ Item not found:', itemId);
      return;
    }

    const updatedSlots = [...inventory];
    const existingSlot = updatedSlots.find(slot => slot.itemId === itemId);

    if (existingSlot) {
      // Add to existing stack with limit check
      const newQty = existingSlot.quantity + amount;
      const limit = itemDef.stackLimit || 99;
      
      if (newQty > limit) {
        console.warn(`⚠️  Item ${itemId} would exceed stack limit (${limit})`);
        existingSlot.quantity = limit;
      } else {
        existingSlot.quantity = newQty;
      }
    } else {
      // Create new slot
      const limit = itemDef.stackLimit || 99;
      updatedSlots.push({
        itemId,
        quantity: Math.min(amount, limit),
      });
    }

    setInventory(updatedSlots);
    await saveInventory(updatedSlots);
    console.log(`✅ Added ${amount}x ${itemDef.name}`);
  }, [inventory, saveInventory]);

  /**
   * Get quantity of specific item
   * @param itemId - Item ID to check
   * @returns Quantity owned (0 if not owned)
   */
  const getItemQuantity = useCallback((itemId: string): number => {
    const slot = inventory.find(s => s.itemId === itemId);
    return slot?.quantity ?? 0;
  }, [inventory]);

  /**
   * Use an item with validation
   * @param itemId - Item ID to use
   * @param targetBug - Optional target bug (required for heal/revive)
   * @returns Result with success status and message
   */
  const useItem = useCallback(async (itemId: string, targetBug?: Bug): Promise<ItemUseResult> => {
    // Validate item exists
    const itemDef = getItemDefinition(itemId);
    if (!itemDef) {
      return {
        success: false,
        message: 'Item not found',
        quantityRemaining: 0,
      };
    }

    // Validate quantity > 0
    const currentQty = getItemQuantity(itemId);
    if (currentQty <= 0) {
      return {
        success: false,
        message: `No ${itemDef.name} available`,
        quantityRemaining: 0,
      };
    }

    // Type-specific validation
    if ((itemDef.type === 'heal' || itemDef.type === 'revive') && !targetBug) {
      return {
        success: false,
        message: `${itemDef.name} requires a target bug`,
        quantityRemaining: currentQty,
      };
    }

    // Revive-specific: target must be fainted (currentHp === 0)
    if (itemDef.type === 'revive' && targetBug) {
      const bugMaxHp = targetBug.maxHp || targetBug.maxXp;
      const bugCurrentHp = targetBug.currentHp !== undefined ? targetBug.currentHp : bugMaxHp;
      if (bugCurrentHp > 0) {
        return {
          success: false,
          message: 'Cannot revive a bug that is not fainted',
          quantityRemaining: currentQty,
        };
      }
    }

    // Heal-specific: target must NOT be fainted (currentHp > 0)
    if (itemDef.type === 'heal' && targetBug) {
      const bugMaxHp = targetBug.maxHp || targetBug.maxXp;
      const bugCurrentHp = targetBug.currentHp !== undefined ? targetBug.currentHp : bugMaxHp;
      if (bugCurrentHp <= 0) {
        return {
          success: false,
          message: 'Cannot heal a fainted bug. Use a Revive item instead!',
          quantityRemaining: currentQty,
        };
      }
    }

    // Trap: no additional validation needed (used in Hive Mode)

    // Item usage is valid - consume it
    const updatedSlots = inventory
      .map(slot => {
        if (slot.itemId === itemId) {
          return { ...slot, quantity: slot.quantity - 1 };
        }
        return slot;
      })
      .filter(slot => slot.quantity > 0); // Remove empty slots

    setInventory(updatedSlots);
    await saveInventory(updatedSlots);

    const newQty = updatedSlots.find(s => s.itemId === itemId)?.quantity ?? 0;
    const targetName = targetBug ? ` on ${targetBug.name}` : '';
    
    console.log(`✅ Used ${itemDef.name}${targetName}`);

    return {
      success: true,
      message: `Used ${itemDef.name}`,
      quantityRemaining: newQty,
    };
  }, [inventory, getItemQuantity, saveInventory]);

  /**
   * Remove items from inventory
   * @param itemId - Item ID to remove
   * @param amount - Quantity to remove
   */
  const removeItem = useCallback(async (itemId: string, amount: number) => {
    if (amount <= 0) {
      console.warn('⚠️  Cannot remove 0 or negative items');
      return;
    }

    const itemDef = getItemDefinition(itemId);
    if (!itemDef) {
      setError(`Item ${itemId} not found`);
      return;
    }

    const updatedSlots = inventory
      .map(slot => {
        if (slot.itemId === itemId) {
          return { ...slot, quantity: Math.max(0, slot.quantity - amount) };
        }
        return slot;
      })
      .filter(slot => slot.quantity > 0);

    setInventory(updatedSlots);
    await saveInventory(updatedSlots);
    console.log(`✅ Removed ${amount}x ${itemDef.name}`);
  }, [inventory, saveInventory]);

  /**
   * Get summary of all owned items
   */
  const getInventorySummary = useCallback((): InventorySlot[] => {
    return [...inventory];
  }, [inventory]);

  /**
   * Clear entire inventory (debug only)
   */
  const clearInventory = useCallback(async () => {
    setInventory([]);
    await AsyncStorage.removeItem(INVENTORY_STORAGE_KEY);
    console.log('🗑️  Inventory cleared');
  }, []);

  const value: InventoryContextType = {
    inventory,
    loading,
    error,
    addItem,
    useItem,
    removeItem,
    getItemQuantity,
    getInventorySummary,
    clearInventory,
  };

  return (
    <InventoryContext.Provider value={value}>
      {children}
    </InventoryContext.Provider>
  );
};

/**
 * Hook to use inventory context
 * Must be called within InventoryProvider
 */
export const useInventory = (): InventoryContextType => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within InventoryProvider');
  }
  return context;
};
