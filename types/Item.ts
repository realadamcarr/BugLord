/**
 * Item System Type Definitions
 * 
 * Defines the core types for the MVP item system used in Hive Mode and general gameplay.
 * Items are immutable definitions; quantities are tracked in Inventory.
 */

/**
 * Item types - extensible enum for future item categories
 */
export type ItemType = 'trap' | 'heal' | 'revive';

/**
 * Item effect data - numbers only, no animation references
 * Each item type uses relevant fields
 */
export interface ItemEffect {
  /** Trap: success rate (0-1) */
  trapSuccessRate?: number;
  
  /** Heal: HP amount to restore */
  healAmount?: number;
  
  /** Revive: HP percentage to restore (0-1) */
  reviveHpPercent?: number;
}

/**
 * Core item definition - immutable and reusable
 * Defines what an item IS, not how many you have
 */
export interface ItemDefinition {
  /** Unique identifier */
  id: string;
  
  /** Display name */
  name: string;
  
  /** Brief description of effect */
  description: string;
  
  /** Item category */
  type: ItemType;
  
  /** Effect parameters (numbers only) */
  effect: ItemEffect;
  
  /** Rarity/tier for future UI sorting (optional) */
  rarity?: 'common' | 'uncommon' | 'rare' | 'epic';
  
  /** Stack limit per inventory (default: 99) */
  stackLimit?: number;
}

/**
 * Inventory slot - tracks quantity of a specific item
 */
export interface InventorySlot {
  itemId: string;
  quantity: number;
}

/**
 * Inventory state - collection of all items and quantities owned
 */
export interface InventoryState {
  slots: InventorySlot[];
  lastUpdated: string; // ISO timestamp
}

/**
 * Item use result - returned when item is used
 */
export interface ItemUseResult {
  success: boolean;
  message: string;
  quantityRemaining: number;
}
