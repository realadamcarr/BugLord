/**
 * ITEM SYSTEM - INTEGRATION GUIDE FOR HIVE MODE
 * 
 * Step-by-step instructions for wiring the item system into Hive Mode battles.
 * This is template code - adapt to your Hive Mode implementation.
 */

import { useInventory } from '@/contexts/InventoryContext';
import {
  BUG_TRAP,
  POTION,
  SUPER_POTION,
  REVIVE_SEED,
  FULL_REVIVE,
  getItemDefinition,
} from '@/constants/Items';
import { Bug } from '@/types/Bug';
import { ItemUseResult } from '@/types/Item';

// ============================================================================
// STEP 1: IMPORT ITEMS & HOOK
// ============================================================================

/*
At the top of your Hive Mode component:

import { useInventory } from '@/contexts/InventoryContext';
import { BUG_TRAP, POTION, REVIVE_SEED, getItemDefinition } from '@/constants/Items';

Then in your component:

const { useItem, getItemQuantity } = useInventory();
*/

// ============================================================================
// STEP 2: DISPLAY AVAILABLE ITEMS IN BATTLE UI
// ============================================================================

export interface BattleItemUIProps {
  playerBug: Bug;
  enemyBug: Bug;
  onItemUsed: (itemId: string, result: ItemUseResult) => void;
  disabled?: boolean;
}

export function BattleItemButtons({ playerBug, enemyBug, onItemUsed, disabled = false }: BattleItemUIProps) {
  const { getItemQuantity } = useInventory();

  // Only show items the player owns
  const hasPotion = getItemQuantity(POTION.id) > 0;
  const hasSuperPotion = getItemQuantity(SUPER_POTION.id) > 0;
  const hasRevive = getItemQuantity(REVIVE_SEED.id) > 0;

  // Simple layout: show 3 buttons for available items
  return (
    <>
      {hasPotion && (
        <BattleItemButton
          itemId={POTION.id}
          label={`Potion (${getItemQuantity(POTION.id)})`}
          onPress={async () => {
            const result = await useItemInBattle(POTION.id, playerBug);
            onItemUsed(POTION.id, result.result);
          }}
          disabled={disabled || playerBug.currentHp <= 0}
        />
      )}

      {hasSuperPotion && (
        <BattleItemButton
          itemId={SUPER_POTION.id}
          label={`Super Potion (${getItemQuantity(SUPER_POTION.id)})`}
          onPress={async () => {
            const result = await useItemInBattle(SUPER_POTION.id, playerBug);
            onItemUsed(SUPER_POTION.id, result.result);
          }}
          disabled={disabled || playerBug.currentHp <= 0}
        />
      )}

      {hasRevive && (
        <BattleItemButton
          itemId={REVIVE_SEED.id}
          label={`Revive (${getItemQuantity(REVIVE_SEED.id)})`}
          onPress={async () => {
            const result = await useItemInBattle(REVIVE_SEED.id, playerBug);
            onItemUsed(REVIVE_SEED.id, result.result);
          }}
          disabled={disabled || playerBug.currentHp > 0}
        />
      )}
    </>
  );
}

// ============================================================================
// STEP 3: HANDLE ITEM USAGE IN BATTLE
// ============================================================================

export interface ItemUseInBattleResult {
  success: boolean;
  result: ItemUseResult;
  gameEffect?: {
    hpRestored?: number;
    bugRevived?: boolean;
    trapApplied?: boolean;
  };
}

/**
 * Core function for using items in battle context
 * Handles:
 * - Validation via useItem() hook
 * - Application of game effects
 * - State updates
 * 
 * @param itemId Item to use
 * @param targetBug Bug to apply effect to
 * @returns Success status and applied effects
 */
export async function useItemInBattle(
  itemId: string,
  targetBug: Bug
): Promise<ItemUseInBattleResult> {
  const { useItem } = useInventory();

  // Step 1: Consume item from inventory (with validation)
  const useResult = await useItem(itemId, targetBug);

  if (!useResult.success) {
    return {
      success: false,
      result: useResult,
    };
  }

  // Step 2: Apply game effect based on item type
  const itemDef = getItemDefinition(itemId);
  if (!itemDef) {
    return {
      success: false,
      result: { ...useResult, success: false, message: 'Item not found' },
    };
  }

  const gameEffect: ItemUseInBattleResult['gameEffect'] = {};

  switch (itemDef.type) {
    case 'heal': {
      // HEAL EFFECT
      const healAmount = itemDef.effect.healAmount || 0;
      const oldHp = targetBug.currentHp;
      targetBug.currentHp = Math.min(targetBug.currentHp + healAmount, targetBug.maxHp);
      gameEffect.hpRestored = targetBug.currentHp - oldHp;

      console.log(
        `💊 ${itemDef.name} used! Restored ${gameEffect.hpRestored} HP ` +
        `(${oldHp} → ${targetBug.currentHp})`
      );
      break;
    }

    case 'revive': {
      // REVIVE EFFECT
      const reviveHpPercent = itemDef.effect.reviveHpPercent || 0.5;
      const hpRestored = Math.floor(targetBug.maxHp * reviveHpPercent);
      targetBug.currentHp = hpRestored;
      gameEffect.bugRevived = true;
      gameEffect.hpRestored = hpRestored;

      console.log(
        `🌿 ${itemDef.name} used! ${targetBug.name} revived with ${hpRestored} HP`
      );
      break;
    }

    case 'trap': {
      // TRAP EFFECT
      // Note: Trap affects next catch attempt, not immediate battle effect
      // Store trap state in battle context for later use
      gameEffect.trapApplied = true;

      console.log(`🪤 ${itemDef.name} prepared! Next catch attempt: +${Math.round((itemDef.effect.trapSuccessRate || 0) * 100)}%`);
      break;
    }

    default:
      console.warn(`Unknown item type: ${itemDef.type}`);
  }

  return {
    success: true,
    result: useResult,
    gameEffect,
  };
}

// ============================================================================
// STEP 4: DISPLAY BATTLE LOG MESSAGES
// ============================================================================

export function formatItemUseMessage(itemId: string, result: ItemUseInBattleResult): string {
  if (!result.success) {
    return `❌ ${result.result.message}`;
  }

  const itemDef = getItemDefinition(itemId);
  if (!itemDef) return 'Item used';

  let message = `✅ ${itemDef.name} used`;

  if (result.gameEffect?.hpRestored) {
    message += ` (+${result.gameEffect.hpRestored} HP)`;
  }

  if (result.gameEffect?.bugRevived) {
    message += ` (Bug revived!)`;
  }

  if (result.gameEffect?.trapApplied) {
    message += ` (Ready for next catch)`;
  }

  return message;
}

// ============================================================================
// STEP 5: SAMPLE HIVE MODE COMPONENT INTEGRATION
// ============================================================================

/**
 * Complete example of Hive Mode battle with items
 * (Pseudo-code - adapt to your implementation)
 */
export function HiveModeBattleExample() {
  const { useItem, getItemQuantity } = useInventory();
  const [battleLog, setBattleLog] = React.useState<string[]>([]);
  const [playerBug, setPlayerBug] = React.useState<Bug>(/* ... */);
  const [enemyBug, setEnemyBug] = React.useState<Bug>(/* ... */);

  const handleItemUse = async (itemId: string) => {
    // Use item in battle
    const result = await useItemInBattle(itemId, playerBug);

    // Format message
    const message = formatItemUseMessage(itemId, result);

    // Add to battle log
    setBattleLog(prev => [...prev, message]);

    // Refresh UI
    setPlayerBug({ ...playerBug }); // Trigger re-render

    // Handle special cases
    if (!result.success) {
      console.warn(result.result.message);
    }

    if (result.gameEffect?.trapApplied) {
      // Store trap state in battle context for catch logic
      // storage: battleState.trapActive = true;
    }
  };

  return (
    <View>
      {/* Battle UI */}
      <BattleItemButtons
        playerBug={playerBug}
        enemyBug={enemyBug}
        onItemUsed={(itemId, result) => handleItemUse(itemId)}
        disabled={false}
      />

      {/* Battle Log */}
      <ScrollView>
        {battleLog.map((log, i) => (
          <Text key={i}>{log}</Text>
        ))}
      </ScrollView>
    </View>
  );
}

// ============================================================================
// STEP 6: TRAP MECHANICS (FUTURE)
// ============================================================================

/**
 * When implementing catch mechanics, wire in trap bonus:
 * 
 * function calculateCatchChance(
 *   enemyBug: Bug,
 *   trapActive: boolean
 * ): number {
 *   let baseChance = 0.3; // 30% base
 *   
 *   // Apply trap bonus
 *   if (trapActive) {
 *     const trapBonus = BUG_TRAP.effect.trapSuccessRate || 0;
 *     baseChance += trapBonus; // Add +25%
 *   }
 *   
 *   // Cap at 100%
 *   return Math.min(baseChance, 1.0);
 * }
 */

// ============================================================================
// STEP 7: DEBUG HELPERS
// ============================================================================

/**
 * Console commands for testing (paste in dev tools):
 * 
 * // Check current inventory
 * JSON.parse(localStorage.getItem('INVENTORY_STATE'))
 * 
 * // Add test items
 * await fetch(...).post({action: 'addItem', itemId: 'item_potion', amount: 10})
 * 
 * // Simulate item use
 * await useItemInBattle('item_potion', mockBug)
 */

// ============================================================================
// MIGRATION CHECKLIST
// ============================================================================

/*
Before launching Hive Mode with items:

□ InventoryProvider wrapped in root layout ✓
□ All MVP items defined ✓
□ useInventory() tested in isolation ✓
□ Item usage returns correct ItemUseResult ✓
□ Persistence working (AsyncStorage) ✓
□ Battle UI displays available items
□ Item effect applied correctly to bug state
□ Battle log shows item usage messages
□ Trap bonus applied to catch calculation
□ Empty inventory handled gracefully
□ Error messages user-friendly
□ Console logging for debugging

Future additions:
□ More item types (status effects, stat boosts)
□ Item rarity cosmetics
□ Crafting system
□ Shop system
□ Item durations (temp effects)
□ Item stacking behavior
*/

export const HIVE_MODE_INTEGRATION = 'See above for step-by-step guide';
