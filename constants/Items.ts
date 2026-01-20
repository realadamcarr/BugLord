/**
 * Item Definitions
 * 
 * Catalog of all available items in the MVP.
 * These are immutable definitions - quantities are tracked in Inventory.
 * 
 * MVP includes:
 * - Bug Trap: Increases catch rate in Hive Mode
 * - Heal Item: Restores HP to a bug
 * - Revive Item: Revives fainted bug with partial HP
 */

import { ItemDefinition } from '@/types/Item';

/**
 * Bug Trap - increases success rate when attempting to catch a bug
 * Used in Hive Mode battles
 */
export const BUG_TRAP: ItemDefinition = {
  id: 'item_bug_trap',
  name: 'Bug Trap',
  description: 'Increases catch rate by 25% when used',
  type: 'trap',
  effect: {
    trapSuccessRate: 0.25, // +25% to catch attempt
  },
  rarity: 'common',
  stackLimit: 99,
};

/**
 * Potion - small HP restoration
 * Can be used on any bug to restore health
 */
export const POTION: ItemDefinition = {
  id: 'item_potion',
  name: 'Potion',
  description: 'Restores 25 HP to a bug',
  type: 'heal',
  effect: {
    healAmount: 25,
  },
  rarity: 'common',
  stackLimit: 99,
};

/**
 * Super Potion - larger HP restoration
 * Better version of Potion
 */
export const SUPER_POTION: ItemDefinition = {
  id: 'item_super_potion',
  name: 'Super Potion',
  description: 'Restores 50 HP to a bug',
  type: 'heal',
  effect: {
    healAmount: 50,
  },
  rarity: 'uncommon',
  stackLimit: 99,
};

/**
 * Revive Seed - brings a fainted bug back to life
 * Restores 50% of max HP when used
 */
export const REVIVE_SEED: ItemDefinition = {
  id: 'item_revive_seed',
  name: 'Revive Seed',
  description: 'Revives a fainted bug with 50% HP',
  type: 'revive',
  effect: {
    reviveHpPercent: 0.5,
  },
  rarity: 'uncommon',
  stackLimit: 99,
};

/**
 * Full Revive - premium revive item
 * Restores 100% HP when used (fully healed)
 */
export const FULL_REVIVE: ItemDefinition = {
  id: 'item_full_revive',
  name: 'Full Revive',
  description: 'Revives a fainted bug with full HP',
  type: 'revive',
  effect: {
    reviveHpPercent: 1.0,
  },
  rarity: 'rare',
  stackLimit: 50, // Less common, lower stack limit
};

/**
 * Item catalog - all available items indexed by ID for quick lookup
 */
export const ITEM_CATALOG: Record<string, ItemDefinition> = {
  [BUG_TRAP.id]: BUG_TRAP,
  [POTION.id]: POTION,
  [SUPER_POTION.id]: SUPER_POTION,
  [REVIVE_SEED.id]: REVIVE_SEED,
  [FULL_REVIVE.id]: FULL_REVIVE,
};

/**
 * Get item definition by ID
 * @param itemId - Item ID
 * @returns Item definition or undefined if not found
 */
export function getItemDefinition(itemId: string): ItemDefinition | undefined {
  return ITEM_CATALOG[itemId];
}

/**
 * Get all items of a specific type
 * @param type - Item type to filter
 * @returns Array of matching item definitions
 */
export function getItemsByType(type: 'trap' | 'heal' | 'revive'): ItemDefinition[] {
  return Object.values(ITEM_CATALOG).filter(item => item.type === type);
}

/**
 * Get all available items
 * @returns Array of all item definitions
 */
export function getAllItems(): ItemDefinition[] {
  return Object.values(ITEM_CATALOG);
}
