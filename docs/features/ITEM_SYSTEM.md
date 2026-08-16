/**
 * ITEM SYSTEM DOCUMENTATION
 * 
 * Complete guide to the MVP item system for BugLord.
 * 
 * Table of Contents:
 * 1. Architecture Overview
 * 2. Item Definitions
 * 3. Inventory System
 * 4. Usage Examples
 * 5. Extension Points
 * 6. Validation Rules
 */

// ============================================================================
// 1. ARCHITECTURE OVERVIEW
// ============================================================================

/**
 * The item system consists of 3 layers:
 * 
 * Layer 1: Item Definitions (constants/Items.ts)
 * - Immutable item catalogs
 * - No quantity tracking
 * - Reusable across game
 * 
 * Layer 2: Inventory Context (contexts/InventoryContext.tsx)
 * - Centralized state management
 * - Persistent storage via AsyncStorage
 * - Business logic for adding/using items
 * 
 * Layer 3: UI Components (components/*, screens/*)
 * - Display inventory
 * - Item interaction buttons
 * - No business logic here
 */

// ============================================================================
// 2. ITEM DEFINITIONS
// ============================================================================

/**
 * All items are defined in constants/Items.ts
 * 
 * MVP Items:
 * 
 * ┌─────────────────────────────────────────────────┐
 * │ Bug Trap                                        │
 * │ - Type: trap                                    │
 * │ - Effect: +25% catch rate                       │
 * │ - Used in Hive Mode (future)                    │
 * │ - Stack limit: 99                               │
 * └─────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────┐
 * │ Potion                                          │
 * │ - Type: heal                                    │
 * │ - Effect: Restore 25 HP                         │
 * │ - Used on any bug                               │
 * │ - Stack limit: 99                               │
 * └─────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────┐
 * │ Super Potion                                    │
 * │ - Type: heal                                    │
 * │ - Effect: Restore 50 HP                         │
 * │ - Used on any bug                               │
 * │ - Stack limit: 99                               │
 * └─────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────┐
 * │ Revive Seed                                     │
 * │ - Type: revive                                  │
 * │ - Effect: Revive with 50% HP                    │
 * │ - Used on fainted bugs only                     │
 * │ - Stack limit: 99                               │
 * └─────────────────────────────────────────────────┘
 * 
 * ┌─────────────────────────────────────────────────┐
 * │ Full Revive                                     │
 * │ - Type: revive                                  │
 * │ - Effect: Revive with 100% HP                   │
 * │ - Used on fainted bugs only                     │
 * │ - Stack limit: 50 (rare item)                   │
 * └─────────────────────────────────────────────────┘
 */

// ============================================================================
// 3. INVENTORY SYSTEM
// ============================================================================

/**
 * Inventory API (accessed via useInventory() hook):
 * 
 * STATE:
 * - inventory: InventorySlot[]  // Current owned items
 * - loading: boolean            // AsyncStorage loading status
 * - error: string | null        // Error messages
 * 
 * ACTIONS:
 * 
 * addItem(itemId: string, amount: number)
 * - Add items to inventory
 * - Creates new slot if item not owned
 * - Updates existing slot if owned
 * - Respects stack limits
 * - Persists automatically
 * - Returns: void
 * 
 * useItem(itemId: string, targetBug?: Bug)
 * - Consume an item
 * - Validates quantity > 0
 * - Type-specific validation:
 *   - heal/revive: requires targetBug
 *   - revive: bug must be fainted
 *   - trap: no validation
 * - Removes from inventory
 * - Persists automatically
 * - Returns: ItemUseResult { success, message, quantityRemaining }
 * 
 * removeItem(itemId: string, amount: number)
 * - Force remove items
 * - Does not persist automatically (use carefully)
 * - Used for admin/debug operations
 * - Returns: void
 * 
 * getItemQuantity(itemId: string)
 * - Query item quantity
 * - Returns 0 if not owned
 * - Instant (no async)
 * - Returns: number
 * 
 * getInventorySummary()
 * - Get all owned items
 * - Returns: InventorySlot[]
 * 
 * clearInventory()
 * - Wipe entire inventory (debug only)
 * - Clears AsyncStorage
 * - Returns: void
 */

// ============================================================================
// 4. USAGE EXAMPLES
// ============================================================================

/**
 * Example 1: Basic Item Management
 * 
 * import { useInventory } from '@/contexts/InventoryContext';
 * import { BUG_TRAP } from '@/constants/Items';
 * 
 * function MyComponent() {
 *   const { addItem, getItemQuantity } = useInventory();
 * 
 *   const givePlayerTrap = async () => {
 *     await addItem(BUG_TRAP.id, 1);
 *     const qty = getItemQuantity(BUG_TRAP.id);
 *     console.log(`You have ${qty} Bug Traps`);
 *   };
 * 
 *   return <Button onPress={givePlayerTrap} title="Give Bug Trap" />;
 * }
 */

/**
 * Example 2: Using Items in Battle
 * 
 * const { useItem } = useInventory();
 * 
 * const handleUsePotion = async (targetBug: Bug) => {
 *   const result = await useItem(POTION.id, targetBug);
 *   
 *   if (result.success) {
 *     // Apply healing effect to targetBug
 *     targetBug.currentHp += POTION.effect.healAmount;
 *     console.log(`${POTION.name} used! ${result.quantityRemaining} remaining.`);
 *   } else {
 *     console.error(result.message);
 *   }
 * };
 */

/**
 * Example 3: Displaying Inventory
 * 
 * import { getItemDefinition } from '@/constants/Items';
 * 
 * function InventoryList() {
 *   const { inventory } = useInventory();
 * 
 *   return (
 *     <ScrollView>
 *       {inventory.map(slot => {
 *         const itemDef = getItemDefinition(slot.itemId);
 *         return (
 *           <ItemCard
 *             key={slot.itemId}
 *             name={itemDef.name}
 *             quantity={slot.quantity}
 *             type={itemDef.type}
 *           />
 *         );
 *       })}
 *     </ScrollView>
 *   );
 * }
 */

/**
 * Example 4: Quest Rewards
 * 
 * const completeQuest = async (questReward: ItemReward[]) => {
 *   for (const reward of questReward) {
 *     await addItem(reward.itemId, reward.quantity);
 *   }
 *   console.log('Quest reward received!');
 * };
 * 
 * // Usage:
 * completeQuest([
 *   { itemId: BUG_TRAP.id, quantity: 3 },
 *   { itemId: POTION.id, quantity: 2 },
 * ]);
 */

// ============================================================================
// 5. EXTENSION POINTS (For Future Features)
// ============================================================================

/**
 * Adding New Item Types:
 * 
 * 1. Add type to ItemType enum in types/Item.ts
 *    export type ItemType = 'trap' | 'heal' | 'revive' | 'NEW_TYPE';
 * 
 * 2. Add effect fields to ItemEffect interface
 *    export interface ItemEffect {
 *      // ... existing fields
 *      newTypeParameter?: number;
 *    }
 * 
 * 3. Create item definition in constants/Items.ts
 *    export const NEW_ITEM: ItemDefinition = { ... };
 * 
 * 4. Add to ITEM_CATALOG
 *    [NEW_ITEM.id]: NEW_ITEM,
 * 
 * 5. Add validation logic in InventoryContext.useItem()
 *    if (itemDef.type === 'NEW_TYPE') {
 *      // New type validation
 *    }
 * 
 * 6. Add UI in relevant game screens
 */

/**
 * Adding Item Rarity Features:
 * 
 * Items already have optional rarity field:
 *   common | uncommon | rare | epic
 * 
 * To implement rarity-based features:
 * 1. Use getItemsByType() to filter items
 * 2. Sort/display by rarity
 * 3. Add rarity-based drop rates in rewards
 * 4. Use for UI theming (colors, icons, etc.)
 */

/**
 * Implementing Shop/Store:
 * 
 * 1. Create shop context similar to InventoryContext
 * 2. Track player currency (separate from items)
 * 3. For each shop item:
 *    - Define price
 *    - Link to item definition
 *    - Call addItem() on purchase
 * 
 * 4. Implement vendor UI
 */

/**
 * Implementing Item Crafting:
 * 
 * 1. Define recipes as data structure:
 *    {
 *      result: { itemId, quantity },
 *      ingredients: [
 *        { itemId: POTION.id, quantity: 2 },
 *        { itemId: BUG_TRAP.id, quantity: 1 },
 *      ]
 *    }
 * 
 * 2. Implement craft function:
 *    - Validate all ingredients owned
 *    - Remove ingredients
 *    - Add result item
 *    - Persist
 */

// ============================================================================
// 6. VALIDATION RULES
// ============================================================================

/**
 * Quantity Rules:
 * - Cannot add 0 or negative items → warning logged, action skipped
 * - Cannot exceed stack limit → capped at limit, warning logged
 * - Cannot use item with 0 quantity → validation error, failure returned
 * - Empty slots automatically removed from inventory
 */

/**
 * Item-Type Specific Rules:
 * 
 * TRAP (bug_trap):
 *   - No target required
 *   - No validation beyond quantity check
 *   - Effect: Adds to catch rate
 * 
 * HEAL (potion, super_potion):
 *   - Target bug required
 *   - Target must be alive (currentHp > 0)
 *   - Effect: Increases currentHp (capped at maxHp)
 * 
 * REVIVE (revive_seed, full_revive):
 *   - Target bug required
 *   - Target MUST be fainted (currentHp === 0)
 *   - Effect: Restores HP and removes fainted status
 */

/**
 * Persistence Rules:
 * - Automatically saves after addItem()
 * - Automatically saves after useItem() (if successful)
 * - Automatically saves after removeItem()
 * - Automatically loads from AsyncStorage on app start
 * - Manual clearInventory() wipes all
 */

/**
 * Error Handling:
 * - All errors logged to console with ❌ prefix
 * - Validation errors return failure in ItemUseResult
 * - Persistence errors caught and error state set
 * - Loading state managed during AsyncStorage operations
 */

// ============================================================================
// END DOCUMENTATION
// ============================================================================

export const ITEM_SYSTEM_DOCS = 'See comments above for full documentation';
