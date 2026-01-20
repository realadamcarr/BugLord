/**
 * ITEM SYSTEM - QUICK REFERENCE GUIDE
 * 
 * Fast lookup for common operations
 */

// ============================================================================
// FILE STRUCTURE
// ============================================================================

/*
types/Item.ts
  └─ ItemDefinition, ItemType, ItemEffect, InventorySlot, etc.

constants/Items.ts
  ├─ BUG_TRAP, POTION, SUPER_POTION, REVIVE_SEED, FULL_REVIVE
  ├─ ITEM_CATALOG (lookup by ID)
  ├─ getItemDefinition(id)
  ├─ getItemsByType(type)
  └─ getAllItems()

contexts/InventoryContext.tsx
  ├─ InventoryProvider (wrapper component)
  └─ useInventory() hook (access state/actions)

app/inventory.tsx
  └─ Inventory screen (simple MVP UI)

__tests__/ItemSystemExamples.tsx
  ├─ Test examples (manual reference)
  └─ ItemSystemTestRunner component

ITEM_SYSTEM.md
  └─ Full documentation
*/

// ============================================================================
// COMMON OPERATIONS
// ============================================================================

// 1. ADD ITEMS TO INVENTORY
// ─────────────────────────
import { useInventory } from '@/contexts/InventoryContext';
import { BUG_TRAP, POTION } from '@/constants/Items';

function MyComponent() {
  const { addItem } = useInventory();

  // Add 5 Bug Traps
  await addItem(BUG_TRAP.id, 5);

  // Add 1 Potion
  await addItem(POTION.id, 1);
}

// 2. CHECK ITEM QUANTITY
// ──────────────────────
const { getItemQuantity } = useInventory();

const trapCount = getItemQuantity(BUG_TRAP.id); // Returns: number
if (trapCount > 0) {
  console.log(`You have ${trapCount} traps`);
}

// 3. USE AN ITEM
// ──────────────
const { useItem } = useInventory();

// Use heal item on bug
const result = await useItem(POTION.id, targetBug);
if (result.success) {
  console.log(result.message); // "Used Potion"
  console.log(result.quantityRemaining); // 4
} else {
  console.error(result.message); // e.g., "No Potion available"
}

// 4. GET ALL INVENTORY
// ────────────────────
const { inventory, getInventorySummary } = useInventory();

// Option A: Direct access
inventory.forEach(slot => {
  const itemDef = getItemDefinition(slot.itemId);
  console.log(`${itemDef.name}: ${slot.quantity}`);
});

// Option B: Via getter
const allItems = getInventorySummary();
allItems.forEach(slot => { /* ... */ });

// 5. GET ITEM DEFINITION
// ──────────────────────
import { getItemDefinition } from '@/constants/Items';

const item = getItemDefinition(BUG_TRAP.id);
console.log(item.name); // "Bug Trap"
console.log(item.description); // "Increases catch rate by 25%..."
console.log(item.effect.trapSuccessRate); // 0.25

// 6. FILTER ITEMS BY TYPE
// ───────────────────────
import { getItemsByType } from '@/constants/Items';

const healItems = getItemsByType('heal'); // [POTION, SUPER_POTION]
const traps = getItemsByType('trap'); // [BUG_TRAP]
const revives = getItemsByType('revive'); // [REVIVE_SEED, FULL_REVIVE]

// ============================================================================
// MVP ITEMS AT A GLANCE
// ============================================================================

/*
┌─ BUG_TRAP ─────────────────────────────────┐
│ Type: trap                                  │
│ Effect: +25% catch success rate             │
│ Stack: 99                                   │
│ Use: In Hive Mode battle                    │
└─────────────────────────────────────────────┘

┌─ POTION ───────────────────────────────────┐
│ Type: heal                                  │
│ Effect: Restore 25 HP                       │
│ Stack: 99                                   │
│ Use: Heal any living bug                    │
└─────────────────────────────────────────────┘

┌─ SUPER_POTION ─────────────────────────────┐
│ Type: heal                                  │
│ Effect: Restore 50 HP                       │
│ Stack: 99                                   │
│ Use: Heal any living bug                    │
└─────────────────────────────────────────────┘

┌─ REVIVE_SEED ──────────────────────────────┐
│ Type: revive                                │
│ Effect: Revive with 50% HP                  │
│ Stack: 99                                   │
│ Use: Revive fainted bugs                    │
└─────────────────────────────────────────────┘

┌─ FULL_REVIVE ──────────────────────────────┐
│ Type: revive                                │
│ Effect: Revive with 100% HP                 │
│ Stack: 50 (rare - limited quantity)         │
│ Use: Revive fainted bugs                    │
└─────────────────────────────────────────────┘
*/

// ============================================================================
// VALIDATION RULES CHEAT SHEET
// ============================================================================

/*
TRAP items:
  ✓ Always usable if quantity > 0
  ✗ No target required
  ✗ No other validation

HEAL items (Potion, Super Potion):
  ✓ Need target bug
  ✓ Target must be alive (currentHp > 0)
  ✗ Cannot use on fainted bugs
  ✗ Cannot use without target

REVIVE items (Revive Seed, Full Revive):
  ✓ Need target bug
  ✓ Target MUST be fainted (currentHp === 0)
  ✗ Cannot use on living bugs
  ✗ Cannot use without target
*/

// ============================================================================
// SETUP CHECKLIST
// ============================================================================

/*
✓ InventoryProvider wrapped in app/_layout.tsx
✓ All items defined in constants/Items.ts
✓ AsyncStorage persistence automatic
✓ useInventory() hook available everywhere
✓ Item definitions immutable and extensible
✓ Validation logic centralized in context
✓ Console logging for debugging
✓ No Hive Mode UI yet (just foundation)
*/

// ============================================================================
// TESTING WITH ItemSystemTestRunner
// ============================================================================

/*
How to use the test component:

1. Import in a dev/debug screen:
   import { ItemSystemTestRunner } from '@/__tests__/ItemSystemExamples';

2. Mount component:
   <ItemSystemTestRunner />

3. Tap buttons to run tests
4. Check console output for detailed results
5. Alerts show success/failure

Tests included:
  - Basic item management (add, check qty, remove)
  - Stack limits enforcement
  - Item usage validation
  - Persistence across sessions
  - Inventory queries
*/

// ============================================================================
// COMMON PATTERNS
// ============================================================================

// Pattern 1: Quest Reward
export async function rewardQuest(
  itemRewards: Array<{ itemId: string; quantity: number }>
) {
  const { addItem } = useInventory();
  for (const reward of itemRewards) {
    await addItem(reward.itemId, reward.quantity);
  }
}

// Pattern 2: Battle Item Usage
export async function useItemInBattle(
  itemId: string,
  targetBug: Bug
): Promise<boolean> {
  const { useItem } = useInventory();
  const result = await useItem(itemId, targetBug);
  
  if (result.success) {
    // Apply game effect based on item type
    const itemDef = getItemDefinition(itemId);
    switch (itemDef?.type) {
      case 'heal':
        targetBug.currentHp += itemDef.effect.healAmount || 0;
        break;
      case 'revive':
        targetBug.currentHp = Math.floor(
          targetBug.maxHp * (itemDef.effect.reviveHpPercent || 0.5)
        );
        break;
      case 'trap':
        // Trap modifies next catch attempt (handled elsewhere)
        break;
    }
    return true;
  }
  return false;
}

// Pattern 3: Shop Purchase
export async function purchaseFromShop(
  itemId: string,
  quantity: number
): Promise<boolean> {
  // Check player currency (separate system)
  const cost = getItemCost(itemId) * quantity;
  if (playerCurrency < cost) {
    console.log('Not enough currency');
    return false;
  }

  // Deduct currency
  playerCurrency -= cost;

  // Add item
  const { addItem } = useInventory();
  await addItem(itemId, quantity);

  return true;
}

// ============================================================================
// DEBUGGING
// ============================================================================

// View all inventory in console
const { inventory } = useInventory();
console.table(
  inventory.map(slot => ({
    item: getItemDefinition(slot.itemId)?.name,
    quantity: slot.quantity,
    stack: getItemDefinition(slot.itemId)?.stackLimit,
  }))
);

// Check specific item
console.log(getItemDefinition(BUG_TRAP.id));

// Get item counts
const { getInventorySummary } = useInventory();
const summary = getInventorySummary();
console.log(`Total item types: ${summary.length}`);
console.log(
  `Total items: ${summary.reduce((sum, s) => sum + s.quantity, 0)}`
);

// ============================================================================
// NEXT STEPS (Not Implemented)
// ============================================================================

/*
When ready to build on this foundation:

1. HIVE MODE INTEGRATION
   - Create HiveModeContext for battle state
   - Wire useItem() to apply effects
   - Implement trap mechanics

2. SHOP SYSTEM
   - Define shop items and prices
   - Create shop UI
   - Handle currency/transactions

3. CRAFTING SYSTEM
   - Define recipes
   - Implement combine/craft logic
   - Create craft UI

4. LOOT/DROPS
   - Define item drop tables
   - Assign to enemies/quests
   - Create reward UI

5. EQUIPMENT (future)
   - Add equipment item type
   - Create equipment slot system
   - Implement equip/unequip logic
*/

export const QUICK_REFERENCE = 'See comments for quick lookup';
